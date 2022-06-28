import { AnchorProvider } from "@project-serum/anchor";
import {
  clusterApiUrl,
  LAMPORTS_PER_SOL,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import { MultisigJobBuilder } from "../src/builders";
import { DEFAULT_FLOW_SIZE } from "../src/config";
import {
  ProposalStateType,
  SerializableAction,
  TriggerType,
} from "../src/models";
import { SnowflakeSafe } from "../src/services/snowflake-safe";
import { initAnchorProvider } from "../src/utils";
import { instructions, testSafe, testWallet } from "./test-data";
import { FRIKTION_DEPOSIT_TX } from "./test-app-data";
import {
  calculateTransactionByteData,
  processDeserializedInstruction,
} from "../src/utils/instruction";
import { FRIKTION_APP_PROGRAM_ID } from "../src/utils/ids";

let provider: AnchorProvider;
let snowflakeSafe: SnowflakeSafe;
let owner: PublicKey;

jest.setTimeout(60 * 1000);

let safeAddress: PublicKey;

const createRecurringFlow = async (ixs: TransactionInstruction[]) => {
  const proposal = new MultisigJobBuilder()
    .jobName("hello world")
    .jobInstructions(ixs)
    .scheduleCron("0 0 * * *")
    .build();
  const response = await snowflakeSafe.createRecurringProposal(
    safeAddress,
    proposal
  );

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
  const API_URL = clusterApiUrl("devnet");
  provider = initAnchorProvider(testWallet, API_URL);
  // provider = AnchorProvider.local(API_URL);
  snowflakeSafe = new SnowflakeSafe(provider);
  await airdropSolToWallet();
  owner = provider.wallet.publicKey;
});

// test("create safe", async function () {
//   const input = {
//     approvalsRequired: 1,
//     owners: [owner],
//   };
//   const [address, txId] = await snowflakeSafe.createSafe(
//     input.owners,
//     input.approvalsRequired
//   );
//   safeAddress = address;
//   console.log("create safe txn signature ", txId);
//   let fetchedSafe: any = await snowflakeSafe.program.account.safe.fetch(
//     safeAddress
//   );
//   expect(fetchedSafe.creator.toString()).toBe(owner.toString());
//   expect(fetchedSafe.ownerSetSeqno).toBe(0);
//   expect(fetchedSafe.approvalsRequired).toBe(input.approvalsRequired);
//   expect(fetchedSafe.owners.length).toBe(input.owners.length);
// });

describe("Blank proposal", () => {
  test("create blank proposal and add action", async () => {
    safeAddress = testSafe;
    console.log(testWallet.publicKey.toString());
    const [newProposalAddress] = await snowflakeSafe.createProposal(
      safeAddress,
      "hello world",
      [],
      [],
      DEFAULT_FLOW_SIZE,
      false
    );

    let flow = await snowflakeSafe.fetchProposal(newProposalAddress);

    expect(flow.proposalStage).toBe(ProposalStateType.Pending);
    expect(flow.safe.toString()).toBe(safeAddress.toString());
    expect(flow.approvals.length).toBe(0);
    expect(flow.triggerType).toBe(TriggerType.None);
    expect(flow.instructions.length).toBe(0);

    const action = SerializableAction.fromInstruction(instructions[0]);

    const addActionSampleIx =
      await snowflakeSafe.createAddProposalActionInstruction(
        newProposalAddress,
        action
      );

    await snowflakeSafe.transactionSender.sendWithWallet({
      instructions: [addActionSampleIx],
      signers: [],
    });

    flow = await snowflakeSafe.fetchProposal(newProposalAddress);

    expect(flow.instructions.length).toBe(1);
    expect(flow.instructions[0].programId.toString()).toEqual(
      instructions[0].programId.toString()
    );
    expect(flow.instructions[0].keys.length).toEqual(
      instructions[0].keys.length
    );
  });
});

describe("App: Friktion", () => {
  test("deposit proposal (without add action) -> encoding overruns buffer", async () => {
    const fritkionIxs = processDeserializedInstruction(FRIKTION_DEPOSIT_TX);
    snowflakeSafe
      .createProposal(
        safeAddress,
        "Friktion Deposit",
        fritkionIxs[1],
        fritkionIxs[0],
        DEFAULT_FLOW_SIZE,
        false
      )
      .catch((e: any) => expect(e.message).toBe("encoding overruns Buffer"));
  });

  test("deposit proposal (with add action)", async () => {
    safeAddress = testSafe;
    const [newProposalAddress] = await snowflakeSafe.createProposal(
      safeAddress,
      "Friktion Deposit",
      [],
      [],
      DEFAULT_FLOW_SIZE + 2000,
      false
    );

    let flow = await snowflakeSafe.fetchProposal(newProposalAddress);

    expect(flow.proposalStage).toBe(ProposalStateType.Pending);
    expect(flow.safe.toString()).toBe(safeAddress.toString());
    expect(flow.approvals.length).toBe(0);
    expect(flow.triggerType).toBe(TriggerType.None);
    expect(flow.instructions.length).toBe(0);

    const fritkionIxs = processDeserializedInstruction(FRIKTION_DEPOSIT_TX);
    const addActions = await Promise.all(
      fritkionIxs[1]
        // .filter(
        //   (ix, ind) => ind != 0 && ix.programId.equals(FRIKTION_APP_PROGRAM_ID)
        // )
        .map(async (ix) => {
          return await snowflakeSafe.createAddProposalActionInstruction(
            newProposalAddress,
            SerializableAction.fromInstruction(ix)
          );
        })
    );
    console.log(calculateTransactionByteData(fritkionIxs[1]));
    console.log(calculateTransactionByteData(addActions));
    console.log(addActions.map((action) => action.programId.toString()));

    // console.log(fritkionIxs);

    await snowflakeSafe.transactionSender.sendWithWallet({
      instructions: [
        ...fritkionIxs[0],
        ...addActions,
      ] as TransactionInstruction[],
      signers: [],
    });

    flow = await snowflakeSafe.fetchProposal(newProposalAddress);

    expect(flow.instructions.length).toBe(addActions.length);
  });
});
