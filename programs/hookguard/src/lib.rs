//! hookguard: an on-chain guard for trades on Meteora DBC transfer-hook pools.
//!
//! A transfer hook is a program the launchpad chose; most are upgradeable, so the rules a coin
//! enforces can change after someone checked them. hookguard pins an attester's verdict to the
//! exact build of a hook program (its programdata deploy slot and upgrade authority, read from
//! chain by this program, not supplied by the attester). `assert_hook` placed in the same
//! transaction as a swap re-reads the hook's identity at execution time and fails the whole
//! transaction if the code or its upgrade key changed, or the verdict isn't one the caller accepts.
//!
//! Instructions (first byte):
//!   0 set_verdict   [attester (signer, w), verdict (w), hook program, hook programdata, system program]
//!                   data: status u8, report_hash [u8; 32]
//!   1 assert_hook   [verdict, hook program, hook programdata]
//!                   data: expected attester [u8; 32], allowed status mask u8, max age in slots u64 (0 = any)
//!   2 close_verdict [attester (signer, w), verdict (w)]
#![cfg_attr(target_os = "solana", no_std)]

use pinocchio::{
    account_info::AccountInfo,
    instruction::{Seed, Signer},
    program_error::ProgramError,
    pubkey::{find_program_address, Pubkey},
    sysvars::{clock::Clock, rent::Rent, Sysvar},
    ProgramResult,
};
use pinocchio_system::instructions::CreateAccount;

pinocchio_pubkey::declare_id!("C3wRkdrAx9tr8FqfGuBEtLrnjpDZEb5aA9Dz2Kbv8ABv");

#[cfg(target_os = "solana")]
pinocchio::program_entrypoint!(process_instruction);
#[cfg(target_os = "solana")]
pinocchio::no_allocator!();
#[cfg(target_os = "solana")]
pinocchio::nostd_panic_handler!();

pub const VERDICT_SEED: &[u8] = b"verdict";
pub const VERDICT_DISC: [u8; 8] = *b"HKVERDCT";
pub const VERDICT_LEN: usize = 188;

/// BPFLoaderUpgradeab1e11111111111111111111111
pub const BPF_UPGRADEABLE_LOADER: Pubkey = pinocchio_pubkey::pubkey!("BPFLoaderUpgradeab1e11111111111111111111111");

/// Verdict status values; `assert_hook` takes a bit mask of acceptable ones (bit = 1 << status).
pub mod status {
    pub const OPEN: u8 = 1;
    pub const GATED: u8 = 2;
    pub const SELL_BLOCKED: u8 = 3;
    pub const FROZEN: u8 = 4;
    pub const MAX: u8 = 4;
}

/// Verdict account layout (188 bytes).
pub mod layout {
    pub const DISC: usize = 0; // [u8; 8]
    pub const VERSION: usize = 8; // u8
    pub const STATUS: usize = 9; // u8
    pub const BUMP: usize = 10; // u8
    pub const FLAGS: usize = 11; // u8, bit0 = upgradeable
    pub const ATTESTER: usize = 12; // Pubkey
    pub const HOOK: usize = 44; // Pubkey
    pub const PROGRAMDATA: usize = 76; // Pubkey (zero if not upgradeable)
    pub const AUTHORITY: usize = 108; // Pubkey (zero if none)
    pub const DEPLOY_SLOT: usize = 140; // u64
    pub const ATTESTED_SLOT: usize = 148; // u64
    pub const REPORT_HASH: usize = 156; // [u8; 32]
}

#[repr(u32)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum GuardError {
    InvalidInstruction = 0x4847_0000,
    BadStatus,
    NotExecutable,
    HookClosed,
    WrongProgramData,
    WrongVerdictAccount,
    WrongAttester,
    WrongHook,
    /// The hook program was redeployed after the verdict was written.
    HookChanged,
    /// The hook's upgrade authority changed after the verdict was written.
    AuthorityChanged,
    /// The verdict's status is not in the caller's allowed mask.
    StatusNotAllowed,
    /// The verdict is older than the caller's max age.
    VerdictStale,
}

impl From<GuardError> for ProgramError {
    fn from(e: GuardError) -> Self {
        ProgramError::Custom(e as u32)
    }
}

/// What a hook program is right now, read from the BPF loader accounts.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct HookIdentity {
    pub upgradeable: bool,
    pub programdata: Pubkey,
    pub authority: Pubkey,
    pub deploy_slot: u64,
}

const ZERO: Pubkey = [0u8; 32];

/// Reads the identity of `hook`. For upgradeable programs `programdata` must be the account the
/// program points to; for any other loader pass the hook program again and the identity is fixed.
pub fn read_identity(hook: &AccountInfo, programdata: &AccountInfo) -> Result<HookIdentity, ProgramError> {
    if !hook.executable() {
        return Err(GuardError::NotExecutable.into());
    }
    let owner = hook.owner();
    if owner != &BPF_UPGRADEABLE_LOADER {
        return Ok(HookIdentity { upgradeable: false, programdata: ZERO, authority: ZERO, deploy_slot: 0 });
    }
    let hook_data = hook.try_borrow_data()?;
    // UpgradeableLoaderState::Program { programdata_address }
    if hook_data.len() < 36 || hook_data[0..4] != [2, 0, 0, 0] {
        return Err(GuardError::WrongProgramData.into());
    }
    let mut pd_key = ZERO;
    pd_key.copy_from_slice(&hook_data[4..36]);
    if programdata.key() != &pd_key {
        return Err(GuardError::WrongProgramData.into());
    }
    let pd = programdata.try_borrow_data()?;
    // UpgradeableLoaderState::ProgramData { slot, upgrade_authority_address: Option<Pubkey> } + ELF
    if programdata.lamports() == 0 || pd.len() <= 45 || pd[0..4] != [3, 0, 0, 0] {
        return Err(GuardError::HookClosed.into());
    }
    let deploy_slot = u64::from_le_bytes(pd[4..12].try_into().unwrap());
    let mut authority = ZERO;
    if pd[12] == 1 {
        authority.copy_from_slice(&pd[13..45]);
    }
    Ok(HookIdentity { upgradeable: authority != ZERO, programdata: pd_key, authority, deploy_slot })
}

pub fn process_instruction(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let (disc, args) = data.split_first().ok_or(GuardError::InvalidInstruction)?;
    match disc {
        0 => set_verdict(program_id, accounts, args),
        1 => assert_hook(program_id, accounts, args),
        2 => close_verdict(program_id, accounts),
        _ => Err(GuardError::InvalidInstruction.into()),
    }
}

fn set_verdict(program_id: &Pubkey, accounts: &[AccountInfo], args: &[u8]) -> ProgramResult {
    let [attester, verdict, hook, programdata, _system, ..] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };
    if args.len() < 33 {
        return Err(GuardError::InvalidInstruction.into());
    }
    let status = args[0];
    if status == 0 || status > status::MAX {
        return Err(GuardError::BadStatus.into());
    }
    if !attester.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    let (expected, bump) = find_program_address(&[VERDICT_SEED, attester.key(), hook.key()], program_id);
    if verdict.key() != &expected {
        return Err(GuardError::WrongVerdictAccount.into());
    }
    let id = read_identity(hook, programdata)?;

    if verdict.data_is_empty() {
        let bump_arr = [bump];
        let seeds = [Seed::from(VERDICT_SEED), Seed::from(attester.key().as_ref()), Seed::from(hook.key().as_ref()), Seed::from(&bump_arr)];
        CreateAccount {
            from: attester,
            to: verdict,
            lamports: Rent::get()?.minimum_balance(VERDICT_LEN),
            space: VERDICT_LEN as u64,
            owner: program_id,
        }
        .invoke_signed(&[Signer::from(&seeds)])?;
    } else if !verdict.is_owned_by(program_id) {
        return Err(GuardError::WrongVerdictAccount.into());
    }

    let slot = Clock::get()?.slot;
    let mut d = verdict.try_borrow_mut_data()?;
    use layout::*;
    d[DISC..DISC + 8].copy_from_slice(&VERDICT_DISC);
    d[VERSION] = 1;
    d[STATUS] = status;
    d[BUMP] = bump;
    d[FLAGS] = id.upgradeable as u8;
    d[ATTESTER..ATTESTER + 32].copy_from_slice(attester.key());
    d[HOOK..HOOK + 32].copy_from_slice(hook.key());
    d[PROGRAMDATA..PROGRAMDATA + 32].copy_from_slice(&id.programdata);
    d[AUTHORITY..AUTHORITY + 32].copy_from_slice(&id.authority);
    d[DEPLOY_SLOT..DEPLOY_SLOT + 8].copy_from_slice(&id.deploy_slot.to_le_bytes());
    d[ATTESTED_SLOT..ATTESTED_SLOT + 8].copy_from_slice(&slot.to_le_bytes());
    d[REPORT_HASH..REPORT_HASH + 32].copy_from_slice(&args[1..33]);
    Ok(())
}

fn assert_hook(program_id: &Pubkey, accounts: &[AccountInfo], args: &[u8]) -> ProgramResult {
    let [verdict, hook, programdata, ..] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };
    if args.len() < 41 {
        return Err(GuardError::InvalidInstruction.into());
    }
    if !verdict.is_owned_by(program_id) {
        return Err(GuardError::WrongVerdictAccount.into());
    }
    let d = verdict.try_borrow_data()?;
    use layout::*;
    if d.len() < VERDICT_LEN || d[DISC..DISC + 8] != VERDICT_DISC {
        return Err(GuardError::WrongVerdictAccount.into());
    }
    if d[ATTESTER..ATTESTER + 32] != args[0..32] {
        return Err(GuardError::WrongAttester.into());
    }
    if &d[HOOK..HOOK + 32] != hook.key().as_ref() {
        return Err(GuardError::WrongHook.into());
    }
    let mask = args[32];
    if mask & (1u8 << d[STATUS]) == 0 {
        return Err(GuardError::StatusNotAllowed.into());
    }
    let max_age = u64::from_le_bytes(args[33..41].try_into().unwrap());
    if max_age > 0 {
        let attested = u64::from_le_bytes(d[ATTESTED_SLOT..ATTESTED_SLOT + 8].try_into().unwrap());
        if Clock::get()?.slot.saturating_sub(attested) > max_age {
            return Err(GuardError::VerdictStale.into());
        }
    }

    let live = read_identity(hook, programdata)?;
    let pinned_slot = u64::from_le_bytes(d[DEPLOY_SLOT..DEPLOY_SLOT + 8].try_into().unwrap());
    if live.programdata != d[PROGRAMDATA..PROGRAMDATA + 32] || live.deploy_slot != pinned_slot {
        return Err(GuardError::HookChanged.into());
    }
    if live.authority != d[AUTHORITY..AUTHORITY + 32] {
        return Err(GuardError::AuthorityChanged.into());
    }
    Ok(())
}

fn close_verdict(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let [attester, verdict, ..] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };
    if !attester.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !verdict.is_owned_by(program_id) {
        return Err(GuardError::WrongVerdictAccount.into());
    }
    {
        let d = verdict.try_borrow_data()?;
        if d.len() < VERDICT_LEN || d[layout::ATTESTER..layout::ATTESTER + 32] != attester.key()[..] {
            return Err(GuardError::WrongAttester.into());
        }
    }
    let lamports = verdict.lamports();
    *attester.try_borrow_mut_lamports()? += lamports;
    *verdict.try_borrow_mut_lamports()? = 0;
    verdict.close()
}

#[cfg(all(test, not(target_os = "solana")))]
mod tests;
