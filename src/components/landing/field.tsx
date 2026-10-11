"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FieldData, STATUS_COLORS, heroProgress, smooth } from "./story";

// Deterministic pseudo-random so the field looks the same on every load.
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
  return [rad * s * Math.cos(t), rad * u, rad * s * Math.sin(t)];
}

const vertex = /* glsl */ `
  attribute vec3 aCloud;
  attribute vec3 aCluster;
  attribute vec3 aColor;
  attribute float aSeed;
  attribute float aFrozen;
  uniform float uMix;
  uniform float uColor;
  uniform float uFrozen;
  uniform float uTime;
  uniform float uPixel;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float m = smoothstep(0.0, 1.0, clamp(uMix * 1.15 - aSeed * 0.15, 0.0, 1.0));
    vec3 p = mix(aCloud, aCluster, m);
    // breathing drift, stronger while scattered
    float w = 0.035 + 0.05 * (1.0 - m);
    p += w * vec3(sin(uTime * 0.7 + aSeed * 40.0), cos(uTime * 0.6 + aSeed * 31.0), sin(uTime * 0.5 + aSeed * 23.0));
    // frozen coins sink and darken once verdicts are shown
    p.y -= aFrozen * uFrozen * (0.35 + aSeed * 0.5);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uPixel * (0.8 + 0.9 * aSeed) / -mv.z;
    vec3 neutral = vec3(0.86, 0.82, 0.74);
    vColor = mix(neutral, aColor, uColor);
    vAlpha = mix(0.5, 0.75, uColor) * (1.0 - 0.6 * aFrozen * uFrozen);
  }
`;

const fragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor * (0.75 + 0.5 * core), vAlpha * core);
  }
`;

function Points({ data }: { data: FieldData }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const group = useRef<THREE.Group>(null);

  const geometry = useMemo(() => {
    const n = data.hook.length;
    const cloud = new Float32Array(n * 3);
    const cluster = new Float32Array(n * 3);
    const color = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    const frozen = new Float32Array(n);

    // Hook programs on a golden-angle spiral disc: the biggest program is the core, smaller ones orbit outward.
    const k = data.sizes.length;
    const max = Math.max(...data.sizes);
    const golden = Math.PI * (3 - Math.sqrt(5));
    const jitter = rng(11);
    const centers = data.sizes.map((_, i) => {
      if (i === 0) return [0, 0, 0] as const;
      const rr = 0.95 + 1.85 * Math.sqrt(i / k);
      const a = i * golden;
      return [Math.cos(a) * rr, (jitter() - 0.5) * 0.55, Math.sin(a) * rr] as const;
    });
    const radius = data.sizes.map((s) => 0.05 + 0.5 * Math.sqrt(s / max));

    const r = rng(7);
    const palette = STATUS_COLORS.map((c) => new THREE.Color(c));
    for (let i = 0; i < n; i++) {
      const [ax, ay, az] = inBall(r, 2.7);
      cloud.set([ax, ay * 0.85, az], i * 3);
      const h = data.hook[i];
      const [bx, by, bz] = inBall(r, radius[h]);
      cluster.set([centers[h][0] + bx, centers[h][1] + by, centers[h][2] + bz], i * 3);
      const c = palette[data.status[i]] ?? palette[5];
      color.set([c.r, c.g, c.b], i * 3);
      seed[i] = r();
      frozen[i] = data.status[i] === 4 ? 1 : 0;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(cluster, 3));
    g.setAttribute("aCloud", new THREE.BufferAttribute(cloud, 3));
    g.setAttribute("aCluster", new THREE.BufferAttribute(cluster, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    g.setAttribute("aFrozen", new THREE.BufferAttribute(frozen, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);
    return g;
  }, [data]);

  const uniforms = useMemo(
    () => ({ uMix: { value: 0 }, uColor: { value: 0 }, uFrozen: { value: 0 }, uTime: { value: 0 }, uPixel: { value: 1 } }),
    [],
  );

  useFrame((state, dt) => {
    const p = heroProgress.current;
    const u = mat.current!.uniforms;
    const ease = 1 - Math.exp(-dt * 5);
    u.uMix.value += (smooth(0.12, 0.46, p) - u.uMix.value) * ease;
    u.uColor.value += (smooth(0.5, 0.66, p) - u.uColor.value) * ease;
    u.uFrozen.value += (smooth(0.64, 0.78, p) - u.uFrozen.value) * ease;
    u.uTime.value = state.clock.elapsedTime;
    u.uPixel.value = state.viewport.dpr * state.size.height * 0.032;
    group.current!.rotation.y += dt * (0.05 + 0.04 * (1 - u.uMix.value));
    group.current!.rotation.x = 0.18 + 0.32 * u.uMix.value + 0.06 * Math.sin(state.clock.elapsedTime * 0.15);
  });

  return (
    <group ref={group}>
      <points geometry={geometry}>
        <shaderMaterial
          ref={mat}
          vertexShader={vertex}
          fragmentShader={fragment}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

export default function FieldCanvas({ data, onReady }: { data: FieldData; onReady?: () => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  // Stop rendering when the hero is off screen.
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    if (wrap.current) io.observe(wrap.current);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={wrap} className="h-full w-full">
      <Canvas
        frameloop={visible ? "always" : "never"}
        dpr={[1, 2]}
        camera={{ position: [0, 0, 6.1], fov: 45 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onCreated={() => requestAnimationFrame(() => requestAnimationFrame(() => onReady?.()))}
      >
        <Points data={data} />
      </Canvas>
    </div>
  );
}
