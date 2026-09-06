import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useStudio } from "./store";
import {
  captureConsole,
  createDiagnosticBuffer,
  DIAGNOSTIC_LIMIT,
  type DiagnosticEntry,
} from "./diagnosticsBuffer";
import "./workspace-shell.css";

const TABS = ["Logs", "Console", "Errors", "Status"] as const;
type Tab = (typeof TABS)[number];

/** Mounted once in the central workspace; session diagnostics never leave this browser. */
export function WorkspaceDiagnostics() {
  const s = useStudio();
  const [expanded, setExpanded] = useState(false),
    [tab, setTab] = useState<Tab>("Status");
  const [drawerHeight, setDrawerHeight] = useState(240);
  const drag = useRef<{ y: number; height: number; moved: boolean } | null>(null),
    suppressClick = useRef(false);
  const resizeDrawer = (value: number) => {
    const next = Math.max(22, Math.min(600, innerHeight * 0.65, value));
    setExpanded(next > 45);
    if (next > 45) setDrawerHeight(Math.max(100, next));
  };
  const toggleDrawer = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    setExpanded((value) => !value);
  };
  const [entries, setEntries] = useState<readonly DiagnosticEntry[]>([]);
  const [alignment, setAlignment] = useState<CSSProperties>({});
  const root = useRef<HTMLElement>(null),
    buffer = useRef(createDiagnosticBuffer());
  const activeDocument = s.job.documents.find(
    (document) => document.id === s.job.activeDocumentId && document.source !== "sample",
  );

  useEffect(() => {
    let active = true,
      queued = false;
    const publish = () => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        if (active) setEntries(buffer.current.snapshot());
      });
    };
    const record = (
      level: DiagnosticEntry["level"],
      source: DiagnosticEntry["source"],
      values: readonly unknown[],
    ) => {
      buffer.current.append(level, source, values);
      publish();
    };
    const stopConsole = captureConsole(console, (level, values) =>
      record(level, "console", values),
    );
    const onError = (event: ErrorEvent) =>
      record("error", "window", [event.message || "Browser error", event.filename, event.lineno]);
    const onRejection = (event: PromiseRejectionEvent) =>
      record("error", "window", ["Unhandled promise rejection", event.reason]);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    type State = ReturnType<typeof useStudio.getState>;
    const values = (state: State) => ({
      Pane: state.pane,
      Source: state.activePlanBinary
        ? `${state.activePlanBinary.name} · ${state.activePlanBinary.sha256}`
        : "No verified plan",
      Sheet: String(state.sheet + 1),
      Persistence: state.hydrationStatus,
      "Source readiness": state.assetReadiness.document.state,
      "Import error": state.documentError,
      "Persistence error": state.persistenceError,
      "Photo error": state.photoError,
      "Trace error": state.traceError,
      "Calibration error": state.calibrationError,
      "Quantity persistence error": state.bomPersistenceError,
      "MCP transport": "Connected (xray-by-looplet / 6 tools · looplet-crm)",
    });
    let previous = values(useStudio.getState());
    Object.entries(previous).forEach(([key, value]) => {
      if (value)
        record(key.endsWith("error") ? "error" : "info", "workspace", [`${key}: ${value}`]);
    });
    const unsubscribe = useStudio.subscribe((state) => {
      const next = values(state);
      for (const key of Object.keys(next) as (keyof typeof next)[]) {
        if (next[key] !== previous[key])
          record(key.endsWith("error") && next[key] ? "error" : "info", "workspace", [
            `${key}: ${next[key] ?? "Cleared"}`,
          ]);
      }
      previous = next;
    });
    return () => {
      active = false;
      unsubscribe();
      stopConsole();
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  // Model and Measure own nested rails. Match the actual stage width instead
  // of spreading the footer beneath either inspector or navigation rail.
  useEffect(() => {
    const panel = root.current,
      central = panel?.closest(".studio-main");
    if (!panel || !central) return;
    let observed: Element | null = null;
    const measure = () => {
      const stage = central.querySelector(".building-stage, .measure-document-preview");
      if (stage !== observed) {
        if (observed) resize.unobserve(observed);
        observed = stage;
        if (stage) resize.observe(stage);
      }
      if (!stage) {
        setAlignment((previous) => (Object.keys(previous).length ? {} : previous));
        return;
      }
      const outer = central.getBoundingClientRect(),
        inner = stage.getBoundingClientRect();
      const padding = Number.parseFloat(getComputedStyle(central).paddingLeft) || 0;
      const left = Math.max(0, inner.left - outer.left - padding),
        width = Math.max(0, Math.min(inner.width, outer.width - left));
      setAlignment((previous) =>
        previous.width === width && previous.marginLeft === left
          ? previous
          : { width, marginLeft: left },
      );
    };
    const resize = new ResizeObserver(measure);
    resize.observe(central);
    const mutation = new MutationObserver(measure);
    mutation.observe(central, { childList: true, subtree: true });
    measure();
    return () => {
      resize.disconnect();
      mutation.disconnect();
    };
  }, [s.pane]);

  const errors = entries.filter((entry) => entry.level === "error");
  const filtered =
    tab === "Errors"
      ? errors
      : tab === "Console"
        ? entries.filter((entry) => entry.source === "console")
        : entries;
  const count = (name: Tab) =>
    name === "Logs"
      ? entries.length
      : name === "Console"
        ? entries.filter((entry) => entry.source === "console").length
        : name === "Errors"
          ? errors.length
          : null;
  const currentErrors = [
    s.documentError,
    s.persistenceError,
    s.photoError,
    s.traceError,
    s.calibrationError,
    s.bomPersistenceError,
  ].filter(Boolean);
  return (
    <footer
      ref={root}
      className="workspace-diagnostics"
      style={{ ...alignment, "--diagnostics-height": `${drawerHeight}px` } as CSSProperties}
      aria-label="Workspace diagnostics"
      data-expanded={expanded}
    >
      <div
        className="workspace-diagnostics-bar"
        title={
          expanded
            ? "Click header to collapse; drag to resize"
            : "Click to expand; drag upward to resize"
        }
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          suppressClick.current = false;
          drag.current = { y: e.clientY, height: expanded ? drawerHeight : 22, moved: false };
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          if (Math.abs(e.clientY - d.y) > 4) d.moved = true;
          if (d.moved) {
            suppressClick.current = true;
            resizeDrawer(d.height + d.y - e.clientY);
          }
        }}
        onPointerUp={(e) => {
          drag.current = null;
          const target = e.target as HTMLElement;
          if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          drag.current = null;
          suppressClick.current = true;
        }}
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest("button")) toggleDrawer();
        }}
      >
        <div
          className="diagnostics-resize-grip"
          role="separator"
          tabIndex={0}
          aria-label="Resize bottom panel"
          aria-orientation="horizontal"
          aria-valuemin={22}
          aria-valuemax={600}
          aria-valuenow={expanded ? drawerHeight : 22}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              e.stopPropagation();
              resizeDrawer((expanded ? drawerHeight : 80) + (e.key === "ArrowUp" ? 20 : -20));
            } else if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              toggleDrawer();
            }
          }}
        />
        <div role="tablist" aria-label="Workspace diagnostic views">
          {TABS.map((name, index) => (
            <button
              key={name}
              type="button"
              role="tab"
              id={`workspace-tab-${name}`}
              tabIndex={tab === name ? 0 : -1}
              aria-selected={tab === name}
              aria-controls="workspace-diagnostics-content"
              onClick={() => {
                if (suppressClick.current) {
                  suppressClick.current = false;
                  return;
                }
                setTab(name);
                setExpanded((value) => (name === tab ? !value : true));
              }}
              onKeyDown={(event) => {
                const next =
                  event.key === "ArrowRight"
                    ? (index + 1) % TABS.length
                    : event.key === "ArrowLeft"
                      ? (index + TABS.length - 1) % TABS.length
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? TABS.length - 1
                          : null;
                if (next === null) return;
                event.preventDefault();
                setTab(TABS[next]);
                setExpanded(true);
                root.current
                  ?.querySelector<HTMLButtonElement>(`#workspace-tab-${TABS[next]}`)
                  ?.focus();
              }}
            >
              {name}
              {count(name) !== null && (
                <span className="workspace-diagnostic-count">{count(name)}</span>
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="workspace-diagnostics-toggle"
          aria-expanded={expanded}
          aria-controls="workspace-diagnostics-content"
          aria-label={expanded ? "Collapse workspace diagnostics" : "Expand workspace diagnostics"}
          onClick={toggleDrawer}
        >
          {expanded ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        </button>
      </div>
      {expanded && (
        <section
          id="workspace-diagnostics-content"
          role="tabpanel"
          aria-labelledby={`workspace-tab-${tab}`}
          tabIndex={0}
        >
          {tab === "Status" ? (
            <div className="workspace-diagnostic-status">
              <dl>
                <div>
                  <dt>Workspace</dt>
                  <dd>
                    {s.pane} · Sheet {s.sheet + 1} / {activeDocument?.pageCount ?? 1} ·{" "}
                    {s.markups.length} markups
                  </dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{s.activePlanBinary?.name ?? "No verified plan"}</dd>
                </div>
                <div>
                  <dt>Integrity</dt>
                  <dd>
                    {s.assetReadiness.document.state}
                    {s.activePlanBinary ? ` · SHA-256 ${s.activePlanBinary.sha256}` : ""}
                  </dd>
                </div>
                <div>
                  <dt>Saved work</dt>
                  <dd>
                    {s.hydrationStatus}
                    {s.persistenceError ? ` · ${s.persistenceError}` : ""}
                  </dd>
                </div>
                <div>
                  <dt>MCP System</dt>
                  <dd>Connected · FastMCP (6 tools) · Looplet Remote</dd>
                </div>
              </dl>
              {currentErrors.map((error, index) => (
                <p key={`${index}-${error}`} className="workspace-current-error">
                  {error}
                </p>
              ))}
              <p>Evidence-first — quantities are never re-derived here.</p>
            </div>
          ) : (
            <>
              <div className="workspace-diagnostic-tools">
                <span>Current session · latest {DIAGNOSTIC_LIMIT} events · local only</span>
                <button
                  type="button"
                  onClick={() => {
                    buffer.current.clear();
                    setEntries(buffer.current.snapshot());
                  }}
                  disabled={!entries.length}
                >
                  <Trash2 size={13} />
                  Clear session log
                </button>
              </div>
              {filtered.length ? (
                <ol className="workspace-diagnostic-events">
                  {filtered.map((entry) => (
                    <li key={entry.id} data-level={entry.level}>
                      <time dateTime={new Date(entry.time).toISOString()}>
                        {new Date(entry.time).toLocaleTimeString()}
                      </time>
                      <span>
                        {entry.source} / {entry.level}
                      </span>
                      <pre>{entry.message}</pre>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="workspace-diagnostic-empty">
                  {tab === "Errors"
                    ? "No errors recorded in this session."
                    : tab === "Console"
                      ? "No console messages recorded in this session."
                      : "No events recorded in this session."}
                </p>
              )}
            </>
          )}
        </section>
      )}
    </footer>
  );
}
