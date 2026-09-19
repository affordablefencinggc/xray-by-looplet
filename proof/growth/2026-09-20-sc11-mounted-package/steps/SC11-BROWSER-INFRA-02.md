# SC11-BROWSER-INFRA-02 — first mounted browser launch infrastructure failure

Status: **INFRA_FAILURE; no application assertions ran and no screenshots exist**. SC11 remains pending. This retained failure is neither a product pass nor a product failure.

## Source and campaign identity

Campaign `sc11-c9b41fd82e89-mounted-dev1` was bound to the unchanged DANS1 application snapshot with source digest `c9b41fd82e892df8d8630ed73dc48c94f1208aa51058c7bf2a9fb1d723bd6ba7`, Git HEAD `6f82b9340b2fd33d195c78ee9029cc4deee84644`, and 1,244 source files. See the [application binding](../campaign/sc11-c9b41fd82e89-mounted-dev1/output/application-binding.json) and [exact mounted-source diff](../sc11-mounted.source.diff), SHA-256 `8df0f257bbea2f83f0c19ec42551a056ccb86172a8fe5b466335d300b77b9fdd`.

The local returned receipts were preserved from `.temp/sc11-mounted-stage/sc11-c9b41fd82e89-mounted-dev1/output` into the public campaign directory without altering the originals. A source-to-public SHA-256 comparison passed for all seven copied files.

## Failure boundary

The launcher began at `2026-09-19T15:16:10.4727969Z` and ended at `2026-09-19T15:16:13.0964606Z`. Its owned development preview process exited before `http://127.0.0.1:8080/` became ready. The preserved stderr is exact:

```text
'npm.cmd' is not recognized as an internal or external command,
operable program or batch file.
```

This is a missing-active-PATH infrastructure failure, preserved in [preview stderr](../campaign/sc11-c9b41fd82e89-mounted-dev1/output/preview.stderr.log) and the [launcher receipt](../campaign/sc11-c9b41fd82e89-mounted-dev1/output/launcher-results.json). Chrome was never started (`browser.rootPid` is null), the raw-CDP runner did not return an exit code, and no application assertion was evaluated. Cleanup records the preview as already exited and the browser as not owned; no unrelated process was terminated.

There is no `browser-results.json`, no capture directory, and no screenshot file for dev1. Screenshot evidence and every mounted browser acceptance claim are explicitly **pending**. A later dev2 campaign, if successful, is separate evidence and does not rewrite this immutable dev1 outcome.

## Published receipt hashes

| Public receipt | SHA-256 |
| --- | --- |
| [application-binding.json](../campaign/sc11-c9b41fd82e89-mounted-dev1/output/application-binding.json) | `ff38008dbfd3e666301001498f5ef9051756c5c76c4d84573024225778980c4d` |
| [input-manifest.json](../campaign/sc11-c9b41fd82e89-mounted-dev1/output/input-manifest.json) | `13d4ffcf5986667aa4eed90abb9ed20dae1ecf68511a1796f916294775c86dcd` |
| [launcher-results.json](../campaign/sc11-c9b41fd82e89-mounted-dev1/output/launcher-results.json) | `d066d7ca426dba2bcb534693acc8d636228cac1f84355b80090eb069b7b3d161` |
| [preview.stderr.log](../campaign/sc11-c9b41fd82e89-mounted-dev1/output/preview.stderr.log) | `7cc0fc923de8621d40eb0d5b9835ff140a301d0954567963b4e92b98d5613da5` |
| [preview.stdout.log](../campaign/sc11-c9b41fd82e89-mounted-dev1/output/preview.stdout.log) | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| [runner-extension.json](../campaign/sc11-c9b41fd82e89-mounted-dev1/output/runner-extension.json) | `b994bcdebf136fb4201f47fff13778371f58536e02c82d296cd8526bff938c7f` |
| [sha256-manifest.json](../campaign/sc11-c9b41fd82e89-mounted-dev1/output/sha256-manifest.json) | `57d9b509c036b97313eac3562dc915ea0a461e88ecb78575b09b0abb382c2851` |

The retained launcher-generated manifest covers `launcher-results.json`, `preview.stderr.log`, and the empty `preview.stdout.log`. The four post-launch wrapper receipts were independently byte-compared during publication and their source/public hashes are recorded above. The extension receipt also states that canonical `scripts/fast-cdp.mjs` remained unchanged; the generated scoped runner added only the mounted-package download, disk-hash, file-selection, and preserved-negative ZIP-mutation operations.

## Required next evidence

SC11 still requires a successful source-bound browser campaign with its full assertion result, downloaded artifact hashes, reopen/restore and negative-path receipts, clean console/error accounting, named desktop/tablet screenshots with SHA-256 values, and human visual inspection. None of those requirements is satisfied by dev1.
