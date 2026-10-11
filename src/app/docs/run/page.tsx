import type { Metadata } from "next";
import { C, Code, DocTitle, H2, P } from "@/components/docs/ui";

export const metadata: Metadata = { title: "Run it yourself" };

export default function Run() {
  return (
    <>
      <DocTitle
        eyebrow="Developers"
        title="Run it yourself"
        lead="Everything runs locally with a mainnet RPC. The free tier of most providers is enough."
      />
      <H2 id="app">The app</H2>
      <Code lang="shell">{`git clone https://github.com/Anshv784/hookscan && cd hookscan
npm install
echo 'RPC_URL=https://mainnet.helius-rpc.com/?api-key=...' > .env.local
npm run dev`}</Code>
      <H2 id="census">The census</H2>
      <P>
        Writes <C>data/snapshot.json</C>. About 30 minutes and roughly 15k RPC calls on a free tier; <C>CONCURRENCY</C> and{" "}
        <C>SAMPLES_PER_HOOK</C> tune it. In the repo it is a manually triggered GitHub Action.
      </P>
      <Code lang="shell">{`bun scripts/index.ts`}</Code>
      <H2 id="program">hookguard</H2>
      <Code lang="shell">{`cd programs/hookguard
cargo build-sbf
cargo test                      # 14 tests
solana program deploy target/deploy/hookguard.so -u devnet`}</Code>
      <H2 id="fork">Fork test against mainnet</H2>
      <Code lang="shell">{`surfpool start --rpc-url <mainnet rpc> --no-tui --airdrop <trader>
solana program deploy programs/hookguard/target/deploy/hookguard.so \\
  --program-id programs/hookguard/target/deploy/hookguard-keypair.json -u http://localhost:8899
RPC_URL=http://localhost:8899 bun scripts/guard-fork-e2e.ts trader.json <pool>`}</Code>
    </>
  );
}
