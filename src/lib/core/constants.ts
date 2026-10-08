import { PublicKey } from "@solana/web3.js";

export const DBC_PROGRAM = new PublicKey("dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN");
/** DBC's single pool authority PDA; it is the hook authority while a pool is on the curve. */
export const DBC_POOL_AUTHORITY = new PublicKey("FhVo3mqL8PW5pH5U2CN4XE33DokiyZnUwuGpH2hmHLuM");
export const BPF_UPGRADEABLE_LOADER = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
export const NATIVE_MINT = new PublicKey("So11111111111111111111111111111111111111112");

/**
 * Funded mainnet wallet used only as the signer of *simulated* buys (sigVerify is off,
 * nothing is ever sent). Any system account with SOL works.
 */
export const SIM_BUYER = new PublicKey("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM");
