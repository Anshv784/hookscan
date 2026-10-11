"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight, Check, Search, X } from "lucide-react";
import { buttonVariants } from "@/components/site/button";
import { SiteNav } from "@/components/site/nav";
import { SiteFooter } from "@/components/site/footer";
import { Reveal, SmoothScroll } from "@/components/site/motion";
import { HOOKGUARD_DEVNET, REPO, SDK_ISSUE } from "@/components/site/brand";
import { FieldData, STATUS_LEGEND } from "./story";

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
        <Ticker data={data} />
        <How />
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

function HeroScan() {
  const router = useRouter();
  const [v, setV] = useState("");
  const [bad, setBad] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v.trim())) router.push(`/app/coin/${v.trim()}`);
        else setBad(true);
      }}
      className={`flex h-14 w-full max-w-lg items-center gap-2 rounded-2xl border bg-card/80 pl-4 pr-2 backdrop-blur transition-colors focus-within:border-primary ${bad ? "border-red" : "border-border"}`}
    >
      <Search className="size-4 shrink-0 text-ink-3" aria-hidden />
      <input
        value={v}
        onChange={(e) => {
          setV(e.target.value);
          setBad(false);
        }}
        spellCheck={false}
        placeholder="Paste a token mint to read its rules"
        aria-label="Token mint or pool address"
        className="h-full w-full bg-transparent font-mono text-sm outline-none placeholder:font-sans placeholder:text-ink-3"
      />
      <button
        type="submit"
        className="bg-brand h-10 shrink-0 rounded-xl px-4 text-sm font-medium text-white transition-[filter] hover:brightness-110"
      >
        Scan
      </button>
    </form>
  );
}

function Hero({ data }: { data: LandingData }) {
  const [ready, setReady] = useState(false);
  const b = data.byStatus;
  const legend = [b.open, b.gated, b.sellBlocked, b.frozen, data.graduated];
  return (
    <section className="relative -mt-[68px] overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className={`absolute inset-0 transition-opacity duration-1000 ${ready ? "opacity-100" : "opacity-0"}`}>
          <Field data={data.field} onReady={() => setReady(true)} />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--bg)_0%,color-mix(in_oklch,var(--bg)_88%,transparent)_34%,transparent_62%)] max-md:bg-[linear-gradient(180deg,var(--bg)_0%,color-mix(in_oklch,var(--bg)_70%,transparent)_45%,var(--bg)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="relative mx-auto flex min-h-[100svh] w-full max-w-6xl flex-col justify-center px-4 pt-28 pb-10 md:px-6">
        <div className="flex max-w-xl flex-col items-start gap-6">
          <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span className="bg-brand size-1.5 rounded-full" aria-hidden />
            For Meteora DBC transfer-hook coins
          </span>
          <h1 className="text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-6xl md:text-7xl">
            Read the <span className="text-brand">rules</span> before you buy.
          </h1>
          <p className="max-w-md text-base leading-7 text-muted-foreground md:text-lg md:leading-8">
            {fmt(data.pools)} coins on Meteora run their launchpad&apos;s own code on every transfer. It decides who can buy, when you can
            sell, and whether your tokens can move at all. HookScan reads it and tests it on mainnet.
          </p>
          <HeroScan />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <Link href="/app" className="inline-flex items-center gap-1.5 font-medium text-foreground hover:text-primary">
              Explore all {fmt(data.pools)} coins <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link href="#how" className="text-muted-foreground hover:text-foreground">
              How it works
            </Link>
          </div>
        </div>

        <div className="mt-14 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground md:mt-20">
          {STATUS_LEGEND.map(([c, l], i) => (
            <span key={l} className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ background: c, boxShadow: `0 0 10px ${c}` }} aria-hidden />
              <span className="tabular-nums text-foreground">{fmt(legend[i])}</span> {l}
            </span>
          ))}
          <span className="hidden text-ink-3 md:inline">· every dot is a real coin, orbiting the hook program that controls it</span>
        </div>
      </div>

      <div className="relative border-y border-border bg-card/40 backdrop-blur">
        <dl className="mx-auto grid w-full max-w-6xl grid-cols-2 md:grid-cols-4">
          {[
            [fmt(data.curve), "coins Jupiter can't route"],
            [fmt(data.hookPrograms), "hook programs"],
            [`${data.upgradeablePct}%`, "on hooks that can be rewritten"],
            [`${data.closed.sol} SOL`, "frozen for good"],
          ].map(([v, l], i) => (
            <div
              key={l}
              className={`flex flex-col gap-1 px-4 py-6 md:px-6 ${i % 2 ? "border-l border-border" : ""} ${i === 2 ? "md:border-l" : ""}`}
            >
              <dt className="order-2 text-xs text-muted-foreground">{l}</dt>
              <dd className={`order-1 text-2xl font-semibold tracking-tight tabular-nums md:text-3xl ${i === 3 ? "text-brand" : ""}`}>
                {v}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- ticker

function Ticker({ data }: { data: LandingData }) {
  const items = [...data.quotes, ...data.quotes];
  return (
    <section aria-label="Messages hooks returned to our test wallets" className="overflow-hidden border-b border-border py-5">
      <div className="marquee flex w-max gap-3">
        {items.map((q, i) => (
          <span key={i} className="inline-flex shrink-0 items-center gap-3 rounded-full border border-border bg-card px-4 py-2 text-sm">
            <span className="text-[11px] uppercase tracking-wide text-ink-3">
              {q.hook} refused a {q.test}
            </span>
            <span className="font-mono text-[13px] text-foreground">&ldquo;{q.reason}&rdquo;</span>
          </span>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- sections

function Heading({ kicker, title, lead }: { kicker: string; title: React.ReactNode; lead?: string }) {
  return (
    <Reveal className="mb-12 flex max-w-2xl flex-col gap-4">
      <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        <span className="bg-brand h-px w-6" aria-hidden />
        {kicker}
      </span>
      <h2 className="text-3xl font-semibold tracking-[-0.03em] text-balance md:text-5xl">{title}</h2>
      {lead && <p className="text-lg leading-8 text-muted-foreground">{lead}</p>}
    </Reveal>
  );
}

function How() {
  const steps = [
    [
      "Read the code",
      "We pull the rule messages compiled into each hook program and its on-chain IDL, and check who holds the upgrade key.",
    ],
    [
      "Test it on mainnet",
      "A buy from a wallet the launchpad has never seen, a sell by the largest real holder, and a transfer. Simulated, nothing sent.",
    ],
    [
      "Trade, or walk away",
      "Open coins trade right there, with the hook's accounts resolved for your wallet. Everything else tells you exactly why not.",
    ],
  ];
  return (
    <section id="how" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-28 md:px-6">
      <div className="grid items-center gap-14 lg:grid-cols-[1fr_1.05fr]">
        <div>
          <Heading kicker="How it works" title="Ten seconds from mint to verdict" />
          <ol className="flex flex-col gap-8">
            {steps.map(([t, b], i) => (
              <Reveal key={t} delay={i * 0.06} className="grid grid-cols-[44px_1fr] gap-4">
                <span className="text-brand text-3xl font-semibold tabular-nums">{i + 1}</span>
                <div>
                  <h3 className="text-lg font-medium">{t}</h3>
                  <p className="mt-1.5 leading-7 text-muted-foreground">{b}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
        <Reveal delay={0.1}>
          <ScanPreview />
        </Reveal>
      </div>
    </section>
  );
}

/** A real scan result (HODL on SPEC.fun), drawn as the app shows it. */
function ScanPreview() {
  const rows: [boolean, string, string][] = [
    [true, "An outside wallet buys", "0.01 SOL bought 180,408 tokens"],
    [false, "A real holder sells", 'Hook says: "SPEC: custom rule 1 refused this transfer"'],
    [true, "Sent to another wallet", "plain transfer to a new wallet"],
  ];
  return (
    <div className="border-brand relative overflow-hidden rounded-3xl p-1 shadow-[0_30px_80px_-40px_rgba(110,69,255,0.45)]">
      <div className="rounded-[20px] bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="font-semibold">HODL</p>
            <p className="font-mono text-[11px] text-ink-3">hook SPEC.fun · upgradeable</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red/30 bg-red-bg px-2.5 py-1 text-xs font-medium text-red">
            <span className="size-1.5 rounded-full bg-current" aria-hidden />
            Sell blocked
          </span>
        </div>
        <ul className="divide-y divide-border">
          {rows.map(([ok, t, d]) => (
            <li key={t} className="flex items-start gap-3 px-5 py-4">
              <span
                className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${ok ? "bg-green-bg text-green" : "bg-red-bg text-red"}`}
              >
                {ok ? <Check className="size-3" aria-hidden /> : <X className="size-3" aria-hidden />}
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-medium">{t}</span>
                <span className="font-mono text-xs text-muted-foreground">{d}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="border-t border-border px-5 py-3.5 text-xs text-muted-foreground">
          Rules in its code:{" "}
          <span className="text-foreground">sells locked until unlock time · per-wallet cap · sell cooldown · blocklist</span>
        </div>
      </div>
    </div>
  );
}

function Findings({ data }: { data: LandingData }) {
  return (
    <section id="findings" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-24 md:px-6">
      <Heading kicker="What the census found" title="What a chart will never show you" lead={`Mainnet census of ${data.generated} UTC.`} />
      <div className="grid gap-4 md:grid-cols-3 md:grid-rows-2">
        <Reveal className="border-brand flex flex-col justify-between gap-8 rounded-3xl p-7 md:row-span-2">
          <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Frozen for good</span>
          <div>
            <p className="text-brand text-6xl font-semibold tracking-tight tabular-nums md:text-7xl">{data.closed.sol}</p>
            <p className="mt-1 text-lg">SOL stuck in curves that can never move</p>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            {data.closed.hooks} hook programs were closed by their owners. A hook can&apos;t be replaced while a coin is on the curve, and
            DBC can&apos;t return reserves before the curve completes, so {fmt(data.closed.coins)} coins are frozen.
          </p>
        </Reveal>
        <Stat
          value={fmt(data.curve)}
          title="coins Jupiter can't route"
          body="On the curve, Jupiter answers TOKEN_NOT_TRADABLE. The only way in is the launchpad's own app."
        />
        <Stat
          value={`${data.upgradeablePct}%`}
          title="can be rewritten tomorrow"
          body={`Live coins on upgradeable hooks. One key controls ${data.sharedKeyMax} different hook programs.`}
        />
        <Stat
          value={fmt(data.sdk.sells)}
          title="sells Meteora's SDK gets wrong"
          body={`The SDK fills hook accounts with placeholder wallets. Those sells fail, ours go through, across ${fmt(data.sdk.coins)} coins.`}
          link={[SDK_ISSUE, "Reported as #122"]}
        />
        <Stat
          value={fmt(data.withMintAuthority)}
          title="can still mint more"
          body="Coins whose mint authority was never revoked, so supply can grow after you buy."
        />
      </div>
    </section>
  );
}

function Stat({ value, title, body, link }: { value: string; title: string; body: string; link?: [string, string] }) {
  return (
    <Reveal className="flex flex-col gap-2 rounded-3xl border border-border bg-card p-6">
      <p className="text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="font-medium">{title}</p>
      <p className="text-sm leading-6 text-muted-foreground">{body}</p>
      {link && (
        <a
          href={link[0]}
          target="_blank"
          rel="noreferrer"
          className="mt-auto inline-flex items-center gap-1 pt-2 text-sm text-primary hover:underline"
        >
          {link[1]} <ArrowUpRight className="size-3.5" aria-hidden />
        </a>
      )}
    </Reveal>
  );
}

function Guard() {
  const rows: [boolean, string, string][] = [
    [true, "set_verdict(open)", "pins deploy slot 453,436,681 + upgrade key"],
    [true, "guarded buy", "assert_hook + swap2_with_transfer_hook"],
    [false, "hook redeployed → guarded buy", "HookChanged · reverted, nothing spent"],
    [true, "hook redeployed → unguarded buy", "goes through on untested rules"],
    [true, "re-attested → guarded buy", "trades again on the new build"],
  ];
  return (
    <section id="guard" className="relative scroll-mt-20 overflow-hidden border-y border-border bg-card/30">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 size-[520px] rounded-full bg-[radial-gradient(circle,rgba(110,69,255,0.18),transparent_65%)]"
      />
      <div className="relative mx-auto w-full max-w-6xl px-4 py-24 md:px-6">
        <Heading
          kicker="On-chain · hookguard"
          title={
            <>
              A scan expires. <span className="text-brand">A guard doesn&apos;t.</span>
            </>
          }
          lead="hookguard is our Rust program. It pins a verdict to the exact build of a hook, read straight from the BPF loader, and one instruction in your swap reverts the trade if the hook changed since we tested it."
        />
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <Reveal className="overflow-hidden rounded-3xl border border-border bg-background">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5 text-xs text-muted-foreground">
              <span>Real SPEC.fun pool · fork of mainnet</span>
              <a href={`${REPO}/blob/main/docs/hookguard-fork-run.txt`} target="_blank" rel="noreferrer" className="hover:text-foreground">
                full log ↗
              </a>
            </div>
            <ul>
              {rows.map(([ok, what, detail], i) => (
                <li key={what} className="flex items-start gap-3 px-5 py-3.5">
                  <span className="mt-1 font-mono text-[11px] text-ink-3">{i + 1}</span>
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
            <pre className="overflow-x-auto rounded-3xl border border-border bg-background p-5 font-mono text-[12.5px] leading-6 text-ink-2">{`tx.add(
  assertHookIx(attester, hook, programData, ["open"]),
  ...swapIxs, // swap2_with_transfer_hook
);
// reverts: HookChanged · AuthorityChanged
//          HookClosed  · StatusNotAllowed`}</pre>
            <div className="grid grid-cols-3 divide-x divide-border overflow-hidden rounded-3xl border border-border bg-background text-center">
              {[
                ["14", "tests pass"],
                ["26 KB", "Pinocchio"],
                ["devnet", "live"],
              ].map(([v, l]) => (
                <div key={l} className="p-4">
                  <div className="text-xl font-semibold tabular-nums">{v}</div>
                  <div className="text-xs text-muted-foreground">{l}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/app/guard" className={buttonVariants()}>
                Try the guard <ArrowRight aria-hidden />
              </Link>
              <a href={HOOKGUARD_DEVNET} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>
                Program on devnet <ArrowUpRight aria-hidden />
              </a>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Terminals() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-24 md:px-6">
      <Heading
        kicker="For terminals, bots and agents"
        title="Two calls. No key."
        lead="Know what a coin allows, then get a swap already simulated for the user's wallet."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {[
          [
            "GET /api/scan/:mint",
            `{ "status": "pad-only",
  "headline": "Outside wallets can't buy. The hook says:
     \\"FOMO_REQUIRED: Buying from this curve requires Fomo\\"",
  "hook": { "upgradeable": true, "rules": [...] } }`,
          ],
          [
            "POST /api/swap",
            `{ "mint": "<MINT>", "owner": "<WALLET>", "side": "buy", "amount": "50000000" }

→ { "ok": true, "transaction": "<base64 v0>",
    "expectedOut": "4302615449497", "minimumOut": "4173536986012" }`,
          ],
        ].map(([h, body], i) => (
          <Reveal key={h} delay={i * 0.06} className="overflow-hidden rounded-3xl border border-border bg-card">
            <div className="border-b border-border px-5 py-3 font-mono text-xs text-primary">{h}</div>
            <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-6 text-ink-2">{body}</pre>
          </Reveal>
        ))}
      </div>
      <Link href="/docs/api" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium hover:text-primary">
        API reference <ArrowRight className="size-4" aria-hidden />
      </Link>
    </section>
  );
}

function Faq({ data }: { data: LandingData }) {
  const qs: [string, string][] = [
    [
      "What is a transfer hook?",
      "A Token-2022 feature: the mint names a program that runs on every transfer and can refuse it. Meteora DBC v0.2.0 added pools for these tokens; the launchpad's hook runs while the coin is on the curve and DBC revokes it at graduation.",
    ],
    [
      "Does scanning send anything?",
      "No. Every test is a simulation against current mainnet state with signature checks off. Only trades you sign yourself are sent.",
    ],
    [
      "Why can't I buy a Gated coin here?",
      "Its hook refuses buyers who don't come through the launchpad's app. HookScan shows the exact rule and won't build a trade it knows will fail.",
    ],
    ["How fresh is it?", `The census is from ${data.generated} UTC. Every coin page runs a fresh scan the moment you open it.`],
    ["Is hookguard on mainnet?", "It is live on devnet and tested against real mainnet pools on a fork. Mainnet is one deploy away."],
  ];
  return (
    <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-24 md:grid-cols-[1fr_1.6fr] md:px-6">
      <Heading kicker="FAQ" title="Questions" />
      <div className="divide-y divide-border border-y border-border">
        {qs.map(([q, a]) => (
          <details key={q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-medium">
              {q}
              <span
                className="grid size-7 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-transform group-open:rotate-45"
                aria-hidden
              >
                +
              </span>
            </summary>
            <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function Cta() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-24 md:px-6">
      <Reveal className="relative overflow-hidden rounded-[2rem] p-10 md:p-16">
        <div aria-hidden className="bg-brand absolute inset-0 opacity-90" />
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(60%_120%_at_100%_0%,rgba(255,255,255,0.25),transparent_60%)]" />
        <div className="relative flex flex-col items-start gap-6 md:flex-row md:items-end md:justify-between">
          <div className="flex max-w-xl flex-col gap-3 text-white">
            <h2 className="text-4xl font-semibold tracking-[-0.03em] md:text-5xl">Paste a mint. Know the rules.</h2>
            <p className="text-white/80">Every Meteora transfer-hook coin, read and tested live on mainnet.</p>
          </div>
          <Link
            href="/app"
            className="inline-flex h-12 items-center gap-2 rounded-full bg-[#0b0b12] px-6 font-medium text-white transition-transform hover:scale-[1.02]"
          >
            Launch app <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
