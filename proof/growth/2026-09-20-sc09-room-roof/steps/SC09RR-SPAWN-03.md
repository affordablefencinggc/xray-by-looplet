# SC09 room/roof — flat argument spawn verification

Scope: the user-requested minimal `Start-OwnedStep` correction only. This is not SC-09 acceptance.

Exact patch in `../infrastructure/qualify.ps1`:

```diff
-function Start-OwnedStep([string]$Name, [object[]]$Arguments, [int]$TimeoutMs, [string]$Lane) {
+function Start-OwnedStep([string]$Name, [string[]]$Arguments, [int]$TimeoutMs, [string]$Lane) {
-  $process = Start-Process -FilePath $node -ArgumentList $Arguments -WorkingDirectory $source -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
+  $process = Start-Process -FilePath $node -ArgumentList ($Arguments -join ' ') -WorkingDirectory $source -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
```

`ConvertFrom-NodeCommand` already returned `$tokens` without a comma before this patch. The validated token alphabet contains no spaces requiring quotation.

Executed on DANS1: extracted the actual function definitions from the patched helper's PowerShell AST, parsed `node scripts/verify-master-plan.mjs` through `ConvertFrom-NodeCommand`, asserted that every resulting token was a string, then called `Start-OwnedStep`, `Wait-OwnedWave`, and `Complete-OwnedStep` serially. No parallel wave was started. The helper bytes are bound by SHA-256 `3e257cee8ef65e57688ff2e6d7cd29f428e6ad729ab6ae19467f4e6f31ce472a` in the receipt.

- SSH command exit: **0**.
- [results.json](../machine/spawn-3/results.json): **PASS**, scope limited to one serial verifier.
- [Command receipt](../machine/spawn-3/serial/verify-master-plan/receipt.json): exit **0**, all owned processes exited.
- [Executed output](../machine/spawn-3/serial/verify-master-plan/stdout.log).

The first diagnostic SSH invocation omitted `-ExecutionPolicy Bypass` and exited 1 while loading the existing resource-policy script, before creating this attempt directory or launching a product process. The corrected invocation above then ran with the same execution-policy option used by the reviewed qualification command. No machine execution policy was changed.

The preceding [machine-2 results](../machine/machine-2/results.json) remain **FAIL** with seven executed commands, not `commands: []`: all command processes exited 0, but the test-summary parser rejected spec-reporter output and aggregation failed. Those original receipts were not rewritten or replaced. Broad tests, typecheck and lint were not repeated for this spawn check.

Limits: no browser, screenshot, build, native or room/roof acceptance from this check. Screenshot evidence remains outstanding; this record does not declare the configuration change or SC-09 complete.
