# Window closed, process exit incomplete

PID 53296 remains the exact isolated `71f5b012342b` X-Ray EXE recorded in `qa-launch.json`. Its process creation time matches the recorded launch (2026-09-08 04:00:48 UTC), excluding PID reuse. The main window handle is zero and the title is empty. The process remains around 49 MiB; 39 waiting threads were observed initially and 41 in the later snapshot. Total CPU stayed at 2.671875 seconds across repeated observations. No child processes or process-owned TCP sockets were observed. The diagnostic port has no listener; the later socket records are `TimeWait`/PID 0, not a live application CDP service.

After root closed both owned agent-browser sessions, the process remained present at 04:17:03 UTC, with the same creation identity, zero window handle and unchanged CPU time. This is recorded separately in `qa-close-after-cdp-release.json`; debugger detachment did not produce immediate exit.

`qa-close.json` correctly remains `closeRequested: true`, `exited: false`, `forced: false`. The UI closure is observed, but a clean process exit is **not accepted**. The saved 97-command native acceptance and previous screenshot findings do not establish shutdown completion.

## Source review and limits

Compared with source checkpoint `844e091`, `lib.rs` adds assistant state/commands and calls its `cancel_all()` in the existing `CloseRequested`, `ExitRequested` and `Exit` handlers. There is no added `prevent_exit` or close-prevention call. The assistant active-state mutex is held only for short synchronous bookkeeping; no network await or blocking join occurs while holding it. Its cancellation invokes the futures abort handle and does not wait for a provider response.

The recorded native status scenario made two malformed requests, which fail request validation before credentials, `state.begin`, or networking, plus cancellation of a nonexistent request. It did not start a paid assistant turn. Therefore these tests provide no evidence of an in-flight assistant request whose abort could explain the lingering process. This is source-based reasoning, not a live mutex/stack inspection. Thread wait classifications alone cannot identify a deadlock or prove its absence.

The prior Stage 09 launch has a recorded normal exit, but it used a different application candidate and scenario/profile. That establishes an earlier successful close, not a controlled regression comparison. No new baseline or reproduction app was launched during this investigation.

## Wait-chain and inherited title-bar investigation

`read-shutdown-wait-chain.ps1` used `GetThreadWaitChain` in the diagnostic PowerShell process, with flags 0, on threads 34540, 68804 and 47164. All three calls succeeded; each returned one `WctThreadType` node with blocked status and `cycle: false`. No owning synchronization object or thread chain was exposed. Microsoft explicitly documents a single node when a wait uses unsupported synchronization, so this result cannot prove a deadlock absent or identify its cause. [Microsoft GetThreadWaitChain documentation](https://learn.microsoft.com/en-us/windows/win32/api/wct/nf-wct-getthreadwaitchain).

The read-only script did not attach a debugger, dump process memory, change privileges, terminate a process or record lock-object names. Raw results are preserved in `qa-close-wait-chain.json`.

The inherited `window_chrome.rs` handler gets the HWND and sets four DWM palette attributes synchronously. Inspection of installed `tauri-2.11.5/src/window/mod.rs:1668` and `tauri-runtime-wry-2.11.4/src/lib.rs:197,235,1972` shows the HWND getter dispatches immediately when already on the event-loop thread before receiving its result. This does not establish that the observed process is blocked there. No title-bar or assistant cancellation change is justified by the current evidence.

## Next action

Keep shutdown as an unresolved native lifecycle issue in the report. Preserve this windowless process and its profile under the current no-force-kill instruction. A subsequent authorized diagnostic slice should capture main/worker thread stacks or explicit exit-event milestones, then compare fresh isolated startup/close and model/save/close against a known candidate to locate the blocked shutdown stage. Do not change assistant cancellation or force an unconditional exit without that evidence.

No process was terminated, no application source changed, and no user/normal-profile data was accessed or modified. The first sandbox CIM query returned access denied; its incidental `PID absent` text was invalid and excluded from the diagnosis. The successful read-only escalated queries produced the verified observations in `qa-close-readonly-diagnostic.json`.

## Actual stack and symbol results

No CDB, WinDbg or ProcDump installation was found in the checked PATH, Windows Kits debugger path or app aliases. The built-in Windows process snapshot and DbgHelp APIs were sufficient: `read-main-thread-stack.ps1` captured only thread metadata/context using `PSS_CAPTURE_THREADS | PSS_CAPTURE_THREAD_CONTEXT`, then unwound the captured main-thread context. It did not create a VA clone, process dump, debugger attachment, explicit suspend/resume or target-memory write. Output contains code addresses and symbols, not stack values or application data. [Microsoft PSS_THREAD_ENTRY documentation](https://learn.microsoft.com/en-us/windows/win32/api/processsnapshot/ns-processsnapshot-pss_thread_entry).

The actual main-thread stack at 04:28:53 UTC was `win32u!NtUserGetMessage -> user32!GetMessageW -> X-Ray frames -> main`. Thus the main thread was waiting for a Windows message; it was not then blocked in the assistant mutex/abort or a DWM title-bar call. The raw symbolic-unavailable result is `qa-close-main-thread-stack.json`.

Native window enumeration found **no top-level/thread windows**, only two invisible message-only windows on the main thread: `SystemUserAdapterWindowClass` and `OleMainThreadWndClass`. Their presence does not independently prove either causes the remaining event loop. See `qa-close-hidden-windows.json`.

The existing Dans1 run contained `xray_by_looplet.pdb` (8,712,192 bytes). It was retrieved without rebuilding into `diagnostic-symbols/`. Remote/local SHA256 matched `29fcb6fd1e9624e43ca92e366969e6e6846bc2a773d2e50b62fe7894a2f66ae9`. A binary identity check compared the PDB information stream's GUID/age with the accepted EXE's CodeView RSDS: both `9cb294dbfc77884f9e309f998ee6ec8a`, age 1. EXE SHA256 remained `38c673ae5591c79ffda0fa283c6dc292118cfd2e6c1823b0f4660170ff474f3c`. See `diagnostic-symbols/identity.json` and `verify-diagnostic-symbols.mjs`.

The repeated stack with that PDB resolves an enclosing `tauri_runtime_wry::Wry<tauri::EventLoopMessage>::run` frame (offset `0x33c2b0`) and `xray_by_looplet_lib::run` below the `GetMessageW` wait. This supports a still-running Tauri event loop. Some optimized frames resolve only to a nearest public symbol with a large displacement; notably the `allow_directory +12557` label must **not** be treated as proof that filesystem permission work is executing. Exact results: `qa-close-main-thread-stack-symbols.json`.

## Final bounded outcome

Root reports that both candidate and baseline startup-only runs closed normally, and a fresh full 97-command run of the same candidate (without the earlier failed viewport emulation) exited normally in 514 ms. Those are separate runs; they do not rewrite the original `qa-close.json` failure or establish which operation caused it. The original windowless PID 53296 remains an isolated unresolved shutdown observation. No general assistant cancellation regression or specific causal fix is established.

This read-only slice is complete. Do not make a speculative lifecycle change or rebuild from these observations. If the original condition recurs, the next concrete instrumentation is timestamped `CloseRequested`, `Destroyed`, `ExitRequested`, `Exit`, and event-loop-return milestones with window IDs/counts (no project content), paired with before/after operation markers including viewport emulation and CDP detach. This distinguishes a lost final-window exit event from a prevented exit or later shutdown pump. Root owns any separately authorized implementation/reproduction.

The diagnostic PDB is a binary debugging artifact, not a source/report image: keep it out of staged source and embedded HTML. Keep its small identity record and symbolic stack evidence. Early remote-shell/inline-generator quoting attempts failed before performing their intended diagnostic step; corrected file-based/encoded commands succeeded. No failed attempt changed the target app or its data.
