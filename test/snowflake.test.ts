import { AnchorProvider } from '@project-serum/anchor';
import {
  clusterApiUrl,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import { RECURRING_FOREVER } from '../src/config';
import { MultisigJobBuilder } from '../src/builders/mutisig-job-builder';
import { DEFAULT_FLOW_SIZE } from '../src/config/job-config';
import { ProposalStateType, SafeType, TriggerType } from '../src/models';
import { SnowflakeSafe } from '../src/services/snowflake-safe';
import { instructions, testWallet } from './test-data';
import { initAnchorProvider } from '../src/utils';

let provider: AnchorProvider;
let snowflakeSafe: SnowflakeSafe;
let owner: PublicKey;

jest.setTimeout(2 * 60 * 1000);

let safeAddress: PublicKey;

const createFlow = async (ixs: TransactionInstruction[]) => {
  const response = await snowflakeSafe.createProposal(safeAddress, 'hello world', ixs);
  return response;
};

const createRecurringFlow = async (ixs: TransactionInstruction[]) => {
  const proposal = new MultisigJobBuilder()
    .jobName('hello world')
    .jobInstructions(ixs)
    .scheduleCron('0 0 * * *')
    .build();
  const response = await snowflakeSafe.createRecurringProposal(safeAddress, proposal);

  return response;
};

const airdropSolToWallet = async () => {
  try {
    const balance = await provider.connection.getBalance(testWallet.publicKey);
    if (balance < 4 * LAMPORTS_PER_SOL) {
      const sig = await provider.connection.requestAirdrop(
        testWallet.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig);
    }
  } catch (error: any) {
    console.log(error.message);
  }
};
beforeAll(async () => {
  const API_URL = clusterApiUrl('devnet');
  provider = initAnchorProvider(testWallet, API_URL);
  // provider = AnchorProvider.local(API_URL);
  snowflakeSafe = new SnowflakeSafe(provider);
  await airdropSolToWallet();
  owner = provider.wallet.publicKey;
});

describe('create', () => {
  test('create safe', async function () {
    const input = {
      approvalsRequired: 1,
      owners: [owner],
    };
    const [address] = await snowflakeSafe.createSafe(input.owners, input.approvalsRequired);
    safeAddress = address;
    const fetchedSafe: any = await snowflakeSafe.program.account.safe.fetch(safeAddress);
    expect(fetchedSafe.creator.toString()).toBe(owner.toString());
    expect(fetchedSafe.ownerSetSeqno).toBe(0);
    expect(fetchedSafe.approvalsRequired).toBe(input.approvalsRequired);
    expect(fetchedSafe.owners.length).toBe(input.owners.length);

    const ownerSafes = await snowflakeSafe.fetchOwnedSafes(owner);
    expect(ownerSafes.some((safe: SafeType) => safe.safeAddress.equals(safeAddress))).toBeTruthy();
  });
  test('create proposal', async function () {
    const [newProposalAddress] = await createFlow(instructions);

    const flow = await snowflakeSafe.fetchProposal(newProposalAddress);

    expect(flow.proposalStage).toBe(ProposalStateType.Approved);
    expect(flow.safe.toString()).toBe(safeAddress.toString());
    expect(flow.approvals.length).toBe(1);
    expect(flow.triggerType).toBe(TriggerType.None);
    expect(flow.instructions.length).toBe(1);
  });
  test('create draft proposal - add actions later', async function () {
    const [newProposalAddress] = await snowflakeSafe.createProposal(
      safeAddress,
      'hello world',
      instructions,
      [],
      DEFAULT_FLOW_SIZE,
      true,
      true
    );

    const flow = await snowflakeSafe.fetchProposal(newProposalAddress);

    expect(flow.instructions.length).toBe(1);
    expect(flow.proposalStage).toBe(ProposalStateType.Approved);
    expect(flow.safe.toString()).toBe(safeAddress.toString());
    expect(flow.approvals.length).toBe(1);
    expect(flow.triggerType).toBe(TriggerType.None);
    expect(flow.instructions.length).toBe(1);
  });

  test('create recurring proposal', async function () {
    const [newProposalAddress] = await createRecurringFlow(instructions);

    const flow = await snowflakeSafe.fetchProposal(newProposalAddress);

    expect(flow.proposalStage).toBe(ProposalStateType.Approved);
    expect(flow.safe.toString()).toBe(safeAddress.toString());
    expect(flow.approvals.length).toBe(1);
    expect(flow.triggerType).toBe(TriggerType.Time);
    expect(flow.instructions.length).toBe(1);
    expect(flow.recurring).toBe(true);
    expect(flow.remainingRuns).toBe(RECURRING_FOREVER);
    expect(flow.cron).toBe('0 0 * * *');
  });
});

describe('update proposal', () => {
  const newOwner = Keypair.generate().publicKey;

  test('add owner', async function () {
    const ix = await snowflakeSafe.createAddOwnerProposalInstruction(safeAddress, newOwner);

    const [newProposalAddress] = await createFlow([ix]);

    const flow = await snowflakeSafe.fetchProposal(newProposalAddress);

    expect(flow.proposalStage).toBe(ProposalStateType.Approved);
    expect(flow.safe.toString()).toBe(safeAddress.toString());
    expect(flow.approvals.length).toBe(1);
    expect(flow.triggerType).toBe(TriggerType.None);
    expect(flow.instructions.length).toBe(1);

    await snowflakeSafe.executeProposal(newProposalAddress);

    const safe = await snowflakeSafe.fetchSafe(safeAddress);

    expect(flow.proposalStage).toBe(ProposalStateType.Approved);
    expect(safe.owners.map(owner => owner.toString()).includes(newOwner.toString())).toBeTruthy();
  });

  test('remove owner', async function () {
    const ix = await snowflakeSafe.createRemoveOwnerProposalInstruction(safeAddress, newOwner);
    const [newProposalAddress] = await createFlow([ix]);

    let flow = await snowflakeSafe.fetchProposal(newProposalAddress);

    expect(flow.proposalStage).toBe(ProposalStateType.Approved);
    expect(flow.safe.toString()).toBe(safeAddress.toString());
    expect(flow.approvals.length).toBe(1);
    expect(flow.triggerType).toBe(TriggerType.None);
    expect(flow.instructions.length).toBe(1);

    await snowflakeSafe.executeProposal(newProposalAddress);

    const safe = await snowflakeSafe.fetchSafe(safeAddress);

    flow = await snowflakeSafe.fetchProposal(newProposalAddress);
    expect(flow.proposalStage).toBe(ProposalStateType.Complete);
    expect(safe.owners.length).toBe(1);
    expect(!safe.owners.map(owner => owner.toString()).includes(newOwner.toString())).toBeTruthy();
    expect(safe.ownerSetSeqno).toBe(2);
  });
});

describe('proposal confirmation', () => {
  test('approve proposal', async function () {
    const newFlowKeypair = Keypair.generate();
    const job = new MultisigJobBuilder().jobInstructions([]).jobName('hello world').build();

    const ix = await snowflakeSafe.instructionBuilder.buildCreateFlowInstruction(
      owner,
      DEFAULT_FLOW_SIZE,
      job,
      false,
      safeAddress,
      newFlowKeypair,
      SystemProgram.programId
    );
    const instructions = [ix];
    await snowflakeSafe.transactionSender.sendWithWallet({
      instructions,
      signers: [newFlowKeypair],
    });

    await snowflakeSafe.approveProposal(newFlowKeypair.publicKey);

    const flow = await snowflakeSafe.fetchProposal(newFlowKeypair.publicKey);

    expect(flow.approvals[0].owner.toString()).toBe(owner.toString());
    expect(flow.approvals[0].isApproved).toBe(true);
    expect(flow.proposalStage).toBe(ProposalStateType.Approved);
  });

  test('reject proposal', async function () {
    const newFlowKeypair = Keypair.generate();
    const job = new MultisigJobBuilder().jobInstructions([]).jobName('hello world').build();

    const ix = await snowflakeSafe.instructionBuilder.buildCreateFlowInstruction(
      owner,
      DEFAULT_FLOW_SIZE,
      job,
      false,
      safeAddress,
      newFlowKeypair,
      SystemProgram.programId
    );
    const instructions = [ix];
    await snowflakeSafe.transactionSender.sendWithWallet({
      instructions,
      signers: [newFlowKeypair],
    });

    await snowflakeSafe.rejectProposal(newFlowKeypair.publicKey);

    const flow = await snowflakeSafe.fetchProposal(newFlowKeypair.publicKey);

    expect(flow.approvals[0].owner.toString()).toBe(owner.toString());
    expect(flow.approvals[0].isApproved).toBe(false);
    expect(flow.proposalStage).toBe(ProposalStateType.Rejected);
  });
});

describe('proposal execution', () => {
  test('abort recurring proposal', async function () {
    const [newProposalAddress] = await createRecurringFlow(instructions);
    await snowflakeSafe.executeProposal(newProposalAddress);

    await snowflakeSafe.abortRecurringProposal(newProposalAddress);

    const flow = await snowflakeSafe.fetchProposal(newProposalAddress);
    expect(flow.proposalStage).toBe(ProposalStateType.Aborted);
  });

  test('execute recurring proposal', async function () {
    const [newProposalAddress] = await createRecurringFlow(instructions);
    await snowflakeSafe.executeProposal(newProposalAddress);

    const flow = await snowflakeSafe.fetchProposal(newProposalAddress);
    expect(flow.proposalStage).toBe(ProposalStateType.ExecutionInProgress);
  });

  test('execute proposal', async function () {
    const [newProposalAddress] = await createFlow(instructions);
    await snowflakeSafe.executeProposal(newProposalAddress);

    const flow = await snowflakeSafe.fetchProposal(newProposalAddress);
    expect(flow.proposalStage).toBe(ProposalStateType.Complete);
  });
});

test('delete proposal', async function () {
  const [newProposalAddress] = await createFlow(instructions);

  await snowflakeSafe.deleteProposal(newProposalAddress);

  try {
    await snowflakeSafe.fetchProposal(newProposalAddress);
  } catch (error: any) {
    expect(error.message).toBe(`Account does not exist ${newProposalAddress.toString()}`);
  }
});
