import "server-only";
import raw from "../../data/snapshot.json";
import type { Snapshot, SnapshotHook } from "./snapshot";

export const snapshot = raw as unknown as Snapshot;

const ORDER = ["broken", "sell-blocked", "pad-only", "open", "complete", "graduated", "untested"];

export function dominantStatus(h: SnapshotHook): string {
  if (h.program === "revoked") return "revoked";
  const entries = Object.entries(h.statuses).filter(([s]) => s !== "untested");
  if (!entries.length) return h.phases.curve === 0 ? (h.phases.graduated ? "graduated" : "complete") : "untested";
  entries.sort((a, b) => b[1] - a[1] || ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]));
  return entries[0][0];
}

export const hookByProgram = new Map(snapshot.hooks.map((h) => [h.program, h]));

export function hookLabel(program: string): string | null {
  if (program === "revoked") return "Graduated (hook revoked)";
  return KNOWN[program] ?? hookByProgram.get(program)?.facts?.label ?? null;
}

/** Names confirmed from the hooks' own messages. */
const KNOWN: Record<string, string> = {
  AJVs2E5oH1mpszGoXKPf6dHzEyasN3vrhC3ow2WpfNWE: "Fomo",
  FKTNiFexa4dFRgKwGjJLwmwNH8pocfyUuKdGvcZGeSSa: "SPEC.fun",
  AvVQRmi5LwnTN64pkHbUEeAwwMgR2ms3FcL8VbfZV7FH: "ai-only pad",
  ARzxmFNCjWx7XuzXMci3WyDubMkg7FMd2xxy9s7tgdrM: "hook_guard",
};
