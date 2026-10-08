import { PublicKey } from "@solana/web3.js";
import { BPF_UPGRADEABLE_LOADER } from "./constants";
import { connection, retry } from "./rpc";
import { inflateSync } from "zlib";

export interface HookProgramFacts {
  program: string;
  exists: boolean;
  upgradeable: boolean;
  upgradeAuthority: string | null;
  lastDeploySlot: number | null;
  sizeBytes: number;
  /** Human-readable messages compiled into the hook: the rules it enforces. */
  rules: string[];
  /** Instruction names the hook exposes (admin powers like UnlockSells, AddTrader). */
  instructions: string[];
  /** Custom error code -> message, from an on-chain Anchor IDL when one is published. */
  errors: Record<number, string>;
  hasIdl: boolean;
  /** Program account exists but its code was closed: the runtime can never execute it again. */
  closed: boolean;
  /** Best-effort name: the Rust crate the hook was built from, or the tag its messages use. */
  label: string | null;
}

// Strings that come from Rust, Anchor or the Solana SDK rather than from the hook author.
const NOISE = [
  /constraint/i,
  /discriminator/i,
  /deseriali[sz]e/i,
  /seriali[sz]e/i,
  /sysvar/i,
  /realloc/i,
  /\bidl\b/i,
  /bump seed/i,
  /rent[- ]exempt/i,
  /program id/i,
  /compute units/i,
  /panicked/i,
  /unwrap\(\)/i,
  /utf-?8/i,
  /\.rs:/,
  /^Program /,
  /instruction trace/i,
  /lamports/i,
  /arithmetic/i,
  /out of memory/i,
  /borrow/i,
  /\bseeds?\b.*\b(length|address)\b/i,
  /account data/i,
  /not enough account keys/i,
  /signature was required/i,
  /AnchorError/,
  /ProgramError/,
  /deprecated/i,
  /fallback/i,
  /invalid (instruction|account|argument)/i,
  /Error Code/i,
  /Error Message/i,
  /library\//,
  /alloc::|core::|std::/,
  /A (mut|seeds|raw|close|has one|signer|owner|token|mint|space|rent)/,
  /ConnectionRefused|NotADirectory|WouldBlock|BrokenPipe/,
  /The given account/i,
  /owned by a different program/i,
  /Display implementation/i,
  /extra-account-metas$/,
  /out of bounds/i,
  /variant index/i,
  /data allocations/i,
  /Provided owner/i,
];

const RULE_WORDS =
  /\b(sell|sells|buy|buys|bought|transfer|transfers|wallet|holder|holders|cap|lock|locked|unlock|only|allowed|refused|required|requires|blocklist|blocklisted|allowlist|whitelist|cooldown|co-?signed|soulbound|curve|max|limit|pad|launch|graduat\w*|trade|trades|trading|record|expired|verification|gate)\b/i;

/** Split a run of concatenated Rust string literals into separate messages. */
function splitRun(run: string): string[] {
  let s = run;
  // A "tag: " prefix that repeats inside the run marks where each message starts
  // (e.g. "ai-only: ...the configai-only: this coin..." -> two "ai-only: " messages).
  const tags = new Set<string>();
  for (const m of s.matchAll(/(?:^|\s)([A-Za-z][\w.\-]{1,24}): /g)) {
    // "capSPEC" is two literals glued together, not a tag
    if (/^(?:[A-Z][A-Z0-9_.\-]*|[a-z][a-z0-9_.\-]*)$/.test(m[1])) tags.add(m[1]);
  }
  for (const tag of tags) {
    if (s.split(`${tag}: `).length > 2) s = s.split(`${tag}: `).join(`\n${tag}: `);
  }
  // Join between two literals: "allowedFomo verification", "allowedFOMO_REQUIRED: ", "co-signedCustom"
  s = s.replace(/([a-z.)])(?=[A-Z][a-z]+ |[A-Z][A-Z0-9_]{1,24}: |Custom$)/g, "$1\n");
  // A sentence that ends in "." glued to the next literal: "...to buy.launch buy: allowed"
  s = s.replace(/\.(?=[a-z][a-z \-]{1,30}: )/g, ".\n");
  // Literals that end in a verdict word run straight into the next one: "allowednot a bonding..."
  s = s.replace(/\b(allowed|passed|refused|denied|closed|reached)(?=[a-z])/g, "$1\n");
  return s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

function instructionNames(run: string, out: Set<string>) {
  for (const m of run.matchAll(/Instruction: ([A-Z][A-Za-z0-9_]*?)(?=Instruction: |[^A-Za-z0-9_]|$)/g)) out.add(m[1]);
}

function labelFrom(elf: Buffer, rules: string[]): string | null {
  const text = elf.toString("latin1");
  const crate = text.match(/programs\/([a-z0-9_\-]{3,40})\/src\//);
  const tags = new Map<string, number>();
  for (const r of rules) {
    const t = r.match(/^([A-Za-z][\w.\-]{1,20}): /)?.[1];
    if (t) tags.set(t, (tags.get(t) ?? 0) + 1);
  }
  const top = [...tags.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] >= 2) return top[0];
  return crate ? crate[1] : (top?.[0] ?? null);
}

export function extractRules(elf: Buffer): { rules: string[]; instructions: string[]; label: string | null } {
  const runs: string[] = [];
  let cur = "";
  for (const b of elf) {
    if (b >= 0x20 && b < 0x7f) cur += String.fromCharCode(b);
    else {
      if (cur.length >= 12) runs.push(cur);
      cur = "";
    }
  }
  if (cur.length >= 12) runs.push(cur);

  const rules = new Set<string>();
  const instructions = new Set<string>();
  for (const run of runs) {
    instructionNames(run, instructions);
    for (const piece of splitRun(run.replace(/Instruction: [A-Za-z0-9_]+/g, "\n"))) {
      if (piece.length < 14 || piece.length > 160) continue;
      if (!/\s/.test(piece)) continue; // identifiers, not sentences
      if (!RULE_WORDS.test(piece)) continue;
      if (NOISE.some((r) => r.test(piece))) continue;
      const letters = piece.replace(/[^A-Za-z]/g, "").length;
      if (letters / piece.length < 0.6) continue;
      rules.add(piece.replace(/\s+/g, " "));
    }
  }
  for (const name of [...instructions]) {
    if (GENERIC_IX.some((g) => name.startsWith(g)) || name.startsWith("Idl")) instructions.delete(name);
  }
  const list = [...rules].slice(0, 60);
  return { rules: list, instructions: [...instructions].slice(0, 40), label: labelFrom(elf, list) };
}

const GENERIC_IX = [
  "Execute",
  "InitializeExtraAccountMetaList",
  "UpdateExtraAccountMetaList",
  "IdlCreateAccount",
  "IdlWrite",
  "IdlSetBuffer",
  "IdlSetAuthority",
  "IdlCloseAccount",
  "IdlResizeAccount",
  "IdlCreateBuffer",
];

/** Anchor programs may publish their IDL on chain: error messages are the rules, instructions are the admin powers. */
async function anchorIdl(program: PublicKey): Promise<{ rules: string[]; errors: Record<number, string>; instructions: string[] } | null> {
  try {
    const base = PublicKey.findProgramAddressSync([], program)[0];
    const addr = await PublicKey.createWithSeed(base, "anchor:idl", program);
    const acc = await retry(() => connection().getAccountInfo(addr));
    if (!acc || acc.data.length < 44) return null;
    const len = acc.data.readUInt32LE(40);
    const json = JSON.parse(inflateSync(acc.data.subarray(44, 44 + len)).toString("utf8"));
    const errors: Record<number, string> = {};
    for (const e of json.errors ?? []) if (e.msg) errors[e.code] = e.msg;
    const camel = (n: string) => n.replace(/(^|_)([a-z])/g, (_: string, __: string, c: string) => c.toUpperCase());
    return {
      rules: Object.values(errors),
      errors,
      instructions: (json.instructions ?? []).map((i: { name: string }) => camel(i.name)).filter((n: string) => !GENERIC_IX.includes(n)),
    };
  } catch {
    return null;
  }
}

const cache = new Map<string, Promise<HookProgramFacts>>();

export function inspectHookProgram(program: string): Promise<HookProgramFacts> {
  if (!cache.has(program)) cache.set(program, load(program));
  return cache.get(program)!;
}

async function load(program: string): Promise<HookProgramFacts> {
  const conn = connection();
  const pk = new PublicKey(program);
  const acc = await retry(() => conn.getAccountInfo(pk));
  const base: HookProgramFacts = {
    program,
    exists: !!acc,
    closed: false,
    upgradeable: false,
    upgradeAuthority: null,
    lastDeploySlot: null,
    sizeBytes: 0,
    rules: [],
    instructions: [],
    errors: {},
    hasIdl: false,
    label: null,
  };
  if (!acc) return base;

  if (acc.owner.equals(BPF_UPGRADEABLE_LOADER) && acc.data.length >= 36) {
    // UpgradeableLoaderState::Program { programdata_address }
    const programData = new PublicKey(acc.data.subarray(4, 36));
    const pd = await retry(() => conn.getAccountInfo(programData));
    if (!pd || pd.data.length <= 45) return { ...base, closed: true };
    // ProgramData { slot: u64, upgrade_authority: Option<Pubkey> } = 4 + 8 + 1 + 32 = 45 bytes header
    const slot = Number(pd.data.readBigUInt64LE(4));
    const hasAuth = pd.data[12] === 1;
    const auth = hasAuth ? new PublicKey(pd.data.subarray(13, 45)).toBase58() : null;
    const elf = pd.data.subarray(45);
    return merge(
      { ...base, upgradeable: hasAuth, upgradeAuthority: auth, lastDeploySlot: slot, sizeBytes: elf.length, ...extractRules(elf) },
      await anchorIdl(pk),
    );
  }
  // Legacy (non-upgradeable) loaders keep the ELF in the program account itself.
  return merge({ ...base, sizeBytes: acc.data.length, ...extractRules(acc.data) }, await anchorIdl(pk));
}

function merge(f: HookProgramFacts, idl: Awaited<ReturnType<typeof anchorIdl>>): HookProgramFacts {
  if (!idl) return f;
  return {
    ...f,
    hasIdl: true,
    errors: idl.errors,
    rules: [...new Set([...idl.rules, ...f.rules])].slice(0, 60),
    instructions: [...new Set([...idl.instructions, ...f.instructions])],
  };
}
