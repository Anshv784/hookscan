import type { Metadata } from "next";
import { C, Code, DocTitle, H2, List, P } from "@/components/docs/ui";

export const metadata: Metadata = { title: "Reading a hook" };

export default function Reading() {
  return (
    <>
      <DocTitle
        eyebrow="Design"
        title="Reading a hook"
        lead="What a hook will refuse is written into its program. HookScan reads it from three places."
      />
      <H2 id="loader">1. The BPF loader</H2>
      <P>
        An upgradeable program account points at a programdata account whose 45-byte header holds the last deploy slot and an optional
        upgrade authority. If that account is gone, the program was closed and can never run again.
      </P>
      <Code lang="programdata header">{`[0..4]   enum tag = 3 (ProgramData)
[4..12]  slot of the last deploy (u64)
[12]     1 if an upgrade authority exists
[13..45] upgrade authority
[45..]   the ELF`}</Code>
      <H2 id="strings">2. Messages in the binary</H2>
      <P>
        Rust string literals end up in the ELF, often concatenated. HookScan extracts printable runs, splits them where one literal ends and
        the next begins (repeated tags like <C>SPEC: </C>, camel-case joins), and keeps sentences that mention trading words and aren&apos;t
        Rust or Anchor boilerplate. From SPEC.fun&apos;s hook that yields 24 rules, for example:
      </P>
      <List>
        <li>
          <C>SPEC: sells are locked until the unlock time</C>
        </li>
        <li>
          <C>SPEC: wallet would hold more than the per-wallet cap</C>
        </li>
        <li>
          <C>SPEC: this coin can only be bought on SPEC.fun</C>
        </li>
      </List>
      <H2 id="idl">3. The on-chain IDL</H2>
      <P>
        Anchor programs can publish their IDL at a PDA derived from the program id. Its error messages are the rules, and its instruction
        names are the admin powers (<C>UnlockSells</C>, <C>AddTrader</C>, <C>SetMinSellAmount</C>). Error codes from a failed simulation are
        mapped through it.
      </P>
      <H2 id="labels">Names</H2>
      <P>
        A hook&apos;s label comes from the tag its messages repeat (<C>SPEC</C>, <C>ai-only</C>) or the Rust crate path in its binary (
        <C>programs/hook_guard</C>).
      </P>
    </>
  );
}
