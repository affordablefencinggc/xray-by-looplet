import { useEffect, useRef, useState } from "react";
import { useLiveAssistant, reviewMatchesSource } from "./liveAssistantState";
import { useStudio } from "./store";
import { ScanSearch, Settings2, FileCheck2, X } from "lucide-react";
import { z } from "zod";
import type { PlanBinary } from "./documentContract";
import type { ProjectMaterials, ProjectMaterial } from "./construction/projectMaterials";
import { appendAiRun, aiProposalDraft, resolveAiProposal } from "./construction/aiMaterialReview";
import {
  scoreMaterialBenchmark,
  type AiProposal,
  type AiMaterialRun,
} from "./construction/aiMaterials";
import { prepareMaterialAiPage } from "./materialAiImages";
import {
  canConfigureMaterialAi,
  configureMaterialAi,
  getMaterialAiStatus,
  runMaterialAi,
  type MaterialAiStatus,
} from "./materialAiTransport";

const truthSchema = z
  .array(
    z
      .object({
        key: z.string().trim().min(1),
        quantity: z.number().finite().nonnegative(),
        unit: z.enum(["each", "m", "m2", "m3", "kg"]),
      })
      .strict(),
  )
  .min(1)
  .max(1000);
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
type Props = {
  value: ProjectMaterials;
  binary: PlanBinary | null;
  disabled: boolean;
  commit: (next: ProjectMaterials) => Promise<boolean>;
  onDraft: (draft: ProjectMaterial, runId: string, index: number) => void;
  onEvidence: (sha: string, page: number, box: AiProposal["evidence"]["box"]) => void;
  onBusy: (busy: boolean) => void;
};

export function AiMaterialReviewPanel({
  value,
  binary,
  disabled,
  commit,
  onDraft,
  onEvidence,
  onBusy,
}: Props) {
  const assistantReview = useLiveAssistant(state => state.review);
  const [connection, setConnection] = useState<MaterialAiStatus | null>(null),
    [message, setMessage] = useState(""),
    [key, setKey] = useState(""),
    [model, setModel] = useState("gemini-3.8-flash"),
    [configure, setConfigure] = useState(false);
  const [page, setPage] = useState(1),
    [focus, setFocus] = useState(""),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState(""),
    [linkId, setLinkId] = useState(""),
    [selected, setSelected] = useState("");
  const [truth, setTruth] = useState<z.infer<typeof truthSchema> | null>(null),
    [truthName, setTruthName] = useState("");
  const abort = useRef<AbortController | null>(null),
    latest = useRef({ value, binary });
  latest.current = { value, binary };
  const source = value.sources.find((s) => s.sha256 === binary?.sha256),
    run = value.aiRuns.find((r) => r.id === selected) ?? value.aiRuns.at(-1);
  useEffect(() => {
    let mounted = true;
    getMaterialAiStatus()
      .then((s) => {
        if (mounted) {
          setConnection(s);
          setModel(s.model);
        }
      })
      .catch((e) => {
        if (mounted) setMessage(errorText(e));
      });
    return () => {
      mounted = false;
      abort.current?.abort();
    };
  }, []);
  useEffect(() => {
    abort.current?.abort();
    setPage(1);
  }, [binary?.sha256, binary?.documentId, value.projectId]);
  useEffect(() => {
    if (!assistantReview) return;
    const document = useStudio.getState().job.documents.find(item => item.id === binary?.documentId && item.sha256 === binary?.sha256);
    if (reviewMatchesSource(assistantReview, binary, document?.pageCount ?? 0)) {
      setPage(assistantReview.page);
      setFocus(assistantReview.focus);
      setMessage(source ? "Instructions received from Live assistant. Check the sheet and send when ready." : "Instructions received from Live assistant. Register this drawing under Source documents before sending.");
    } else {
      setMessage("The assistant's drawing changed. Prepare a new review for the current source.");
    }
    useLiveAssistant.setState({ review: null });
  }, [assistantReview, binary, source?.pageCount]);
  useEffect(() => {
    setTruth(null);
    setTruthName("");
  }, [run?.id]);
  async function configureProvider(disconnect = false) {
    try {
      const next = await configureMaterialAi(disconnect ? "" : key, model);
      setKey("");
      setConnection(next);
      setMessage(next.message);
      setConfigure(false);
    } catch (e) {
      setKey("");
      setMessage(errorText(e));
    }
  }
  async function interpret() {
    if (!binary || !source || busy || disabled || !connection?.available) return;
    const original = value,
      originalBinary = binary,
      controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    onBusy(true);
    setMessage("Preparing one source sheet and four overlapping detail views…");
    try {
      const request = await prepareMaterialAiPage(binary, value, page, focus, controller.signal);
      if (controller.signal.aborted) throw Error("AI interpretation cancelled.");
      setMessage("Gemini is interpreting the selected sheet. No materials have been added.");
      const result = await runMaterialAi(request, controller.signal);
      if (
        controller.signal.aborted ||
        latest.current.binary !== originalBinary ||
        latest.current.value !== original
      )
        throw Error(
          "Source or inventory changed. AI results were not saved; retry against the current revision.",
        );
      if (await commit(appendAiRun(original, result))) {
        setSelected(result.id);
        setMessage(
          `${result.result.proposals.length} AI proposals saved for review. No quantities were approved automatically.`,
        );
      }
    } catch (e) {
      setMessage(
        controller.signal.aborted
          ? "AI interpretation cancelled. Saved inventory preserved."
          : errorText(e),
      );
    } finally {
      if (abort.current === controller) {
        abort.current = null;
        setBusy(false);
        onBusy(false);
      }
    }
  }
  async function decide(index: number, action: "linked" | "excluded") {
    if (!run) return;
    try {
      if (
        await commit(
          resolveAiProposal(
            value,
            run.id,
            index,
            action,
            action === "linked" ? linkId : null,
            reason,
          ),
        )
      ) {
        setReason("");
        setMessage(
          action === "linked"
            ? "Evidence linked. Existing quantity preserved."
            : "Proposal excluded with your reason.",
        );
      }
    } catch (e) {
      setMessage(errorText(e));
    }
  }
  async function loadTruth(file: File | undefined) {
    try {
      if (!file) return;
      if (file.size > 200000) throw Error("Benchmark file exceeds 200 KB.");
      const parsed = truthSchema.parse(JSON.parse(await file.text()));
      scoreMaterialBenchmark(parsed, []);
      setTruth(parsed);
      setTruthName(file.name);
      setMessage("");
    } catch (e) {
      setTruth(null);
      setMessage(errorText(e));
    }
  }
  const score =
    truth && run
      ? scoreMaterialBenchmark(
          truth,
          run.result.proposals.map((p) => ({
            key: p.tag || p.label,
            quantity: p.quantity,
            unit: p.unit,
          })),
        )
      : null;
  const percent = (n: number | null) => (n === null ? "Not measured" : `${(n * 100).toFixed(1)}%`);
  const pending = value.aiRuns.reduce(
    (n, r) => n + r.result.proposals.length - r.decisions.length,
    0,
  );
  return (
    <div className="material-ai-panel">
      <div className="material-ai-heading">
        <ScanSearch size={20} />
        <div>
          <strong>AI drawing review</strong>
          <p>Read the sheet. Check the evidence. Reconcile each material.</p>
        </div>
        <span className="material-ai-count">{pending} pending</span>
      </div>
      <section className="material-ai-section">
        <div className="material-ai-heading">
          <strong>{connection?.available ? "Gemini configured" : "AI not connected"}</strong>
          <button
            className="pill"
            aria-expanded={configure}
            onClick={() => setConfigure(!configure)}
          >
            <Settings2 size={14} />
            Connection
          </button>
        </div>
        <p>{connection?.message ?? "Checking provider configuration…"}</p>
        {configure && (
          <div className="material-ai-form">
            {canConfigureMaterialAi() ? (
              <>
                <label>
                  Gemini API key
                  <input
                    type="password"
                    autoComplete="off"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="Session only — never saved in a backup"
                  />
                </label>
                <label>
                  Gemini model
                  <input value={model} onChange={(e) => setModel(e.target.value)} />
                </label>
                <p>
                  The desktop app keeps this key in memory until it closes. This configures access;
                  it does not verify the key or make an AI call.
                </p>
                <div className="material-ai-actions">
                  <button
                    className="pill"
                    disabled={!key.trim() || busy}
                    onClick={() => void configureProvider()}
                  >
                    Use for this session
                  </button>
                  <button
                    className="pill"
                    disabled={busy || !connection?.configured}
                    onClick={() => void configureProvider(true)}
                  >
                    Disconnect
                  </button>
                </div>
              </>
            ) : (
              <p>
                AI credentials belong on the server. Use the desktop app to configure a key for this
                session, or ask the app operator to enable the web provider.
              </p>
            )}
          </div>
        )}
        <label>
          Source sheet
          <select
            aria-label="AI source sheet"
            disabled={!source || busy || disabled}
            value={page}
            onChange={(e) => setPage(Number(e.target.value))}
          >
            {source ? (
              Array.from({ length: source.pageCount }, (_, i) => (
                <option key={i} value={i + 1}>
                  {source.name} · {i + 1}
                </option>
              ))
            ) : (
              <option>Open and register a PDF first</option>
            )}
          </select>
        </label>
        <label>
          Review focus <span className="text-muted">(optional)</span>
          <textarea
            maxLength={1500}
            rows={2}
            value={focus}
            disabled={busy}
            onChange={(e) => setFocus(e.target.value)}
            placeholder="All visible materials, quantities and unresolved details on this sheet"
          />
        </label>
        <p>
          One sheet per request, up to five views. Starting sends these drawing images to Google
          Gemini and may incur provider charges. Proposals need review; hidden items are never
          assumed.
        </p>
        <div className="material-ai-actions">
          <button
            className="pill pill-primary"
            disabled={disabled || busy || !source || !connection?.available}
            onClick={() => void interpret()}
          >
            <ScanSearch size={15} />
            {busy ? "Interpreting…" : "Send selected sheet to Gemini"}
          </button>
          {busy && (
            <button className="pill" onClick={() => abort.current?.abort()}>
              <X size={14} />
              Cancel
            </button>
          )}
        </div>
      </section>
      {message && (
        <p role="status" className="material-ai-message">
          {message}
        </p>
      )}
      {!run ? (
        <div className="material-ai-empty">
          <FileCheck2 size={24} />
          <strong>No AI results yet</strong>
          <p>
            Local text scans and prepared trial materials are separate from AI results.
            Whole-building accuracy has not been measured.
          </p>
        </div>
      ) : (
        <>
          <label>
            Saved AI run
            <select value={run.id} disabled={busy} onChange={(e) => setSelected(e.target.value)}>
              {[...value.aiRuns].reverse().map((r) => (
                <option key={r.id} value={r.id}>
                  {r.result.sheetTitle} · page {r.page} · {new Date(r.createdAt).toLocaleString()}
                </option>
              ))}
            </select>
          </label>
          <p className="text-muted">
            {run.provider} / {run.model} · Source {run.sourceSha256.slice(0, 12)} · saved with the
            project backup
          </p>
          <p>{run.result.scopeNote}</p>
          {run.result.warnings.map((w, i) => (
            <p key={i} className="material-ai-message">
              {w}
            </p>
          ))}
          <div className="material-ai-form">
            <label>
              Decision reason
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why this is the same item or outside scope"
              />
            </label>
            <label>
              Existing physical material
              <select
                aria-label="Existing physical material"
                value={linkId}
                onChange={(e) => setLinkId(e.target.value)}
              >
                <option value="">Select a matching item to link</option>
                {value.materials.map((m) => (
                  <option key={m.stock.id} value={m.stock.id}>
                    {m.stock.stockCode} · {m.stock.description}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="material-ai-proposals">
            {run.result.proposals.map((p, index) => {
              const decision = run.decisions.find((d) => d.index === index);
              return (
                <article className="material-ai-proposal" key={index} data-ai-proposal={index}>
                  <div className="material-ai-heading">
                    <strong>
                      {p.tag ? `${p.tag} · ` : ""}
                      {p.label}
                    </strong>
                    <span className="material-ai-count">
                      {p.quantity ?? "?"} {p.unit}
                    </span>
                  </div>
                  <p>
                    {p.discipline} · {p.category} · {p.floor}
                  </p>
                  <p>{p.calculation}</p>
                  <blockquote>{p.evidence.quote}</blockquote>
                  {p.unresolved.length > 0 && <p>Unresolved: {p.unresolved.join("; ")}</p>}
                  <p className="text-muted">
                    {p.confidence === null
                      ? "No confidence estimate"
                      : `Model confidence ${(p.confidence * 100).toFixed(0)}% — uncalibrated, not accuracy`}
                  </p>
                  <div className="material-ai-actions">
                    <button
                      className="pill"
                      onClick={() => onEvidence(run.sourceSha256, run.page, p.evidence.box)}
                    >
                      View drawing region
                    </button>
                    {!decision && (
                      <>
                        <button
                          className="pill"
                          disabled={disabled || busy}
                          onClick={() => {
                            try {
                              onDraft(
                                aiProposalDraft(value, run.id, index, crypto.randomUUID()),
                                run.id,
                                index,
                              );
                            } catch (e) {
                              setMessage(errorText(e));
                            }
                          }}
                        >
                          Review material draft
                        </button>
                        <button
                          className="pill"
                          disabled={disabled || busy || !linkId || !reason.trim()}
                          onClick={() => void decide(index, "linked")}
                        >
                          Link evidence
                        </button>
                        <button
                          className="pill"
                          disabled={disabled || busy || !reason.trim()}
                          onClick={() => void decide(index, "excluded")}
                        >
                          Exclude
                        </button>
                      </>
                    )}
                  </div>
                  {decision && (
                    <p className="material-ai-decision">
                      {decision.action} · {decision.reason}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
          <details className="material-ai-section">
            <summary>Measure this run against checked quantities</summary>
            <p>
              Supply an independently checked JSON list for this exact page and scope:{" "}
              {`[{"key":"D01","quantity":2,"unit":"each"}]`}. Keys must match the proposal tag, or
              its label when untagged. Include every expected item in the chosen scope; omissions
              affect the score.
            </p>
            <label>
              Checked ground truth
              <input
                aria-label="AI benchmark ground truth"
                type="file"
                accept=".json,application/json"
                onChange={(e) => {
                  void loadTruth(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            {score && (
              <div data-ai-benchmark>
                <strong>
                  {truthName} · {score.truthItems} checked items
                </strong>
                <dl className="material-ai-metrics">
                  <div>
                    <dt>Detection precision</dt>
                    <dd>{percent(score.precision)}</dd>
                  </div>
                  <div>
                    <dt>Detection recall</dt>
                    <dd>{percent(score.recall)}</dd>
                  </div>
                  <div>
                    <dt>Exact quantity recall</dt>
                    <dd>{percent(score.exactQuantityRecall)}</dd>
                  </div>
                </dl>
                <p>
                  {score.falsePositive} extra / duplicate proposals · {score.missed} missed items ·{" "}
                  {score.exactQuantities} exact quantities. Absolute error on comparable items:{" "}
                  {Object.entries(score.absoluteQuantityErrorByUnit)
                    .map(([u, n]) => `${n} ${u}`)
                    .join(", ") || "not measured"}
                  .
                </p>
                <p>
                  This measures only this run against your supplied reference. It does not certify
                  the whole building or unlisted materials.
                </p>
                <button
                  className="pill"
                  onClick={() => downloadBenchmark(run, truth!, truthName, score)}
                >
                  Download benchmark evidence
                </button>
              </div>
            )}
          </details>
        </>
      )}
    </div>
  );
}
function downloadBenchmark(
  run: AiMaterialRun,
  truth: z.infer<typeof truthSchema>,
  truthName: string,
  score: ReturnType<typeof scoreMaterialBenchmark>,
) {
  const data = {
    schema: "xray.ai-benchmark/v1",
    measuredAt: new Date().toISOString(),
    scope: "One AI run against user-supplied independently checked reference",
    truthName,
    truth,
    run,
    score,
  };
  const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = `ai-benchmark-${run.id}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
