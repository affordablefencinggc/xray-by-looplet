import { useState } from "react";
import { useStudio } from "./store";
import "./workspace-shell.css";

export function ProjectPlanSwitcher({ onSelect }: { onSelect: (documentId: string) => Promise<void> }) {
  const documents = useStudio(state => state.job.documents);
  const activeId = useStudio(state => state.job.activeDocumentId);
  const hydrated = useStudio(state => state.persistenceHydrated);
  const plans = documents.filter(document => document.source !== "sample");
  const selected = plans.findIndex(document => document.id === activeId);
  const [switching, setSwitching] = useState(false), [error, setError] = useState<string | null>(null);
  async function select(documentId: string) {
    if (switching || documentId === activeId) return;
    setSwitching(true); setError(null);
    try { await onSelect(documentId); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "This plan could not be restored."); }
    finally { setSwitching(false); }
  }
  return <div className="workspace-plan-switcher">
    <label>
      <span className="workspace-plan-count">{switching ? "Restoring plan…" : plans.length ? `${Math.max(0, selected + 1)} of ${plans.length} plans` : "No plans open"}</span>
      <select aria-label="Current plan" value={selected >= 0 ? activeId ?? "" : ""} disabled={!hydrated || switching || !plans.length} onChange={event => { void select(event.currentTarget.value); }} title={plans[selected]?.name ?? "Open a plan to begin"}>
        {selected < 0 && <option value="">Open a plan to begin</option>}
        {plans.map(document => <option key={document.id} value={document.id}>{document.name}</option>)}
      </select>
    </label>
    {error && <span className="workspace-plan-switch-error" role="alert">{error}</span>}
  </div>;
}
