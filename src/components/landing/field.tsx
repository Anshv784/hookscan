"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { FieldData, STATUS_COLORS } from "./story";

// Deterministic pseudo-random so the system looks the same on every load.
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

function inBall(r: () => number, radius: number): [number, number, number] {
  const u = r() * 2 - 1;
  const t = r() * Math.PI * 2;
  const rad = radius * Math.cbrt(r());
  const s = Math.sqrt(1 - u * u);
  return [rad * s * Math.cos(t), rad * u * 0.6, rad * s * Math.sin(t)];
}

/**
 * Every coin is a point. Its hook program is a cluster orbiting the core (the biggest program);
 * inner clusters orbit faster. On load the coins fall in from a wide cloud into their orbits.
 */
const vertex = /* glsl */ `
  attribute vec3 aStart;
  attribute vec3 aLocal;
  attribute vec3 aColor;
  attribute float aOrbitR;
  attribute float aOrbitA;
  attribute float aOrbitY;
  attribute float aSeed;
  attribute float aFrozen;
  uniform float uTime;
  uniform float uIntro;
  uniform float uPixel;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float speed = 0.16 / pow(max(aOrbitR, 0.6), 1.5);
    float a = aOrbitA + uTime * speed;
    vec3 center = vec3(cos(a) * aOrbitR, aOrbitY, sin(a) * aOrbitR);
    float s = uTime * (0.25 + aSeed * 0.2);
    vec3 local = vec3(aLocal.x * cos(s) - aLocal.z * sin(s), aLocal.y, aLocal.x * sin(s) + aLocal.z * cos(s));
    vec3 orbit = center + local;
    orbit.y -= aFrozen * (0.18 + 0.25 * aSeed);
    float t = smoothstep(0.0, 1.0, clamp(uIntro * 1.35 - aSeed * 0.35, 0.0, 1.0));
    vec3 p = mix(aStart, orbit, t);
    p += 0.02 * vec3(sin(uTime * 0.9 + aSeed * 50.0), cos(uTime * 0.7 + aSeed * 37.0), sin(uTime * 0.6 + aSeed * 21.0));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uPixel * (0.7 + 1.0 * aSeed) / -mv.z;
    vColor = mix(vec3(0.85, 0.84, 1.0), aColor, t);
    vAlpha = (0.35 + 0.55 * t) * (1.0 - 0.45 * aFrozen);
  }
`;

const fragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor * (0.7 + 0.6 * core), vAlpha * core);
  }
`;

const coreVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const coreFragment = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  void main() {
    vec2 c = vUv - 0.5;
    float d = length(c);
    float a = atan(c.y, c.x);
    vec3 yellow = vec3(0.96, 0.74, 0.0);
    vec3 orange = vec3(0.96, 0.29, 0.0);
    vec3 violet = vec3(0.43, 0.27, 1.0);
    vec3 col = mix(yellow, orange, smoothstep(0.0, 0.12, d));
    col = mix(col, violet, smoothstep(0.1, 0.42, d + 0.03 * sin(a * 3.0 + uTime * 0.6)));
    float glow = exp(-d * 9.0) * 1.4 + exp(-d * 3.2) * 0.35;
    gl_FragColor = vec4(col * glow, glow * smoothstep(0.5, 0.25, d));
  }
`;

function System({ data }: { data: FieldData }) {
  const points = useRef<THREE.ShaderMaterial>(null);
  const core = useRef<THREE.ShaderMaterial>(null);
  const group = useRef<THREE.Group>(null);
  const { viewport, size } = useThree();
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const on = (e: PointerEvent) => {
      pointer.current = { x: (e.clientX / window.innerWidth) * 2 - 1, y: (e.clientY / window.innerHeight) * 2 - 1 };
    };
    window.addEventListener("pointermove", on, { passive: true });
    return () => window.removeEventListener("pointermove", on);
  }, []);

  const { geometry, rings } = useMemo(() => {
    const n = data.hook.length;
    const k = data.sizes.length;
    const max = Math.max(...data.sizes);
    const golden = Math.PI * (3 - Math.sqrt(5));
    const jr = rng(11);
    const orbits = data.sizes.map((_, i) =>
      i === 0 ? { r: 0, a: 0, y: 0 } : { r: 1.0 + 2.1 * Math.sqrt(i / k), a: i * golden, y: (jr() - 0.5) * 0.28 },
    );
    const radius = data.sizes.map((s, i) => (i === 0 ? 0.42 : 0.04 + 0.42 * Math.sqrt(s / max)));

    const start = new Float32Array(n * 3);
    const local = new Float32Array(n * 3);
    const color = new Float32Array(n * 3);
    const oR = new Float32Array(n);
    const oA = new Float32Array(n);
    const oY = new Float32Array(n);
    const seed = new Float32Array(n);
    const frozen = new Float32Array(n);
    const r = rng(7);
    const palette = STATUS_COLORS.map((c) => new THREE.Color(c));
    for (let i = 0; i < n; i++) {
      const h = data.hook[i];
      const [sx, sy, sz] = inBall(r, 7);
      start.set([sx, sy * 1.6, sz], i * 3);
      const [lx, ly, lz] = inBall(r, radius[h]);
      local.set([lx, ly, lz], i * 3);
      oR[i] = orbits[h].r;
      oA[i] = orbits[h].a;
      oY[i] = orbits[h].y;
      const c = palette[data.status[i]] ?? palette[5];
      color.set([c.r, c.g, c.b], i * 3);
      seed[i] = r();
      frozen[i] = data.status[i] === 4 ? 1 : 0;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(local, 3));
    g.setAttribute("aStart", new THREE.BufferAttribute(start, 3));
    g.setAttribute("aLocal", new THREE.BufferAttribute(local, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
    g.setAttribute("aOrbitR", new THREE.BufferAttribute(oR, 1));
    g.setAttribute("aOrbitA", new THREE.BufferAttribute(oA, 1));
    g.setAttribute("aOrbitY", new THREE.BufferAttribute(oY, 1));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    g.setAttribute("aFrozen", new THREE.BufferAttribute(frozen, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10);
    return { geometry: g, rings: orbits.slice(1, 14).map((o) => o.r) };
  }, [data]);

  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uIntro: { value: 0 }, uPixel: { value: 1 } }), []);
  const coreUniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  // To the right of the copy on wide screens, centered behind it on phones.
  const wide = size.width >= 900;
  const offsetX = wide ? viewport.width * 0.22 : 0;
  const scale = wide ? 1 : 0.7;

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const u = points.current!.uniforms;
    u.uTime.value = t;
    u.uIntro.value = Math.min(1, u.uIntro.value + dt / 2.6);
    u.uPixel.value = state.viewport.dpr * state.size.height * 0.03;
    core.current!.uniforms.uTime.value = t;
    const g = group.current!;
    const ease = 1 - Math.exp(-dt * 2.5);
    g.rotation.x += (0.42 + pointer.current.y * 0.12 - g.rotation.x) * ease;
    g.rotation.z += (-0.12 - pointer.current.x * 0.08 - g.rotation.z) * ease;
    g.rotation.y = t * 0.03;
  });

  return (
    <group position={[offsetX, wide ? 0.1 : -0.6, 0]} scale={scale}>
      <mesh>
        <planeGeometry args={[3.2, 3.2]} />
        <shaderMaterial
          ref={core}
          vertexShader={coreVertex}
          fragmentShader={coreFragment}
          uniforms={coreUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <group ref={group}>
        {rings.map((rad, i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[rad - 0.003, rad + 0.003, 160]} />
            <meshBasicMaterial color="#8a7cff" transparent opacity={0.07} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        ))}
        <points geometry={geometry}>
          <shaderMaterial
            ref={points}
            vertexShader={vertex}
            fragmentShader={fragment}
            uniforms={uniforms}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      </group>
    </group>
  );
}

export default function FieldCanvas({ data, onReady }: { data: FieldData; onReady?: () => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    if (wrap.current) io.observe(wrap.current);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={wrap} className="absolute inset-0">
      <Canvas
        frameloop={visible ? "always" : "never"}
        dpr={[1, 2]}
        camera={{ position: [0, 0, 7], fov: 42 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onCreated={() => requestAnimationFrame(() => requestAnimationFrame(() => onReady?.()))}
      >
        <System data={data} />
      </Canvas>
    </div>
  );
}
