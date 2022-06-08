import { AnchorProvider } from "@project-serum/anchor";
import {
  clusterApiUrl,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { MultisigJobBuilder } from "../src/builders/mutisig-job-builder";
import { DEFAULT_FLOW_SIZE } from "../src/config/job-config";
import {
  MultisigJob,
  ProposalStateType,
  SerializableAction,
  TriggerType,
} from "../src/models";
import { SnowflakeSafe } from "../src/services/snowflake-safe";
import { instructions } from "./test-data";

let provider: AnchorProvider;
let snowflakeSafe: SnowflakeSafe;
let owner: PublicKey;

let testJobs: MultisigJob[] = [];
let safeKeypair: Keypair = Keypair.generate();
let safeAddress: PublicKey = safeKeypair.publicKey;

jest.setTimeout(60 * 1000);

const createFlow = async (
  ixs: TransactionInstruction[],
  newFlowKeypair: Keypair
) => {
  const job = new MultisigJobBuilder()
    .jobInstructions(ixs)
    .jobName("hello world")
    .build();

  const txId = await snowflakeSafe.createFlow(
    safeAddress,
    DEFAULT_FLOW_SIZE,
    registerTestJob(job),
    newFlowKeypair,
    []
  );
  console.log("create new flow txn signature ", txId);
};

beforeAll(() => {
  const API_URL = clusterApiUrl("devnet");
  provider = AnchorProvider.local(API_URL);
  snowflakeSafe = new SnowflakeSafe(provider);
  owner = provider.wallet.publicKey;
});

test("create safe", async function () {
  const input = {
    approvalsRequired: 1,
    owners: [owner],
  };
  const txId = await snowflakeSafe.createSafe(
    safeKeypair,
    input.owners,
    input.approvalsRequired
  );
  console.log("create safe txn signature ", txId);

  let fetchedSafe = await snowflakeSafe.fetchSafe(safeKeypair.publicKey);
  expect(fetchedSafe.creator.toString()).toBe(owner.toString());
  expect(fetchedSafe.ownerSetSeqno).toBe(0);
  expect(fetchedSafe.approvalsRequired).toBe(input.approvalsRequired);
  expect(fetchedSafe.owners.length).toBe(input.owners.length);
});

test("create multisig flow", async function () {
  const newFlowKeypair = Keypair.generate();
  await createFlow(instructions, newFlowKeypair);

  let flow = await snowflakeSafe.fetchJob(newFlowKeypair.publicKey);

  expect(flow.proposalStage).toBe(ProposalStateType.Approved);
  expect(flow.safe.toString()).toBe(safeAddress.toString());
  expect(flow.approvals.length).toBe(1);
  expect(flow.triggerType).toBe(TriggerType.None);
  expect(flow.instructions.length).toBe(1);
});

let newOwner = Keypair.generate().publicKey;

test("add owner", async function () {
  const newFlowKeypair = Keypair.generate();

  const ix = await snowflakeSafe.createAddOwnerInstruction(
    safeAddress,
    newOwner
  );

  await createFlow([ix], newFlowKeypair);

  let flow = await snowflakeSafe.fetchJob(newFlowKeypair.publicKey);

  expect(flow.proposalStage).toBe(ProposalStateType.Approved);
  expect(flow.safe.toString()).toBe(safeAddress.toString());
  expect(flow.approvals.length).toBe(1);
  expect(flow.triggerType).toBe(TriggerType.None);
  expect(flow.instructions.length).toBe(1);

  const actions = flow.instructions.map((ix: TransactionInstruction) =>
    SerializableAction.fromInstruction(ix)
  );

  const tx = await snowflakeSafe.executeMultisigFlow(
    newFlowKeypair.publicKey,
    actions,
    safeAddress
  );

  let safe = await snowflakeSafe.fetchSafe(safeAddress);

  console.log("execute add owner flow txn signature ", tx);

  expect(flow.proposalStage).toBe(ProposalStateType.Approved);
  expect(
    safe.owners.map((owner) => owner.toString()).includes(newOwner.toString())
  ).toBeTruthy();
});

test("remove owner", async function () {
  const newFlowKeypair = Keypair.generate();

  const ix = await snowflakeSafe.createRemoveOwnerInstruction(
    safeAddress,
    newOwner
  );
  await createFlow([ix], newFlowKeypair);

  let flow = await snowflakeSafe.fetchJob(newFlowKeypair.publicKey);

  expect(flow.proposalStage).toBe(ProposalStateType.Approved);
  expect(flow.safe.toString()).toBe(safeAddress.toString());
  expect(flow.approvals.length).toBe(1);
  expect(flow.triggerType).toBe(TriggerType.None);
  expect(flow.instructions.length).toBe(1);

  const actions = flow.instructions.map((ix: TransactionInstruction) =>
    SerializableAction.fromInstruction(ix)
  );

  const tx = await snowflakeSafe.executeMultisigFlow(
    newFlowKeypair.publicKey,
    actions,
    safeAddress
  );

  let safe = await snowflakeSafe.fetchSafe(safeAddress);

  console.log("execute add owner flow txn signature ", tx);

  expect(flow.proposalStage).toBe(ProposalStateType.Approved);
  expect(safe.owners.length).toBe(1);
  expect(
    !safe.owners.map((owner) => owner.toString()).includes(newOwner.toString())
  ).toBeTruthy();
  expect(safe.ownerSetSeqno).toBe(2);
});

test("approve flow", async function () {
  const newFlowKeypair = Keypair.generate();
  const job = new MultisigJobBuilder()
    .jobInstructions([])
    .jobName("hello world")
    .build();

  const ix = await snowflakeSafe.instructionBuilder.buildCreateFlowInstruction(
    owner,
    DEFAULT_FLOW_SIZE,
    job,
    safeAddress,
    newFlowKeypair,
    SystemProgram.programId
  );
  const instructions = [ix];
  await snowflakeSafe.transactionSender.sendWithWallet({
    instructions,
    signers: [newFlowKeypair],
  });

  const tx = await snowflakeSafe.approveProposal(
    safeAddress,
    newFlowKeypair.publicKey
  );
  console.log("approve flow txn signature ", tx);

  let flow = await snowflakeSafe.fetchJob(newFlowKeypair.publicKey);

  expect(flow.approvals[0].owner.toString()).toBe(owner.toString());
  expect(flow.approvals[0].isApproved).toBe(true);
});

test("reject flow", async function () {
  const newFlowKeypair = Keypair.generate();
  const job = new MultisigJobBuilder()
    .jobInstructions([])
    .jobName("hello world")
    .build();

  const ix = await snowflakeSafe.instructionBuilder.buildCreateFlowInstruction(
    owner,
    DEFAULT_FLOW_SIZE,
    job,
    safeAddress,
    newFlowKeypair,
    SystemProgram.programId
  );
  const instructions = [ix];
  await snowflakeSafe.transactionSender.sendWithWallet({
    instructions,
    signers: [newFlowKeypair],
  });

  const tx = await snowflakeSafe.rejectProposal(
    safeAddress,
    newFlowKeypair.publicKey
  );
  console.log("approve flow txn signature ", tx);

  let flow = await snowflakeSafe.fetchJob(newFlowKeypair.publicKey);

  expect(flow.approvals[0].owner.toString()).toBe(owner.toString());
  expect(flow.approvals[0].isApproved).toBe(false);
});

test("execute flow", async function () {
  const newFlowKeypair = Keypair.generate();

  await createFlow(instructions, newFlowKeypair);

  let flow = await snowflakeSafe.fetchJob(newFlowKeypair.publicKey);

  const tx = await snowflakeSafe.executeMultisigFlow(
    newFlowKeypair.publicKey,
    flow.instructions.map((ix: any) => SerializableAction.fromInstruction(ix)),
    safeAddress
  );

  console.log("execute flow txn signature ", tx);
});

test("delete flow", async function () {
  const newFlowKeypair = Keypair.generate();
  await createFlow(instructions, newFlowKeypair);

  const txId = await snowflakeSafe.deleteFlow(newFlowKeypair.publicKey);

  console.log("delete flow txn signature ", txId);

  try {
    await snowflakeSafe.fetchJob(newFlowKeypair.publicKey);
  } catch (error: any) {
    expect(error.message).toBe(
      `Account does not exist ${newFlowKeypair.publicKey.toString()}`
    );
  }
});

function registerTestJob(job: MultisigJob) {
  testJobs.push(job);
  return job;
}
