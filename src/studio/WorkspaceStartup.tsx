import { useEffect, useRef, useState, type ReactNode } from "react";
import { executeWorkspaceRestore, type RestoreOperation } from "./workspaceRestore";
import { browserRestorePorts, finishPendingRestore, readPendingRestore } from "./workspaceRestoreStorage";
import { readProjectBackup } from "./projectBackupStorage";
import { FENCING_JOB_STORAGE_KEY } from "./persistence";
import { recoverStoredJournal } from "./persistence/recoveryJournal";
import {
  browserLockBackend,
  browserLockBus,
  openWorkspaceLock,
  WorkspaceLockUnavailableError,
  type WorkspaceLockSession,
} from "./persistence/workspaceLock";
import { canMountStudio, WorkspaceRecoveryScreen } from "./workspaceRecoveryScreen";
import "./workspaceStartup.css";

function download(serialized: string, name: string) {
  const url = URL.createObjectURL(new Blob([serialized], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = `${name}.xray-backup.json`;
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function startupProjectId(storage: Pick<Storage, "getItem">): string {
  try {
    const raw = storage.getItem(FENCING_JOB_STORAGE_KEY);
    if (!raw) return "workspace";
    const id = (JSON.parse(raw) as { id?: unknown }).id;
    return typeof id === "string" && id.length > 0 && id.length <= 240 ? id : "workspace";
  } catch {
    return "workspace";
  }
}

let pageSession: Promise<WorkspaceLockSession> | null = null;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;
let pagehideBound = false;

function bindPagehide() {
  if (pagehideBound || typeof window === "undefined") return;
  pagehideBound = true;
  window.addEventListener("pagehide", () => {
    const pending = pageSession;
    pageSession = null;
    void pending?.then((session) => session.release());
  });
}

function acquirePageSession(projectId: string): Promise<WorkspaceLockSession> {
  bindPagehide();
  if (releaseTimer) {
    clearTimeout(releaseTimer);
    releaseTimer = null;
  }
  if (!pageSession) {
    pageSession = openWorkspaceLock({
      projectId,
      backend: browserLockBackend(),
      bus: browserLockBus(),
    }).catch((error: unknown) => {
      pageSession = null;
      throw error;
    });
  }
  return pageSession;
}

function schedulePageRelease() {
  if (releaseTimer) clearTimeout(releaseTimer);
  releaseTimer = setTimeout(() => {
    releaseTimer = null;
    const pending = pageSession;
    pageSession = null;
    void pending?.then((session) => session.release());
  }, 0);
}

/** Nothing in Studio mounts before this tab holds the exclusive workspace lease. */
export function WorkspaceStartup({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(true);
  const [operation, setOperation] = useState<RestoreOperation | null>(null), [error, setError] = useState("");
  const [exclusive, setExclusive] = useState(false), [readOnly, setReadOnly] = useState(false);
  const [quarantined, setQuarantined] = useState(false), [foreignHolderId, setForeignHolderId] = useState<string | null>(null);
  const sessionRef = useRef<WorkspaceLockSession | null>(null);
  const takeoverBusy = useRef(false);

  useEffect(() => {
    let disposed = false;
    let unsubscribe = () => {};
    let entered = false;
    let paused = false;
    const storage = window.localStorage;

    async function enterExclusive(session: WorkspaceLockSession) {
      if (disposed || paused || entered || session.mode !== "exclusive") return;
      entered = true;
      const pending = await readPendingRestore();
      if (disposed || session.mode !== "exclusive") {
        entered = false;
        return;
      }
      if (pending) {
        setOperation(pending);
        setExclusive(true);
        setReadOnly(false);
        setReady(false);
        try {
          const result = await executeWorkspaceRestore(pending, browserRestorePorts());
          if (!disposed && session.mode === "exclusive") setOperation(result);
        } catch (failure) {
          if (!disposed) {
            setError(failure instanceof Error ? failure.message : "Restoration did not finish.");
            setOperation(await readPendingRestore());
          }
        }
        if (!disposed) setBusy(false);
        return;
      }
      setExclusive(true);
      setReadOnly(false);
      setReady(true);
      setBusy(false);
    }

    async function start() {
      const recovery = recoverStoredJournal(storage);
      if (disposed) return;
      if (recovery.status === "quarantined") {
        paused = true;
        setQuarantined(true);
        setError(recovery.reason);
        setReady(false);
      }
      let session: WorkspaceLockSession;
      try {
        session = await acquirePageSession(startupProjectId(storage));
      } catch (failure) {
        if (disposed) return;
        setExclusive(false);
        setError(failure instanceof WorkspaceLockUnavailableError || failure instanceof Error ? failure.message : String(failure));
        setBusy(false);
        return;
      }
      if (disposed) return;
      sessionRef.current = session;
      const apply = () => {
        if (disposed) return;
        setForeignHolderId(session.foreignHolderId);
        if (session.mode === "read-only") {
          entered = false;
          setExclusive(false);
          setReadOnly(true);
          setReady(false);
          if (!takeoverBusy.current) setBusy(false);
          return;
        }
        setExclusive(true);
        setReadOnly(false);
        if (paused) {
          setBusy(false);
          return;
        }
        void enterExclusive(session);
      };
      unsubscribe = session.subscribe(apply);
      apply();
    }

    void start().catch((failure) => {
      if (!disposed) {
        setExclusive(false);
        setError(failure instanceof Error ? failure.message : String(failure));
        setBusy(false);
      }
    });
    return () => {
      disposed = true;
      unsubscribe();
      sessionRef.current = null;
      schedulePageRelease();
    };
  }, []);

  async function finish() {
    if (!operation || !exclusive) return;
    setBusy(true); setError("");
    try { await finishPendingRestore(operation); location.reload(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); setBusy(false); }
  }

  async function takeOver() {
    const session = sessionRef.current;
    if (!session || quarantined || takeoverBusy.current) return;
    takeoverBusy.current = true;
    setBusy(true); setError("");
    try {
      const result = await session.requestTakeover();
      if (result === "still-held") {
        setError("The other window still has this project open. Editing stays locked.");
        setBusy(false);
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
      setBusy(false);
    } finally {
      takeoverBusy.current = false;
    }
  }

  if (canMountStudio({ ready, readOnly, quarantined })) return <>{children}</>;
  return <WorkspaceRecoveryScreen
    busy={busy}
    error={error}
    operation={operation}
    exclusive={exclusive}
    readOnly={readOnly}
    quarantined={quarantined}
    foreignHolderId={foreignHolderId}
    onRetry={() => location.reload()}
    onFinish={() => void finish()}
    onTakeOver={() => void takeOver()}
    onDownloadRequested={() => { if (operation) download(operation.backup, "Requested restore"); }}
    onDownloadRecovery={() => {
      if (!operation?.plan) return;
      void readProjectBackup(operation.plan.recoveryBackupId)
        .then((value) => download(value.serialized, "Before restore"))
        .catch((failure) => setError(String(failure)));
    }}
  />;
}
