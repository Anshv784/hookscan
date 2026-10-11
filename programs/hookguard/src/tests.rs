//! Runs the compiled SBF program in Mollusk with hand-built BPF loader accounts, so redeploys,
//! authority changes and closed programs can be simulated exactly.
use crate::{layout, status, GuardError, VERDICT_LEN, VERDICT_SEED};
use mollusk_svm::{program::keyed_account_for_system_program, result::Check, Mollusk};
use solana_account::Account;
use solana_instruction::{AccountMeta, Instruction};
use solana_program_error::ProgramError;
use solana_pubkey::Pubkey;

const PROGRAM_ID: Pubkey = Pubkey::new_from_array(crate::ID);
const LOADER: Pubkey = Pubkey::new_from_array(crate::BPF_UPGRADEABLE_LOADER);
const ALL: u8 = 0b1_1110;
const OPEN_ONLY: u8 = 1 << status::OPEN;

fn mollusk() -> Mollusk {
    unsafe { std::env::set_var("SBF_OUT_DIR", concat!(env!("CARGO_MANIFEST_DIR"), "/target/deploy")) };
    Mollusk::new(&PROGRAM_ID, "hookguard")
}

struct Hook {
    program: Pubkey,
    programdata: Pubkey,
}

fn hook_accounts(slot: u64, authority: Option<Pubkey>) -> (Hook, Account, Account) {
    let program = Pubkey::new_unique();
    let programdata = Pubkey::new_unique();
    let mut pdata = vec![2, 0, 0, 0];
    pdata.extend_from_slice(programdata.as_ref());
    let prog = Account { lamports: 1_141_440, data: pdata, owner: LOADER, executable: true, rent_epoch: 0 };
    (Hook { program, programdata }, prog, programdata_account(slot, authority))
}

fn programdata_account(slot: u64, authority: Option<Pubkey>) -> Account {
    let mut d = vec![3, 0, 0, 0];
    d.extend_from_slice(&slot.to_le_bytes());
    match authority {
        Some(a) => {
            d.push(1);
            d.extend_from_slice(a.as_ref());
        }
        None => {
            d.push(0);
            d.extend_from_slice(&[0u8; 32]);
        }
    }
    d.extend_from_slice(&[0x7f, b'E', b'L', b'F', 0, 0, 0, 0]); // stand-in for the ELF
    Account { lamports: 5_000_000, data: d, owner: LOADER, executable: false, rent_epoch: 0 }
}

fn verdict_key(attester: &Pubkey, hook: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[VERDICT_SEED, attester.as_ref(), hook.as_ref()], &PROGRAM_ID).0
}

fn set_verdict_ix(attester: Pubkey, verdict: Pubkey, hook: &Hook, status: u8) -> Instruction {
    let mut data = vec![0, status];
    data.extend_from_slice(&[7u8; 32]);
    Instruction::new_with_bytes(
        PROGRAM_ID,
        &data,
        vec![
            AccountMeta::new(attester, true),
            AccountMeta::new(verdict, false),
            AccountMeta::new_readonly(hook.program, false),
            AccountMeta::new_readonly(hook.programdata, false),
            AccountMeta::new_readonly(solana_pubkey::pubkey!("11111111111111111111111111111111"), false),
        ],
    )
}

fn assert_ix(verdict: Pubkey, hook: &Hook, attester: &Pubkey, mask: u8, max_age: u64) -> Instruction {
    let mut data = vec![1];
    data.extend_from_slice(attester.as_ref());
    data.push(mask);
    data.extend_from_slice(&max_age.to_le_bytes());
    Instruction::new_with_bytes(
        PROGRAM_ID,
        &data,
        vec![
            AccountMeta::new_readonly(verdict, false),
            AccountMeta::new_readonly(hook.program, false),
            AccountMeta::new_readonly(hook.programdata, false),
        ],
    )
}

fn err(e: GuardError) -> Check<'static> {
    Check::err(ProgramError::Custom(e as u32))
}

fn funded() -> Account {
    Account::new(1_000_000_000, 0, &solana_pubkey::pubkey!("11111111111111111111111111111111"))
}

/// Writes a verdict and returns (mollusk, attester, verdict key, verdict account, hook, program acc, programdata acc).
fn attested(status: u8) -> (Mollusk, Pubkey, Pubkey, Account, Hook, Account, Account) {
    let mollusk = mollusk();
    let attester = Pubkey::new_unique();
    let (hook, prog, pd) = hook_accounts(450_000_000, Some(Pubkey::new_unique()));
    let verdict = verdict_key(&attester, &hook.program);
    let res = mollusk.process_and_validate_instruction(
        &set_verdict_ix(attester, verdict, &hook, status),
        &[
            (attester, funded()),
            (verdict, Account::default()),
            (hook.program, prog.clone()),
            (hook.programdata, pd.clone()),
            keyed_account_for_system_program(),
        ],
        &[Check::success()],
    );
    let v = res.get_account(&verdict).unwrap().clone();
    (mollusk, attester, verdict, v, hook, prog, pd)
}

#[test]
fn set_verdict_pins_the_identity_read_from_chain() {
    let (_m, attester, _v, acc, hook, _p, pd) = attested(status::OPEN);
    let d = &acc.data;
    assert_eq!(acc.owner, PROGRAM_ID);
    assert_eq!(d.len(), VERDICT_LEN);
    assert_eq!(&d[0..8], b"HKVERDCT");
    assert_eq!(d[layout::STATUS], status::OPEN);
    assert_eq!(d[layout::FLAGS], 1);
    assert_eq!(&d[layout::ATTESTER..layout::ATTESTER + 32], attester.as_ref());
    assert_eq!(&d[layout::HOOK..layout::HOOK + 32], hook.program.as_ref());
    assert_eq!(&d[layout::PROGRAMDATA..layout::PROGRAMDATA + 32], hook.programdata.as_ref());
    assert_eq!(&d[layout::AUTHORITY..layout::AUTHORITY + 32], &pd.data[13..45]);
    assert_eq!(u64::from_le_bytes(d[layout::DEPLOY_SLOT..layout::DEPLOY_SLOT + 8].try_into().unwrap()), 450_000_000);
}

#[test]
fn assert_passes_while_the_hook_is_unchanged() {
    let (m, attester, verdict, v, hook, prog, pd) = attested(status::OPEN);
    m.process_and_validate_instruction(
        &assert_ix(verdict, &hook, &attester, OPEN_ONLY, 0),
        &[(verdict, v), (hook.program, prog), (hook.programdata, pd)],
        &[Check::success()],
    );
}

#[test]
fn assert_fails_after_the_hook_is_redeployed() {
    let (m, attester, verdict, v, hook, prog, pd) = attested(status::OPEN);
    let mut redeployed = pd.clone();
    redeployed.data[4..12].copy_from_slice(&450_000_777u64.to_le_bytes());
    m.process_and_validate_instruction(
        &assert_ix(verdict, &hook, &attester, OPEN_ONLY, 0),
        &[(verdict, v), (hook.program, prog), (hook.programdata, redeployed)],
        &[err(GuardError::HookChanged)],
    );
}

#[test]
fn assert_fails_when_the_upgrade_key_changes() {
    let (m, attester, verdict, v, hook, prog, pd) = attested(status::OPEN);
    let mut handed_over = pd.clone();
    handed_over.data[13..45].copy_from_slice(Pubkey::new_unique().as_ref());
    m.process_and_validate_instruction(
        &assert_ix(verdict, &hook, &attester, OPEN_ONLY, 0),
        &[(verdict, v), (hook.program, prog), (hook.programdata, handed_over)],
        &[err(GuardError::AuthorityChanged)],
    );
}

#[test]
fn assert_fails_when_the_hook_program_is_closed() {
    let (m, attester, verdict, v, hook, prog, _pd) = attested(status::OPEN);
    let closed = Account { lamports: 0, data: vec![], owner: LOADER, executable: false, rent_epoch: 0 };
    m.process_and_validate_instruction(
        &assert_ix(verdict, &hook, &attester, OPEN_ONLY, 0),
        &[(verdict, v), (hook.program, prog), (hook.programdata, closed)],
        &[err(GuardError::HookClosed)],
    );
}

#[test]
fn assert_rejects_a_status_the_caller_did_not_allow() {
    let (m, attester, verdict, v, hook, prog, pd) = attested(status::GATED);
    m.process_and_validate_instruction(
        &assert_ix(verdict, &hook, &attester, OPEN_ONLY, 0),
        &[(verdict, v.clone()), (hook.program, prog.clone()), (hook.programdata, pd.clone())],
        &[err(GuardError::StatusNotAllowed)],
    );
    m.process_and_validate_instruction(
        &assert_ix(verdict, &hook, &attester, ALL, 0),
        &[(verdict, v), (hook.program, prog), (hook.programdata, pd)],
        &[Check::success()],
    );
}

#[test]
fn assert_rejects_a_verdict_from_an_untrusted_attester() {
    let (m, _attester, verdict, v, hook, prog, pd) = attested(status::OPEN);
    let trusted = Pubkey::new_unique();
    m.process_and_validate_instruction(
        &assert_ix(verdict, &hook, &trusted, OPEN_ONLY, 0),
        &[(verdict, v), (hook.program, prog), (hook.programdata, pd)],
        &[err(GuardError::WrongAttester)],
    );
}

#[test]
fn assert_rejects_a_verdict_for_a_different_hook() {
    let (m, attester, verdict, v, _hook, _prog, _pd) = attested(status::OPEN);
    let (other, oprog, opd) = hook_accounts(1, Some(Pubkey::new_unique()));
    m.process_and_validate_instruction(
        &assert_ix(verdict, &other, &attester, OPEN_ONLY, 0),
        &[(verdict, v), (other.program, oprog), (other.programdata, opd)],
        &[err(GuardError::WrongHook)],
    );
}

#[test]
fn assert_enforces_max_age() {
    let (mut m, attester, verdict, v, hook, prog, pd) = attested(status::OPEN);
    m.sysvars.clock.slot += 10_000;
    m.process_and_validate_instruction(
        &assert_ix(verdict, &hook, &attester, OPEN_ONLY, 5_000),
        &[(verdict, v.clone()), (hook.program, prog.clone()), (hook.programdata, pd.clone())],
        &[err(GuardError::VerdictStale)],
    );
    m.process_and_validate_instruction(
        &assert_ix(verdict, &hook, &attester, OPEN_ONLY, 20_000),
        &[(verdict, v), (hook.program, prog), (hook.programdata, pd)],
        &[Check::success()],
    );
}

#[test]
fn assert_rejects_a_spoofed_programdata_account() {
    let (m, attester, verdict, v, hook, prog, pd) = attested(status::OPEN);
    let fake = Hook { program: hook.program, programdata: Pubkey::new_unique() };
    m.process_and_validate_instruction(
        &assert_ix(verdict, &fake, &attester, OPEN_ONLY, 0),
        &[(verdict, v), (hook.program, prog), (fake.programdata, pd)],
        &[err(GuardError::WrongProgramData)],
    );
}

#[test]
fn immutable_hooks_have_a_fixed_identity() {
    let m = mollusk();
    let attester = Pubkey::new_unique();
    let (hook, prog, pd) = hook_accounts(42, None);
    let verdict = verdict_key(&attester, &hook.program);
    let res = m.process_and_validate_instruction(
        &set_verdict_ix(attester, verdict, &hook, status::OPEN),
        &[(attester, funded()), (verdict, Account::default()), (hook.program, prog.clone()), (hook.programdata, pd.clone()), keyed_account_for_system_program()],
        &[Check::success()],
    );
    let v = res.get_account(&verdict).unwrap().clone();
    assert_eq!(v.data[layout::FLAGS], 0);
    m.process_and_validate_instruction(
        &assert_ix(verdict, &hook, &attester, OPEN_ONLY, 0),
        &[(verdict, v), (hook.program, prog), (hook.programdata, pd)],
        &[Check::success()],
    );
}

#[test]
fn set_verdict_requires_the_attester_signature_and_its_own_pda() {
    let m = mollusk();
    let attester = Pubkey::new_unique();
    let (hook, prog, pd) = hook_accounts(9, Some(Pubkey::new_unique()));
    let verdict = verdict_key(&attester, &hook.program);
    let mut unsigned = set_verdict_ix(attester, verdict, &hook, status::OPEN);
    unsigned.accounts[0].is_signer = false;
    m.process_and_validate_instruction(
        &unsigned,
        &[(attester, funded()), (verdict, Account::default()), (hook.program, prog.clone()), (hook.programdata, pd.clone()), keyed_account_for_system_program()],
        &[Check::err(ProgramError::MissingRequiredSignature)],
    );
    let wrong = Pubkey::new_unique();
    m.process_and_validate_instruction(
        &set_verdict_ix(attester, wrong, &hook, status::OPEN),
        &[(attester, funded()), (wrong, Account::default()), (hook.program, prog.clone()), (hook.programdata, pd.clone()), keyed_account_for_system_program()],
        &[err(GuardError::WrongVerdictAccount)],
    );
    m.process_and_validate_instruction(
        &set_verdict_ix(attester, verdict, &hook, 9),
        &[(attester, funded()), (verdict, Account::default()), (hook.program, prog), (hook.programdata, pd), keyed_account_for_system_program()],
        &[err(GuardError::BadStatus)],
    );
}

#[test]
fn reattesting_after_a_redeploy_repins_the_new_build() {
    let (m, attester, verdict, v, hook, prog, pd) = attested(status::OPEN);
    let mut redeployed = pd.clone();
    redeployed.data[4..12].copy_from_slice(&460_000_000u64.to_le_bytes());
    let res = m.process_and_validate_instruction(
        &set_verdict_ix(attester, verdict, &hook, status::SELL_BLOCKED),
        &[(attester, funded()), (verdict, v), (hook.program, prog.clone()), (hook.programdata, redeployed.clone()), keyed_account_for_system_program()],
        &[Check::success()],
    );
    let v2 = res.get_account(&verdict).unwrap().clone();
    assert_eq!(v2.data[layout::STATUS], status::SELL_BLOCKED);
    m.process_and_validate_instruction(
        &assert_ix(verdict, &hook, &attester, OPEN_ONLY, 0),
        &[(verdict, v2), (hook.program, prog), (hook.programdata, redeployed)],
        &[err(GuardError::StatusNotAllowed)],
    );
}

#[test]
fn close_verdict_returns_rent_to_the_attester_only() {
    let (m, attester, verdict, v, _hook, _prog, _pd) = attested(status::OPEN);
    let ix = |signer: Pubkey| {
        Instruction::new_with_bytes(PROGRAM_ID, &[2], vec![AccountMeta::new(signer, true), AccountMeta::new(verdict, false)])
    };
    let stranger = Pubkey::new_unique();
    m.process_and_validate_instruction(&ix(stranger), &[(stranger, funded()), (verdict, v.clone())], &[err(GuardError::WrongAttester)]);
    let rent = v.lamports;
    m.process_and_validate_instruction(
        &ix(attester),
        &[(attester, funded()), (verdict, v)],
        &[Check::success(), Check::account(&attester).lamports(1_000_000_000 + rent).build(), Check::account(&verdict).lamports(0).build()],
    );
}
