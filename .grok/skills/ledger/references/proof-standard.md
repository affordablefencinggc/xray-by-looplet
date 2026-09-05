# Proof Standard & Evidence Collection

## Daniel's Proof Standard

Nothing counts as done unless it ships with **both** a code diff and visual or executed proof.

### What Constitutes Proof

| Surface | Valid Proof Format | Invalid / Unacceptable |
|---|---|---|
| **Web UI / React / Layout** | Browser screenshot (CDP, Playwright, or browser tool) showing rendered components, zero uncaught errors in console, responsive layout (390px mobile + desktop) | "It builds cleanly", "code looks correct", terminal 200 OK |
| **Backend / Edge Functions** | Executed test output with real or mock bindings showing exit 0, assertions passed, and returned response JSON | Unexecuted test code, dry-run statement without output |
| **Rust / Desktop / Tauri** | `cargo test` passing output, CLI process run with stdout/stderr capture | Uncompiled Rust code, hypothetical assertions |
| **Database Migrations** | Ephemeral DB replay, pgTAP test pass, idempotent replay check | Manual inspection of SQL, untested DDL |
| **MCP Tools** | FastMCP / stdio probe tool invocation result, JSON-RPC response verification | Assuming FastMCP registers tools without checking schema |

### Blame Verification Rule

Before reporting an error or failure to Daniel:
1. Check if the error is caused by your changes or pre-existing in the tree.
2. Test procedure:
   ```bash
   git stash push -m "temp-verify" -- <your-files>
   # Run verification on baseline
   git stash pop
   ```
3. Report pre-existing issues honestly and keep your changes isolated.
