import { AccountInfo, PublicKey } from "@solana/web3.js";
import {
  ExtensionType,
  getExtensionTypes,
  getPermanentDelegate,
  getTransferFeeConfig,
  getTransferHook,
  getDefaultAccountState,
  getPausableConfig,
  getTokenMetadata,
  unpackMint,
  TOKEN_2022_PROGRAM_ID,
  AccountState,
} from "@solana/spl-token";
import { unpack as unpackMetadata } from "@solana/spl-token-metadata";
import { DBC_POOL_AUTHORITY } from "./constants";

export interface MintFacts {
  mint: string;
  name: string | null;
  symbol: string | null;
  uri: string | null;
  decimals: number;
  supply: string;
  hookProgram: string | null; // null = no hook or revoked
  hookAuthority: string | null;
  /** Hook authority is DBC's pool authority, so it is revoked automatically at graduation. */
  hookAuthorityIsDbc: boolean;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  permanentDelegate: string | null;
  transferFeeBps: number;
  pausable: boolean;
  defaultFrozen: boolean;
  extensions: string[];
}

function metadataFromTlv(info: AccountInfo<Buffer>): { name: string; symbol: string; uri: string } | null {
  // getTokenMetadata needs a connection; parse the TokenMetadata TLV entry directly instead.
  try {
    const data = info.data;
    let i = 166; // base mint (82) padded to 165 + account type byte
    while (i + 4 <= data.length) {
      const type = data.readUInt16LE(i);
      const len = data.readUInt16LE(i + 2);
      if (type === ExtensionType.TokenMetadata) {
        const m = unpackMetadata(data.subarray(i + 4, i + 4 + len));
        return { name: m.name, symbol: m.symbol, uri: m.uri };
      }
      if (type === 0 && len === 0) break;
      i += 4 + len;
    }
  } catch {
    /* metadata may live in Metaplex instead */
  }
  return null;
}

export function readMint(mint: PublicKey, info: AccountInfo<Buffer>): MintFacts {
  const m = unpackMint(mint, info, info.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : info.owner);
  const hook = getTransferHook(m);
  const hookProgram = hook && !hook.programId.equals(PublicKey.default) ? hook.programId.toBase58() : null;
  const hookAuthority = hook && !hook.authority.equals(PublicKey.default) ? hook.authority.toBase58() : null;
  const delegate = getPermanentDelegate(m);
  const fee = getTransferFeeConfig(m);
  const das = getDefaultAccountState(m);
  let pausable = false;
  try {
    pausable = Boolean(getPausableConfig(m));
  } catch {
    pausable = false;
  }
  const meta = metadataFromTlv(info);
  return {
    mint: mint.toBase58(),
    name: meta?.name?.replace(/\0/g, "").trim() || null,
    symbol: meta?.symbol?.replace(/\0/g, "").trim() || null,
    uri: meta?.uri?.replace(/\0/g, "").trim() || null,
    decimals: m.decimals,
    supply: m.supply.toString(),
    hookProgram,
    hookAuthority,
    hookAuthorityIsDbc: hookAuthority === DBC_POOL_AUTHORITY.toBase58(),
    mintAuthority: m.mintAuthority?.toBase58() ?? null,
    freezeAuthority: m.freezeAuthority?.toBase58() ?? null,
    permanentDelegate: delegate && !delegate.delegate.equals(PublicKey.default) ? delegate.delegate.toBase58() : null,
    transferFeeBps: fee ? fee.newerTransferFee.transferFeeBasisPoints : 0,
    pausable,
    defaultFrozen: das ? das.state === AccountState.Frozen : false,
    extensions: getExtensionTypes(m.tlvData).map((t) => ExtensionType[t] ?? String(t)),
  };
}

export { getTokenMetadata };
