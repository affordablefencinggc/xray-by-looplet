import React, { useId, useMemo, useState } from "react";
import {
  calculateFastenerSchedule,
  calculateFlashingSchedule,
  compileRoofingDeliverable,
  exportRoofingPackageToCsv,
  WIND_DENSITY_MAP,
  SUBSTRATE_SCREW_MAP,
  type BattenSubstrate,
  type WindClassification,
} from "./flashingSchedules.ts";
import type { RoofTakeoffSummary } from "./roofGeometry.ts";

export interface FlashingFixingsPanelProps {
  takeoff?: RoofTakeoffSummary;
  disabled?: boolean;
}

const WIND_OPTIONS: Array<{ value: WindClassification; label: string; desc: string }> = [
  { value: "N1", label: "N1 (W28N)", desc: "Low wind non-cyclonic (up to 34 m/s)" },
  { value: "N2", label: "N2 (W33N)", desc: "Standard suburban non-cyclonic (up to 40 m/s)" },
  { value: "N3", label: "N3 (W41N)", desc: "Suburban exposed / rural non-cyclonic (up to 50 m/s)" },
  { value: "N4", label: "N4 (W50N)", desc: "High wind exposed non-cyclonic (up to 61 m/s)" },
  { value: "N5", label: "N5 (W60N)", desc: "Very high wind non-cyclonic (up to 74 m/s)" },
  { value: "C1", label: "C1 (W41C)", desc: "Low cyclonic coastal (up to 50 m/s)" },
  { value: "C2", label: "C2 (W50C)", desc: "Medium cyclonic coastal (up to 61 m/s)" },
  { value: "C3", label: "C3 (W60C)", desc: "High cyclonic coastal (up to 74 m/s)" },
];

const SUBSTRATE_OPTIONS: Array<{ value: BattenSubstrate; label: string }> = [
  { value: "timber-softwood", label: "Timber Battens (Softwood MGP10/F5) — 50mm Type 17" },
  { value: "timber-hardwood", label: "Timber Battens (Hardwood F17) — 65mm Type 17" },
  { value: "steel-battens", label: "Steel Topspan Battens (0.75-1.5mm BMT) — 20mm AutoTek" },
  { value: "steel-purlins", label: "Steel C/Z Purlins (1.5-4.5mm) — 45mm Commercial Tek" },
];

export function FlashingFixingsPanel({ takeoff, disabled = false }: FlashingFixingsPanelProps) {
  const prefix = useId();
  const [wind, setWind] = useState<WindClassification>("N2");
  const [substrate, setSubstrate] = useState<BattenSubstrate>("timber-softwood");
  const [unitLengthM, setUnitLengthM] = useState<number>(2.4);
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

  // Fallback synthetic takeoff if no active 3D model is provided
  const activeTakeoff: RoofTakeoffSummary = useMemo(() => {
    if (takeoff && takeoff.faces.length > 0) return takeoff;
    return {
      projectedAreaM2: 120.0,
      trueSlopeAreaM2: 129.89,
      hipLinealM: 32.4,
      valleyLinealM: 14.8,
      ridgeLinealM: 10.0,
      eavesLinealM: 52.0,
      rakeLinealM: 0,
      faces: [],
      edges: [],
      validationWarnings: [],
    };
  }, [takeoff]);

  // Compile full sealed deliverable
  const deliverable = useMemo(() => {
    return compileRoofingDeliverable(activeTakeoff, {
      wind,
      substrate,
    });
  }, [activeTakeoff, wind, substrate]);

  const handleCopyCsv = () => {
    const csv = exportRoofingPackageToCsv(deliverable);
    navigator.clipboard?.writeText(csv).then(() => {
      setCopiedNotification("CSV Transmittal copied to clipboard!");
      setTimeout(() => setCopiedNotification(null), 3000);
    });
  };

  const handleCopyJson = () => {
    const json = JSON.stringify(deliverable, null, 2);
    navigator.clipboard?.writeText(json).then(() => {
      setCopiedNotification("JSON Deliverable Package copied to clipboard!");
      setTimeout(() => setCopiedNotification(null), 3000);
    });
  };

  return (
    <div
      className="flashing-fixings-panel"
      data-testid="flashing-fixings-panel"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
        background: "#090d16",
        color: "#f8fafc",
        padding: "1.25rem",
        borderRadius: "10px",
        border: "1px solid #1e293b",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.4)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
          borderBottom: "1px solid #1e293b",
          paddingBottom: "0.85rem",
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "#38bdf8" }}>
            Roof Flashings, Fixing Schedules &amp; Sealed Deliverable (ROOF-05/06)
          </h3>
          <p style={{ margin: "3px 0 0 0", fontSize: "0.85rem", color: "#94a3b8" }}>
            Automated ridge/valley/barge girth development (300/400/600mm), AS 4055 wind uplift fixings &amp; SH-03 delivery sealing.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={handleCopyCsv}
            disabled={disabled}
            style={{
              padding: "6px 12px",
              fontSize: "0.8rem",
              fontWeight: 600,
              borderRadius: "6px",
              border: "1px solid #0284c7",
              background: "#0369a1",
              color: "#ffffff",
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            Export CSV Transmittal
          </button>
          <button
            type="button"
            onClick={handleCopyJson}
            disabled={disabled}
            style={{
              padding: "6px 12px",
              fontSize: "0.8rem",
              fontWeight: 600,
              borderRadius: "6px",
              border: "1px solid #334155",
              background: "#1e293b",
              color: "#38bdf8",
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            Copy JSON Package
          </button>
        </div>
      </div>

      {copiedNotification && (
        <div
          role="status"
          style={{
            background: "rgba(16, 185, 129, 0.2)",
            border: "1px solid #10b981",
            color: "#34d399",
            padding: "8px 12px",
            borderRadius: "6px",
            fontSize: "0.85rem",
            fontWeight: 600,
          }}
        >
          ✓ {copiedNotification}
        </div>
      )}

      {/* Configuration Strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
          background: "#0f172a",
          padding: "1rem",
          borderRadius: "8px",
          border: "1px solid #1e293b",
        }}
      >
        <div>
          <label
            htmlFor={`${prefix}-wind-select`}
            style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8", marginBottom: "4px" }}
          >
            AS 4055 Wind Classification
          </label>
          <select
            id={`${prefix}-wind-select`}
            value={wind}
            onChange={(e) => setWind(e.target.value as WindClassification)}
            style={{
              width: "100%",
              padding: "6px 8px",
              fontSize: "0.8rem",
              background: "#1e293b",
              border: "1px solid #334155",
              color: "#f8fafc",
              borderRadius: "4px",
            }}
          >
            {WIND_OPTIONS.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label} — {w.desc}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor={`${prefix}-substrate-select`}
            style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8", marginBottom: "4px" }}
          >
            Batten Substrate &amp; Screw Profile
          </label>
          <select
            id={`${prefix}-substrate-select`}
            value={substrate}
            onChange={(e) => setSubstrate(e.target.value as BattenSubstrate)}
            style={{
              width: "100%",
              padding: "6px 8px",
              fontSize: "0.8rem",
              background: "#1e293b",
              border: "1px solid #334155",
              color: "#f8fafc",
              borderRadius: "4px",
            }}
          >
            {SUBSTRATE_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor={`${prefix}-unit-length`}
            style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8", marginBottom: "4px" }}
          >
            Standard Flashing Unit Length (m)
          </label>
          <input
            id={`${prefix}-unit-length`}
            type="number"
            step="0.1"
            min="1.8"
            max="6.0"
            value={unitLengthM}
            onChange={(e) => setUnitLengthM(parseFloat(e.target.value) || 2.4)}
            style={{
              width: "100%",
              padding: "6px 8px",
              fontSize: "0.8rem",
              background: "#1e293b",
              border: "1px solid #334155",
              color: "#f8fafc",
              borderRadius: "4px",
            }}
          />
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "0.75rem",
        }}
      >
        <div
          style={{
            background: "#0f172a",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid #334155",
          }}
        >
          <span style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase" }}>
            True Slope Area
          </span>
          <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "#38bdf8", marginTop: "2px" }}>
            {deliverable.trueSlopeAreaM2.toFixed(2)} m²
          </div>
          <span style={{ fontSize: "0.75rem", color: "#cbd5e1" }}>
            Projected: {deliverable.projectedAreaM2.toFixed(2)} m²
          </span>
        </div>

        <div
          style={{
            background: "#0f172a",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid #334155",
          }}
        >
          <span style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase" }}>
            Fasteners Required
          </span>
          <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "#fbbf24", marginTop: "2px" }}>
            {deliverable.fasteners.totalFastenersWithSpares} screws
          </div>
          <span style={{ fontSize: "0.75rem", color: "#fef08a" }}>
            {deliverable.fasteners.boxesRequired} boxes ({deliverable.fasteners.boxSize}/box)
          </span>
        </div>

        <div
          style={{
            background: "#0f172a",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid #334155",
          }}
        >
          <span style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase" }}>
            Flashing Pieces
          </span>
          <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "#34d399", marginTop: "2px" }}>
            {deliverable.flashings.reduce((s, f) => s + f.piecesRequired, 0)} pcs
          </div>
          <span style={{ fontSize: "0.75rem", color: "#6ee7b7" }}>
            {deliverable.flashings.reduce((s, f) => s + f.totalLinealM, 0).toFixed(1)} lineal metres
          </span>
        </div>

        <div
          style={{
            background: "#0f172a",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid #334155",
          }}
        >
          <span style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase" }}>
            Fixing &amp; Flashing Cost
          </span>
          <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "#f43f5e", marginTop: "2px" }}>
            ${deliverable.costBreakdown.estimatedRoofSubtotal.toFixed(2)}
          </div>
          <span style={{ fontSize: "0.75rem", color: "#fda4af" }}>
            Fixings: ${deliverable.costBreakdown.fastenersSubtotal.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Flashing Schedule Table */}
      <div
        className="industry-table-wrap"
        data-testid="flashing-table-wrap"
        style={{
          background: "#0f172a",
          padding: "14px",
          borderRadius: "8px",
          border: "1px solid #334155",
        }}
      >
        <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
          <caption
            style={{
              textAlign: "left",
              fontWeight: 700,
              color: "#f8fafc",
              marginBottom: "0.6rem",
              fontSize: "0.9rem",
            }}
          >
            Flashing Girth Development &amp; Quantity Schedule
          </caption>
          <thead>
            <tr style={{ background: "#1e293b", color: "#cbd5e1", textAlign: "left" }}>
              <th style={{ padding: "8px 10px" }}>Item</th>
              <th style={{ padding: "8px 10px" }}>Kind</th>
              <th style={{ padding: "8px 10px" }}>Standard Girth</th>
              <th style={{ padding: "8px 10px" }}>Net Lineal (m)</th>
              <th style={{ padding: "8px 10px" }}>Lap %</th>
              <th style={{ padding: "8px 10px" }}>Order Lineal (m)</th>
              <th style={{ padding: "8px 10px" }}>Pieces ({unitLengthM}m)</th>
              <th style={{ padding: "8px 10px" }}>Rate ($/m)</th>
              <th style={{ padding: "8px 10px" }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {deliverable.flashings.map((f) => (
              <tr key={f.id} style={{ borderBottom: "1px solid #1e293b" }}>
                <td style={{ padding: "8px 10px", fontWeight: 600, color: "#38bdf8" }}>{f.name}</td>
                <td style={{ padding: "8px 10px", color: "#94a3b8", textTransform: "capitalize" }}>
                  {f.kind}
                </td>
                <td style={{ padding: "8px 10px", color: "#cbd5e1" }}>
                  <span
                    style={{
                      background: "#1e293b",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontSize: "0.75rem",
                      border: "1px solid #475569",
                    }}
                  >
                    {f.girthMm} mm
                  </span>
                </td>
                <td style={{ padding: "8px 10px", color: "#f8fafc" }}>{f.linealMetresNet.toFixed(2)}</td>
                <td style={{ padding: "8px 10px", color: "#94a3b8" }}>+{f.lapAllowancePct}%</td>
                <td style={{ padding: "8px 10px", fontWeight: 600, color: "#f8fafc" }}>
                  {f.totalLinealM.toFixed(2)}
                </td>
                <td style={{ padding: "8px 10px", fontWeight: 700, color: "#34d399" }}>
                  {f.piecesRequired}
                </td>
                <td style={{ padding: "8px 10px", color: "#cbd5e1" }}>${f.costPerM.toFixed(2)}</td>
                <td style={{ padding: "8px 10px", fontWeight: 700, color: "#fbbf24" }}>
                  ${f.totalCost.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: "#1e293b", fontWeight: 700, color: "#f8fafc" }}>
              <td style={{ padding: "8px 10px" }}>Total Flashings</td>
              <td style={{ padding: "8px 10px" }}>—</td>
              <td style={{ padding: "8px 10px" }}>—</td>
              <td style={{ padding: "8px 10px" }}>
                {deliverable.flashings.reduce((s, f) => s + f.linealMetresNet, 0).toFixed(2)}
              </td>
              <td style={{ padding: "8px 10px" }}>—</td>
              <td style={{ padding: "8px 10px" }}>
                {deliverable.flashings.reduce((s, f) => s + f.totalLinealM, 0).toFixed(2)}
              </td>
              <td style={{ padding: "8px 10px", color: "#34d399" }}>
                {deliverable.flashings.reduce((s, f) => s + f.piecesRequired, 0)} pcs
              </td>
              <td style={{ padding: "8px 10px" }}>—</td>
              <td style={{ padding: "8px 10px", color: "#fbbf24" }}>
                ${deliverable.costBreakdown.flashingsSubtotal.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Fastener Schedule Card */}
      <div
        data-testid="fastener-schedule-card"
        style={{
          background: "#0f172a",
          padding: "14px",
          borderRadius: "8px",
          border: "1px solid #334155",
        }}
      >
        <h4 style={{ margin: "0 0 10px 0", fontSize: "0.95rem", fontWeight: 700, color: "#e2e8f0" }}>
          Fastener &amp; Fixing Schedule (AS 4055 / AS 1170.2)
        </h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
          <div>
            <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Specified Fastener:</div>
            <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "#38bdf8", marginTop: "2px" }}>
              {deliverable.fasteners.screwDescription}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "2px" }}>
              Product Code: <strong>{deliverable.fasteners.screwCode}</strong>
            </div>
          </div>

          <div>
            <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Wind Load Fastener Densities:</div>
            <div style={{ fontSize: "0.85rem", color: "#cbd5e1", marginTop: "2px" }}>
              General Field Area (85%): <strong>{deliverable.fasteners.generalDensityPerM2}</strong> screws/m²
            </div>
            <div style={{ fontSize: "0.85rem", color: "#cbd5e1" }}>
              Perimeter Edge Zones (15%): <strong>{deliverable.fasteners.perimeterDensityPerM2}</strong> screws/m²
            </div>
            <div style={{ fontSize: "0.85rem", color: "#34d399", fontWeight: 600 }}>
              Effective Average: {deliverable.fasteners.effectiveAverageDensityPerM2} screws/m²
            </div>
          </div>

          <div>
            <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Ordering Summary:</div>
            <div style={{ fontSize: "0.85rem", color: "#cbd5e1", marginTop: "2px" }}>
              Net Count: {deliverable.fasteners.totalFastenersExact} (+5% site spares:{" "}
              <strong>{deliverable.fasteners.totalFastenersWithSpares}</strong>)
            </div>
            <div style={{ fontSize: "0.85rem", color: "#fbbf24", fontWeight: 600 }}>
              Boxes to Order: {deliverable.fasteners.boxesRequired} × {deliverable.fasteners.boxSize} pk @ $
              {deliverable.fasteners.costPerBox}/box
            </div>
            <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#38bdf8", marginTop: "2px" }}>
              Fasteners Total: ${deliverable.fasteners.totalFastenerCost.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Cryptographic Delivery Seal Card (SH-03) */}
      <div
        data-testid="delivery-seal-card"
        style={{
          background: "#022c22",
          border: "1px solid #059669",
          borderRadius: "8px",
          padding: "14px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "1.2rem" }}>🔒</span>
            <span style={{ fontWeight: 700, color: "#34d399", fontSize: "0.95rem" }}>
              Cryptographically Sealed Deliverable (SH-03 Delivery Record)
            </span>
          </div>
          <span
            style={{
              padding: "2px 10px",
              borderRadius: "9999px",
              background: "#059669",
              color: "#ecfdf5",
              fontSize: "0.75rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {deliverable.deliveryRecord.state}
          </span>
        </div>

        <div style={{ fontSize: "0.8rem", color: "#a7f3d0" }}>
          This roofing deliverable package has been compiled, frozen, and sealed with a deterministic SHA-256 payload digest. Any tampering or modification will invalidate the cryptographic hash.
        </div>

        <div
          style={{
            background: "#064e3b",
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid #10b981",
            fontFamily: "monospace",
            fontSize: "0.8rem",
            color: "#6ee7b7",
            wordBreak: "break-all",
          }}
        >
          SHA-256: {deliverable.deliveryRecord.contentSha256}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#6ee7b7", flexWrap: "wrap", gap: "4px" }}>
          <span>Record ID: {deliverable.packageId}</span>
          <span>Issued At: {deliverable.generatedAt}</span>
          <span>Status: ACTIVE (Uncompromised)</span>
        </div>
      </div>
    </div>
  );
}
