# IW-SC02 startup packet

Authorization: parent reports user instruction “Implement the plan.” Bounded contract foundation only. Ledger skill read; its executed-proof standard applies, UI proof is inapplicable to this pure module slice.

Baseline: `feat/v1-production-ready`, `7ba4a14d1eccdcde1cfc15293adbf08918524c4f`. Initial untracked paths: `.agents/`, `.autopilot/`, `.claude/`, `.grok/skills/ledger/`, `engine/bin/`, `scripts/chat-autopilot-cdp.cjs`. No tracked changes at startup. Git reports inaccessible global ignore and `.pytest_cache`; neither touched.

Ownership: new `src/studio/construction/**`, `contracts/construction/**`, `planning/industry-contract.md`, this handover directory, `proof/audit/IW-SC02/**`. No existing runtime, storage, BOM, package, ledger or migration edits. No commits or agents.

Read: AGENTS.md, AGENTS.project.md, ledger skill, package/tsconfig, domain and v1 migration, persistence, document contract, fencing BOM contract. Legacy storage is `xray:fencing-job:v1/v2`; existing parsing migrates v1 and strips extra fields. Adapter must validate through that parser but preserve original JSON separately. Source document identity already exists but calibration uses sheet only; new core always binds source revision + hash + locator.

Plan: strict Zod schemas and inferred types; pure quantity validation/calculation; append-only revision transition guard and future command interface; non-writing legacy envelope import; deterministic tests and JSON schema exports; executed proof and completion API handover. No UI completion claim.
