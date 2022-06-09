# Snowflake Safe SDK

Snowflake Safe SDK provides an easy way to interact with the Snowflake Safe app and onchain programs

## Installation

Install with npm

```bash
npm i @snowflake-so/snowflake-safe-sdk
```

Install with yarn

```bash
yarn add @snowflake-so/snowflake-safe-sdk
```

## Quick start guide

### Initialize Snowflake

To create a new Snowflake service, we would need to initialize with the Provider.

```typescript
// if your Anchor version is older than 0.24.2,
// please use Snowflake SDK version 1.0.11 and initialize the provider as below
let provider: Provider = Provider.local(API_URL);

// if your Anchor version is 0.24.2 or later,
// please use the latest version of Snowflake SDK and initialize the provider as below
let provider: Provider = AnchorProvider.local(API_URL);
```

The `API_URL` is the endpoint to the Solana cluster. Empty API_URL is pointed to the `local testnet`

- Mainnet Beta: `https://api.mainnet-beta.solana.com`
- Testnet: `https://api.testnet.solana.com`
- Devnet: `https://api.devnet.solana.com`

```typescript
let snowflakeSafe: SnowflakeSafe = new SnowflakeSafe(provider);
```

### Create a new safe

Create a new safe with one owner and approvals required as one

```typescript
const input = {
  approvalsRequired: 1,
  owners: [owner],
};
const txId = await snowflakeSafe.createSafe(
  safeKeypair,
  input.owners,
  input.approvalsRequired
);
```
### Create a new proposal
Create a new proposal that can be executed by any safe owners
```typescript
const response = await snowflakeSafe.createProposal(
  safeAddress,
  "hello world",
  instructions
);
```
### Create a new recurring proposal
Create a new recurring proposal that can be executed automatically by Snowflake node operators
```typescript
const proposal = new MultisigJobBuilder()
  .jobName("hello world")
  .jobInstructions(instructions)
  .scheduleCron("0 0 * * *")
  .build();
  
const [newProposalAddress, txId] = await snowflakeSafe.createRecurringProposal(
  safeAddress,
  proposal
);
```

### Update an existing safe

#### Add owner proposal

The method will create a new instruction to propose adding new owner to the safe

```typescript
const ix = await snowflakeSafe.createAddOwnerProposalInstruction(safeAddress, newOwner);
```

#### Remove owner proposal

The method will create a new instruction to propose removing an existing owner from the safe

```typescript
const ix = await snowflakeSafe.createRemoveOwnerProposalInstruction(
  safeAddress,
  newOwner
);
```

#### Change threshold proposal

The method will create a new instruction to propose changing threshold of the safe

```typescript
const ix = await snowflakeSafe.createChangeThresholdProposalInstruction(
  safeAddress,
  newOwner
);
```

### Approve a proposal

```typescript
await snowflakeSafe.approveProposal(safeAddress, flowAddress);
```

### Reject a proposal

```typescript
await snowflakeSafe.rejectProposal(safeAddress, flowAddress);
```

### Execute a proposal

```typescript
await snowflakeSafe.executeProposal(flowAddress, flowActions, safeAddress);
```

### Abort a recurring proposal

```typescript
await snowflakeSafe.abortRecurringProposal(safeAddress, flowAddress);
```

### Build an once-off scheduled job

With Snowflake SDK, you can create a job with two line of code.

```typescript
const job = new MultisigJobBuilder()
  .jobName("hello world")
  .jobInstructions(instructions)
  .scheduleOnce(tomorrow())
  .build();

await snowflake.createJob(job);
```

### Build a recurring scheduled job

Schedule a job that runs every minute for 10 times.

```typescript
const job = new MultisigJobBuilder()
  .jobName("hello world")
  .jobInstructions(instructions)
  .scheduleCron("* * * * *", 10)
  .build();

await snowflake.createJob(job);
```

Schedule a job that runs at 10:00 AM on the first day of every month .

```typescript
const job = new MultisigJobBuilder()
  .jobName("hello world")
  .jobInstructions(instructions)
  .scheduleCron("0 10 1 * *")
  .build();

await snowflake.createJob(job);
```

### Build a program condition triggered job

Schedule a job that is triggered based on an arbitrary condition defined within the user program.

```typescript
const job = new MultisigJobBuilder()
  .jobName("hello world")
  .jobInstructions(instructions)
  .scheduleConditional(1)
  .build();

await snowflake.createJob(job);
```
