# IW-SC02 independent review corrections, attempt 02

Status: awaiting independent re-verification. Parent explicitly paused the separate CLI packet to authorize these narrow original-scope corrections.

- CORE-01: native volume now requires exact model property identity across the measurement locator, native operand locator and at least one supporting native-volume evidence locator. General `locatorKey` still identifies source/page/model element, preserving valid calibration and cross-document depth/specification use.
- CORE-02: non-count positive geometry whose gross calculation becomes zero now fails with an unsupported underflow-range error. Zero net from a legitimate full deduction remains valid. Existing overflow validation remains intact.
- Local auth clarification requested by parent: command layer needs an attributed local actor and revision control. Authentication is required only by a future integration that needs it, not as a blocker for local UI work.

Added two focused tests covering property aliasing (including matching measurement/basis with wrong-property evidence) and length/area/volume underflow. All 24 tests pass. Independently authored CORE-01 and CORE-02 reproductions also now pass unchanged. Full TypeScript check passes; generated structural schemas remain fresh.

New proof files preserve the original 22-test attempt: `proof/audit/IW-SC02/tests-attempt-02.log`, `typecheck-attempt-02.log`, `independent-core-attempt-02.log`, `schema-check-attempt-02.log`, `code-attempt-02.patch`, `source-hashes-attempt-02.json`. These hashes supersede the original source manifest for current-code verification; original evidence was not overwritten. Native/package and UI claims remain out of scope.
