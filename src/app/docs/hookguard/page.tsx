import type { Metadata } from "next";
import { C, Callout, Code, DocTitle, H2, P, Table } from "@/components/docs/ui";

export const metadata: Metadata = { title: "hookguard program" };

export default function Hookguard() {
  return (
    <>
      <DocTitle
        eyebrow="Design"
        title="hookguard program"
        lead="A 26 KB Rust program (Pinocchio) that makes a swap revert if the hook it goes through isn't the exact build an attester tested."
      />
      <H2 id="why">Why</H2>
      <P>
        A scan is a snapshot. Most hooks are upgradeable, so a hook that let you sell when HookScan tested it can be redeployed a minute
        later with a sell lock. hookguard moves the check into the trade itself.
      </P>
      <H2 id="instructions">Instructions</H2>
      <Table
        head={["#", "Instruction", "Accounts", "Data"]}
        rows={[
          [
            "0",
            <C key="a">set_verdict</C>,
            "attester (signer), verdict PDA, hook program, hook programdata, system program",
            "status u8, report hash [32]",
          ],
          [
            "1",
            <C key="b">assert_hook</C>,
            "verdict PDA, hook program, hook programdata",
            "trusted attester [32], allowed status mask u8, max age in slots u64",
          ],
          ["2", <C key="c">close_verdict</C>, "attester (signer), verdict PDA", "—"],
        ]}
      />
      <P>
        Verdicts live at <C>{'PDA(["verdict", attester, hook])'}</C>, so anyone can attest and a caller chooses whose verdicts to trust. In{" "}
        <C>set_verdict</C> the program reads the hook&apos;s deploy slot and upgrade authority from the BPF loader itself; the attester only
        supplies the status.
      </P>
      <H2 id="assert">What assert_hook checks</H2>
      <Table
        head={["Check", "Error"]}
        rows={[
          ["The verdict is from the attester you pass", "WrongAttester"],
          ["The verdict is for this hook", "WrongHook"],
          ["Its status is in your allowed mask", "StatusNotAllowed"],
          ["It is newer than your max age (if set)", "VerdictStale"],
          ["The programdata account is the one the hook points to", "WrongProgramData"],
          ["The hook still has code", "HookClosed"],
          ["Same deploy slot as when attested", "HookChanged"],
          ["Same upgrade authority as when attested", "AuthorityChanged"],
        ]}
      />
      <H2 id="usage">Using it</H2>
      <Code lang="typescript">{`import { assertHookIx, setVerdictIx } from "@/lib/core/guard";

// attester, once per tested build
await send([setVerdictIx(attester, hook, programData, "open")]);

// trader, in the same transaction as the swap
await send([
  assertHookIx(attester, hook, programData, ["open"]),
  ...swapIxs, // swap2_with_transfer_hook
]);`}</Code>
      <H2 id="tests">Tests</H2>
      <P>
        14 tests run the compiled SBF program in Mollusk with hand-built loader accounts: redeploy, authority handover, closed program,
        spoofed programdata, wrong attester, wrong hook, stale verdict, immutable hooks, re-attesting, rent refund.
      </P>
      <Code lang="shell">{`cd programs/hookguard
cargo build-sbf && cargo test`}</Code>
      <H2 id="fork">Mainnet fork run</H2>
      <P>
        On a Surfpool fork of mainnet with a real SPEC.fun pool: a guarded buy passes; after the hook is redeployed the guarded buy reverts
        with <C>HookChanged</C> while an unguarded buy still goes through; after re-attesting, the guarded buy works again. Script:{" "}
        <C>scripts/guard-fork-e2e.ts</C>, output: <C>docs/hookguard-fork-run.txt</C>.
      </P>
      <Callout title="Deployment">
        Devnet: <C>C3wRkdrAx9tr8FqfGuBEtLrnjpDZEb5aA9Dz2Kbv8ABv</C>. Mainnet is one <C>solana program deploy</C> away (about 0.19 SOL of
        rent).
      </Callout>
    </>
  );
}
