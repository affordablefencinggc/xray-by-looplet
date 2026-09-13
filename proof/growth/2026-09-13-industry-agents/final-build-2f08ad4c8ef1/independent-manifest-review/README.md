# Independent final-build evidence review

Read-only audit of DANS1 run2f08ad4c8ef1. No new test/build, source edit, index refresh or executable copying.

At the comparison checkpoint (remote2026-09-13T20:56:40+10), all834 web-source and104 native-source manifest entries matched staged source. Local working files also matched all834+104 entries when local-comparison.json was written. Later HVAC edits to discussionOnly.ts/test.ts and useAssistantChat.ts occurred after this comparison; this report does NOT cover those later edits. Root will build their new snapshot separately.

completion.json records dependencies/typecheck/focused-tests/web-build exit0; native-completion.json adds native-build exit0. Native executable SHA25699d1738c692864b2f7033443bc41b5b31f8d11b978dcc0d82b239fd4f4450cf3 and NSIS installer05004e4ae411600147c7ce36f965af7ed612f8863ab25df4e0d7dec677cfb7c2 were independently rehashed and match. Binaries remain remote.

Asset distinction: native tauri build runs build:desktop and overwrites dist. Of27 original web completion assets,6 remain identically named/hashed and21 are absent after desktop rebuilding. Current desktop asset hashes are recorded separately in final-asset-comparison.json. Original web production browser proof was captured before native completion and applies to that original web dist; it must not be presented as testing the later desktop asset set. Initial verify-web-artifacts attempt stopped on first missing old asset; final-asset-comparison provides complete accounting.

contracts/xray-job-bom-v1.schema.json reports M in source control but working git blob equals HEAD3a41d3c04c518000ab61b442fd6cc0d00a0967f2; git diff is empty and both index/worktree are LF. Working SHA256 matches manifest60ef497fc03a800aba23e7acc6a1974ecf7a48f465f90479a862e195a55b8cd7. No content change identified; status is metadata/stat bookkeeping. No index writes performed.

Reproduce staged source/artifact checks with verify-staged.ps1 and verify-final-assets.ps1 on DANS1. Completion receipts, original manifests and build stdout/stderr are preserved adjacent. Existing sibling final-build proof was not overwritten.
