import { useEffect, useRef, useState } from "react";
import { getMaterialAiStatus } from "../materialAiTransport";
import { NumberField } from "./ArchitectInspector";
import { requestLayout } from "./layoutTransport";
import { validateLayoutProposal, type LayoutRequest } from "./layoutAi";
import { uuid, type ArchitectProject } from "./model";
import { primitives } from "./drawing";
import { DrawingPrimitives } from "./DrawingPrimitives";
import { drawingBounds } from "./sheets";
export function ArchitectAi({
  project: p,
  levelId,
  onChange,
}: {
  project: ArchitectProject;
  levelId: string;
  onChange: (p: ArchitectProject) => boolean;
}) {
  const [brief, setBrief] = useState(
      "A compact studio with a workshop, kitchenette and accessible entrance. Explain any unresolved circulation and egress assumptions.",
    ),
    [width, setWidth] = useState(9000),
    [depth, setDepth] = useState(6000),
    [status, setStatus] = useState("Checking AI provider…"),
    [available, setAvailable] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [proposal, setProposal] = useState<{
      request: LayoutRequest;
      raw: unknown;
      design: ArchitectProject;
      assumptions: string[];
      model: string;
    } | null>(null),
    abort = useRef<AbortController | null>(null),
    latest = useRef(p);
  latest.current = p;
  useEffect(() => {
    getMaterialAiStatus()
      .then((s) => {
        setAvailable(s.available);
        setStatus(s.message);
      })
      .catch(() =>
        setStatus("AI provider unavailable. Configure it in the Live assistant settings."),
      );
    return () => abort.current?.abort();
  }, []);
  const items = proposal ? primitives(proposal.design, levelId) : [],
    b = drawingBounds(items);
  return (
    <div className="arch-ai">
      <div>
        <span className="kicker">REVIEWED LAYOUT PROPOSALS</span>
        <h2>Describe the space. Review the design.</h2>
        <p className="arch-note">
          Gemini receives only this brief and envelope dimensions when you click Generate. It
          proposes a replacement for the selected level. Other levels remain intact.
        </p>
        <label className="arch-field">
          Design brief
          <textarea
            value={brief}
            maxLength={4000}
            rows={5}
            onChange={(e) => setBrief(e.target.value)}
          />
        </label>
        <div className="arch-field-pair">
          <NumberField label="Envelope width mm" value={width} onCommit={setWidth} />
          <NumberField label="Envelope depth mm" value={depth} onCommit={setDepth} />
        </div>
        <p className="arch-note">{status}</p>
        <div className="arch-button-row">
          <button
            disabled={!available || busy}
            onClick={async () => {
              setError("");
              setProposal(null);
              setBusy(true);
              const controller = new AbortController();
              abort.current = controller;
              try {
                const request: LayoutRequest = {
                  schema: "xray.architect-ai-request/v1",
                  requestId: uuid(),
                  projectId: p.id,
                  designRevision: p.revision,
                  levelId,
                  width,
                  depth,
                  height: p.levels.find((l) => l.id === levelId)!.height,
                  brief,
                };
                const run = await requestLayout(request, controller.signal),
                  checked = validateLayoutProposal(latest.current, request, run.result);
                setProposal({
                  request,
                  raw: run.result,
                  design: checked.project,
                  assumptions: checked.result.assumptions,
                  model: run.model,
                });
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Generating and validating…" : "Generate AI proposal"}
          </button>
          {busy && <button onClick={() => abort.current?.abort()}>Cancel</button>}
        </div>
        {error && (
          <div className="arch-error" role="alert">
            {error}
          </div>
        )}
        <p className="arch-note">
          Validation checks model identities, footprint bounds, closed rooms and hosted openings. It
          does not certify building-code compliance, structural safety, accessibility or fire
          egress.
        </p>
      </div>
      <div className="arch-ai-review">
        {proposal ? (
          <>
            <h2>Review before applying</h2>
            <p>
              {proposal.model} · {proposal.design.walls.filter((w) => w.levelId === levelId).length}{" "}
              walls
            </p>
            <svg
              role="img"
              aria-label="AI layout proposal preview"
              viewBox={`${b.min[0] - 500} ${b.min[1] - 500} ${b.max[0] - b.min[0] + 1000} ${b.max[1] - b.min[1] + 1000}`}
            >
              <DrawingPrimitives items={items} />
            </svg>
            <ul>
              {proposal.assumptions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
            <button
              onClick={() => {
                try {
                  const checked = validateLayoutProposal(p, proposal.request, proposal.raw);
                  if (onChange(checked.project)) setProposal(null);
                } catch (e) {
                  setError(String(e));
                }
              }}
            >
              Apply reviewed proposal to this level
            </button>
            <button onClick={() => setProposal(null)}>Discard</button>
          </>
        ) : (
          <div className="arch-empty">
            <h3>Your proposal appears here</h3>
            <p>Nothing changes until you review and apply it.</p>
          </div>
        )}
      </div>
    </div>
  );
}
