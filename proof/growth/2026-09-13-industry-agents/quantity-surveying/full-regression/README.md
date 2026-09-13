# Full npm test — DANS1 support completion and frozen regression

Root delegated test-fixture staging and full regression execution in its mutable `concurrency-source` snapshot. No immutable build run was modified. No product source edits by this agent. Root-authorized final source transfers were `liveAssistantState.ts`, `package.json`, and the final `toolReceipt.ts/test.ts` pair; their owners implemented them.

## Final frozen result

`npm test` exited **0** on DANS1 at **2026-09-13T19:45:40.681+10:00**. Master-plan and BOM-golden gates passed; script tests **201/201**; TypeScript tests **1145/1145**, 89 suites, zero failures. Exact stdout/stderr, process ownership and exit receipt use prefix `qs-full-regression-frozen`. Eight changed-input hashes match the frozen local files. This is test execution, not a native/package/browser-build claim.

## Earlier failures and resolution

- Initial support snapshot lacked app-env, Vite config, PWA assets, MCP config fixtures and migration source. Seven nonsecret local files were staged with archive and per-file hash verification. Configs were inspected: no tokens/credentials. MCP config paths are fixtures only, no MCP connection was launched.
- Next stage reached TypeScript tests but lacked bundled model JSON, PDFs and an existing AI-material fixture/schema. Ten fixture files and then three original model PDFs were staged with hashes. No fixture content was invented or changed.
- Roofing owner confirmed a stale parser/test pair and staged its tested versions.
- Remaining bare-Node canvas-reference import failure was present in HEAD: extensionless runtime imports in `liveAssistantState.ts`. Root fixed the import extensions; this agent staged the exact root-owned file.
- First full pass was 201 + 1142 tests. The final receipt-prefix tests then changed; the frozen rerun above covers the final pair, 201 + 1145 tests.

All support manifests are retained here. Original failed logs are retained for attribution. Tests ran via hidden, owned DANS1 processes at High priority; parent test processes exited, no preview/browser/tunnel was stopped. No source permission, calibration, authority or assertion was weakened to make tests pass.
