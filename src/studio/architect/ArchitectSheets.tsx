import { useRef, useState } from "react";
import { useEffect } from "react";
import { type View } from "./drawing";
import { authoredSheets, changeAuthoredSheets, editActiveSheet, resizeSheetPaper, reviewAuthoredSheetArchive, type AuthoredSheetAction, type AuthoredSheetArchiveReview } from "./authoredSheetSet";
import { DrawingPrimitives } from "./DrawingPrimitives";
import {
  paperSize,
  sheetViewports,
  viewportBox,
  exportDrawingPdf,
  exportIssueSetPdf,
  saveDownload,
} from "./sheets";
import { reviewIssueSet, issueFileName, type IssueSetReview } from "./issueSet";
import { uuid, type ArchitectProject } from "./model";
import { titleBlockFields, titleBlockField } from "./titleBlock";
import { NumberField, TextField } from "./ArchitectInspector";
export function ArchitectSheets({
  project: p,
  onChange,
  onError,
  disabled = false,
}: {
  project: ArchitectProject;
  onChange: (p: ArchitectProject) => boolean;
  onError: (e: string) => void;
  disabled?: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [newView, setNewView] = useState<View>("plan"),
    [newLevel, setNewLevel] = useState(p.levels[0].id),
    [review, setReview] = useState<AuthoredSheetArchiveReview | null>(null),
    // D-13: which sheets are in the issue, its purpose, and the reviewed set.
    [issueSelection, setIssueSelection] = useState<string[]>([]),
    [issuePurpose, setIssuePurpose] = useState("For construction"),
    [issueReview, setIssueReview] = useState<IssueSetReview | null>(null),
    [notice, setNotice] = useState(""),
    [failure, setFailure] = useState(""),
    drag = useRef<{ id: string; x: number; y: number; oldX: number; oldY: number } | null>(null),
    svg = useRef<SVGSVGElement>(null),
    [w, h] = paperSize(p),
    // D-07: linked title block fields, fitted to their columns so a long
    // project name or address cannot overrun the sheet number beside it.
    titleBlock = titleBlockFields(p, p.sheet, w),
    vs = sheetViewports(p),
    v = vs.find((v) => v.id === selected),
    set = authoredSheets(p),
    active = set.sheets.find(sheet => sheet.id === set.activeId)!,
    live = set.sheets.filter(sheet => !sheet.archived),
    archived = set.sheets.filter(sheet => sheet.archived);
  useEffect(() => { setSelected(null); drag.current = null; }, [set.activeId]);
  function change(action: AuthoredSheetAction, message: string) {
    if (disabled) return;
    setNotice("");
    setFailure("");
    try {
      if (onChange(changeAuthoredSheets(p, action))) {
        setReview(null); setNotice(message);
      } else setFailure("Drawing sheet was not saved. Your previous saved sheets are unchanged. Resolve the design storage error, then retry this action.");
    } catch (error) { const message = error instanceof Error ? error.message : String(error); setFailure(message); onError(message); }
  }
  function update(fn: (q: ArchitectProject) => void) {
    if (disabled) return;
    setNotice("");
    setFailure("");
    try {
      const q = structuredClone(p);
      q.sheet.viewports = structuredClone(vs);
      fn(q);
      if (!onChange(editActiveSheet(p, layout => Object.assign(layout, q.sheet)))) setFailure("Drawing sheet changes were not saved. Your previous saved layout is unchanged. Resolve the design storage error, then retry the edit.");
    } catch (error) { const message = error instanceof Error ? error.message : String(error); setFailure(message); onError(message); }
  }
  function at(e: { clientX: number; clientY: number }) {
    return new DOMPoint(e.clientX, e.clientY).matrixTransform(
      svg.current!.getScreenCTM()!.inverse(),
    );
  }
  return (
    <fieldset className="arch-sheet-layout" disabled={disabled}>
      <section className="arch-sheet-register" aria-label="Authored drawing sheets">
        <div><h2>Drawing sheets</h2><p>Save independent layouts in this design. Archived sheets remain recoverable after reopening.</p></div>
        <div className="arch-sheet-actions">
          <label>Active drawing sheet<select aria-label="Active drawing sheet" value={set.activeId} onChange={event => change({ type: "select", sheetId: event.target.value }, "Active drawing sheet saved.")}>{live.map(sheet => <option key={sheet.id} value={sheet.id}>{sheet.layout.number} · {sheet.name}</option>)}</select></label>
          <button disabled={set.sheets.length >= 200} onClick={() => change({ type: "add" }, "Drawing sheet added and saved.")}>Add drawing sheet</button>
          <button disabled={set.sheets.length >= 200} onClick={() => change({ type: "duplicate", sheetId: active.id }, "Independent copy saved with new sheet and viewport identities.")}>Duplicate sheet</button>
          <button disabled={live.length < 2} title={live.length < 2 ? "Keep one active sheet; add another before archiving." : "Review the layout before archiving"} onClick={() => { try { setReview(reviewAuthoredSheetArchive(p, active.id)); setNotice(""); } catch (error) { onError(String(error)); } }}>Archive sheet</button>
        </div>
        <div className="arch-sheet-actions">
          <button disabled={live[0].id === active.id} onClick={() => change({ type: "move", sheetId: active.id, direction: -1 }, "Sheet order saved.")}>Move sheet earlier</button>
          <button disabled={live.at(-1)!.id === active.id} onClick={() => change({ type: "move", sheetId: active.id, direction: 1 }, "Sheet order saved.")}>Move sheet later</button>
          <span>{live.length} active · {archived.length} archived · {set.sheets.length}/200 sheets</span>
        </div>
        {notice && <p role="status">{notice}</p>}
        {failure && <p className="arch-sheet-review" role="alert">{failure}</p>}
        {review && <div className="arch-sheet-review" role="region" aria-label="Review drawing sheet archive">
          <h3>Archive {review.name}?</h3><p>{review.viewports} live viewport{review.viewports === 1 ? "" : "s"}, sheet scale, north rotation and layout will be retained in the original sheet position. Shared model geometry, dimensions, quantities and previously exported files stay unchanged.</p>
          <p>Recover the same sheet from Archived drawing sheets after reopening. Keep at least one active drawing sheet.</p>
          {review.projectSnapshot !== JSON.stringify(p) && <p role="alert">The design changed after this review. Cancel and review again before archiving.</p>}
          <div className="arch-sheet-actions"><button disabled={review.projectSnapshot !== JSON.stringify(p)} onClick={() => change({ type: "archive", review }, "Sheet archived and saved. Recover it from Archived drawing sheets.")}>Confirm sheet archive</button><button onClick={() => setReview(null)}>Cancel sheet archive</button></div>
        </div>}
        <details className="arch-sheet-archive"><summary>Archived drawing sheets ({archived.length})</summary>
          {archived.length ? <ol>{archived.map(sheet => <li key={sheet.id}><span><strong>{sheet.layout.number} · {sheet.name}</strong><small>Position {set.sheets.indexOf(sheet) + 1} · {sheet.layout.size} · 1:{sheet.layout.scale} · {Math.max(1, sheet.layout.viewports.length)} viewports retained</small></span><button aria-label={`Recover drawing sheet ${sheet.name}`} onClick={() => change({ type: "recover", sheetId: sheet.id }, "Drawing sheet recovered in its saved position.")}>Recover sheet</button></li>)}</ol> : <p>No archived drawing sheets.</p>}
        </details>
        <details className="arch-sheet-archive arch-issue-set">
          <summary>Issue a drawing set ({issueSelection.length} of {live.length} selected)</summary>
          <p>
            Select the sheets to issue, state the purpose, then review. The issued PDF leads with
            an issue register listing every sheet in printed order. Issuing never changes the design.
          </p>
          <div className="arch-sheet-actions">
            <button
              type="button"
              onClick={() => { setIssueSelection(live.map(sheet => sheet.id)); setIssueReview(null); }}
            >
              Select all sheets
            </button>
            <button
              type="button"
              disabled={!issueSelection.length}
              onClick={() => { setIssueSelection([]); setIssueReview(null); }}
            >
              Clear selection
            </button>
          </div>
          <ol className="arch-issue-list">
            {live.map(sheet => (
              <li key={sheet.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={issueSelection.includes(sheet.id)}
                    onChange={event => {
                      setIssueReview(null);
                      setIssueSelection(current =>
                        event.target.checked
                          ? [...current, sheet.id]
                          : current.filter(id => id !== sheet.id));
                    }}
                  />
                  <span>
                    <strong>{sheet.layout.number} · {sheet.name}</strong>
                    <small>{sheet.layout.size} · 1:{sheet.layout.scale} · {Math.max(1, sheet.layout.viewports.length)} viewports</small>
                  </span>
                </label>
              </li>
            ))}
          </ol>
          <label>
            Issue purpose
            <input
              value={issuePurpose}
              maxLength={80}
              onChange={event => { setIssuePurpose(event.target.value); setIssueReview(null); }}
            />
          </label>
          <div className="arch-sheet-actions">
            <button
              type="button"
              disabled={!issueSelection.length}
              onClick={() => {
                setNotice(""); setFailure("");
                try {
                  setIssueReview(reviewIssueSet(p, issueSelection, issuePurpose));
                } catch (error) {
                  const message = error instanceof Error ? error.message : String(error);
                  setIssueReview(null); setFailure(message); onError(message);
                }
              }}
            >
              Review issue
            </button>
          </div>
          {issueReview && (
            <div className="arch-sheet-review" role="region" aria-label="Review drawing issue">
              <h3>Issue {issueReview.sheets.length} sheet{issueReview.sheets.length === 1 ? "" : "s"}?</h3>
              <p>
                Purpose: {issueReview.purpose}. Design revision {issueReview.designRevision}, model
                revision {issueReview.modelRevision}. Sheets print in this order:
              </p>
              <ol>
                {issueReview.sheets.map(sheet => (
                  <li key={sheet.sheetId}>
                    <span>
                      <strong>{sheet.number} · {sheet.name}</strong>
                      <small>{sheet.size} · 1:{sheet.scale} · {sheet.viewports} viewports</small>
                    </span>
                  </li>
                ))}
              </ol>
              {issueReview.projectSnapshot !== JSON.stringify(p) && (
                <p role="alert">The design changed after this review. Review the issue again before exporting.</p>
              )}
              <div className="arch-sheet-actions">
                <button
                  type="button"
                  disabled={busy || issueReview.projectSnapshot !== JSON.stringify(p)}
                  onClick={async () => {
                    setBusy(true); setNotice(""); setFailure("");
                    try {
                      const issuedAt = new Date();
                      saveDownload(
                        await exportIssueSetPdf(p, issueReview, issuedAt),
                        issueFileName(issueReview, issuedAt),
                        "application/pdf",
                      );
                      setNotice(`Issued ${issueReview.sheets.length} sheets with an issue register.`);
                    } catch (error) {
                      const message = error instanceof Error ? error.message : String(error);
                      setFailure(message); onError(message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? "Preparing issue…" : "Export issue PDF"}
                </button>
                <button type="button" onClick={() => setIssueReview(null)}>Cancel issue</button>
              </div>
            </div>
          )}
        </details>
      </section>
      <div>
        <div className="arch-button-row">
          <select
            aria-label="Paper size"
            value={p.sheet.size}
            onChange={(e) =>
              update((q) => {
                Object.assign(q.sheet, resizeSheetPaper(q.sheet, e.target.value as "A1" | "A3"));
              })
            }
          >
            <option>A3</option>
            <option>A1</option>
          </select>
          <select
            aria-label="Sheet default scale"
            value={p.sheet.scale}
            onChange={(e) =>
              update((q) => {
                q.sheet.scale = e.target.value as "50";
                for (const v of q.sheet.viewports) v.scale = q.sheet.scale;
              })
            }
          >
            {["50", "100", "200"].map((s) => (
              <option key={s} value={s}>
                1:{s}
              </option>
            ))}
          </select>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                saveDownload(await exportDrawingPdf(p), p.sheet.number + ".pdf", "application/pdf");
              } catch (e) {
                onError(String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Preparing vectors…" : "Export vector PDF"}
          </button>
        </div>
        <svg
          ref={svg}
          className="arch-paper"
          role="img"
          aria-label="Scaled architectural drawing sheet"
          viewBox={`0 0 ${w} ${h}`}
          onPointerMove={(e) => {
            if (disabled || !drag.current) return;
            const pt = at(e),
              d = drag.current;
            const g = svg.current?.querySelector(`[data-viewport="${d.id}"]`);
            g?.setAttribute(
              "transform",
              `translate(${Math.max(8, Math.min(w - 25, d.oldX + pt.x - d.x))} ${Math.max(8, Math.min(h - 60, d.oldY + pt.y - d.y))})`,
            );
          }}
          onPointerUp={(e) => {
            if (disabled || !drag.current) return;
            const pt = at(e),
              d = drag.current;
            drag.current = null;
            update((q) => {
              const v = q.sheet.viewports.find((v) => v.id === d.id)!;
              v.x = Math.max(8, Math.min(w - v.width - 8, d.oldX + pt.x - d.x));
              v.y = Math.max(8, Math.min(h - v.height - 44, d.oldY + pt.y - d.y));
            });
          }}
        >
          <rect width={w} height={h} fill="#fffefa" />
          <rect
            x="8"
            y="8"
            width={w - 16}
            height={h - 16}
            fill="none"
            stroke="#64686b"
            strokeWidth=".3"
          />
          {vs.map((v) => {
            const { items, box } = viewportBox(p, v);
            return (
              <g
                key={v.id}
                data-viewport={v.id}
                transform={`translate(${v.x} ${v.y})`}
                onPointerDown={(e) => {
                  if (disabled) return;
                  e.stopPropagation();
                  setSelected(v.id);
                  const pt = at(e);
                  drag.current = { id: v.id, x: pt.x, y: pt.y, oldX: v.x, oldY: v.y };
                  svg.current?.setPointerCapture(e.pointerId);
                }}
              >
                <rect
                  width={v.width}
                  height={v.height}
                  fill="transparent"
                  stroke={selected === v.id ? "#7a908e" : "none"}
                  strokeWidth=".3"
                />
                <svg
                  width={v.width}
                  height={v.height - 8}
                  viewBox={box.join(" ")}
                  style={{ pointerEvents: "none" }}
                >
                  <DrawingPrimitives items={items} />
                </svg>
                <text x="0" y={v.height - 2} fontSize="2.8">
                  {v.view.toUpperCase()} / {p.levels.find((l) => l.id === v.levelId)?.name} / 1:
                  {v.scale}
                </text>
              </g>
            );
          })}
          <path d={`M8 ${h - 42} H${w - 8}`} stroke="#555" strokeWidth=".3" />
          <text x="14" y={h - 31} fontSize="4.5">
            {titleBlockField(titleBlock, "name").text}
            {titleBlockField(titleBlock, "name").truncated && <title>{p.name}</title>}
          </text>
          <text x="14" y={h - 24} fontSize="2.7">
            {titleBlockField(titleBlock, "address").text}
            {titleBlockField(titleBlock, "address").truncated && <title>{p.address}</title>}
          </text>
          <text x="14" y={h - 16} fontSize="2.7">
            {titleBlockField(titleBlock, "status").text}
          </text>
          <text x={w - 100} y={h - 31} fontSize="3.5">
            {titleBlockField(titleBlock, "number").text}
            {titleBlockField(titleBlock, "number").truncated && (
              <title>{titleBlockField(titleBlock, "number").full}</title>
            )}
          </text>
          <text x={w - 100} y={h - 24} fontSize="2.7">
            {titleBlockField(titleBlock, "modelRevision").text}
          </text>
          <g transform={`translate(${w - 18} ${h - 29}) rotate(${p.sheet.northAngle})`}>
            <path d="M0 8V-8M-2 -4L0 -8L2 -4" fill="none" stroke="#333" strokeWidth=".4" />
            <text x="-1" y="-10" fontSize="3">
              N
            </text>
          </g>
          <path
            d={`M${w - 100} ${h - 14}h${5000 / Number(p.sheet.scale)}`}
            stroke="#333"
            strokeWidth=".7"
          />
          <text x={w - 100} y={h - 10} fontSize="2.2">
            0 — 5 m / 1:{p.sheet.scale}
          </text>
        </svg>
        <p className="arch-note">
          Drag a viewport to position it. Each viewport prints at its labelled scale; content
          outside its frame is clipped. Changing paper size fits frames to the paper and preserves their scales. Print the PDF at 100%, without fit-to-page.
        </p>
      </div>
      <aside className="arch-inspector">
        <h2>Drawing sheet</h2>
        <TextField key={active.id} label="Drawing sheet name" value={active.name} onCommit={name => change({ type: "rename", sheetId: active.id, name }, "Drawing sheet name saved.")} />
        <TextField
          label="Sheet number"
          value={p.sheet.number}
          onCommit={(n) =>
            update((q) => {
              q.sheet.number = n;
            })
          }
        />
        <NumberField
          label="North rotation °"
          value={p.sheet.northAngle}
          onCommit={(n) =>
            update((q) => {
              q.sheet.northAngle = n;
            })
          }
        />
        <h3>Add a live viewport</h3>
        <select
          aria-label="New viewport projection"
          value={newView}
          onChange={(e) => setNewView(e.target.value as View)}
        >
          {["plan", "north", "south", "east", "west", "section"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select
          aria-label="New viewport level"
          value={newLevel}
          onChange={(e) => setNewLevel(e.target.value)}
        >
          {p.levels.map((l) => (
            <option value={l.id} key={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <button
          disabled={vs.length >= 4}
          title="Up to four live viewports per drawing sheet"
          onClick={() =>
            update((q) => {
              if (q.sheet.viewports.length === 1 && q.sheet.viewports[0].width === w - 24 && q.sheet.viewports[0].height === h - 62)
                q.sheet.viewports[0] = {
                  ...q.sheet.viewports[0],
                  width: (w - 36) / 2,
                  height: (h - 70) / 2,
                };
              q.sheet.viewports.push({
                id: uuid(),
                view: newView,
                levelId: newLevel,
                x: q.sheet.viewports.length % 2 === 0 ? 12 : w / 2,
                y: 12 + Math.floor(q.sheet.viewports.length / 2) * ((h - 70) / 2 + 8),
                width: w / 2 - 16,
                height: (h - 70) / 2,
                scale: p.sheet.scale,
              });
            })
          }
        >
          Add viewport
        </button>
        {v && (
          <>
            <h3>Selected viewport</h3>
            <select
              aria-label="Viewport scale"
              value={v.scale}
              onChange={(e) =>
                update((q) => {
                  q.sheet.viewports.find((a) => a.id === v.id)!.scale = e.target.value as "50";
                })
              }
            >
              {["50", "100", "200"].map((s) => (
                <option value={s} key={s}>
                  1:{s}
                </option>
              ))}
            </select>
            {(["x", "y", "width", "height"] as const).map((key) => (
              <NumberField
                key={key}
                label={key + " / paper mm"}
                value={v[key]}
                onCommit={(n) =>
                  update((q) => {
                    q.sheet.viewports.find((a) => a.id === v.id)![key] = n;
                  })
                }
              />
            ))}
            <button
              onClick={() =>
                update((q) => {
                  q.sheet.viewports = q.sheet.viewports.filter((a) => a.id !== v.id);
                })
              }
            >
              Remove viewport
            </button>
          </>
        )}
      </aside>
    </fieldset>
  );
}
