"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMotionValueEvent, useScroll } from "motion/react";
import { ArrowRight, ArrowUpRight, Check, FileSearch, FlaskConical, ShieldCheck, X } from "lucide-react";
import { buttonVariants } from "@/components/site/button";
import { SiteNav } from "@/components/site/nav";
import { SiteFooter } from "@/components/site/footer";
import { Reveal, SmoothScroll } from "@/components/site/motion";
import { HOOKGUARD_DEVNET, REPO, SDK_ISSUE } from "@/components/site/brand";
import { FieldData, heroProgress, smooth, stageOf } from "./story";

const loadField = () => import("./field");
if (typeof window !== "undefined") void loadField();
const Field = dynamic(loadField, { ssr: false });

export interface LandingData {
  field: FieldData;
  pools: number;
  curve: number;
  graduated: number;
  hookPrograms: number;
  upgradeablePct: number;
  withMintAuthority: number;
  byStatus: { open: number; gated: number; sellBlocked: number; frozen: number };
  closed: { hooks: number; coins: number; sol: string };
  sharedKeyMax: number;
  sdk: { sells: number; coins: number };
  quotes: { reason: string; hook: string; coins: number; test: string }[];
  generated: string;
}

const fmt = (n: number) => n.toLocaleString("en-US");

export function Landing({ data }: { data: LandingData }) {
  return (
    <SmoothScroll>
      <SiteNav />
      <main>
        <Hero data={data} />
        <How />
        <Quotes data={data} />
        <Findings data={data} />
        <Guard />
        <Terminals />
        <Faq data={data} />
        <Cta />
      </main>
      <SiteFooter />
    </SmoothScroll>
  );
}

// ---------------------------------------------------------------- hero

function Hero({ data }: { data: LandingData }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [p, setP] = useState(0);
  const [ready, setReady] = useState(false);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    heroProgress.current = v;
    setP(v);
  });
  const stage = stageOf(p);
  const intro = 1 - smooth(0.04, 0.14, p);

  const copy = [
    {
      kicker: "Live census · Solana mainnet",
      title: (
        <>
          <span className="text-primary tabular-nums">{fmt(data.pools)}</span> coins run their own code on every transfer.
        </>
      ),
      body: "Meteora's bonding curve lets a launchpad attach a transfer hook: a program that decides who may buy, when you may sell and where your tokens may go. Jupiter won't route these coins, and nothing on a chart tells you the rules.",
    },
    {
      kicker: "Who sets the rules",
      title: (
        <>
          <span className="text-primary tabular-nums">{fmt(data.hookPrograms)}</span> programs write them.
        </>
      ),
      body: `Each cluster is one hook program. Every coin in it runs that program on every buy, sell and transfer, and ${data.upgradeablePct}% of live coins sit on programs whose owner can rewrite them at any time.`,
    },
    {
      kicker: "What we found",
      title: <>Most of them don&apos;t let you in.</>,
      body: "We simulated an outside buy, a real holder's sell and a plain transfer on the busiest coins of every hook program, against mainnet.",
    },
    {
      kicker: "HookScan",
      title: <>Read the rules before you buy.</>,
      body: "Scan any coin in seconds, trade the ones that let outsiders in, and guard the trade on-chain so it reverts if the hook changes after we checked it.",
    },
  ][stage];

  return (
    <section ref={ref} className="relative -mt-16 h-[320svh]">
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_55%_at_70%_50%,color-mix(in_oklch,var(--primary)_10%,transparent),transparent_70%)]"
        />
        <div className="relative mx-auto grid h-full w-full max-w-6xl items-center gap-8 px-4 pt-16 md:grid-cols-[1fr_1.15fr] md:px-6">
          <div className="relative z-10 flex flex-col items-start gap-5 md:gap-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden />
              {copy.kicker}
            </span>
            <h1
              key={stage}
              className="rise text-[2.1rem] font-semibold leading-[1.06] tracking-tight text-balance sm:text-5xl md:text-[3.4rem]"
            >
              {copy.title}
            </h1>
            <p key={`b${stage}`} className="rise max-w-md text-base leading-7 text-muted-foreground md:text-lg md:leading-8">
              {copy.body}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/app" className={buttonVariants({ size: "lg" })}>
                Launch app <ArrowRight aria-hidden />
              </Link>
              <Link href="#how" className={buttonVariants({ size: "lg", variant: "outline" })}>
                How it works
              </Link>
            </div>
            <StageCard stage={stage} data={data} />
          </div>
          <div className="absolute inset-x-0 bottom-0 top-[40%] opacity-35 md:relative md:inset-auto md:h-[min(84svh,720px)] md:opacity-100">
            <div
              aria-hidden
              className={`pointer-events-none absolute inset-0 grid place-items-center transition-opacity duration-700 ${ready ? "opacity-0" : "opacity-100"}`}
            >
              <div className="aspect-square h-[62%] rounded-full bg-[radial-gradient(circle,rgba(236,230,218,0.16)_1px,transparent_1.6px)] [background-size:10px_10px] [mask-image:radial-gradient(circle,black_45%,transparent_70%)]" />
            </div>
            <div className={`h-full w-full transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}>
              <Field data={data.field} onReady={() => setReady(true)} />
            </div>
          </div>
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-8 hidden flex-col items-center gap-2 text-xs text-muted-foreground md:flex"
          style={{ opacity: intro }}
          aria-hidden
        >
          Scroll through the census
          <span className="h-8 w-px bg-gradient-to-b from-muted-foreground to-transparent" />
        </div>
      </div>
    </section>
  );
}

function StageCard({ stage, data }: { stage: number; data: LandingData }) {
  const b = data.byStatus;
  const cells: [string, string, string][] =
    stage === 0
      ? [
          [fmt(data.pools), "hook coins", "text-foreground"],
          [fmt(data.curve), "Jupiter can't route", "text-foreground"],
          [fmt(data.graduated), "graduated, hook gone", "text-blue"],
        ]
      : stage === 1
        ? [
            [fmt(data.hookPrograms), "hook programs", "text-foreground"],
            [`${data.upgradeablePct}%`, "can be rewritten", "text-primary"],
            [fmt(data.withMintAuthority), "mint still open", "text-red"],
          ]
        : [
            [fmt(b.open), "open to anyone", "text-green"],
            [fmt(b.gated + b.sellBlocked), "gated or sell-blocked", "text-primary"],
            [fmt(b.frozen), "frozen", "text-red"],
          ];
  return (
    <div className="mt-1 flex w-full max-w-md flex-col gap-3">
      <ol className="flex items-center gap-2 text-xs" aria-label="Census progress">
        {["Coins", "Hooks", "Verdicts", "Scan"].map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`grid size-5 place-items-center rounded-full border font-mono text-[10px] transition-colors duration-300 ${
                i < stage
                  ? "border-primary bg-primary text-primary-foreground"
                  : i === stage
                    ? "border-primary text-primary"
                    : "border-border text-muted-foreground"
              }`}
            >
              {i + 1}
            </span>
            <span className={i === stage ? "text-foreground" : "text-muted-foreground"}>{label}</span>
            {i < 3 && <span className={`h-px w-5 transition-colors duration-300 ${i < stage ? "bg-primary" : "bg-border"}`} aria-hidden />}
          </li>
        ))}
      </ol>
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border text-sm" aria-live="polite">
        {cells.map(([v, l, tone]) => (
          <div key={l} className="flex flex-col gap-1 bg-card/80 p-4 backdrop-blur">
            <span className={`text-2xl font-medium tabular-nums ${tone}`}>{v}</span>
            <span className="text-xs leading-4 text-muted-foreground">{l}</span>
          </div>
        ))}
        {stage >= 2 && (
          <div className="col-span-3 flex flex-wrap gap-x-4 gap-y-1 bg-card/80 px-4 py-2.5 text-xs text-muted-foreground backdrop-blur">
            {[
              ["bg-green", "open"],
              ["bg-primary", "gated"],
              ["bg-red", "sell-blocked"],
              ["bg-[#7a2a22]", "frozen"],
              ["bg-blue", "graduated"],
            ].map(([c, l]) => (
              <span key={l} className="flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${c}`} aria-hidden />
                {l}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- sections

function Section({
  id,
  kicker,
  title,
  lead,
  children,
}: {
  id?: string;
  kicker: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-24 md:px-6">
      <Reveal className="mb-12 flex max-w-2xl flex-col gap-3">
        <p className="text-sm font-medium text-primary">{kicker}</p>
        <h2 className="text-3xl font-semibold tracking-tight text-balance md:text-4xl">{title}</h2>
        {lead && <p className="text-lg leading-8 text-muted-foreground">{lead}</p>}
      </Reveal>
      {children}
    </section>
  );
}

function How() {
  const steps = [
    {
      icon: FileSearch,
      title: "Read the code",
      body: "For every hook program we pull the rule messages compiled into its binary and the error messages in its on-chain IDL, and check who holds the upgrade key and when it was last redeployed.",
      eg: '"SPEC: sells are locked until the unlock time"',
    },
    {
      icon: FlaskConical,
      title: "Test it live",
      body: "Three simulations against mainnet, nothing sent: a buy from a wallet the launchpad has never seen, a sell by the largest real holder, and a transfer to a fresh wallet.",
      eg: "buy ✓  ·  sell ✕  ·  transfer ✓",
    },
    {
      icon: ShieldCheck,
      title: "Guard the trade",
      body: "hookguard, our on-chain program, pins the verdict to the exact build of the hook. Add one instruction to a swap and it reverts if the hook was redeployed since we tested it.",
      eg: "assert_hook → HookChanged",
    },
  ];
  return (
    <Section
      id="how"
      kicker="How it works"
      title="Three checks before you trade a hook coin"
      lead="A verdict you can trace back to the hook's own code and a real simulation, not a score."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {steps.map((s, i) => (
          <Reveal key={s.title} delay={i * 0.08} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <span className="grid size-10 place-items-center rounded-xl border border-border bg-muted text-primary">
                <s.icon className="size-5" aria-hidden />
              </span>
              <span className="font-mono text-xs text-ink-3">0{i + 1}</span>
            </div>
            <h3 className="text-lg font-medium">{s.title}</h3>
            <p className="text-sm leading-6 text-muted-foreground">{s.body}</p>
            <code className="mt-auto rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-ink-2">{s.eg}</code>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

function Quotes({ data }: { data: LandingData }) {
  return (
    <Section
      kicker="In their own words"
      title="What the hooks told our test wallets"
      lead="Each line is the exact message a hook returned on mainnet when our simulated buyer, seller or sender was refused."
    >
      <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {data.quotes.slice(0, 12).map((q) => (
          <div key={q.reason} className="flex flex-col justify-between gap-4 bg-background p-5">
            <q className="font-mono text-[13px] leading-relaxed text-foreground">{q.reason}</q>
            <span className="flex items-center justify-between text-xs text-ink-3">
              <span>
                {q.hook} · {fmt(q.coins)} coins
              </span>
              <span>refused a {q.test}</span>
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Findings({ data }: { data: LandingData }) {
  const items = [
    {
      n: fmt(data.curve),
      title: "coins Jupiter can't trade",
      body: "While a coin is on the curve, Jupiter answers TOKEN_NOT_TRADABLE. The only way in is the app that launched it, or HookScan for the ones that let outsiders buy.",
    },
    {
      n: `${data.upgradeablePct}%`,
      title: "on hooks that can be rewritten",
      body: `Whoever holds the upgrade key can turn selling off after you buy. One key controls ${data.sharedKeyMax} different hook programs.`,
    },
    {
      n: `${data.closed.sol} SOL`,
      title: "frozen for good",
      body: `${data.closed.hooks} hook programs were closed by their owners. A hook can't be replaced on the curve and DBC can't return reserves before the curve completes, so ${fmt(data.closed.coins)} coins can never move again.`,
    },
    {
      n: fmt(data.sdk.sells),
      title: "sells Meteora's SDK can't make",
      body: `The SDK resolves a hook's accounts with placeholder wallets. Those sells fail through the SDK and go through with HookScan's resolver, across ${fmt(data.sdk.coins)} live coins. Reported upstream.`,
    },
  ];
  return (
    <Section
      id="findings"
      kicker="What the census found"
      title="What a trader can't see from a chart"
      lead={`From the mainnet census of ${data.generated} UTC.`}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((f, i) => (
          <Reveal key={f.title} delay={i * 0.06} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6">
            <span className="text-4xl font-medium tabular-nums text-primary">{f.n}</span>
            <h3 className="text-lg font-medium">{f.title}</h3>
            <p className="text-sm leading-6 text-muted-foreground">{f.body}</p>
          </Reveal>
        ))}
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        SDK bug report:{" "}
        <a href={SDK_ISSUE} target="_blank" rel="noreferrer" className="text-foreground underline underline-offset-4">
          MeteoraAg/dynamic-bonding-curve-sdk#122
        </a>
      </p>
    </Section>
  );
}

function Guard() {
  const rows: [boolean, string, string][] = [
    [true, "set_verdict(open)", "pins deploy slot 453,436,681 and the upgrade key"],
    [true, "guarded buy", "assert_hook + swap2_with_transfer_hook"],
    [false, "hook redeployed, guarded buy", "HookChanged: reverted, nothing spent"],
    [true, "hook redeployed, unguarded buy", "goes through on the new, untested rules"],
    [true, "re-attested, guarded buy", "trades again on the new build"],
  ];
  return (
    <Section
      id="guard"
      kicker="On-chain · hookguard"
      title="A verdict is only true for the build we tested"
      lead="hookguard is a 26 KB Rust program. It reads a hook's deploy slot and upgrade key from the BPF loader itself, pins them to the verdict, and checks them again inside your swap."
    >
      <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
        <Reveal className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-3 text-xs text-muted-foreground">
            <span>Real SPEC.fun pool on a fork of mainnet</span>
            <a href={`${REPO}/blob/main/docs/hookguard-fork-run.txt`} target="_blank" rel="noreferrer" className="hover:text-foreground">
              full log ↗
            </a>
          </div>
          <ul className="divide-y divide-border">
            {rows.map(([ok, what, detail]) => (
              <li key={what} className="flex items-start gap-3 px-5 py-3.5">
                <span
                  className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${ok ? "bg-green-bg text-green" : "bg-red-bg text-red"}`}
                >
                  {ok ? <Check className="size-3" aria-hidden /> : <X className="size-3" aria-hidden />}
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{what}</span>
                  <span className="font-mono text-xs text-muted-foreground">{detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={0.08} className="flex flex-col gap-4">
          <pre className="overflow-x-auto rounded-2xl border border-border bg-card p-5 font-mono text-[12.5px] leading-6 text-ink-2">{`const tx = new Transaction().add(
  assertHookIx(attester, hook, programData, ["open"]),
  ...swapIxs, // swap2_with_transfer_hook
);
// reverts: HookChanged | AuthorityChanged |
//          HookClosed | StatusNotAllowed`}</pre>
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-border bg-border text-center">
            {[
              ["14", "tests pass"],
              ["26 KB", "Pinocchio"],
              ["devnet", "deployed"],
            ].map(([v, l]) => (
              <div key={l} className="bg-card p-4">
                <div className="font-mono text-xl">{v}</div>
                <div className="text-xs text-muted-foreground">{l}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/docs/hookguard" className={buttonVariants({ variant: "outline" })}>
              How it works
            </Link>
            <a href={HOOKGUARD_DEVNET} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "ghost" })}>
              View on devnet <ArrowUpRight aria-hidden />
            </a>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

function Terminals() {
  return (
    <Section
      kicker="For terminals, bots and agents"
      title="One call to know, one call to trade"
      lead="No key. Scan any coin, or get a swap transaction already simulated for the user's wallet with the hook's accounts resolved correctly."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Reveal>
          <pre className="h-full overflow-x-auto rounded-2xl border border-border bg-card p-5 font-mono text-[12.5px] leading-6 text-ink-2">{`GET /api/scan/<mint>

{ "status": "pad-only",
  "headline": "Outside wallets can't buy. The hook says:
     \\"FOMO_REQUIRED: Buying from this curve requires Fomo\\"",
  "tests": { "buy": {...}, "sell": {...}, "transfer": {...} },
  "hook": { "upgradeable": true, "rules": [...] } }`}</pre>
        </Reveal>
        <Reveal delay={0.06}>
          <pre className="h-full overflow-x-auto rounded-2xl border border-border bg-card p-5 font-mono text-[12.5px] leading-6 text-ink-2">{`POST /api/swap
{ "mint": "<MINT>", "owner": "<WALLET>",
  "side": "buy", "amount": "50000000" }

{ "ok": true,
  "transaction": "<base64 v0, unsigned>",
  "expectedOut": "4302615449497",
  "minimumOut":  "4173536986012" }`}</pre>
        </Reveal>
      </div>
      <Link href="/docs/api" className={`${buttonVariants({ variant: "outline" })} mt-6`}>
        API reference <ArrowRight aria-hidden />
      </Link>
    </Section>
  );
}

function Faq({ data }: { data: LandingData }) {
  const qs: [string, string][] = [
    [
      "What is a transfer hook?",
      "A Token-2022 feature: the mint names a program that runs on every transfer and can refuse it. Meteora DBC v0.2.0 added pools for such tokens; while the coin is on the curve the launchpad's hook runs, and DBC revokes it at graduation.",
    ],
    [
      "Does HookScan send transactions when it scans?",
      "No. Every test is a simulation against current mainnet state with signature checks off. Only trades you sign yourself are sent.",
    ],
    [
      "Why can't I buy a Gated coin here?",
      "Its hook refuses buyers who don't come through the launchpad's app (a co-signature, an allowlist, trading hours). HookScan tells you which rule and won't build a trade it knows will fail.",
    ],
    [
      "How fresh is the data?",
      `The census on the home page is from ${data.generated} UTC. Any coin page runs a fresh scan when you open it.`,
    ],
    [
      "Is hookguard on mainnet?",
      "It is deployed on devnet and tested against real mainnet pools on a fork. Mainnet deployment is one command and about 0.19 SOL of rent.",
    ],
  ];
  return (
    <Section kicker="FAQ" title="Questions">
      <div className="divide-y divide-border rounded-2xl border border-border">
        {qs.map(([q, a]) => (
          <details key={q} className="group px-6 py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
              {q}
              <span className="text-muted-foreground transition-transform group-open:rotate-45" aria-hidden>
                +
              </span>
            </summary>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

function Cta() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-24 md:px-6">
      <Reveal className="flex flex-col items-start gap-6 rounded-3xl border border-border bg-[radial-gradient(70%_120%_at_0%_0%,color-mix(in_oklch,var(--primary)_14%,var(--card)),var(--card))] p-8 md:flex-row md:items-center md:justify-between md:p-12">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-semibold tracking-tight">Paste a mint. Know the rules.</h2>
          <p className="text-muted-foreground">Every Meteora transfer-hook coin, scanned live on mainnet.</p>
        </div>
        <Link href="/app" className={buttonVariants({ size: "lg" })}>
          Launch app <ArrowRight aria-hidden />
        </Link>
      </Reveal>
    </section>
  );
}
