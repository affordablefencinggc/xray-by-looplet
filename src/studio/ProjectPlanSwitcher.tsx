import { useState } from "react";
import { FilePlus2, FolderOpen } from "lucide-react";
import { useStudio } from "./store";
import "./workspace-shell.css";

export interface ProjectPlanSwitcherProps {
  onSelect: (documentId: string) => Promise<void>;
  onOpenPlan?: () => Promise<void> | void;
  /** [PROVENANCE] Starts a new, empty project from the header. */
  onNewProject?: () => Promise<void> | void;
  onLoadSample?: (sampleId?: string) => Promise<void> | void;
}

export function ProjectPlanSwitcher({ onSelect, onOpenPlan, onLoadSample, onNewProject }: ProjectPlanSwitcherProps) {
  const documents = useStudio(state => state.job.documents);
  const activeId = useStudio(state => state.job.activeDocumentId);
  const hydrated = useStudio(state => state.persistenceHydrated);
  const plans = documents.filter(document => document.source !== "sample");
  const selected = plans.findIndex(document => document.id === activeId);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(val: string) {
    if (!val) return;
    if (val === "__OPEN_PLAN__") {
      if (onOpenPlan) {
        try {
          await onOpenPlan();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not open plan file");
        }
      }
      return;
    }
    if (val === "__SAMPLE_REDBURN__") {
      if (onLoadSample) {
        setSwitching(true);
        setError(null);
        try {
          await onLoadSample("redburn");
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not load sample plan");
        } finally {
          setSwitching(false);
        }
      }
      return;
    }
    if (switching || val === activeId) return;
    setSwitching(true);
    setError(null);
    try {
      await onSelect(val);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "This plan could not be restored.");
    } finally {
      setSwitching(false);
    }
  }

  const selectValue = selected >= 0 ? activeId ?? "" : "";

  return (
    <div className="workspace-plan-switcher" data-has-plans={plans.length > 0 ? "true" : "false"}>
      <label>
        <span className="workspace-plan-count">
          {switching ? "Restoring plan…" : plans.length ? `${Math.max(0, selected + 1)} of ${plans.length} plans` : "No plans open"}
        </span>
        <div className="workspace-plan-controls">
          <select
            aria-label="Current plan"
            value={selectValue}
            disabled={!hydrated || switching}
            onChange={(e) => void handleSelect(e.currentTarget.value)}
            title={plans[selected]?.name ?? "Open a plan to begin"}
          >
            {selected < 0 && <option value="">Open a plan to begin</option>}
            <option value="__OPEN_PLAN__">📂 Open plan file (PDF, CAD, Image)…</option>
            {onLoadSample && <option value="__SAMPLE_REDBURN__">📄 Load sample plan (Redburn BR250157 PDF)…</option>}
            {plans.length > 0 && (
              <optgroup label="Imported Project Plans">
                {plans.map((document) => (
                  <option key={document.id} value={document.id}>
                    {document.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          {onOpenPlan && (
            <button
              type="button"
              className="workspace-plan-open-btn"
              onClick={() => void onOpenPlan()}
              title="Browse and open a plan file"
              disabled={!hydrated || switching}
            >
              <FolderOpen size={13} />
              <span>Open</span>
            </button>
          )}
          {/* [PROVENANCE] Start a genuinely empty project from the header, so new work never begins
              on top of a job that already holds someone else's imported drawings. */}
          {onNewProject && (
            <button
              type="button"
              className="workspace-plan-new-btn"
              onClick={() => void onNewProject()}
              title="Start a new, empty project. The open project is saved first."
              disabled={!hydrated || switching}
            >
              <FilePlus2 size={13} />
              <span>New</span>
            </button>
          )}
        </div>
      </label>
      {error && <span className="workspace-plan-switch-error" role="alert">{error}</span>}
    </div>
  );
}
