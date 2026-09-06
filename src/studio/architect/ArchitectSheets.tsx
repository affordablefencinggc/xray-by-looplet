import { useRef, useState } from "react";
import { primitives, type View } from "./drawing";
import { DrawingPrimitives } from "./DrawingPrimitives";
import { paperSize, sheetViewports, viewportBox, exportDrawingPdf, saveDownload } from "./sheets";
import { uuid, type ArchitectProject } from "./model";
import { NumberField, TextField } from "./ArchitectInspector";
export function ArchitectSheets({
  project: p,
  onChange,
  onError,
}: {
  project: ArchitectProject;
  onChange: (p: ArchitectProject) => boolean;
  onError: (e: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [newView, setNewView] = useState<View>("plan"),
    [newLevel, setNewLevel] = useState(p.levels[0].id),
    drag = useRef<{ id: string; x: number; y: number; oldX: number; oldY: number } | null>(null),
    svg = useRef<SVGSVGElement>(null),
    [w, h] = paperSize(p),
    vs = sheetViewports(p),
    v = vs.find((v) => v.id === selected);
  function update(fn: (q: ArchitectProject) => void) {
    const q = structuredClone(p);
    q.sheet.viewports = structuredClone(vs);
    fn(q);
    onChange(q);
  }
  function at(e: { clientX: number; clientY: number }) {
    return new DOMPoint(e.clientX, e.clientY).matrixTransform(
      svg.current!.getScreenCTM()!.inverse(),
    );
  }
  return (
    <div className="arch-sheet-layout">
      <div>
        <div className="arch-button-row">
          <select
            aria-label="Paper size"
            value={p.sheet.size}
            onChange={(e) =>
              update((q) => {
                q.sheet.size = e.target.value as "A1" | "A3";
                q.sheet.viewports = [];
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
            if (!drag.current) return;
            const pt = at(e),
              d = drag.current;
            const g = svg.current?.querySelector(`[data-viewport="${d.id}"]`);
            g?.setAttribute(
              "transform",
              `translate(${Math.max(8, Math.min(w - 25, d.oldX + pt.x - d.x))} ${Math.max(8, Math.min(h - 60, d.oldY + pt.y - d.y))})`,
            );
          }}
          onPointerUp={(e) => {
            if (!drag.current) return;
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
            {p.name}
          </text>
          <text x="14" y={h - 24} fontSize="2.7">
            {p.address || "Project address not specified"}
          </text>
          <text x="14" y={h - 16} fontSize="2.7">
            DESIGN REVIEW / not for construction
          </text>
          <text x={w - 100} y={h - 31} fontSize="3.5">
            {p.sheet.number} / REV {p.designRevision} / {p.sheet.size}
          </text>
          <text x={w - 100} y={h - 24} fontSize="2.7">
            Model revision {p.revision} / print at 100%
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
          outside its frame is clipped. Print the PDF at 100%, without fit-to-page.
        </p>
      </div>
      <aside className="arch-inspector">
        <h2>Drawing sheet</h2>
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
              if (q.sheet.viewports.length === 1 && q.sheet.viewports[0].id === "default-plan")
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
    </div>
  );
}
