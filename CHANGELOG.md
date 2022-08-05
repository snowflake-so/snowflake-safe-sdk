# Changelog

All notable changes to this project will be documented in this file.

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
