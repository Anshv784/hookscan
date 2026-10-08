import type { HookProgramFacts } from "./core/program";
import type { Phase } from "./core/layout";
import type { Status, TestResult } from "./core/scan";

export interface SnapshotCoin {
  pool: string;
  mint: string;
  symbol: string | null;
  name: string | null;
  hook: string; // program id, or "revoked"
  phase: Phase;
  creator: string;
  quoteMint: string | null;
  quoteReserve: string;
  progress: number | null;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  permanentDelegate: string | null;
}

export interface SnapshotHook {
  program: string;
  facts: HookProgramFacts | null;
  pools: number;
  phases: Record<Phase, number>;
  creators: number;
  creatorIsUpgradeAuthority: number;
  withMintAuthority: number;
  quoteReserveLamports: string;
  statuses: Record<string, number>;
  samples: {
    pool: string;
    mint: string;
    symbol: string | null;
    status: Status;
    headline: string;
    tests: { buy: TestResult; sell: TestResult; transfer: TestResult };
  }[];
}

export interface Snapshot {
  generatedAt: number;
  slot: number;
  totals: {
    pools: number;
    curve: number;
    complete: number;
    graduated: number;
    hookPrograms: number;
    upgradeableHookPrograms: number;
    poolsOnUpgradeableHooks: number;
    withMintAuthority: number;
    curvePoolsByStatus: Record<"open" | "pad-only" | "sell-blocked" | "broken" | "untested", number>;
    quoteLockedLamports: string;
  };
  hooks: SnapshotHook[];
  coins: SnapshotCoin[];
}
