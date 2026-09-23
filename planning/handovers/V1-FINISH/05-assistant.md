# 05 — Assistant reliability

**When:** Wed 4 – Tue 10 Nov 2026 (5 days) · **Depends on:** 01

## Goal
The live assistant completes its documented jobs on both providers (MiniMax, which is the default, and Gemini), on web and desktop, without repeated or failing turns.

## Starting state
- Desktop MiniMax works since 23 Sep via the native `minimax_ai.rs` transport (`proof/growth/2026-09-23-minimax-desktop/`). Gemini was out of quota (HTTP 429) on 23 Sep.
- **TAKEOVER-TODO SC-01/02:** the MiniMax roofing lap/units prose and QS null-handling turns fail.
- **ASSISTANT-MCP-TODO SC-02..07:**
  - Gemini transport on web and native
  - drawing tools
  - the live conversation UI
  - failure tests
  - Dans1 builds
  - capability matrix
- **VISIBLE-WORKING-EXAMPLE:** MiniMax repeats checks.
- **AI-MATERIALS-TODO LIVE-01:** a real benchmark on the public drawings.
- **Installed-app readback items:** DWG-TODO SC-05d, ARCHITECT-SKETCH SC-05 and PROFESSIONAL-COVERAGE SC-R03. They need only installed-app proof and can land here or in 06.

## Steps
1. TAKEOVER SC-01/02: reproduce both MiniMax turns with a fixed prompt set. Fix them through the tool descriptions, the context manual or response handling. Add regression tests in `src/studio/assistant/*.test.ts`.
2. ASSISTANT-MCP SC-02..07 in order. For SC-07, publish a capability matrix: tool × provider × web/desktop, with a pass/fail proof link per cell.
3. Stop MiniMax repeating checks by tightening the completion preflight and `finalToolClaims`. Add a test.
4. AI-MATERIALS LIVE-01: run the configured provider on the public drawings. Record precision, recall and quantity agreement against the checked ground truth.
5. Run the three installed-app readback items once 06's installed build exists, or on the current installed build if nothing else has changed.

## Exit check
- TAKEOVER, ASSISTANT-MCP, AI-MATERIALS and the VISIBLE-WORKING-EXAMPLE assistant lines are ticked.
- The capability matrix has no untested cells.
- No provider turn in the prompt set fails.

## Proof
`proof/growth/<date>-assistant-v1/`: prompt-set transcripts (no secrets), the matrix, benchmark results, test logs and a README.
