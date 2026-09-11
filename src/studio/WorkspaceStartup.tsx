import { useEffect, useState, type ReactNode } from "react";
import { WORKSPACE_ACCESS_LOCK, executeWorkspaceRestore, type RestoreOperation } from "./workspaceRestore";
import { browserRestorePorts, finishPendingRestore, readPendingRestore } from "./workspaceRestoreStorage";
import { readProjectBackup } from "./projectBackupStorage";
import "./workspaceStartup.css";

function download(serialized: string, name: string) {
  const url = URL.createObjectURL(new Blob([serialized], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = `${name}.xray-backup.json`;
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
/** Nothing in Studio (including persistence effects) mounts before the workspace lease is acquired. */
export function WorkspaceStartup({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(true);
  const [operation, setOperation] = useState<RestoreOperation | null>(null), [error, setError] = useState("");
  const [exclusive, setExclusive] = useState(false);
  useEffect(() => {
    let disposed = false, release = () => {};
    const hold = new Promise<void>(resolve => { release = resolve; });
    async function start() {
      const pending = await readPendingRestore();
      if (disposed) return;
      setOperation(pending);
      if (!navigator.locks) {
        if (pending) throw Error("This browser cannot protect restoration. Open this workspace in a browser with Web Locks support.");
        setReady(true); setBusy(false); return;
      }
      await navigator.locks.request(WORKSPACE_ACCESS_LOCK, { mode: pending ? "exclusive" : "shared", ifAvailable: true }, async lock => {
        if (disposed) return;
        if (!lock) throw Error("Close other X-Ray tabs or windows, then retry. Their editing sessions prevent restoration from starting.");
        const latest = await readPendingRestore();
        if (disposed) return;
        if (!pending && latest) throw Error("A restore was requested in another window. Reload to review it.");
        if (!latest) { setReady(true); setBusy(false); await hold; return; }
        setExclusive(true); setOperation(latest);
        try {
          const result = await executeWorkspaceRestore(latest, browserRestorePorts());
          if (!disposed) setOperation(result);
        } catch (failure) {
          if (!disposed) {
            setError(failure instanceof Error ? failure.message : "Restoration did not finish.");
            setOperation(await readPendingRestore());
          }
        }
        if (!disposed) setBusy(false);
        await hold;
      });
    }
    void start().catch(failure => { if (!disposed) { setExclusive(false); setError(failure instanceof Error ? failure.message : String(failure)); setBusy(false); } });
    return () => { disposed = true; release(); };
  }, []);
  if (ready) return <>{children}</>;
  async function finish() {
    if (!operation || !exclusive) return;
    setBusy(true); setError("");
    try { await finishPendingRestore(operation); location.reload(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); setBusy(false); }
  }
  const terminal = operation?.phase === "verified" || operation?.phase === "rolled-back";
  return <main className="workspace-startup" aria-busy={busy}>
    <section aria-label="Workspace recovery">
      <header><p>X-Ray workspace</p><h1>{ready ? "Workspace ready" : operation ? "Restore project" : "Opening your workspace"}</h1></header>
      {busy ? <p role="status">{operation ? "Checking the saved snapshot and recovery journal. Editing will open after verification." : "Checking saved work…"}</p> : <>
        {operation?.message && <p role="status">{operation.message}</p>}
        {error && <p role="alert">{error}</p>}
        {operation?.phase === "recovery-required" && <p>Keep both packages below. Retry recovery before making further edits.</p>}
        <div className="workspace-startup-actions">
          {exclusive && operation && (terminal || operation.phase === "requested") && <button onClick={() => void finish()}>{terminal ? "Open workspace" : "Cancel restore and open workspace"}</button>}
          <button onClick={() => location.reload()}>Retry</button>
          {operation && <button onClick={() => download(operation.backup, "Requested restore")}>Download requested backup</button>}
          {operation?.plan && <button onClick={() => void readProjectBackup(operation.plan!.recoveryBackupId).then(v => download(v.serialized, "Before restore")).catch(e => setError(String(e)))}>Download recovery copy</button>}
        </div>
      </>}
    </section>
  </main>;
}
