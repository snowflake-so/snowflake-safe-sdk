import { AnchorProvider } from "@project-serum/anchor";
import { SerializableAction, TriggerType } from "@snowflake-so/snowflake-sdk";
import {
  clusterApiUrl,
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import { MultisigJobBuilder } from "../src/builders/mutisig-job-builder";
import { DEFAULT_FLOW_SIZE } from "../src/config/job-config";
import { MultisigJob, ProposalStateType } from "../src/models";
import { SnowflakeSafe } from "../src/services/snowflake-safe";
import { instructions } from "./test-data";

let provider: AnchorProvider;
let snowflakeSafe: SnowflakeSafe;
let owner: PublicKey;

let testJobs: MultisigJob[] = [];
let safeKeypair: Keypair = Keypair.generate();
let safeAddress: PublicKey = safeKeypair.publicKey;

jest.setTimeout(60 * 1000);

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
  expect(fetchedSafe).toBeTruthy();
  if (fetchedSafe) {
    expect(fetchedSafe.creator.toString()).toBe(owner.toString());
    expect(fetchedSafe.ownerSetSeqno).toBe(0);
    expect(fetchedSafe.approvalsRequired).toBe(input.approvalsRequired);
    expect(fetchedSafe.owners.length).toBe(input.owners.length);
  }
});

test("create multisig flow", async function () {
  const newFlowKeypair = Keypair.generate();
  const job = new MultisigJobBuilder()
    .jobInstructions(instructions)
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

  let flow = await snowflakeSafe.fetchJob(newFlowKeypair.publicKey);

  expect(flow).toBeTruthy();
  if (flow) {
    expect(flow.name).toBe("hello world");
    expect(flow.proposalStage).toBe(ProposalStateType.Approved);
    expect(flow.safe.toString()).toBe(safeAddress.toString());
    expect(flow.approvals.length).toBe(1);
    expect(flow.triggerType).toBe(TriggerType.None);
    expect(flow.instructions.length).toBe(1);
  }
});

test("Add owner", async function () {
  const newFlowKeypair = Keypair.generate();
  const newOwner = Keypair.generate().publicKey;

  const ix = await snowflakeSafe.createAddOwnerInstruction(
    safeAddress,
    newOwner
  );

  const job = new MultisigJobBuilder()
    .jobInstructions([ix])
    .jobName("Add owner")
    .build();

  const txId = await snowflakeSafe.createFlow(
    safeAddress,
    DEFAULT_FLOW_SIZE,
    registerTestJob(job),
    newFlowKeypair,
    []
  );
  console.log("create new add owner flow txn signature ", txId);

  let flow = await snowflakeSafe.fetchJob(newFlowKeypair.publicKey);

  expect(flow).toBeTruthy();
  if (flow) {
    expect(flow.name).toBe("Add owner");
    expect(flow.proposalStage).toBe(ProposalStateType.Approved);
    expect(flow.safe.toString()).toBe(safeAddress.toString());
    expect(flow.approvals.length).toBe(1);
    expect(flow.triggerType).toBe(TriggerType.None);
    expect(flow.instructions.length).toBe(1);
  }
  // TODO execute add owner
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

  expect(flow).toBeTruthy();
  if (flow) {
    expect(flow.approvals[0].owner.toString()).toBe(owner.toString());
    expect(flow.approvals[0].isApproved).toBe(true);
  }
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

  expect(flow).toBeTruthy();
  if (flow) {
    expect(flow.approvals[0].owner.toString()).toBe(owner.toString());
    expect(flow.approvals[0].isApproved).toBe(false);
  }
});

test("execute flow", async function () {
  const newFlowKeypair = Keypair.generate();
  const job = new MultisigJobBuilder()
    .jobInstructions(instructions)
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

  let flow = await snowflakeSafe.fetchJob(newFlowKeypair.publicKey);

  expect(flow).toBeTruthy();
  if (flow) {
    const tx = await snowflakeSafe.executeMultisigFlow(
      newFlowKeypair.publicKey,
      flow.instructions.map((ix) => SerializableAction.fromInstruction(ix)),
      safeAddress
    );

    console.log("execute flow txn signature ", tx);
  }
});

test("delete flow", async function () {
  const newFlowKeypair = Keypair.generate();
  const job = new MultisigJobBuilder()
    .jobInstructions(instructions)
    .jobName("hello world")
    .build();

  await snowflakeSafe.createFlow(
    safeAddress,
    DEFAULT_FLOW_SIZE,
    registerTestJob(job),
    newFlowKeypair,
    []
  );

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
