import { useState } from "react";
import { type ArchitectProject } from "./model.ts";
import {
  type AlterationIssueRecord,
  alterationIssueSeal,
  compareAlterationIssues,
  type AlterationIssueComparison,
} from "./alterationIssues.ts";
import { exportAlterationIssueSetPdf } from "./alterationIssueExport.ts";

export type AlterationIssueHistoryProps = {
  project: ArchitectProject;
};

export function AlterationIssueHistory({ project }: AlterationIssueHistoryProps) {
  const issues = project.alterationIssues ?? [];
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState("");
  const [comparison, setComparison] = useState<AlterationIssueComparison | null>(null);

  const handleDownloadPdf = async (issueId: string, revision: string) => {
    setDownloadError("");
    setDownloadingId(issueId);
    try {
      const pdfBytes = await exportAlterationIssueSetPdf(project, issueId);
      const blob = new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `alteration-issue-rev-${revision}-${project.id.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
      document.body.appendChild(a);
      try {
        a.click();
      } finally {
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "PDF export failed.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCompare = (baseline: AlterationIssueRecord, target: AlterationIssueRecord) => {
    const result = compareAlterationIssues(baseline, target);
    setComparison(result);
  };

  if (issues.length === 0) {
    return (
      <div className="alteration-saved-drafts">
        <strong>Formal Coordinated Issue History</strong>
        <p className="alteration-stage-note">
          No formal alteration sets have been issued yet. Review stage geometry and click &ldquo;Issue Coordinated Set&rdquo; to freeze an auditable revision.
        </p>
      </div>
    );
  }

  return (
    <div className="alteration-saved-drafts">
      <div className="alteration-actions-row">
        <strong>Formal Coordinated Issue History ({issues.length} records)</strong>
      </div>
      {downloadError && <p className="alteration-stage-error" role="alert">{downloadError}</p>}

      {/* Comparison Drawer / Card */}
      {comparison && (
        <div className="alteration-issue-comparison-card">
          <div className="alteration-comparison-header">
            <strong>
              Revision Comparison: Rev {comparison.baselineRevision} vs Rev {comparison.targetRevision}
            </strong>
            <button type="button" onClick={() => setComparison(null)}>
              Close Comparison
            </button>
          </div>
          <p className="alteration-stage-note">
            Comparison between formal issue releases across geometry, schedules, and drawing sheets.
          </p>

          <table className="alteration-breakdown-table" aria-label="Revision delta comparison">
            <thead>
              <tr>
                <th scope="col">Scope / Quantity</th>
                <th scope="col">Delta (Target − Baseline)</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Proposed Wall Solid Volume</td>
                <td>{comparison.wallVolumeDeltaM3 > 0 ? "+" : ""}{comparison.wallVolumeDeltaM3.toFixed(4)} m³</td>
                <td>{Math.abs(comparison.wallVolumeDeltaM3) > 1e-4 ? "Modified" : "Unchanged"}</td>
              </tr>
              <tr>
                <td>Demolition Scope Volume</td>
                <td>{comparison.demolitionVolumeDeltaM3 > 0 ? "+" : ""}{comparison.demolitionVolumeDeltaM3.toFixed(4)} m³</td>
                <td>{Math.abs(comparison.demolitionVolumeDeltaM3) > 1e-4 ? "Modified" : "Unchanged"}</td>
              </tr>
              <tr>
                <td>Salvage & Disposal Volume</td>
                <td>{comparison.salvageVolumeDeltaM3 > 0 ? "+" : ""}{comparison.salvageVolumeDeltaM3.toFixed(4)} m³</td>
                <td>{Math.abs(comparison.salvageVolumeDeltaM3) > 1e-4 ? "Modified" : "Unchanged"}</td>
              </tr>
              <tr>
                <td>Repair Scope Volume</td>
                <td>{comparison.repairVolumeDeltaM3 > 0 ? "+" : ""}{comparison.repairVolumeDeltaM3.toFixed(4)} m³</td>
                <td>{Math.abs(comparison.repairVolumeDeltaM3) > 1e-4 ? "Modified" : "Unchanged"}</td>
              </tr>
              <tr>
                <td>Material Order Area</td>
                <td>{comparison.materialOrderAreaDeltaM2 > 0 ? "+" : ""}{comparison.materialOrderAreaDeltaM2.toFixed(2)} m²</td>
                <td>{Math.abs(comparison.materialOrderAreaDeltaM2) > 1e-4 ? "Modified" : "Unchanged"}</td>
              </tr>
              <tr>
                <td>Room Floor Area</td>
                <td>{comparison.roomAreaDeltaM2 > 0 ? "+" : ""}{comparison.roomAreaDeltaM2.toFixed(2)} m²</td>
                <td>{Math.abs(comparison.roomAreaDeltaM2) > 1e-4 ? "Modified" : "Unchanged"}</td>
              </tr>
              <tr>
                <td>Openings Count</td>
                <td>{comparison.openingsCountDelta > 0 ? "+" : ""}{comparison.openingsCountDelta} apertures</td>
                <td>{comparison.openingsCountDelta !== 0 ? "Modified" : "Unchanged"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* List of Issues (Reverse chronological) */}
      <div className="alteration-issues-list">
        {[...issues].reverse().map((issue, idx, arr) => {
          const isCurrent = issue.status === "current";
          const priorIssue = arr[idx + 1];
          /* Recomputed here rather than read off the record: the badge says the frozen bytes hash to the
             seal this issue was issued with, which is the claim a reader is being asked to rely on. */
          const seal = alterationIssueSeal(issue);

          return (
            <div key={issue.id} className="alteration-saved-row alteration-issue-row">
              <div className="alteration-issue-row-header">
                <div>
                  <span className={`alteration-status-badge ${isCurrent ? "status-current" : "status-superseded"}`}>
                    {isCurrent ? "CURRENT" : "SUPERSEDED"}
                  </span>
                  <strong style={{ marginLeft: 8 }}>
                    Rev {issue.designRevision} — {issue.purpose}
                  </strong>
                </div>
                <time dateTime={issue.issuedAt}>{new Date(issue.issuedAt).toLocaleString("en-AU")}</time>
              </div>

              <p className="alteration-seal-row">
                {seal.sealed ? (
                  <span
                    className="alteration-seal-badge seal-verified"
                    title={`The frozen source hashes to ${seal.contentSha256}, the seal this issue was issued with.`}
                  >
                    Cryptographically Sealed (SHA-256 Verified)
                  </span>
                ) : (
                  <span
                    className="alteration-seal-badge seal-broken"
                    role="alert"
                    title={`The frozen source no longer hashes to ${seal.contentSha256}. Re-issue the set from the project; do not edit this record.`}
                  >
                    Seal not verified — the frozen bytes have changed since this issue was sealed
                  </span>
                )}
                <code className="alteration-seal-hash">{seal.contentSha256.slice(0, 16)}…</code>
              </p>

              {!isCurrent && issue.supersededByRevision && (
                <p className="alteration-superseded-pointer">
                  Superseded by Revision {issue.supersededByRevision} on {new Date(issue.supersededAt ?? "").toLocaleString("en-AU")}.
                </p>
              )}

              <p className="alteration-stage-note">
                Basis: {issue.basis.reference} | Registered Sheets: {issue.sheets.length} | Demolition: {issue.schedulesSummary.demolitionVolumeM3.toFixed(3)} m³ | Rooms: {issue.proposedSummary.roomsCount} ({issue.proposedSummary.totalRoomAreaM2.toFixed(2)} m²)
              </p>

              <div className="alteration-saved-actions">
                <button
                  type="button"
                  className="alteration-download-btn"
                  disabled={downloadingId === issue.id}
                  onClick={() => handleDownloadPdf(issue.id, issue.designRevision)}
                >
                  {downloadingId === issue.id ? "Preparing PDF…" : "Download Issued PDF"}
                </button>

                {priorIssue && (
                  <button
                    type="button"
                    onClick={() => handleCompare(priorIssue, issue)}
                  >
                    Compare with Rev {priorIssue.designRevision}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
