import { Suspense } from "react";
import type { Metadata } from "next";
import { CoinView } from "@/components/coin-view";
import { hookLabel, snapshot } from "@/lib/data";

function lookup(id: string) {
  return snapshot.coins.find((c) => c.mint === id || c.pool === id) ?? null;
}

export async function generateMetadata(props: PageProps<"/coin/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const c = lookup(id);
  return { title: c ? `${c.symbol ?? "Coin"} — HookScan` : "Scan — HookScan" };
}

export default function CoinPage(props: PageProps<"/coin/[id]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-7xl px-4 py-8 sm:px-6" />}>
      <Coin params={props.params} />
    </Suspense>
  );
}

async function Coin({ params }: { params: PageProps<"/coin/[id]">["params"] }) {
  const { id } = await params;
  const c = lookup(id);
  return <CoinView id={id} known={c ? { ...c, hookLabel: hookLabel(c.hook) } : null} />;
}
