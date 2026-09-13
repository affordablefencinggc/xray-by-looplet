# HVAC straight duct draft proof — 2026-09-13

Requirement: IND-30 T-1; related shared rows T-03 and T-10. No shared capability row is promoted by this isolated module.

Implemented rectangular straight duct lateral area `2 × (width + height) × length`, circular straight duct lateral area `π × diameter × length`, and optional mass from an explicit supplied kg/m² operand. No end caps, fittings, seams, waste, insulation or supports are included. Results remain `draft-unverified`, even with reference strings. Those strings are retained, not authenticated source evidence.

All test inputs are synthetic arithmetic fixtures, not manufacturer or project quantities. The helper cannot select dimensions, load duties, gauges, pressure drops, regulatory requirements or equipment.

## Executed checks

- `node --experimental-strip-types --test src/studio/industries/hvac/straightDuct.test.ts`: **10 passed, 0 failed** (`tests.txt`).
- `npx.cmd tsc --noEmit --strict --skipLibCheck --target ES2022 --module ESNext --moduleResolution bundler --allowImportingTsExtensions src/studio/industries/hvac/straightDuct.ts src/studio/industries/hvac/straightDuct.test.ts`: **exit 0**, no diagnostics (`typecheck.txt`). This is scoped checking, not a full application build.

Coverage includes independent 16 m² rectangular and 0.8π m² circular fixtures; mixed schedules; optional mass with incomplete totals withheld; preserved references; no input mutation/aliasing; malformed numeric values; unsupported shapes/fields; duplicate IDs; overflow/underflow; and length scaling.

Exact new source/test diff: `changes.patch`. Parent owns final combined checks and shared integration. No UI or persistence was changed, so no screenshot or user-facing workflow acceptance is claimed. No browser, server, tunnel or background helper was started; only foreground test/typecheck processes ran and exited.
