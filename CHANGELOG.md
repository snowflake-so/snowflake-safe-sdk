# Changelog

All notable changes to this project will be documented in this file.

## [1.0.8] - 2022/03/10

### Changes description

- Allow create proposal with large payload
- New create recurring proposal instructions method added to support create proposal with separated actions.
```typescript
const [newProposalAddress] = await snowflakeSafe.createProposal(
  safeAddress,
  'hello world',
  instructions,
  [],
  DEFAULT_FLOW_SIZE,
  true,
  true // Set separatedActions parameter to true
);
```

## [1.0.7] - 2022/23/08

### Changes description

- Add fetch owned safes by owner address

```typescript
async findOwnedSafes(ownerAddress: PublicKey): Promise<SafeType[]>;
```

- Add unit test for the method in `snowflake.test.ts`

## [1.0.6] - 2022/17/08

### Changes description

- Fix a minor bug in validating `createSafe` method parameters

## [1.0.4] - 2022/05/08

### Changes description

- Remove `flowActions` from `executeProposal`: Instead of providing flowActions to the executeProposal method, inner the method will fetch the `instructions` and serialized to `proposalActions` by provided `proposalAddress`
- Add more test cases for recurring proposal and update test cases for new execute proposal method
- Update documentation

### New dependencies

```json
"@typescript-eslint/eslint-plugin": "^5.30.6",
"@typescript-eslint/parser": "^5.30.6",
"eslint": "^8.0.0",
"pre-commit": "^1.2.2",
"prettier": "^2.1.2",
```
