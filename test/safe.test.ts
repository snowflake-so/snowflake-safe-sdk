import { AnchorProvider } from "@project-serum/anchor";
import { clusterApiUrl, Keypair, PublicKey } from "@solana/web3.js";
import { SnowflakeSafe } from "../src/services/snowflake-safe";

let provider: AnchorProvider;
let snowflakeSafe: SnowflakeSafe;
let owner: PublicKey;

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
  const newSafeKeypair = Keypair.generate();
  const txId = await snowflakeSafe.createSafe(
    newSafeKeypair,
    input.owners,
    input.approvalsRequired
  );
  console.log("create safe txn signature ", txId);

  const fetchedSafe = await snowflakeSafe.fetchSafe(newSafeKeypair.publicKey);
  expect(fetchedSafe.creator.toString()).toBe(owner.toString());
  expect(fetchedSafe.ownerSetSeqno).toBe(0);
  expect(fetchedSafe.approvalsRequired).toBe(input.approvalsRequired);
  expect(fetchedSafe.owners.length).toBe(input.owners);
});

test("update safe", async function () {});

test("create multisig flow", async function () {
  expect(1 + 1).toBe(2);
});

test("delete flow", async function () {
  expect(1 + 1).toBe(2);
});

test("approve flow", async function () {
  expect(1 + 1).toBe(2);
});

test("reject flow", async function () {
  expect(1 + 1).toBe(2);
});

test("execute flow", async function () {
  expect(1 + 1).toBe(2);
});
