import { useState, useId } from "react";
import { type ArchitectProject } from "./model.ts";
import { type AlterationBasis } from "./alterationStage.ts";
import {
  createAlterationIssueRecord,
  appendAlterationIssue,
  defaultAlterationIssueSheets,
  type AlterationIssueRecord,
} from "./alterationIssues.ts";

export type AlterationIssueModalProps = {
  project: ArchitectProject;
  basis: AlterationBasis | null;
  onClose: () => void;
  onIssued: (nextProject: ArchitectProject, issue: AlterationIssueRecord) => void;
};

export function AlterationIssueModal({
  project,
  basis,
  onClose,
  onIssued,
}: AlterationIssueModalProps) {
  const purposeId = useId();
  const [purpose, setPurpose] = useState("For construction / client sign-off");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const defaultSheets = defaultAlterationIssueSheets(project);

  const handleIssue = () => {
    setError("");
    if (!purpose.trim()) {
      setError("Please specify a formal issue purpose.");
      return;
    }
    if (!confirmed) {
      setError("Please confirm the coordinated drawings and schedules before issuing.");
      return;
    }
    if (!basis) {
      setError("A reviewed alteration basis is required to issue an alteration set.");
      return;
    }

    setBusy(true);
    try {
      const record = createAlterationIssueRecord(project, basis, {
        purpose: purpose.trim(),
        sheets: defaultSheets,
      });
      const nextProject = appendAlterationIssue(project, record);
      onIssued(nextProject, record);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The alteration set could not be issued.");
      setBusy(false);
    }
  };

  return (
    <div className="alteration-issue-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="issue-modal-title">
      <div className="alteration-issue-modal-card">
        <h3 id="issue-modal-title">Issue Coordinated Alteration Set</h3>
        <p className="alteration-stage-note">
          Freeze and issue official coordinated stage drawings (before & proposed plans, elevations, sections)
          and schedules (demolition, salvage/disposal, repair, materials, openings, rooms).
        </p>

        <div className="alteration-issue-field">
          <label htmlFor={purposeId}>Issue Purpose (required)</label>
          <input
            id={purposeId}
            value={purpose}
            maxLength={100}
            placeholder="e.g. For planning approval, For tender, For construction"
            onChange={(e) => setPurpose(e.target.value)}
          />
        </div>

        <div className="alteration-issue-summary">
          <strong>Included in this Coordinated Issue:</strong>
          <ul>
            <li><strong>Design Revision:</strong> {project.designRevision} (Model Rev {project.revision})</li>
            <li><strong>Basis Reference:</strong> {basis?.reference ?? "None"}</li>
            <li><strong>Registered Sheets ({defaultSheets.length}):</strong> Before Plan, Proposed Plan, North/South Elevations, Cross-Section</li>
            <li><strong>Frozen Schedules (6):</strong> Demolition, Salvage & Disposal, Repair, Materials & Waste, Stage Openings, Stage Rooms</li>
          </ul>
        </div>

        <label className="alteration-stage-confirm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span>
            I confirm that stage drawings, quantities, and annotations have been reviewed and are ready for official issue.
          </span>
        </label>

        {error && <p className="alteration-stage-error" role="alert">{error}</p>}

        <div className="alteration-actions-row">
          <button
            type="button"
            className="alteration-stage-review"
            disabled={busy || !confirmed || !purpose.trim()}
            onClick={handleIssue}
          >
            {busy ? "Freezing Issue Set…" : "Issue & Freeze Coordinated Set"}
          </button>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
