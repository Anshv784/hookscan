import type { Metadata } from "next";
import { C, DocTitle, H2, List, P } from "@/components/docs/ui";

export const metadata: Metadata = { title: "How it works" };

export default function How() {
  return (
    <>
      <DocTitle
        eyebrow="Overview"
        title="How it works"
        lead="Three steps per coin: read the hook, test it on mainnet, and pin the result on-chain so a trade can check it."
      />
      <H2 id="census">1. Find every hook pool</H2>
      <P>
        One <C>getProgramAccounts</C> call on the DBC program filtered by the <C>TransferHookPool</C> account discriminator returns every
        hook pool. Each pool account is decoded by byte offset: config, creator, base mint, vaults, reserves, and whether it has graduated.
        Configs are
        <C>ConfigWithTransferHook</C> accounts, decoded with Meteora&apos;s own Anchor coder to get the quote mint and migration threshold.
      </P>
      <H2 id="read">2. Read the hook</H2>
      <P>For each mint we read the Token-2022 extensions, and for each hook program the BPF loader state and the code itself.</P>
      <List>
        <li>
          <strong>Mint:</strong> transfer hook program and authority, mint authority, freeze authority, permanent delegate, pausable,
          transfer fee.
        </li>
        <li>
          <strong>Hook program:</strong> upgradeable or not, upgrade authority, last deploy slot, and whether it was closed.
        </li>
        <li>
          <strong>Rules:</strong> human-readable messages compiled into the program, plus error messages and admin instructions from its
          on-chain Anchor IDL.
        </li>
      </List>
      <H2 id="test">3. Test it live</H2>
      <P>
        Three mainnet simulations with signature checks off, so nothing is sent: an outside buy, a sell by the largest real holder, and a
        transfer to a new wallet. Each result carries the hook&apos;s own error message. See{" "}
        <a className="text-primary" href="/docs/live-tests">
          Live tests
        </a>
        .
      </P>
      <H2 id="verdict">4. Give a verdict</H2>
      <P>
        The results become one of six verdicts, with the reason in the hook&apos;s words. See{" "}
        <a className="text-primary" href="/docs/verdicts">
          Verdicts
        </a>
        .
      </P>
      <H2 id="guard">5. Guard the trade</H2>
      <P>
        A verdict is only true for the build that was tested.{" "}
        <a className="text-primary" href="/docs/hookguard">
          hookguard
        </a>{" "}
        pins it to the hook&apos;s deploy slot and upgrade key on-chain, and its <C>assert_hook</C> instruction makes a swap revert if
        either changed.
      </P>
    </>
  );
}
