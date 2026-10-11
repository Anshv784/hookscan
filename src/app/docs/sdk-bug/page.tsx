import type { Metadata } from "next";
import { C, Callout, Code, DocTitle, H2, List, P } from "@/components/docs/ui";

export const metadata: Metadata = { title: "The SDK bug" };

export default function SdkBug() {
  return (
    <>
      <DocTitle
        eyebrow="Developers"
        title="The SDK bug"
        lead="Meteora's DBC SDK builds hook swaps with the wrong accounts for any hook that depends on the wallet. Reported upstream as issue #122."
      />
      <H2 id="cause">Cause</H2>
      <P>
        <C>swap2WithTransferHook</C> in <C>@meteora-ag/dynamic-bonding-curve-sdk</C> (1.5.13, and <C>main</C> as of Oct 2026) resolves the
        hook&apos;s extra accounts like this:
      </P>
      <Code lang="typescript">{`createTransferCheckedWithTransferHookInstruction(
  connection,
  PublicKey.default, // source
  mint,
  PublicKey.default, // destination
  PublicKey.default, // owner
  ...
)`}</Code>
      <P>Hooks whose extra accounts are derived from those addresses get the wrong accounts.</P>
      <H2 id="symptoms">Symptoms</H2>
      <List>
        <li>
          The swap fails with <C>0xa261c2c0</C> (<C>AccountResolutionError::IncorrectAccount</C>). In the repro, the SDK passes the same PDA
          for both the sender&apos;s and the receiver&apos;s record, because both are derived from the placeholder.
        </li>
        <li>
          For hooks that read seed bytes from account data, the SDK throws <C>TokenTransferHookInvalidSeed</C> and can&apos;t build the
          transaction at all.
        </li>
      </List>
      <H2 id="repro">Repro</H2>
      <Code lang="shell">{`RPC_URL=<mainnet rpc> bun scripts/sdk-hook-repro.ts \\
  2uG28kKjfYGGBebpjipUnMuagQSBRm5FqgiSNf7B6gbN 8syfgnxL67yFjcyfXdH9fm3sFAo1u39Mi1GWen23nm1k`}</Code>
      <Code lang="output">{`SDK swap2WithTransferHook (unmodified): {"InstructionError":[1,{"Custom":2724315840}]}
hook accounts: SDK 6 real 6
  differs at 2: SDK 2DhCzf8X...  real Cp14JaY6...
  differs at 3: SDK 2DhCzf8X...  real 74aeiB8B...
Same tx, hook accounts resolved for the real wallet: OK`}</Code>
      <H2 id="fix">How HookScan does it</H2>
      <P>
        Resolve for the transfer DBC performs (base vault to buyer on buys, seller to base vault on sells), supply would-be data for token
        accounts the transaction creates, and size the <C>TransferHookAccountsInfo</C> slice to the resolved count. See{" "}
        <C>src/lib/core/swap.ts</C>.
      </P>
      <Callout title="Upstream">
        <a className="text-primary" href="https://github.com/MeteoraAg/dynamic-bonding-curve-sdk/issues/122">
          MeteoraAg/dynamic-bonding-curve-sdk#122
        </a>
      </Callout>
    </>
  );
}
