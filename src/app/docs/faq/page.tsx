import type { Metadata } from "next";
import { DocTitle, H2, P } from "@/components/docs/ui";

export const metadata: Metadata = { title: "FAQ" };

const QA: [string, string, string][] = [
  ["send", "Does scanning send transactions?", "No. Every test is a simulation with signature checks off. Only trades you sign are sent."],
  [
    "gated",
    "Why won't HookScan trade a Gated coin?",
    "Its hook refuses buyers who don't come through the launchpad's app. HookScan shows which rule and won't build a trade it knows will fail.",
  ],
  [
    "accuracy",
    "Can a verdict be wrong?",
    "It is true for the moment and the build it tested. Hooks can be redeployed and some rules depend on time or wallet, which is why coin pages rescan live and hookguard exists.",
  ],
  [
    "graduated",
    "What happens at graduation?",
    "DBC migrates the coin to a DAMM v2 pool and revokes the hook. From then on it trades freely and Jupiter routes it.",
  ],
  [
    "frozen",
    "Is the SOL in frozen coins really stuck?",
    "For coins whose hook program was closed, yes: every transfer of the token fails, the curve can't complete without trades, and DBC has no instruction that returns reserves before completion.",
  ],
  [
    "mainnet",
    "Is hookguard on mainnet?",
    "It is deployed on devnet and tested against real mainnet pools on a Surfpool fork. Mainnet is one deploy away.",
  ],
  ["fees", "Does HookScan take a fee?", "No."],
];

export default function Faq() {
  return (
    <>
      <DocTitle eyebrow="Developers" title="FAQ" lead="Short answers to what people ask most." />
      {QA.map(([id, q, a]) => (
        <section key={id}>
          <H2 id={id}>{q}</H2>
          <P>{a}</P>
        </section>
      ))}
    </>
  );
}
