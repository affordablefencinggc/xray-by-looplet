import { useEffect, useRef, useState } from "react";
import type { SourceBuilding } from "./sourceBuilding";
import { floorKey, planBounds } from "./componentLocation";
import { WorkspaceDialog } from "./WorkspaceDialog";

export type WalkStart = { x: number; z: number; elevation: number; level?: string };

export function WalkStartDialog({
  model,
  initialFloor,
  onClose,
  onStart,
}: {
  model: SourceBuilding;
  initialFloor: string;
  onClose: () => void;
  onStart: (floor: string, point: WalkStart) => void;
}) {
  const floors =
    model.storeys ??
    [
      {
        id: "ground",
        label: "Ground floor",
        elevation: model.floorElevations?.ground ?? model.bounds.min[1],
      },
      {
        id: "upper",
        label: "Upper floor",
        elevation: model.floorElevations?.upper ?? model.bounds.min[1],
      },
    ].filter((f) => model.objects.some((p) => floorKey(p) === f.id));
  const [floor, setFloor] = useState(floors.find((f) => f.id === initialFloor)?.id ?? floors[0].id);
  const [point, setPoint] = useState<[number, number] | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const parts = model.objects.filter((p) => floorKey(p) === floor);
  const bounds = planBounds(parts),
    width = 600,
    height = 360;
  const scale = Math.min(
    552 / Math.max(0.1, bounds[2] - bounds[0]),
    312 / Math.max(0.1, bounds[3] - bounds[1]),
  );
  const ox = (width - (bounds[2] - bounds[0]) * scale) / 2 - bounds[0] * scale;
  const oz = (height - (bounds[3] - bounds[1]) * scale) / 2 - bounds[1] * scale;
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#d4d6d8";
    ctx.strokeStyle = "#646a70";
    ctx.lineWidth = 0.6;
    for (const p of parts)
      for (let i = 0; i < p.indices.length; i += 3) {
        ctx.beginPath();
        for (let j = 0; j < 3; j++) {
          const n = p.indices[i + j] * 3,
            x = ox + p.positions[n] * scale,
            z = oz + p.positions[n + 2] * scale;
          if (j === 0) ctx.moveTo(x, z);
          else ctx.lineTo(x, z);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    if (point) {
      const x = ox + point[0] * scale,
        y = oz + point[1] * scale;
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fillStyle = "#dc333d";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }, [floor, point, model]);
  const choose = (x: number, z: number) =>
    setPoint([
      Math.max(bounds[0], Math.min(bounds[2], x)),
      Math.max(bounds[1], Math.min(bounds[3], z)),
    ]);
  return (
    <WorkspaceDialog title="Pick your walking start" onClose={onClose}>
      <div className="walk-start-picker">
        <p>Pick the area you wish to start walking in. Choose a floor, then click its plan.</p>
        <label>
          Starting floor
          <select
            aria-label="Starting floor"
            value={floor}
            onChange={(e) => {
              setFloor(e.target.value);
              setPoint(null);
            }}
          >
            {floors.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <canvas
          ref={canvas}
          width={width}
          height={height}
          tabIndex={0}
          role="button"
          aria-label="Choose walking start on floor plan"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            choose(
              (((e.clientX - r.left) * width) / r.width - ox) / scale,
              (((e.clientY - r.top) * height) / r.height - oz) / scale,
            );
          }}
          onKeyDown={(e) => {
            const p = point ?? [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2];
            if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", " "].includes(e.key)) {
              e.preventDefault();
              choose(
                p[0] + (e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0),
                p[1] + (e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0),
              );
            }
          }}
        />
        <p>
          {point
            ? `Start: X ${point[0].toFixed(1)} m · Z ${point[1].toFixed(1)} m`
            : "Click the plan, or focus it and use the arrow keys."}
        </p>
        <div className="walk-start-footer">
          <span>
            <kbd>Esc</kbd> exits navigation at any time
          </span>
          <button
            className="pill-dark"
            disabled={!point}
            onClick={() =>
              point &&
              onStart(floor, {
                x: point[0],
                z: point[1],
                elevation: floors.find((f) => f.id === floor)!.elevation,
              })
            }
          >
            Start walking here
          </button>
        </div>
        <small>
          Eye height 1.65 m above the floor. Free walkthrough; walls and openings do not block
          movement.
        </small>
      </div>
    </WorkspaceDialog>
  );
}
