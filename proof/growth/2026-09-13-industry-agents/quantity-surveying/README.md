# IND-38 / T-06 / T-15 — classification helper evidence

This is an isolated domain foundation, not a shipped quantity-surveying workflow.

`classification.ts` validates explicit user-defined nodes and assignments, rejects hierarchy cycles and duplicate item assignments, and reconciles exact decimal quantities by unit and declared evidence category. It retains source fields and visible unclassified residue. It always returns `draft-classification` and `verifiedQuoteEligible: false`; caller-declared `measured` is not independent verification.

## Executed

- `node --experimental-strip-types --test src/studio/industries/quantity-surveying/classification.test.ts`: **11 passed, 0 failed** (`tests.txt`).
- `npx.cmd tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --strict --skipLibCheck --allowImportingTsExtensions src/studio/industries/quantity-surveying/classification.ts src/studio/industries/quantity-surveying/classification.test.ts`: **exit 0**, no diagnostics (`typecheck.txt`). This is scoped, not a full application check.
- `changes.patch` records both new source files against the empty baseline.

Fixtures are synthetic. No real source document was verified, no rates were used, no measurement or cost plan was issued. Browser/package acceptance is not asserted. Root owns UI/persistence integration and global ledgers. No background process was launched, retained or terminated by this agent.
