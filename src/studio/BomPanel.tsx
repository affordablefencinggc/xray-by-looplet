import type { BomAssumption, BomIssue } from "./bomContract.ts";
import type { BomStateEnvelope } from "./bomState.ts";

export type BomTransportStatus =
  | { phase: "idle" }
  | { phase: "pending"; message?: string }
  | { phase: "failed"; message: string };

export type BomEvidenceRef = NonNullable<BomStateEnvelope["snapshot"]>["response"]["bom"]["lines"][number]["evidenceRefs"][number];

export type BomPanelProps = {
  state: BomStateEnvelope;
  compileIssues?: readonly BomIssue[];
  transportStatus?: BomTransportStatus;
  /** `null` means no recipe is selected; an empty array is a recipe with no assumptions. */
  recipeAssumptions?: readonly BomAssumption[] | null;
  generationAvailable?: boolean;
  onGenerate: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onAcceptAssumption: (assumptionId: string) => void;
  onReopenAssumption: (assumptionId: string) => void;
  onOpenEvidence?: (reference: BomEvidenceRef) => void;
};

type PanelState =
  | "no-recipe"
  | "assumptions"
  | "pending"
  | "transport-failure"
  | "domain-issues"
  | "current"
  | "stale"
  | "unavailable"
  | "ready";

export function deriveBomPanelState({
  state,
  compileIssues = [],
  transportStatus = { phase: "idle" },
  recipeAssumptions = null,
  generationAvailable = true,
}: Pick<BomPanelProps, "state" | "compileIssues" | "transportStatus" | "recipeAssumptions" | "generationAvailable">): PanelState {
  if (state.pending || transportStatus.phase === "pending") return "pending";
  if (transportStatus.phase === "failed" || state.lastFailure?.kind === "transport" || state.lastFailure?.kind === "contract") return "transport-failure";
  if (compileIssues.length > 0 || state.lastFailure?.kind === "domain") return "domain-issues";
  if (state.snapshot && state.invalidation) return "stale";
  if (state.snapshot) return "current";
  if (recipeAssumptions === null) return "no-recipe";
  if (recipeAssumptions.some((assumption) => assumption.status === "unresolved")) return "assumptions";
  if (!generationAvailable) return "unavailable";
  return "ready";
}

export function BomPanel(props: BomPanelProps) {
  const {
    state,
    compileIssues = [],
    transportStatus = { phase: "idle" },
    recipeAssumptions = null,
    generationAvailable = true,
    onGenerate,
    onCancel,
    onRetry,
    onAcceptAssumption,
    onReopenAssumption,
    onOpenEvidence,
  } = props;
  const panelState = deriveBomPanelState({ state, compileIssues, transportStatus, recipeAssumptions, generationAvailable });
  const unresolved = recipeAssumptions?.filter((assumption) => assumption.status === "unresolved") ?? [];
  const accepted = recipeAssumptions?.filter((assumption) => assumption.status === "accepted") ?? [];
  const issues = compileIssues.length > 0 ? compileIssues : state.lastFailure?.kind === "domain" ? state.lastFailure.issues : [];
  const snapshot = state.snapshot;

  return (
    <section className="bom-panel flex min-w-0 flex-col" aria-labelledby="bom-panel-heading" aria-busy={panelState === "pending" || undefined}>
      <header className="cost-state-card">
        <div className="pane-heading-row">
          <div>
            <span className="eyebrow">Evidence-bound quantity register</span>
            <h1 id="bom-panel-heading" className="mt-1 text-xl font-semibold">Materials / BOM</h1>
          </div>
          <span className="asset-state">{stateLabel(panelState)}</span>
        </div>
        <p className="mt-2 text-pretty">Measured quantities · evidence trace only.</p>
      </header>

      {panelState === "no-recipe" ? (
        <StateCard title="No materials recipe" detail="Select a versioned materials recipe before generating a bill of materials." />
      ) : null}

      {snapshot && state.invalidation && panelState !== "pending" ? (
        <section className="cost-readiness" aria-labelledby="bom-regenerate-heading">
          <span className="eyebrow">Source revision changed</span>
          <h2 id="bom-regenerate-heading" className="mt-1 text-lg font-semibold">Rebuild current quantities</h2>
          <p className="mt-2 text-muted">The retained register remains available for comparison, but it cannot represent the current evidence revision.</p>
          {generationAvailable ? (
            <button type="button" className="button button-primary mt-3 min-h-11" disabled={unresolved.length > 0} onClick={onGenerate}>Regenerate BOM</button>
          ) : (
            <span className="mt-2 block text-muted">Open this job in the X-Ray desktop workbench to regenerate the retained quantities.</span>
          )}
        </section>
      ) : null}

      {unresolved.length > 0 && panelState !== "pending" ? (
        <section className="cost-readiness" aria-labelledby="bom-assumptions-heading">
          <span className="eyebrow">Confirmation required</span>
          <h2 id="bom-assumptions-heading" className="mt-1 text-lg font-semibold">Review recipe assumptions</h2>
          <p className="mt-2 text-muted">Generation remains unavailable until each listed assumption is explicitly accepted.</p>
          <ul>
            {unresolved.map((assumption) => (
              <li key={assumption.id} className="border-t border-line pt-2">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0">
                    <strong className="block text-ink">{assumption.label}</strong>
                    <span className="block break-words">{assumption.value} {assumption.unit} · {assumption.source}</span>
                  </span>
                  <button type="button" className="button min-h-11" onClick={() => onAcceptAssumption(assumption.id)}>Accept assumption</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {panelState === "pending" ? (
        <section className="cost-readiness" role="status">
          <span className="eyebrow">Build in progress</span>
          <h2 className="mt-1 text-lg font-semibold">Compiling quantities</h2>
          <p className="mt-2 text-muted">{transportStatus.phase === "pending" && transportStatus.message ? transportStatus.message : "Applying the bound recipe and evidence rules."}</p>
          <button type="button" className="button mt-3 min-h-11" onClick={onCancel}>Cancel build</button>
        </section>
      ) : null}

      {panelState === "transport-failure" ? (
        <section className="cost-readiness" role="alert">
          <span className="eyebrow">Build interrupted</span>
          <h2 className="mt-1 text-lg font-semibold">BOM could not be generated</h2>
          <p className="mt-2 text-muted">{transportFailureMessage(state, transportStatus)}</p>
          <button type="button" className="button mt-3 min-h-11" onClick={onRetry}>Retry build</button>
        </section>
      ) : null}

      {panelState === "domain-issues" ? (
        <IssueList issues={issues} onRetry={onRetry} />
      ) : null}

      {panelState === "ready" ? (
        <section className="cost-readiness">
          <span className="eyebrow">Ready to compile</span>
          <h2 className="mt-1 text-lg font-semibold">Recipe assumptions confirmed</h2>
          <p className="mt-2 text-muted">Generate deterministic material quantities from the current evidence revision.</p>
          <button type="button" className="button button-primary mt-3 min-h-11" onClick={onGenerate}>Generate BOM</button>
        </section>
      ) : null}

      {panelState === "unavailable" ? (
        <StateCard title="Desktop quantity engine required" detail="This browser can inspect retained validated quantities, but it cannot generate a new BOM. Open this job in the X-Ray desktop workbench to run the bound local engine." />
      ) : null}

      {accepted.length > 0 ? (
        <section className="cost-readiness" aria-labelledby="bom-accepted-assumptions-heading">
          <span className="eyebrow">Audited decisions</span>
          <h2 id="bom-accepted-assumptions-heading" className="mt-1 text-lg font-semibold">Accepted project assumptions</h2>
          <ul>
            {accepted.map((assumption) => (
              <li key={assumption.id} className="border-t border-line pt-2">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                  <span className="min-w-0">
                    <strong className="block text-ink">{assumption.label}</strong>
                    <span className="block break-words">{assumption.value} {assumption.unit} · {assumption.source}</span>
                    <span className="mt-1 block font-mono text-xs">Accepted by {assumption.acceptedBy} · {assumption.acceptedAt}</span>
                  </span>
                  <button type="button" className="button min-h-11" onClick={() => onReopenAssumption(assumption.id)}>Reopen</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {snapshot ? <BomSnapshot state={state} onOpenEvidence={onOpenEvidence} /> : null}
    </section>
  );
}

function StateCard({ title, detail }: { title: string; detail: string }) {
  return (
    <section className="cost-readiness">
      <span className="eyebrow">Not ready</span>
      <h2 className="mt-1 text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-muted">{detail}</p>
    </section>
  );
}

function IssueList({ issues, onRetry }: { issues: readonly BomIssue[]; onRetry: () => void }) {
  return (
    <section className="cost-readiness" aria-labelledby="bom-issues-heading" role="alert">
      <span className="eyebrow">Evidence or rule issues</span>
      <h2 id="bom-issues-heading" className="mt-1 text-lg font-semibold">Resolve before generating</h2>
      <ul>
        {issues.map((issue, index) => (
          <li key={`${issue.code}-${issue.entityId ?? "job"}-${index}`} className="border-t border-line pt-2">
            <strong className="block text-ink">{issue.code}</strong>
            <span className="block break-words">{issue.message}</span>
            {issue.path ? <code className="mt-1 block break-words font-mono text-xs">{issue.path}</code> : null}
          </li>
        ))}
      </ul>
      <button type="button" className="button mt-3 min-h-11" onClick={onRetry}>Check again</button>
    </section>
  );
}

function BomSnapshot({ state, onOpenEvidence }: { state: BomStateEnvelope; onOpenEvidence?: (reference: BomEvidenceRef) => void }) {
  const snapshot = state.snapshot;
  if (!snapshot) return null;
  const { bom } = snapshot.response;
  const stale = state.invalidation !== null;
  return (
    <section className="cost-readiness" aria-labelledby="bom-lines-heading">
      <div className="pane-heading-row">
        <div>
          <span className="eyebrow">{stale ? "Retained result" : "Current result"}</span>
          <h2 id="bom-lines-heading" className="mt-1 text-lg font-semibold">Material quantities</h2>
        </div>
        <span className="asset-state">{stale ? "Stale" : bom.status}</span>
      </div>

      {stale ? (
        <div className="mt-3 border-y border-line py-3" role="status">
          <strong className="block">Stale — source inputs changed</strong>
          <span className="mt-1 block text-muted">These retained quantities are for the previous bound revision and must not be treated as current.</span>
          <span className="mt-1 block font-mono text-xs text-muted">{state.invalidation?.reasons.map(formatReason).join(" · ")}</span>
        </div>
      ) : null}

      <dl className="mt-3 grid grid-cols-1 gap-2 border-y border-line py-3 sm:grid-cols-3">
        <SummaryItem label="Line items" value={bom.summary.lineCount} />
        <SummaryItem label="Needs human review" value={bom.summary.needsHumanCount} />
        <SummaryItem label="Blocking issues" value={bom.summary.blockerCount} />
      </dl>

      <div className="mt-3 overflow-x-auto">
        <table className="bom-table w-full min-w-max border-collapse text-left">
          <caption className="sr-only">Bill of materials quantity lines and calculation evidence</caption>
          <thead>
            <tr className="eyebrow">
              <th className="py-2 pr-4" scope="col">Code</th>
              <th className="py-2 pr-4" scope="col">Description</th>
              <th className="py-2 pr-4" scope="col">Quantity</th>
              <th className="py-2" scope="col">Trace</th>
            </tr>
          </thead>
          <tbody>
            {bom.lines.map((line) => (
              <tr className="border-t border-line align-top" key={line.id}>
                <td className="py-3 pr-4 font-mono text-xs">{line.itemCode ?? "Uncoded"}</td>
                <td className="py-3 pr-4">{line.description}</td>
                <td className="py-3 pr-4 font-mono tabular-nums">{line.quantity.value} {line.quantity.unit}</td>
                <td className="py-3">
                  <details>
                    <summary className="min-h-11 cursor-pointer py-2 font-medium">Calculation and evidence</summary>
                    <dl className="grid min-w-0 gap-2 pb-2 text-sm">
                      <Detail label="Rule" value={`${line.calculation.ruleId}@${line.calculation.ruleVersion}`} />
                      <Detail label="Expression" value={line.calculation.expression} />
                      <Detail label="Operands" value={line.calculation.operands.length ? line.calculation.operands.map((operand) => `${operand.name}=${operand.value} ${operand.unit}`).join(" · ") : "No separate operands recorded"} />
                      <Detail label="Result" value={`${line.calculation.result.value} ${line.calculation.result.unit}`} />
                      <Detail label="Confidence" value={formatConfidence(line.confidenceTier)} />
                      <EvidenceLinks references={line.evidenceRefs} onOpen={onOpenEvidence} />
                      <Detail label="Assumptions" value={line.assumptionRefs.length ? line.assumptionRefs.join(", ") : "None"} />
                    </dl>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="bom-register-boundary mt-3 text-muted">Quantities only — unpriced and not sent.</p>
    </section>
  );
}

function EvidenceLinks({ references, onOpen }: { references: readonly BomEvidenceRef[]; onOpen?: (reference: BomEvidenceRef) => void }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow">Evidence</dt>
      <dd className="mt-1 flex flex-wrap gap-1.5">
        {references.map((reference) => onOpen ? (
          <button key={`${reference.kind}-${reference.id}`} type="button" className="pill" onClick={() => onOpen(reference)}>{formatEvidenceRef(reference)}</button>
        ) : <span key={`${reference.kind}-${reference.id}`}>{formatEvidenceRef(reference)}</span>)}
      </dd>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: number }) {
  return <div><dt className="eyebrow">{label}</dt><dd className="mt-1 font-mono text-lg tabular-nums">{value}</dd></div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="eyebrow">{label}</dt><dd className="mt-1 break-words">{value}</dd></div>;
}

function stateLabel(state: PanelState): string {
  return {
    "no-recipe": "No recipe",
    assumptions: "Needs confirmation",
    pending: "Compiling",
    "transport-failure": "Interrupted",
    "domain-issues": "Issues found",
    current: "Current",
    stale: "Stale result",
    unavailable: "Desktop required",
    ready: "Ready",
  }[state];
}

function transportFailureMessage(state: BomStateEnvelope, status: BomTransportStatus): string {
  if (status.phase === "failed") return status.message;
  return state.lastFailure?.message ?? "The quantity build was interrupted before a verified result was received.";
}

function formatReason(reason: NonNullable<BomStateEnvelope["invalidation"]>["reasons"][number]): string {
  return reason.replaceAll("-", " ");
}

function formatConfidence(tier: "reconciled" | "single-source" | "needs-human"): string {
  return { reconciled: "Reconciled", "single-source": "Single source", "needs-human": "Needs human review" }[tier];
}

function formatEvidenceRef(ref: NonNullable<BomStateEnvelope["snapshot"]>["response"]["bom"]["lines"][number]["evidenceRefs"][number]): string {
  if ("revision" in ref) return `${ref.kind}:${ref.id} rev ${ref.revision}`;
  if ("sha256" in ref) return `${ref.kind}:${ref.id} SHA ${ref.sha256.slice(0, 10)}…`;
  if (ref.kind === "calibration") return `${ref.kind}:${ref.id} digest ${ref.digest.slice(0, 10)}…`;
  return `${ref.kind}:${ref.id}`;
}
