import React, { useId, useMemo, useState } from "react";
import {
  calculateRoofTakeoff,
  calculateUnequalPitchValleyIntersection,
  generatePyramidHipRoof,
  generateStandardHipRoof,
  generateLShapedHipValleyRoof,
  type Point3D,
  type Point2D,
  type RoofTakeoffSummary,
  type Roof3DFace,
  type Roof3DEdge,
} from "./roofGeometry.ts";

export interface RoofingWorksheetProps {
  draftPlanes?: Array<{
    id: string;
    grossPlanAreaM2: number;
    pitchDegrees: number;
  }>;
  onApplyTakeoff?: (summary: RoofTakeoffSummary) => void;
  disabled?: boolean;
}

type PresetType = "standard-hip" | "pyramid-hip" | "unequal-valley" | "gable-rake";

const EDGE_COLORS: Record<string, { stroke: string; label: string; bg: string }> = {
  hip: { stroke: "#f59e0b", label: "Hip (Ext. Angle)", bg: "rgba(245, 158, 11, 0.15)" },
  valley: { stroke: "#06b6d4", label: "Valley (Trough)", bg: "rgba(6, 182, 212, 0.15)" },
  ridge: { stroke: "#a855f7", label: "Ridge (Apex)", bg: "rgba(168, 85, 247, 0.15)" },
  eave: { stroke: "#10b981", label: "Eaves (Gutter)", bg: "rgba(16, 185, 129, 0.15)" },
  rake: { stroke: "#f43f5e", label: "Rake / Verge", bg: "rgba(244, 63, 94, 0.15)" },
  boundary: { stroke: "#94a3b8", label: "Boundary", bg: "rgba(148, 163, 184, 0.15)" },
  abutment: { stroke: "#3b82f6", label: "Abutment Wall", bg: "rgba(59, 130, 246, 0.15)" },
};

/**
 * 3D Isometric Projection Helper
 */
function projectIsometric(p: Point3D, scale: number, center: [number, number]): [number, number] {
  // Classic 30-degree isometric projection:
  // x_iso = (x - y) * cos(30°)
  // y_iso = -z + (x + y) * sin(30°)
  const cos30 = 0.8660254;
  const sin30 = 0.5;
  const screenX = (p[0] - p[1]) * cos30 * scale + center[0];
  const screenY = (-(p[2]) + (p[0] + p[1]) * sin30) * scale + center[1];
  return [screenX, screenY];
}

export function RoofingWorksheet({ draftPlanes, disabled = false }: RoofingWorksheetProps) {
  const prefix = useId();
  const [activePreset, setActivePreset] = useState<PresetType>("standard-hip");
  const [viewMode, setViewMode] = useState<"3d-iso" | "2d-unfolded">("3d-iso");
  const [selectedFaceId, setSelectedFaceId] = useState<string | null>(null);

  // Custom preset parameters
  const [hipLength, setHipLength] = useState(14);
  const [hipSpan, setHipSpan] = useState(8);
  const [hipPitch, setHipPitch] = useState(22.5);

  const [valleyPitch1, setValleyPitch1] = useState(22.5);
  const [valleyPitch2, setValleyPitch2] = useState(30.0);

  // Generate 3D faces based on active preset
  const inputFaces = useMemo(() => {
    switch (activePreset) {
      case "standard-hip":
        return generateStandardHipRoof(hipLength, hipSpan, hipPitch, 0.45);
      case "pyramid-hip":
        return generatePyramidHipRoof(10, 25, 0.45);
      case "unequal-valley":
        return generateLShapedHipValleyRoof(12, 6, 8, 5, valleyPitch1, valleyPitch2);
      case "gable-rake": {
        // Deterministic gable roof with inclined rakes
        const halfSpan = 3.0;
        const rad = (35 * Math.PI) / 180;
        const apexH = halfSpan * Math.tan(rad);
        return [
          {
            id: "gable-north",
            name: "Gable North Slope (35°)",
            vertices3D: [
              [-6, 0, 0],
              [6, 0, 0],
              [6, 3, apexH],
              [-6, 3, apexH],
            ] as Point3D[],
          },
          {
            id: "gable-south",
            name: "Gable South Slope (35°)",
            vertices3D: [
              [6, 0, 0],
              [-6, 0, 0],
              [-6, -3, apexH],
              [6, -3, apexH],
            ] as Point3D[],
          },
        ];
      }
      default:
        return generateStandardHipRoof(14, 8, 22.5, 0.45);
    }
  }, [activePreset, hipLength, hipSpan, hipPitch, valleyPitch1, valleyPitch2]);

  // Compute full 3D geometric takeoff
  const takeoff = useMemo(() => calculateRoofTakeoff(inputFaces), [inputFaces]);

  // Compute analytical unequal pitch valley intersection details
  const unequalValleyDetails = useMemo(() => {
    return calculateUnequalPitchValleyIntersection(valleyPitch1, valleyPitch2, 90, 2.5);
  }, [valleyPitch1, valleyPitch2]);

  // SVG dimensions
  const svgWidth = 640;
  const svgHeight = 420;

  return (
    <div className="roofing-worksheet" style={{ marginTop: "1.5rem", borderTop: "2px solid #334155", paddingTop: "1.25rem" }}>
      <header style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.15rem", color: "#f8fafc", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ color: "#38bdf8" }}>❖</span>
              3D Roof Inspector &amp; True Surface Development
              <span style={{ fontSize: "0.75rem", background: "#0369a1", color: "#e0f2fe", padding: "2px 8px", borderRadius: "9999px", fontWeight: 600 }}>
                ROOF-02 / ROOF-03
              </span>
            </h3>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem", color: "#94a3b8" }}>
              True 3D rafter geometry, asymmetrical valley intersections, and isometric 2D unfolding. Zero projected approximations.
            </p>
          </div>

          {/* View Mode Controls */}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={() => setViewMode("3d-iso")}
              style={{
                padding: "4px 12px",
                fontSize: "0.8rem",
                borderRadius: "4px",
                border: "1px solid #475569",
                background: viewMode === "3d-iso" ? "#0284c7" : "#1e293b",
                color: "#f8fafc",
                cursor: "pointer",
                fontWeight: viewMode === "3d-iso" ? 600 : 400,
              }}
            >
              3D Axonometric Wireframe
            </button>
            <button
              type="button"
              onClick={() => setViewMode("2d-unfolded")}
              style={{
                padding: "4px 12px",
                fontSize: "0.8rem",
                borderRadius: "4px",
                border: "1px solid #475569",
                background: viewMode === "2d-unfolded" ? "#0284c7" : "#1e293b",
                color: "#f8fafc",
                cursor: "pointer",
                fontWeight: viewMode === "2d-unfolded" ? 600 : 400,
              }}
            >
              2D Unfolded Flat Patterns
            </button>
          </div>
        </div>

        {/* Preset Selector */}
        <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <label htmlFor={`${prefix}-preset`} style={{ fontSize: "0.85rem", color: "#cbd5e1", fontWeight: 500 }}>
            Roof Model Preset:
          </label>
          <select
            id={`${prefix}-preset`}
            value={activePreset}
            onChange={(e) => setActivePreset(e.target.value as PresetType)}
            disabled={disabled}
            style={{
              padding: "4px 8px",
              background: "#0f172a",
              color: "#f8fafc",
              border: "1px solid #475569",
              borderRadius: "4px",
              fontSize: "0.85rem",
            }}
          >
            <option value="standard-hip">Standard Elongated Hip (14m × 8m, 22.5°)</option>
            <option value="pyramid-hip">Pyramid Hip Roof (10m × 10m, 25.0°)</option>
            <option value="unequal-valley">L-Shaped Asymmetrical Valley (22.5° &amp; 30.0° Pitches)</option>
            <option value="gable-rake">Gable Roof with Rakes (12m × 6m, 35.0°)</option>
          </select>

          {activePreset === "standard-hip" && (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <label style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                Pitch:
                <input
                  type="number"
                  value={hipPitch}
                  onChange={(e) => setHipPitch(Number(e.target.value))}
                  style={{ width: "55px", marginLeft: "4px", background: "#0f172a", color: "#fff", border: "1px solid #475569", borderRadius: "3px", padding: "2px 4px" }}
                  step="0.5"
                  min="5"
                  max="75"
                />
                °
              </label>
            </div>
          )}

          {activePreset === "unequal-valley" && (
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <label style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                Main Pitch:
                <input
                  type="number"
                  value={valleyPitch1}
                  onChange={(e) => setValleyPitch1(Number(e.target.value))}
                  style={{ width: "55px", marginLeft: "4px", background: "#0f172a", color: "#fff", border: "1px solid #475569", borderRadius: "3px", padding: "2px 4px" }}
                  step="0.5"
                  min="5"
                  max="60"
                />
                °
              </label>
              <label style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                Wing Pitch:
                <input
                  type="number"
                  value={valleyPitch2}
                  onChange={(e) => setValleyPitch2(Number(e.target.value))}
                  style={{ width: "55px", marginLeft: "4px", background: "#0f172a", color: "#fff", border: "1px solid #475569", borderRadius: "3px", padding: "2px 4px" }}
                  step="0.5"
                  min="5"
                  max="60"
                />
                °
              </label>
            </div>
          )}
        </div>
      </header>

      {/* KPI Cards Strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "0.75rem",
          marginBottom: "1rem",
        }}
      >
        <div style={{ background: "#1e293b", padding: "8px 12px", borderRadius: "6px", border: "1px solid #334155" }}>
          <div style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>True Slope Area</div>
          <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#38bdf8" }}>{takeoff.trueSlopeAreaM2.toFixed(2)} m²</div>
          <div style={{ fontSize: "0.7rem", color: "#64748b" }}>Projected: {takeoff.projectedAreaM2.toFixed(2)} m²</div>
        </div>

        <div style={{ background: "#1e293b", padding: "8px 12px", borderRadius: "6px", border: "1px solid #334155" }}>
          <div style={{ fontSize: "0.75rem", color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Hip Lineal</div>
          <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#fbbf24" }}>{takeoff.hipLinealM.toFixed(2)} m</div>
          <div style={{ fontSize: "0.7rem", color: "#64748b" }}>{takeoff.edges.filter((e) => e.kind === "hip").length} hip runs</div>
        </div>

        <div style={{ background: "#1e293b", padding: "8px 12px", borderRadius: "6px", border: "1px solid #334155" }}>
          <div style={{ fontSize: "0.75rem", color: "#06b6d4", textTransform: "uppercase", letterSpacing: "0.05em" }}>Valley Lineal</div>
          <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#22d3ee" }}>{takeoff.valleyLinealM.toFixed(2)} m</div>
          <div style={{ fontSize: "0.7rem", color: "#64748b" }}>{takeoff.edges.filter((e) => e.kind === "valley").length} valley troughs</div>
        </div>

        <div style={{ background: "#1e293b", padding: "8px 12px", borderRadius: "6px", border: "1px solid #334155" }}>
          <div style={{ fontSize: "0.75rem", color: "#a855f7", textTransform: "uppercase", letterSpacing: "0.05em" }}>Ridge Lineal</div>
          <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#c084fc" }}>{takeoff.ridgeLinealM.toFixed(2)} m</div>
          <div style={{ fontSize: "0.7rem", color: "#64748b" }}>{takeoff.edges.filter((e) => e.kind === "ridge").length} ridges</div>
        </div>

        <div style={{ background: "#1e293b", padding: "8px 12px", borderRadius: "6px", border: "1px solid #334155" }}>
          <div style={{ fontSize: "0.75rem", color: "#10b981", textTransform: "uppercase", letterSpacing: "0.05em" }}>Eaves Perimeter</div>
          <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#34d399" }}>{takeoff.eavesLinealM.toFixed(2)} m</div>
          <div style={{ fontSize: "0.7rem", color: "#64748b" }}>Gutter run</div>
        </div>
      </div>

      {/* Asymmetrical Valley Special Inspection Notice */}
      {activePreset === "unequal-valley" && (
        <div
          style={{
            background: "#082f49",
            border: "1px solid #0284c7",
            borderRadius: "6px",
            padding: "10px 14px",
            marginBottom: "1rem",
            fontSize: "0.85rem",
            color: "#f0f9ff",
            lineHeight: 1.4,
          }}
        >
          <strong style={{ color: "#38bdf8" }}>Analytic Asymmetrical Valley Intersection: </strong>
          Plane 1 ({valleyPitch1}°) meets Plane 2 ({valleyPitch2}°) at 90° return.
          Plan trajectory swings to <span style={{ fontWeight: 700, color: "#fef08a" }}>{unequalValleyDetails.planIntersectionAngle1Deg.toFixed(2)}°</span> from Main Eave normal.
          Valley slope from horizontal is <span style={{ fontWeight: 700, color: "#fef08a" }}>{unequalValleyDetails.valleyPitchDeg.toFixed(2)}°</span> (flatter than both pitches).
          True 3D valley length for 2.5m rise = <span style={{ fontWeight: 700, color: "#fef08a" }}>{unequalValleyDetails.trueValleyLengthM.toFixed(2)} m</span>.
        </div>
      )}

      {/* Main Graphical Canvas / SVG Viewport */}
      <div
        style={{
          background: "#090d16",
          border: "1px solid #1e293b",
          borderRadius: "8px",
          padding: "0.75rem",
          marginBottom: "1rem",
        }}
      >
        {/* Top toolbar inside canvas: non-overlapping flex layout */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "8px",
            marginBottom: "10px",
          }}
        >
          <div
            style={{
              fontSize: "0.75rem",
              color: "#38bdf8",
              background: "#1e293b",
              padding: "4px 10px",
              borderRadius: "4px",
              border: "1px solid #334155",
              fontWeight: 600,
            }}
          >
            {viewMode === "3d-iso" ? "3D Axonometric Wireframe" : "2D Unfolded Surface Developments"}
          </div>

          {/* Legend */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              fontSize: "0.72rem",
              background: "#1e293b",
              padding: "4px 8px",
              borderRadius: "4px",
              border: "1px solid #334155",
              flexWrap: "wrap",
            }}
          >
            {Object.entries(EDGE_COLORS).slice(0, 5).map(([kind, info]) => (
              <span key={kind} style={{ display: "flex", alignItems: "center", gap: "4px", color: "#cbd5e1" }}>
                <span style={{ width: "10px", height: "3px", backgroundColor: info.stroke, display: "inline-block", borderRadius: "1px" }} />
                {info.label}
              </span>
            ))}
          </div>
        </div>

        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{ width: "100%", height: "auto", maxHeight: "380px", display: "block" }}
          aria-label="Roof geometry interactive diagram"
        >
          {viewMode === "3d-iso" ? (
            /* 3D Axonometric View */
            <g transform="translate(0, 20)">
              {/* Shaded Roof Faces */}
              {takeoff.faces.map((face) => {
                const isSelected = selectedFaceId === face.id;
                const pointsSvg = face.vertices3D
                  .map((v) => {
                    const [sx, sy] = projectIsometric(v, 20, [svgWidth / 2, svgHeight / 2 - 20]);
                    return `${sx},${sy}`;
                  })
                  .join(" ");

                return (
                  <polygon
                    key={face.id}
                    points={pointsSvg}
                    fill={isSelected ? "rgba(56, 189, 248, 0.35)" : "rgba(30, 41, 59, 0.6)"}
                    stroke="#475569"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                    style={{ cursor: "pointer", transition: "fill 0.2s" }}
                    onClick={() => setSelectedFaceId(isSelected ? null : face.id)}
                  >
                    <title>{`${face.name}: True ${face.areaTrueM2.toFixed(2)}m² (Pitch ${face.pitchDegrees.toFixed(1)}°)`}</title>
                  </polygon>
                );
              })}

              {/* Color-Coded 3D Edges */}
              {takeoff.edges.map((edge) => {
                const [x1, y1] = projectIsometric(edge.start, 20, [svgWidth / 2, svgHeight / 2 - 20]);
                const [x2, y2] = projectIsometric(edge.end, 20, [svgWidth / 2, svgHeight / 2 - 20]);
                const edgeStyle = EDGE_COLORS[edge.kind] ?? EDGE_COLORS.boundary;

                return (
                  <g key={edge.id}>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={edgeStyle.stroke}
                      strokeWidth={edge.kind === "hip" || edge.kind === "valley" || edge.kind === "ridge" ? "3" : "1.8"}
                      strokeLinecap="round"
                    />
                    {/* Midpoint length label for significant hips, valleys, ridges */}
                    {(edge.kind === "hip" || edge.kind === "valley" || edge.kind === "ridge") && (
                      <text
                        x={(x1 + x2) / 2}
                        y={(y1 + y2) / 2 - 6}
                        fill={edgeStyle.stroke}
                        fontSize="9"
                        fontWeight="600"
                        textAnchor="middle"
                        style={{ paintOrder: "stroke", stroke: "#090d16", strokeWidth: "3px" }}
                      >
                        {edge.length3D.toFixed(2)}m
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          ) : (
            /* 2D Unfolded Flat Patterns Development */
            <g transform="translate(10, 30)">
              {takeoff.faces.map((face, index) => {
                // Layout unfolded patterns in grid or flow
                const col = index % 2;
                const row = Math.floor(index / 2);
                const ox = col * 300 + 70;
                const oy = row * 180 + 70;
                const isSelected = selectedFaceId === face.id;

                const pointsSvg = face.unfolded2D.vertices2D
                  .map(([u, v]) => `${ox + u * 16},${oy - v * 16}`)
                  .join(" ");

                return (
                  <g key={face.id} onClick={() => setSelectedFaceId(isSelected ? null : face.id)} style={{ cursor: "pointer" }}>
                    <polygon
                      points={pointsSvg}
                      fill={isSelected ? "rgba(56, 189, 248, 0.25)" : "rgba(30, 41, 59, 0.5)"}
                      stroke={isSelected ? "#38bdf8" : "#64748b"}
                      strokeWidth="1.5"
                    />
                    <text
                      x={ox + 20}
                      y={oy - 20}
                      fill="#e2e8f0"
                      fontSize="10"
                      fontWeight="600"
                    >
                      {face.name}
                    </text>
                    <text
                      x={ox + 20}
                      y={oy - 6}
                      fill="#38bdf8"
                      fontSize="9"
                    >
                      True Area: {face.areaTrueM2.toFixed(2)} m²
                    </text>
                  </g>
                );
              })}
            </g>
          )}
        </svg>
      </div>

      {/* Comprehensive Takeoff Data Tables */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem" }}>
        {/* Table 1: Roof Plane Takeoff */}
        <div
          className="industry-table-wrap"
          style={{
            background: "#0f172a",
            padding: "14px",
            borderRadius: "8px",
            border: "1px solid #334155",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.2)",
          }}
        >
          <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
            <caption style={{ textAlign: "left", fontWeight: 700, color: "#f8fafc", marginBottom: "0.6rem", fontSize: "0.9rem" }}>
              Plane Surface Development (A_true = A_proj / cos θ)
            </caption>
            <thead>
              <tr style={{ background: "#1e293b", color: "#cbd5e1", textAlign: "left" }}>
                <th style={{ padding: "8px 10px" }}>Plane</th>
                <th style={{ padding: "8px 10px" }}>Pitch</th>
                <th style={{ padding: "8px 10px" }}>Factor</th>
                <th style={{ padding: "8px 10px" }}>Proj m²</th>
                <th style={{ padding: "8px 10px" }}>True m²</th>
              </tr>
            </thead>
            <tbody>
              {takeoff.faces.map((face) => (
                <tr
                  key={face.id}
                  onClick={() => setSelectedFaceId(face.id === selectedFaceId ? null : face.id)}
                  style={{
                    borderBottom: "1px solid #1e293b",
                    background: face.id === selectedFaceId ? "rgba(56, 189, 248, 0.18)" : "#0f172a",
                    cursor: "pointer",
                  }}
                >
                  <td style={{ padding: "8px 10px", fontWeight: 600, color: "#f8fafc" }}>{face.name}</td>
                  <td style={{ padding: "8px 10px", color: "#94a3b8" }}>{face.pitchDegrees.toFixed(1)}°</td>
                  <td style={{ padding: "8px 10px", color: "#94a3b8" }}>{face.slopeFactor.toFixed(4)}</td>
                  <td style={{ padding: "8px 10px", color: "#e2e8f0" }}>{face.areaProjectedM2.toFixed(2)}</td>
                  <td style={{ padding: "8px 10px", fontWeight: 700, color: "#38bdf8" }}>{face.areaTrueM2.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "#1e293b", fontWeight: 700, color: "#f8fafc" }}>
                <td style={{ padding: "8px 10px" }}>Total</td>
                <td style={{ padding: "8px 10px" }}>—</td>
                <td style={{ padding: "8px 10px" }}>—</td>
                <td style={{ padding: "8px 10px" }}>{takeoff.projectedAreaM2.toFixed(2)}</td>
                <td style={{ padding: "8px 10px", color: "#38bdf8" }}>{takeoff.trueSlopeAreaM2.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Table 2: 3D Edge Lineal Breakdown */}
        <div
          className="industry-table-wrap"
          style={{
            background: "#0f172a",
            padding: "14px",
            borderRadius: "8px",
            border: "1px solid #334155",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.2)",
          }}
        >
          <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
            <caption style={{ textAlign: "left", fontWeight: 700, color: "#f8fafc", marginBottom: "0.6rem", fontSize: "0.9rem" }}>
              3D Edge Lineal Metres by Classification
            </caption>
            <thead>
              <tr style={{ background: "#1e293b", color: "#cbd5e1", textAlign: "left" }}>
                <th style={{ padding: "8px 10px" }}>Classification</th>
                <th style={{ padding: "8px 10px" }}>Runs</th>
                <th style={{ padding: "8px 10px" }}>Projected (m)</th>
                <th style={{ padding: "8px 10px" }}>True 3D (m)</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #1e293b", background: "#0f172a" }}>
                <td style={{ padding: "8px 10px", color: "#f59e0b", fontWeight: 600 }}>Hip Rafters</td>
                <td style={{ padding: "8px 10px", color: "#94a3b8" }}>{takeoff.edges.filter((e) => e.kind === "hip").length}</td>
                <td style={{ padding: "8px 10px", color: "#94a3b8" }}>
                  {takeoff.edges
                    .filter((e) => e.kind === "hip")
                    .reduce((s, e) => s + e.lengthProjected, 0)
                    .toFixed(2)}
                </td>
                <td style={{ padding: "8px 10px", fontWeight: 700, color: "#fbbf24" }}>{takeoff.hipLinealM.toFixed(2)}</td>
              </tr>

              <tr style={{ borderBottom: "1px solid #1e293b", background: "#0f172a" }}>
                <td style={{ padding: "8px 10px", color: "#06b6d4", fontWeight: 600 }}>Valley Gutters</td>
                <td style={{ padding: "8px 10px", color: "#94a3b8" }}>{takeoff.edges.filter((e) => e.kind === "valley").length}</td>
                <td style={{ padding: "8px 10px", color: "#94a3b8" }}>
                  {takeoff.edges
                    .filter((e) => e.kind === "valley")
                    .reduce((s, e) => s + e.lengthProjected, 0)
                    .toFixed(2)}
                </td>
                <td style={{ padding: "8px 10px", fontWeight: 700, color: "#22d3ee" }}>{takeoff.valleyLinealM.toFixed(2)}</td>
              </tr>

              <tr style={{ borderBottom: "1px solid #1e293b", background: "#0f172a" }}>
                <td style={{ padding: "8px 10px", color: "#a855f7", fontWeight: 600 }}>Ridge Capping</td>
                <td style={{ padding: "8px 10px", color: "#94a3b8" }}>{takeoff.edges.filter((e) => e.kind === "ridge").length}</td>
                <td style={{ padding: "8px 10px", color: "#94a3b8" }}>
                  {takeoff.edges
                    .filter((e) => e.kind === "ridge")
                    .reduce((s, e) => s + e.lengthProjected, 0)
                    .toFixed(2)}
                </td>
                <td style={{ padding: "8px 10px", fontWeight: 700, color: "#c084fc" }}>{takeoff.ridgeLinealM.toFixed(2)}</td>
              </tr>

              <tr style={{ borderBottom: "1px solid #1e293b", background: "#0f172a" }}>
                <td style={{ padding: "8px 10px", color: "#10b981", fontWeight: 600 }}>Eaves / Fascia</td>
                <td style={{ padding: "8px 10px", color: "#94a3b8" }}>{takeoff.edges.filter((e) => e.kind === "eave").length}</td>
                <td style={{ padding: "8px 10px", color: "#94a3b8" }}>
                  {takeoff.edges
                    .filter((e) => e.kind === "eave")
                    .reduce((s, e) => s + e.lengthProjected, 0)
                    .toFixed(2)}
                </td>
                <td style={{ padding: "8px 10px", fontWeight: 700, color: "#34d399" }}>{takeoff.eavesLinealM.toFixed(2)}</td>
              </tr>

              {takeoff.rakeLinealM > 0 && (
                <tr style={{ borderBottom: "1px solid #1e293b", background: "#0f172a" }}>
                  <td style={{ padding: "8px 10px", color: "#f43f5e", fontWeight: 600 }}>Gable Rakes / Verges</td>
                  <td style={{ padding: "8px 10px", color: "#94a3b8" }}>{takeoff.edges.filter((e) => e.kind === "rake").length}</td>
                  <td style={{ padding: "8px 10px", color: "#94a3b8" }}>
                    {takeoff.edges
                      .filter((e) => e.kind === "rake")
                      .reduce((s, e) => s + e.lengthProjected, 0)
                      .toFixed(2)}
                  </td>
                  <td style={{ padding: "8px 10px", fontWeight: 700, color: "#fb7185" }}>{takeoff.rakeLinealM.toFixed(2)}</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr style={{ background: "#1e293b", fontWeight: 700, color: "#f8fafc" }}>
                <td style={{ padding: "8px 10px" }}>Total Lineal</td>
                <td style={{ padding: "8px 10px" }}>{takeoff.edges.length}</td>
                <td style={{ padding: "8px 10px" }}>
                  {takeoff.edges.reduce((s, e) => s + e.lengthProjected, 0).toFixed(2)}
                </td>
                <td style={{ padding: "8px 10px", color: "#38bdf8" }}>
                  {takeoff.edges.reduce((s, e) => s + e.length3D, 0).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
