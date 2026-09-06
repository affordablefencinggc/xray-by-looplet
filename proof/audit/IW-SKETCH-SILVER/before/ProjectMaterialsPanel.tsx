import { AiMaterialReviewPanel } from "./AiMaterialReviewPanel";
import { AiEvidenceRegion } from "./AiEvidenceRegion";
import { resolveAiProposal } from "./construction/aiMaterialReview";
import type { AiProposal } from "./construction/aiMaterials";
import { useEffect, useRef, useState } from "react";
import { Download, Plus, ScanSearch, FileUp } from "lucide-react";
import { useStudio } from "./store";
import { WorkspaceDialog } from "./WorkspaceDialog";
import { DocumentPreview } from "./DocumentPreview";
import { addThorntonPreparedMaterials } from "./construction/thorntonMaterials";
import { THORNTON_LIBRARY } from "./construction/thorntonLibrary";
import { openMaterialLibrarySource } from "./materialLibrarySource";
import { MaterialSourceLibrary } from "./MaterialSourceLibrary";
import { restoreMaterialDatabase, saveMaterialDatabase } from "./projectMaterialsPersistence";
import { scanMaterialImagePage } from "./materialOcr";
import { scanMaterialDocument } from "./materialDiscovery";
import { materialErrorMessage, MATERIAL_UNITS } from "./construction/materialRegister";
import {
  DISCIPLINES,
  attachMaterialSource,
  newProjectMaterial,
  putProjectMaterial,
  disposeDiscovery,
  materialCoverage,
  projectMaterialTotals,
  projectMaterialsCsv,
  projectMaterialsExport,
  previewMaterialsBackup,
  type MaterialSource,
  type ProjectMaterial,
  type ProjectMaterials,
  type ProjectMaterialsSession,
} from "./construction/projectMaterials";

const show = (n: number | null, unit = "") =>
  n === null ? "Unknown" : `${n.toLocaleString(undefined, { maximumFractionDigits: 3 })}${unit}`;
function download(data: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ProjectMaterialsPanel() {
  const s = useStudio(),
    projectId = s.job.id;
  const [session, setSession] = useState<ProjectMaterialsSession | null>(null),
    [tab, setTab] = useState("Materials"),
    [discipline, setDiscipline] = useState<MaterialSource["discipline"]>("Structural");
  const [aiCandidate, setAiCandidate] = useState<{ runId: string; index: number } | null>(null),
    [aiBusy, setAiBusy] = useState(false);
  const [draft, setDraft] = useState<ProjectMaterial | null>(null),
    [candidate, setCandidate] = useState<string | null>(null),
    [filter, setFilter] = useState(""),
    [status, setStatus] = useState("");
  const [scan, setScan] = useState<string | null>(null),
    abort = useRef<AbortController | null>(null),
    [sheetPage, setSheetPage] = useState(1),
    [sheetNote, setSheetNote] = useState("");
  const [reason, setReason] = useState(""),
    [linkId, setLinkId] = useState(""),
    [backup, setBackup] = useState<ProjectMaterials | null>(null),
    [backupConfirmed, setBackupConfirmed] = useState(false);
  const [viewPage, setViewPage] = useState<{
      sha256: string;
      page: number;
      box?: AiProposal["evidence"]["box"];
    } | null>(null),
    [scopeReason, setScopeReason] = useState("");
  useEffect(() => {
    let active = true;
    void restoreMaterialDatabase(projectId).then((v) => {
      if (active) setSession(v);
    });
    return () => {
      active = false;
      abort.current?.abort();
    };
  }, [projectId]);
  useEffect(() => {
    abort.current?.abort();
    setSheetPage(1);
    setDraft(null);
    setCandidate(null);
    setAiCandidate(null);
    setSheetNote("");
  }, [s.activePlanBinary?.documentId, s.activePlanBinary?.sha256]);
  if (!session) return <p role="status">Restoring project material inventory…</p>;
  const value = session.value,
    active = s.job.documents.find((d) => d.id === s.job.activeDocumentId),
    binary = s.activePlanBinary;
  const source = value.sources.find((d) => d.sha256 === active?.sha256);
  const sourceReady = !!(
    active &&
    binary &&
    binary.documentId === active.id &&
    binary.sha256 === active.sha256
  );
  const disabled = session.blocked || !!scan || aiBusy,
    totals = projectMaterialTotals(value),
    coverage = materialCoverage(value);
  const sheet = source
    ? value.sheets.find((p) => p.sha256 === source.sha256 && p.page === sheetPage)
    : null;
  const discoveries = source
    ? value.discoveries.filter((d) => d.sha256 === source.sha256 && d.page === sheetPage)
    : [];
  async function commit(next: ProjectMaterials) {
    const saved = await saveMaterialDatabase(session!, next);
    setSession(saved);
    setStatus(saved.error ? "" : "Project material inventory saved.");
    return !saved.error;
  }
  async function change(action: () => ProjectMaterials) {
    try {
      return await commit(action());
    } catch (e) {
      setStatus(materialErrorMessage(e));
      return false;
    }
  }
  function register() {
    if (!active?.sha256 || !active.pageCount || !sourceReady) return;
    change(() =>
      attachMaterialSource(value, {
        sha256: active.sha256!,
        name: active.name,
        pageCount: active.pageCount!,
        discipline,
      }),
    );
  }
  async function discover(ocr = false) {
    if (!binary || !source || disabled) return;
    const original = session,
      originalBinary = binary,
      controller = new AbortController();
    abort.current = controller;
    setScan("Starting scan…");
    setStatus("");
    try {
      const next = ocr
        ? await scanMaterialImagePage(binary, value, sheetPage, setScan, controller.signal)
        : await scanMaterialDocument(
            binary,
            value,
            (page, total) => setScan(`Reading sheet ${page} of ${total}`),
            controller.signal,
          );
      if (
        controller.signal.aborted ||
        useStudio.getState().activePlanBinary !== originalBinary ||
        useStudio.getState().job.id !== projectId
      )
        throw Error("Source changed during scan. Saved inventory was preserved.");
      const saved = await saveMaterialDatabase(original!, next);
      setSession(saved);
      setTab("Sheet coverage");
      setStatus(
        saved.error
          ? ""
          : "Scan saved. Material mentions need reconciliation; none were counted automatically.",
      );
    } catch (e) {
      setStatus(materialErrorMessage(e));
    } finally {
      setScan(null);
      abort.current = null;
    }
  }
  async function saveDraft() {
    if (!draft) return;
    const ok = await change(() => {
      let next = putProjectMaterial(value, draft);
      if (candidate)
        next = disposeDiscovery(
          next,
          candidate,
          draft.stock.id,
          "Created material from source mention; quantity independently established.",
        );
      if (aiCandidate)
        next = resolveAiProposal(
          next,
          aiCandidate.runId,
          aiCandidate.index,
          "material",
          draft.stock.id,
          "Created material draft from AI proposal; independent review still required.",
        );
      return next;
    });
    if (ok) {
      setDraft(null);
      setCandidate(null);
      setAiCandidate(null);
    }
  }
  async function showEvidence(sha: string, page: number, box?: AiProposal["evidence"]["box"]) {
    try {
      let current = useStudio.getState();
      const doc = current.job.documents.find((d) => d.sha256 === sha && d.source !== "sample");
      if (doc) {
        if (current.job.activeDocumentId !== doc.id) await current.selectDocument(doc.id);
      } else {
        const library = THORNTON_LIBRARY.find((d) => d.sha256 === sha);
        if (!library) {
          setStatus("Attach the original drawing revision to view this evidence.");
          return;
        }
        setStatus("Opening original source revision...");
        await openMaterialLibrarySource(library);
      }
      current = useStudio.getState();
      if (
        current.job.id !== projectId ||
        current.activePlanBinary?.sha256 !== sha ||
        current.activePlanBinary.documentId !== current.job.activeDocumentId
      )
        throw Error("Original drawing could not be restored. Evidence navigation was cancelled.");
      setStatus("");
      setViewPage({ sha256: sha, page, box });
    } catch (e) {
      setStatus(materialErrorMessage(e));
    }
  }
  async function readBackup(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024) throw Error("Backup exceeds the 20 MB limit.");
      setBackup(previewMaterialsBackup(await file.text(), projectId));
      setBackupConfirmed(false);
      setStatus("");
    } catch (e) {
      setStatus(materialErrorMessage(e));
    }
  }
  const field = (key: keyof ProjectMaterial, label: string) =>
    draft ? (
      <label>
        {label}
        <input
          value={String(draft[key])}
          onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
        />
      </label>
    ) : null;
  return (
    <section className="source-takeoff project-materials" aria-label="Project material takeoff">
      <header className="takeoff-heading">
        <div>
          <span className="kicker">All materials / source register</span>
          <h1>Every material. Every source.</h1>
          <p>Project-wide takeoff · quantities, material volume, specified weight and storage</p>
        </div>
        <div className="takeoff-actions">
          <button
            className="pill"
            disabled={disabled || !!draft || !!backup}
            onClick={() =>
              download(
                JSON.stringify(projectMaterialsExport(value), null, 2),
                "project-materials-backup.json",
                "application/json",
              )
            }
          >
            <Download size={15} />
            Backup & report
          </button>
          <label className="pill material-import">
            <FileUp size={15} />
            Restore backup
            <input
              type="file"
              accept=".json,application/json"
              disabled={!!scan || !!draft}
              onChange={(e) => {
                void readBackup(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </header>
      {session.error && (
        <div role="alert" className="takeoff-notice">
          {session.error}
          <button
            className="pill"
            onClick={async () => {
              setSession(await restoreMaterialDatabase(projectId));
              setDraft(null);
              setBackup(null);
            }}
          >
            Retry restore
          </button>
        </div>
      )}
      {status && (
        <p role="status" className="takeoff-notice">
          {status}
        </p>
      )}
      {backup && (
        <div className="takeoff-inspector">
          <h2>Restore preview</h2>
          <p>
            {backup.materials.length} material lines · {backup.sources.length} source revisions ·{" "}
            {backup.sheets.length} sheets. This replaces this project's material register only. The
            previous raw snapshot is archived in the same transaction before replacement.
          </p>
          <label className="takeoff-check">
            <input
              type="checkbox"
              checked={backupConfirmed}
              onChange={(e) => setBackupConfirmed(e.target.checked)}
            />
            I have reviewed this backup and want to replace this material register
          </label>
          <div className="takeoff-actions">
            <button
              className="pill"
              disabled={!!scan || !backupConfirmed}
              onClick={async () => {
                const saved = await saveMaterialDatabase(session, backup, true);
                setSession(saved);
                if (!saved.error) {
                  setBackup(null);
                  setStatus(
                    "Backup restored. Previous raw inventory archived atomically for recovery.",
                  );
                }
              }}
            >
              Restore reviewed backup
            </button>
            <button className="pill" onClick={() => setBackup(null)}>
              Cancel restore
            </button>
          </div>
        </div>
      )}
      <div className="takeoff-summary">
        <div>
          <span>Material lines</span>
          <strong>{value.materials.length}</strong>
          <small>{totals.unknownQuantities} quantities unresolved</small>
        </div>
        <div>
          <span>Known material volume</span>
          <strong>{show(totals.materialVolume.value, " m³")}</strong>
          <small>
            {totals.materialVolume.known}/{totals.materialVolume.total} lines · solid material
          </small>
        </div>
        <div>
          <span>Known specified weight</span>
          <strong>{show(totals.weight.value, " kg")}</strong>
          <small>
            {totals.weight.known}/{totals.weight.total} lines have weight
          </small>
        </div>
        <div>
          <span>Known storage volume</span>
          <strong>{show(totals.storageVolume.value, " m³")}</strong>
          <small>
            {totals.storageVolume.known}/{totals.storageVolume.total} lines · whole packages
          </small>
        </div>
      </div>
      <p className="takeoff-boundary">
        <b>
          Coverage: {coverage.reviewedSheets}/{coverage.sheets} sheets reviewed.
        </b>{" "}
        {coverage.pendingDiscoveries} material candidates and {coverage.pendingAiProposals} AI
        proposals need reconciliation. Missing disciplines:{" "}
        {coverage.missingDisciplines.join(", ") || "none recorded"}. Totals are partial; quantities
        in different units are never added together. Storage excludes aisles, stacking restrictions
        and handling space.
      </p>
      <details className="takeoff-inspector">
        <summary>Prepared source inventory · review before adding</summary>
        <p>
          79 lines: 37 swinging door leaves, 5 overhead door assemblies, 35 frame assemblies, 8
          selected roof beams, 16 shear plates, 32 bolts and one RTU-1 rooftop unit. Counts are from
          reviewed source schedules and a bounded roof span; the whole-building material count is
          still incomplete.
        </p>
        <p>
          All imported entries require review. Door hardware, other building assemblies, services
          distribution and most weights/volumes remain unresolved. Existing entries with the same
          physical keys are preserved.
        </p>
        <button
          className="pill"
          disabled={disabled || !!draft || !!backup}
          onClick={() => change(() => addThorntonPreparedMaterials(value))}
        >
          Add prepared source inventory
        </button>
      </details>
      <MaterialSourceLibrary
        disabled={disabled || !!draft || !!backup}
        onOpened={async (source) => {
          await change(() => attachMaterialSource(value, source));
          setTab("Sheet coverage");
        }}
      />
      <nav className="takeoff-filters" aria-label="Project takeoff views">
        {["Materials", "AI review", "Sheet coverage", "Source documents"].map((t) => (
          <button
            className="pill"
            key={t}
            aria-pressed={tab === t}
            disabled={!!draft || !!backup || !!scan}
            onClick={() => {
              setTab(t);
              setAiBusy(false);
            }}
          >
            {t}
          </button>
        ))}
      </nav>
      {tab === "AI review" && (
        <AiMaterialReviewPanel
          value={value}
          binary={sourceReady ? binary : null}
          disabled={session.blocked || !!scan || !!backup}
          commit={commit}
          onBusy={setAiBusy}
          onEvidence={(sha, page, box) => void showEvidence(sha, page, box)}
          onDraft={(draft, runId, index) => {
            setDraft(draft);
            setCandidate(null);
            setAiCandidate({ runId, index });
            setTab("Materials");
          }}
        />
      )}
      {tab === "Source documents" && (
        <div className="takeoff-inspector">
          <h2>Register drawing disciplines</h2>
          <p>
            Open a drawing using the project selector, then register its discipline. Re-importing
            identical bytes does not create a second source. Revised bytes remain a separate source
            revision.
          </p>
          <div className="takeoff-editor">
            <label>
              Active drawing discipline
              <select
                aria-label="Active drawing discipline"
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value as MaterialSource["discipline"])}
              >
                {DISCIPLINES.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            <button
              className="pill"
              disabled={disabled || !sourceReady || !!source || !!backup}
              onClick={register}
            >
              {source ? "Active drawing already registered" : "Register active drawing"}
            </button>
          </div>
          {value.sources.map((d) => (
            <div key={d.sha256}>
              <b>{d.name}</b>
              <p>
                {d.discipline} · {d.pageCount} pages
              </p>
              <code className="takeoff-hash">{d.sha256}</code>
            </div>
          ))}
          <h2>Discipline scope</h2>
          <label className="takeoff-editor">
            Scope reason
            <input
              value={scopeReason}
              onChange={(e) => setScopeReason(e.target.value)}
              placeholder="Why this discipline is outside the requested work"
            />
          </label>
          {value.scope.map((d) => (
            <label key={d.discipline} className="takeoff-check">
              <input
                type="checkbox"
                checked={d.excluded}
                disabled={disabled || !!backup || (!d.excluded && !scopeReason.trim())}
                onChange={(e) =>
                  change(() => ({
                    ...value,
                    revision: value.revision + 1,
                    scope: value.scope.map((x) =>
                      x.discipline === d.discipline
                        ? {
                            ...x,
                            excluded: e.target.checked,
                            reason: e.target.checked ? scopeReason : "",
                          }
                        : x,
                    ),
                  }))
                }
              />
              Exclude {d.discipline} from scope {d.excluded && `— ${d.reason}`}
            </label>
          ))}
        </div>
      )}
      {tab === "Sheet coverage" && (
        <div className="takeoff-inspector">
          <h2>Read, reconcile, then review</h2>
          {!source ? (
            <p>Register the active drawing in Source documents first.</p>
          ) : (
            <>
              <div className="takeoff-actions">
                <button
                  className="pill"
                  disabled={disabled || !sourceReady || !!backup}
                  onClick={() => void discover()}
                >
                  <ScanSearch size={15} />
                  Scan all source sheets
                </button>
                <button
                  className="pill"
                  disabled={disabled || !sourceReady || !!backup}
                  onClick={() => void discover(true)}
                >
                  Read selected sheet with OCR
                </button>
                {scan && (
                  <button className="pill" onClick={() => abort.current?.abort()}>
                    Cancel scan
                  </button>
                )}
                <span role="status">{scan}</span>
              </div>
              {sheet?.ocrConfidence !== null && sheet?.ocrConfidence !== undefined && (
                <p className="takeoff-notice">
                  OCR confidence: {sheet.ocrConfidence.toFixed(0)}%. Check every recognized tag and
                  specification against the original image; OCR text is not a verified count.
                </p>
              )}
              <p>
                Text discovery finds candidate material names and steel designations. It does not
                detect every symbol or establish physical quantities. Image-only sheets require
                visual review; a zero-match scan is not an empty-material sheet.
              </p>
              <label className="takeoff-editor">
                Coverage sheet
                <select
                  aria-label="Coverage sheet"
                  value={sheetPage}
                  disabled={!!scan}
                  onChange={(e) => {
                    setSheetPage(Number(e.target.value));
                    setSheetNote("");
                  }}
                >
                  {value.sheets
                    .filter((p) => p.sha256 === source.sha256)
                    .map((p) => (
                      <option value={p.page} key={p.page}>
                        {p.title} · {p.scan} · {p.reviewed ? "reviewed" : "needs review"}
                      </option>
                    ))}
                </select>
              </label>
              <button
                className="pill"
                disabled={!sourceReady}
                onClick={() => void showEvidence(source.sha256, sheetPage)}
              >
                Inspect coverage sheet
              </button>
              <div className="material-candidate-actions">
                <label>
                  Disposition reason
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Existing detail, outside scope, or not a physical item"
                  />
                </label>
                <label>
                  Existing physical material
                  <select
                    aria-label="Existing physical material"
                    value={linkId}
                    onChange={(e) => setLinkId(e.target.value)}
                  >
                    <option value="">Choose existing material</option>
                    {value.materials.map((m) => (
                      <option value={m.stock.id} key={m.stock.id}>
                        {m.stock.description} · {m.physicalKey}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="material-discoveries">
                {discoveries.map((d) => (
                  <article key={d.id}>
                    <div>
                      <b>{d.label}</b>
                      <span>
                        {d.category} · {d.mentions} text mentions · {d.status}
                      </span>
                      <p>{d.excerpt}</p>
                    </div>
                    {d.status === "pending" && (
                      <div className="takeoff-actions">
                        <button
                          className="pill"
                          disabled={disabled || !!backup}
                          onClick={() => {
                            const next = newProjectMaterial(source, d.page, crypto.randomUUID());
                            next.stock.description = d.label;
                            next.category = d.category;
                            next.specification = d.excerpt;
                            setDraft(next);
                            setCandidate(d.id);
                            setTab("Materials");
                          }}
                        >
                          Create material
                        </button>
                        <button
                          className="pill"
                          disabled={disabled || !linkId || !!backup}
                          onClick={() =>
                            change(() => disposeDiscovery(value, d.id, linkId, reason))
                          }
                        >
                          Link evidence
                        </button>
                        <button
                          className="pill"
                          disabled={disabled || !reason.trim() || !!backup}
                          onClick={() => change(() => disposeDiscovery(value, d.id, null, reason))}
                        >
                          Exclude mention
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
              <div className="takeoff-editor">
                <label>
                  Sheet visual review note
                  <textarea
                    aria-label="Sheet visual review note"
                    value={sheetNote}
                    onChange={(e) => setSheetNote(e.target.value)}
                    placeholder="Record checks of plan, details, schedules and material coverage"
                  />
                </label>
                <button
                  className="pill"
                  disabled={
                    disabled ||
                    !!backup ||
                    !sheetNote.trim() ||
                    sheet?.scan === "not-scanned" ||
                    sheet?.scan === "failed" ||
                    discoveries.some((d) => d.status === "pending")
                  }
                  onClick={() =>
                    change(() => ({
                      ...value,
                      revision: value.revision + 1,
                      sheets: value.sheets.map((p) =>
                        p.sha256 === source.sha256 && p.page === sheetPage
                          ? { ...p, reviewed: true, reviewNote: sheetNote }
                          : p,
                      ),
                    }))
                  }
                >
                  Mark sheet visually reviewed
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {tab === "Materials" && (
        <>
          {draft ? (
            <div className="takeoff-inspector">
              <h2>
                {value.materials.some((m) => m.stock.id === draft.stock.id)
                  ? "Edit physical material"
                  : "Add physical material"}
              </h2>
              <div className="takeoff-editor">
                <div className="takeoff-input-grid">
                  <label>
                    Description
                    <input
                      value={draft.stock.description}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          stock: { ...draft.stock, description: e.target.value },
                        })
                      }
                    />
                  </label>
                  <label>
                    Stock / order line code
                    <input
                      value={draft.stock.stockCode}
                      onChange={(e) =>
                        setDraft({ ...draft, stock: { ...draft.stock, stockCode: e.target.value } })
                      }
                    />
                  </label>
                  {field("physicalKey", "Unique physical scope key")}
                  {field("category", "Material category")}
                  {field("building", "Building")}
                  {field("floor", "Floor / level")}
                  {field("location", "Location / grid / room")}
                  <label>
                    Material discipline
                    <select
                      aria-label="Material discipline"
                      value={draft.discipline}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          discipline: e.target.value as MaterialSource["discipline"],
                        })
                      }
                    >
                      {DISCIPLINES.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Quantity
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={draft.stock.quantity ?? ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          stock: {
                            ...draft.stock,
                            quantity: e.target.value === "" ? null : Number(e.target.value),
                          },
                        })
                      }
                    />
                  </label>
                  <label>
                    Stock unit
                    <select
                      aria-label="Stock unit"
                      value={draft.stock.unit}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          stock: {
                            ...draft.stock,
                            unit: e.target.value as ProjectMaterial["stock"]["unit"],
                          },
                        })
                      }
                    >
                      {Object.entries(MATERIAL_UNITS).map(([v, l]) => (
                        <option value={v} key={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Quantity basis
                    <select
                      aria-label="Quantity basis"
                      value={draft.quantityBasis}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          quantityBasis: e.target.value as ProjectMaterial["quantityBasis"],
                        })
                      }
                    >
                      {["unresolved", "counted", "scheduled", "measured", "derived"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  {field("calculation", "Quantity calculation / method")}
                  {field("specification", "Material specification")}
                  {field("unresolved", "Unresolved components / properties")}
                </div>
                <label>
                  Source / supplier reference
                  <textarea
                    value={draft.stock.reference}
                    onChange={(e) =>
                      setDraft({ ...draft, stock: { ...draft.stock, reference: e.target.value } })
                    }
                  />
                </label>
                <fieldset>
                  <legend>Overall physical dimensions</legend>
                  <div className="takeoff-input-grid">
                    {(["length", "width", "height", "depth"] as const).map((key) => (
                      <label key={key}>
                        Physical {key} (m)
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={draft.dimensionsM[key] ?? ""}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              dimensionsM: {
                                ...draft.dimensionsM,
                                [key]: e.target.value === "" ? null : Number(e.target.value),
                              },
                            })
                          }
                        />
                      </label>
                    ))}
                    {field("dimensionReference", "Physical dimensions reference")}
                  </div>
                </fieldset>
                <fieldset>
                  <legend>Material volume, weight and packaging — optional until specified</legend>
                  <div className="takeoff-input-grid">
                    <label>
                      Material volume per stock unit (m³)
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={draft.materialVolumePerUnitM3 ?? ""}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            materialVolumePerUnitM3:
                              e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    {field("volumeReference", "Material volume calculation / reference")}
                    {(
                      [
                        ["specifiedWeightKg", "Specified weight (kg)"],
                        ["unitsPerPackage", "Stock units per package"],
                        ["lengthM", "Package length (m)"],
                        ["widthM", "Package width (m)"],
                        ["heightM", "Package height (m)"],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key}>
                        {label}
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={draft.stock[key] ?? ""}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              stock: {
                                ...draft.stock,
                                [key]: e.target.value === "" ? null : Number(e.target.value),
                              },
                            })
                          }
                        />
                      </label>
                    ))}
                    <label>
                      Weight basis
                      <select
                        aria-label="Weight basis"
                        value={draft.stock.weightBasis}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            stock: {
                              ...draft.stock,
                              weightBasis: e.target.value as "unit" | "package",
                            },
                          })
                        }
                      >
                        <option value="unit">Per stock unit</option>
                        <option value="package">Per whole package</option>
                      </select>
                    </label>
                  </div>
                </fieldset>
                <label>
                  Review note
                  <textarea
                    aria-label="Review note"
                    value={draft.reviewNote}
                    onChange={(e) => setDraft({ ...draft, reviewNote: e.target.value })}
                  />
                </label>
                <label className="takeoff-check">
                  <input
                    type="checkbox"
                    checked={draft.review === "reviewed"}
                    onChange={(e) =>
                      setDraft({ ...draft, review: e.target.checked ? "reviewed" : "pending" })
                    }
                  />
                  Quantity and source checked
                </label>
                <p>
                  Changing material properties clears prior review. Save the change, then reopen and
                  review the new revision.
                </p>
                <div className="takeoff-actions">
                  <button className="pill" disabled={disabled} onClick={saveDraft}>
                    Save physical material
                  </button>
                  <button
                    className="pill"
                    onClick={() => {
                      setDraft(null);
                      setCandidate(null);
                      setAiCandidate(null);
                    }}
                  >
                    Cancel material edit
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="takeoff-actions">
                <button
                  className="pill"
                  disabled={disabled || !source || !sourceReady || !!backup}
                  onClick={() => {
                    setDraft(newProjectMaterial(source!, sheetPage, crypto.randomUUID()));
                    setCandidate(null);
                    setAiCandidate(null);
                  }}
                >
                  <Plus size={15} />
                  Add physical material
                </button>
                <button
                  className="pill"
                  disabled={disabled || !value.materials.length || !!backup}
                  onClick={() =>
                    download(
                      projectMaterialsCsv(value),
                      "project-materials.csv",
                      "text/csv;charset=utf-8",
                    )
                  }
                >
                  Export materials CSV
                </button>
                <input
                  aria-label="Filter project materials"
                  placeholder="Search material, floor or location"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </div>
              {!source && (
                <p className="takeoff-notice">
                  Register the active drawing in Source documents to start entering materials.
                </p>
              )}
              {!value.materials.length && (
                <p className="takeoff-boundary">
                  No physical material quantities entered. Scan the registered source sheets to find
                  candidates, then establish each quantity from the actual plan, schedule or
                  measurement.
                </p>
              )}
              <div className="project-material-list">
                {value.materials
                  .filter((m) => JSON.stringify(m).toLowerCase().includes(filter.toLowerCase()))
                  .map((m) => {
                    const t = totals.rows.find((r) => r.id === m.stock.id)!;
                    return (
                      <article key={m.stock.id}>
                        <div>
                          <b>{m.stock.description}</b>
                          <p>
                            {m.discipline} / {m.category} · {m.floor} · {m.location}
                          </p>
                          <small>
                            {m.physicalKey} · revision {m.stock.revision} · {m.review}
                          </small>
                          {m.unresolved && (
                            <p className="takeoff-notice">Unresolved: {m.unresolved}</p>
                          )}
                        </div>
                        <div>
                          <b>
                            {show(m.stock.quantity)} {MATERIAL_UNITS[m.stock.unit]}
                          </b>
                          <p>
                            Material {show(t.materialVolumeM3, " m³")} · weight{" "}
                            {show(t.weightKg, " kg")}
                          </p>
                          <small>Storage {show(t.volumeM3, " m³")}</small>
                        </div>
                        <div className="takeoff-actions">
                          <button
                            className="pill"
                            disabled={disabled || !!backup}
                            onClick={() => setDraft(structuredClone(m))}
                          >
                            Edit {m.stock.stockCode}
                          </button>
                          {m.evidence.map((e, i) => (
                            <button
                              className="pill"
                              key={i}
                              onClick={() => void showEvidence(e.sha256, e.page)}
                            >
                              Source page {e.page}
                            </button>
                          ))}
                        </div>
                      </article>
                    );
                  })}
              </div>
            </>
          )}
        </>
      )}
      {viewPage !== null && binary && sourceReady && viewPage.sha256 === binary.sha256 && (
        <WorkspaceDialog title="source preview" onClose={() => setViewPage(null)}>
          <p>
            {active?.name} · original source page {viewPage.page}
          </p>
          <DocumentPreview
            binary={binary}
            pageIndex={viewPage.page - 1}
            pageCount={active?.pageCount}
            className="project-material-preview"
          >
            {viewPage.box
              ? (page) => <AiEvidenceRegion page={page} box={viewPage.box!} />
              : undefined}
          </DocumentPreview>
        </WorkspaceDialog>
      )}
    </section>
  );
}
