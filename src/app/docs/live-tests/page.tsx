import type { Metadata } from "next";
import { C, Callout, Code, DocTitle, H2, P, Table } from "@/components/docs/ui";

export const metadata: Metadata = { title: "Live tests" };

export default function LiveTests() {
  return (
    <>
      <DocTitle
        eyebrow="Design"
        title="Live tests"
        lead="Three simulations against current mainnet state. Signature checks are off, so any wallet can be the signer and nothing is sent."
      />
      <H2 id="tests">The three tests</H2>
      <Table
        head={["Test", "Transaction", "Signer"]}
        rows={[
          [
            "Outside buy",
            "swap2_with_transfer_hook, 0.01 SOL in (0.25 SOL if a minimum rule refused it)",
            "A funded wallet the launchpad has never seen",
          ],
          ["Holder sell", "swap2_with_transfer_hook, 10% of the largest holder's bag", "The largest system-owned holder"],
          ["Transfer", "transferChecked to a brand-new wallet's token account", "Same holder"],
        ]}
      />
      <H2 id="accounts">Resolving the hook&apos;s accounts</H2>
      <P>
        A transfer hook declares extra accounts in an <C>ExtraAccountMetaList</C>, often derived from the transfer&apos;s source,
        destination or owner. HookScan resolves them for the transfer DBC will actually make:
      </P>
      <Code lang="transfer the swap performs">{`buy:  base vault  -> buyer's token account   (owner: DBC pool authority)
sell: seller's token account -> base vault   (owner: seller)`}</Code>
      <P>
        When the transaction itself creates the buyer&apos;s token account, it doesn&apos;t exist yet, so hooks that read seed bytes from it
        would fail to resolve. HookScan supplies the account data it will have once created (mint, owner, Token-2022 extensions).
      </P>
      <Callout title="Why this matters" kind="warn">
        Meteora&apos;s SDK resolves these accounts with placeholder wallets. See{" "}
        <a className="text-primary" href="/docs/sdk-bug">
          The SDK bug
        </a>
        .
      </Callout>
      <H2 id="reason">Reading the reason</H2>
      <P>
        From the simulation logs, the first failing program is the culprit. The nearest log line it wrote becomes the reason; Anchor errors
        are unwrapped to their message, panics to their text, and custom codes are mapped through the hook&apos;s IDL when it has one.
      </P>
    </>
  );
}
