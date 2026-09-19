import React, { useId, useMemo, useState } from "react";
import {
  calculateStockNesting,
  generateCutsFromRoofTakeoff,
  STANDARD_STOCK_LENGTHS,
  type NestingOptions,
  type NestingPlanSummary,
  type RequiredCut,
} from "./stockNesting.ts";
import type { RoofTakeoffSummary } from "./roofGeometry.ts";

export interface CuttingListPanelProps {
  takeoff?: RoofTakeoffSummary;
  disabled?: boolean;
}

const DEFAULT_SAMPLE_CUTS: RequiredCut[] = [
  { id: "c1", label: "North Rafter 1", lengthM: 4.85, planeId: "north" },
  { id: "c2", label: "North Rafter 2", lengthM: 4.85, planeId: "north" },
  { id: "c3", label: "North Rafter 3", lengthM: 4.85, planeId: "north" },
  { id: "c4", label: "North Rafter 4", lengthM: 4.85, planeId: "north" },
  { id: "c5", label: "South Rafter 1", lengthM: 3.65, planeId: "south" },
  { id: "c6", label: "South Rafter 2", lengthM: 3.65, planeId: "south" },
  { id: "c7", label: "East Hip Taper 1", lengthM: 2.95, planeId: "east" },
  { id: "c8", label: "East Hip Taper 2", lengthM: 2.15, planeId: "east" },
  { id: "c9", label: "East Hip Taper 3", lengthM: 1.45, planeId: "east" },
  { id: "c10", label: "West Hip Taper 1", lengthM: 2.95, planeId: "west" },
  { id: "c11", label: "West Hip Taper 2", lengthM: 2.15, planeId: "west" },
  { id: "c12", label: "West Hip Taper 3", lengthM: 1.45, planeId: "west" },
];

export function CuttingListPanel({ takeoff, disabled = false }: CuttingListPanelProps) {
  const prefix = useId();

  // Mode: "from-takeoff" | "sample" | "manual"
  const [sourceMode, setSourceMode] = useState<"from-takeoff" | "sample" | "manual">("from-takeoff");

  // Nesting options
  const [stockLengths, setStockLengths] = useState<number[]>([...STANDARD_STOCK_LENGTHS]);
  const [kerfMm, setKerfMm] = useState<number>(5.0);
  const [reusableThresholdM, setReusableThresholdM] = useState<number>(1.2);
  const [stockCostPerM, setStockCostPerM] = useState<number>(26.8);
  const [salvageRatePerM, setSalvageRatePerM] = useState<number>(14.5);

  // Manual cut list editing
  const [manualCuts, setManualCuts] = useState<RequiredCut[]>([...DEFAULT_SAMPLE_CUTS]);
  const [newCutLabel, setNewCutLabel] = useState("");
  const [newCutLength, setNewCutLength] = useState("");

  // Determine active cuts
  const activeCuts = useMemo<RequiredCut[]>(() => {
    if (sourceMode === "from-takeoff" && takeoff && takeoff.faces.length > 0) {
      return generateCutsFromRoofTakeoff(takeoff, 0.762);
    }
    if (sourceMode === "sample") {
      return DEFAULT_SAMPLE_CUTS;
    }
    return manualCuts;
  }, [sourceMode, takeoff, manualCuts]);

  // Execute Typesafe JEV nesting calculation
  const nestingSummary = useMemo<NestingPlanSummary>(() => {
    try {
      const opts: Partial<NestingOptions> = {
        availableStockLengthsM: stockLengths.length > 0 ? stockLengths : [...STANDARD_STOCK_LENGTHS],
        kerfMm,
        reusableOffcutThresholdM: reusableThresholdM,
        stockCostPerM,
        salvageRatePerM,
      };
      return calculateStockNesting(activeCuts, opts);
    } catch (err) {
      console.error("Nesting calculation error:", err);
      return {
        totalStockSheets: 0,
        totalStockLengthM: 0,
        totalRequiredCutLengthM: 0,
        totalKerfLossM: 0,
        totalReusableOffcutM: 0,
        totalScrapM: 0,
        netUtilizationPct: 0,
        grossUtilizationPct: 0,
        totalStockCost: 0,
        totalSalvageCredit: 0,
        netMaterialCost: 0,
        sheets: [],
      };
    }
  }, [activeCuts, stockLengths, kerfMm, reusableThresholdM, stockCostPerM, salvageRatePerM]);

  // Handlers for manual cut editing
  const handleAddCut = () => {
    const len = parseFloat(newCutLength);
    if (!newCutLabel.trim() || isNaN(len) || len <= 0) return;
    const newCut: RequiredCut = {
      id: `cut-manual-${Date.now()}`,
      label: newCutLabel.trim(),
      lengthM: Math.round(len * 1000) / 1000,
    };
    setManualCuts((prev) => [...prev, newCut]);
    setNewCutLabel("");
    setNewCutLength("");
  };

  const handleRemoveCut = (id: string) => {
    setManualCuts((prev) => prev.filter((c) => c.id !== id));
  };

  const toggleStockLength = (length: number) => {
    setStockLengths((prev) => {
      if (prev.includes(length)) {
        if (prev.length <= 1) return prev; // keep at least one
        return prev.filter((s) => s !== length);
      }
      return [...prev, length].sort((a, b) => a - b);
    });
  };

  return (
    <div
      className="cutting-list-panel"
      data-testid="cutting-list-panel"
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
      {/* Header & Source Selection */}
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
            Stock Sheet Layout, Kerf & Nesting (ROOF-04)
          </h3>
          <p style={{ margin: "3px 0 0 0", fontSize: "0.85rem", color: "#94a3b8" }}>
            Deterministic 1D multi-stock nesting with 5mm kerf allowance & 1.20m offcut salvage classification.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={() => setSourceMode("from-takeoff")}
            disabled={disabled || !takeoff || takeoff.faces.length === 0}
            style={{
              padding: "6px 12px",
              fontSize: "0.8rem",
              fontWeight: 600,
              borderRadius: "6px",
              border: "1px solid",
              borderColor: sourceMode === "from-takeoff" ? "#0284c7" : "#334155",
              background: sourceMode === "from-takeoff" ? "rgba(2, 132, 199, 0.25)" : "#0f172a",
              color: sourceMode === "from-takeoff" ? "#38bdf8" : "#cbd5e1",
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            From 3D Roof Model ({takeoff?.faces.length ?? 0} faces)
          </button>
          <button
            type="button"
            onClick={() => setSourceMode("sample")}
            disabled={disabled}
            style={{
              padding: "6px 12px",
              fontSize: "0.8rem",
              fontWeight: 600,
              borderRadius: "6px",
              border: "1px solid",
              borderColor: sourceMode === "sample" ? "#0284c7" : "#334155",
              background: sourceMode === "sample" ? "rgba(2, 132, 199, 0.25)" : "#0f172a",
              color: sourceMode === "sample" ? "#38bdf8" : "#cbd5e1",
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            Sample Preset (12 Cuts)
          </button>
          <button
            type="button"
            onClick={() => setSourceMode("manual")}
            disabled={disabled}
            style={{
              padding: "6px 12px",
              fontSize: "0.8rem",
              fontWeight: 600,
              borderRadius: "6px",
              border: "1px solid",
              borderColor: sourceMode === "manual" ? "#0284c7" : "#334155",
              background: sourceMode === "manual" ? "rgba(2, 132, 199, 0.25)" : "#0f172a",
              color: sourceMode === "manual" ? "#38bdf8" : "#cbd5e1",
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            Manual Custom List
          </button>
        </div>
      </div>

      {/* Configuration Strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1rem",
          background: "#0f172a",
          padding: "1rem",
          borderRadius: "8px",
          border: "1px solid #1e293b",
        }}
      >
        <div>
          <label style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8", marginBottom: "4px" }}>
            Available Stock Sizes
          </label>
          <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
            {STANDARD_STOCK_LENGTHS.map((len) => {
              const active = stockLengths.includes(len);
              return (
                <button
                  key={len}
                  type="button"
                  onClick={() => toggleStockLength(len)}
                  style={{
                    padding: "3px 8px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    borderRadius: "4px",
                    border: active ? "1px solid #38bdf8" : "1px solid #334155",
                    background: active ? "rgba(56, 189, 248, 0.2)" : "#1e293b",
                    color: active ? "#38bdf8" : "#64748b",
                    cursor: "pointer",
                  }}
                >
                  {len.toFixed(1)}m
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label
            htmlFor={`${prefix}-kerf`}
            style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8", marginBottom: "4px" }}
          >
            Blade Kerf Allowance (mm)
          </label>
          <input
            id={`${prefix}-kerf`}
            type="number"
            step="0.5"
            min="0"
            max="25"
            value={kerfMm}
            onChange={(e) => setKerfMm(parseFloat(e.target.value) || 0)}
            style={{
              width: "100%",
              padding: "5px 8px",
              fontSize: "0.8rem",
              background: "#1e293b",
              border: "1px solid #334155",
              color: "#f8fafc",
              borderRadius: "4px",
            }}
          />
        </div>

        <div>
          <label
            htmlFor={`${prefix}-offcut-thresh`}
            style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8", marginBottom: "4px" }}
          >
            Reusable Offcut Threshold (m)
          </label>
          <input
            id={`${prefix}-offcut-thresh`}
            type="number"
            step="0.1"
            min="0.5"
            max="3.0"
            value={reusableThresholdM}
            onChange={(e) => setReusableThresholdM(parseFloat(e.target.value) || 1.2)}
            style={{
              width: "100%",
              padding: "5px 8px",
              fontSize: "0.8rem",
              background: "#1e293b",
              border: "1px solid #334155",
              color: "#f8fafc",
              borderRadius: "4px",
            }}
          />
        </div>

        <div>
          <label
            htmlFor={`${prefix}-salvage-rate`}
            style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8", marginBottom: "4px" }}
          >
            Salvage Credit Rate ($/m)
          </label>
          <input
            id={`${prefix}-salvage-rate`}
            type="number"
            step="0.5"
            min="0"
            value={salvageRatePerM}
            onChange={(e) => setSalvageRatePerM(parseFloat(e.target.value) || 0)}
            style={{
              width: "100%",
              padding: "5px 8px",
              fontSize: "0.8rem",
              background: "#1e293b",
              border: "1px solid #334155",
              color: "#f8fafc",
              borderRadius: "4px",
            }}
          />
        </div>

        <div>
          <label
            htmlFor={`${prefix}-stock-cost`}
            style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8", marginBottom: "4px" }}
          >
            Stock Purchase Cost ($/m)
          </label>
          <input
            id={`${prefix}-stock-cost`}
            type="number"
            step="0.5"
            min="1"
            value={stockCostPerM}
            onChange={(e) => setStockCostPerM(parseFloat(e.target.value) || 26.8)}
            style={{
              width: "100%",
              padding: "5px 8px",
              fontSize: "0.8rem",
              background: "#1e293b",
              border: "1px solid #334155",
              color: "#f8fafc",
              borderRadius: "4px",
            }}
          />
        </div>
      </div>

      {/* KPI Takeoff Summary Grid */}
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
            Total Stock Ordered
          </span>
          <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "#38bdf8", marginTop: "2px" }}>
            {nestingSummary.totalStockSheets} sheets
          </div>
          <span style={{ fontSize: "0.75rem", color: "#cbd5e1" }}>
            {nestingSummary.totalStockLengthM.toFixed(2)} lineal metres
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
            Net Cut Length
          </span>
          <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "#f8fafc", marginTop: "2px" }}>
            {nestingSummary.totalRequiredCutLengthM.toFixed(2)} m
          </div>
          <span style={{ fontSize: "0.75rem", color: "#10b981", fontWeight: 600 }}>
            {nestingSummary.netUtilizationPct.toFixed(1)}% net yield
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
            Reusable Offcuts (≥1.2m)
          </span>
          <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "#34d399", marginTop: "2px" }}>
            {nestingSummary.totalReusableOffcutM.toFixed(2)} m
          </div>
          <span style={{ fontSize: "0.75rem", color: "#6ee7b7" }}>
            +${nestingSummary.totalSalvageCredit.toFixed(2)} salvage credit
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
            Scrap & Kerf Waste
          </span>
          <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "#f43f5e", marginTop: "2px" }}>
            {(nestingSummary.totalScrapM + nestingSummary.totalKerfLossM).toFixed(2)} m
          </div>
          <span style={{ fontSize: "0.75rem", color: "#fda4af" }}>
            {nestingSummary.totalKerfLossM.toFixed(3)}m kerf ({kerfMm}mm/cut)
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
            Net Material Cost
          </span>
          <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "#fbbf24", marginTop: "2px" }}>
            ${nestingSummary.netMaterialCost.toFixed(2)}
          </div>
          <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
            Gross: ${nestingSummary.totalStockCost.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Manual Cut Input Row (if manual mode selected) */}
      {sourceMode === "manual" && (
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            background: "#0f172a",
            padding: "0.75rem",
            borderRadius: "6px",
            border: "1px solid #334155",
            alignItems: "center",
          }}
        >
          <input
            type="text"
            placeholder="Cut label (e.g. Ridge Course 1)"
            value={newCutLabel}
            onChange={(e) => setNewCutLabel(e.target.value)}
            style={{
              flex: 2,
              padding: "6px 10px",
              fontSize: "0.8rem",
              background: "#1e293b",
              border: "1px solid #334155",
              color: "#f8fafc",
              borderRadius: "4px",
            }}
          />
          <input
            type="number"
            step="0.05"
            placeholder="Length (m)"
            value={newCutLength}
            onChange={(e) => setNewCutLength(e.target.value)}
            style={{
              flex: 1,
              padding: "6px 10px",
              fontSize: "0.8rem",
              background: "#1e293b",
              border: "1px solid #334155",
              color: "#f8fafc",
              borderRadius: "4px",
            }}
          />
          <button
            type="button"
            onClick={handleAddCut}
            style={{
              padding: "6px 14px",
              fontSize: "0.8rem",
              fontWeight: 600,
              background: "#0284c7",
              color: "#ffffff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Add Cut
          </button>
        </div>
      )}

      {/* Visual SVG Cutting Diagram */}
      <div
        className="cutting-diagram-container"
        data-testid="cutting-diagram-container"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          background: "#030712",
          padding: "1.25rem",
          borderRadius: "8px",
          border: "1px solid #1e293b",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#e2e8f0" }}>
            Visual Cutting Diagrams ({nestingSummary.sheets.length} Stock Sheets)
          </h4>
          <div style={{ display: "flex", gap: "1rem", fontSize: "0.75rem" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <span style={{ width: "12px", height: "12px", background: "#0284c7", borderRadius: "2px" }} />
              Required Cut
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <span style={{ width: "12px", height: "12px", background: "#ef4444", borderRadius: "2px" }} />
              5mm Kerf
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <span style={{ width: "12px", height: "12px", background: "#10b981", borderRadius: "2px" }} />
              Reusable Offcut (≥1.2m)
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <span style={{ width: "12px", height: "12px", background: "#7f1d1d", borderRadius: "2px" }} />
              Scrap Waste (&lt;1.2m)
            </span>
          </div>
        </div>

        {nestingSummary.sheets.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: "0.85rem", margin: "1rem 0" }}>
            No stock sheets required. Add cuts or load from 3D roof takeoff.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {nestingSummary.sheets.map((sheet) => {
              const stock = sheet.stockLengthM;
              return (
                <div
                  key={sheet.sheetIndex}
                  style={{
                    background: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: "6px",
                    padding: "10px",
                  }}
                >
                  {/* Sheet Header */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      marginBottom: "6px",
                      color: "#cbd5e1",
                    }}
                  >
                    <span>
                      <strong style={{ color: "#38bdf8" }}>Sheet #{sheet.sheetIndex + 1}</strong> —{" "}
                      {sheet.stockLengthM.toFixed(1)}m Stock ({sheet.cuts.length} cuts)
                    </span>
                    <span>
                      Yield:{" "}
                      <strong
                        style={{
                          color:
                            sheet.utilizationPct > 85
                              ? "#34d399"
                              : sheet.utilizationPct > 65
                                ? "#fbbf24"
                                : "#f87171",
                        }}
                      >
                        {sheet.utilizationPct.toFixed(1)}%
                      </strong>{" "}
                      | Net Cost: <strong>${sheet.netCost.toFixed(2)}</strong>
                    </span>
                  </div>

                  {/* SVG Bar Visualizer */}
                  <svg
                    width="100%"
                    height="44"
                    viewBox={`0 0 1000 44`}
                    preserveAspectRatio="none"
                    style={{
                      display: "block",
                      borderRadius: "4px",
                      overflow: "hidden",
                      background: "#1e293b",
                      border: "1px solid #475569",
                    }}
                  >
                    {/* Render Each Cut */}
                    {sheet.cuts.map((cut, idx) => {
                      const x1 = (cut.startOffsetM / stock) * 1000;
                      const w = (cut.lengthM / stock) * 1000;
                      const kerfX = (cut.endOffsetM / stock) * 1000;
                      const kerfW = ((cut.kerfOffsetM - cut.endOffsetM) / stock) * 1000;

                      return (
                        <g key={cut.cutId}>
                          {/* Cut Rectangle */}
                          <rect
                            x={x1}
                            y="4"
                            width={Math.max(2, w)}
                            height="36"
                            fill="#0284c7"
                            stroke="#0369a1"
                            strokeWidth="1"
                          />
                          {/* Label if wide enough */}
                          {w > 60 && (
                            <text
                              x={x1 + w / 2}
                              y="26"
                              fill="#ffffff"
                              fontSize="11"
                              fontWeight="600"
                              textAnchor="middle"
                              style={{ pointerEvents: "none" }}
                            >
                              {cut.lengthM.toFixed(2)}m ({cut.label.slice(0, 14)})
                            </text>
                          )}
                          {/* Kerf Divider */}
                          <rect
                            x={kerfX}
                            y="2"
                            width={Math.max(2, kerfW)}
                            height="40"
                            fill="#ef4444"
                            stroke="#b91c1c"
                            strokeWidth="1"
                          >
                            <title>5mm Blade Kerf</title>
                          </rect>
                        </g>
                      );
                    })}

                    {/* Render Offcut (Remainder) */}
                    {sheet.offcutLengthM > 0 && (() => {
                      const lastCut = sheet.cuts[sheet.cuts.length - 1];
                      const offcutStart = lastCut ? lastCut.kerfOffsetM : 0;
                      const offcutX = (offcutStart / stock) * 1000;
                      const offcutW = (sheet.offcutLengthM / stock) * 1000;
                      const isReusable = sheet.offcutClassification === "reusable";

                      return (
                        <g>
                          <rect
                            x={offcutX}
                            y="4"
                            width={Math.max(2, offcutW)}
                            height="36"
                            fill={isReusable ? "#059669" : "#7f1d1d"}
                            stroke={isReusable ? "#10b981" : "#991b1b"}
                            strokeWidth="1"
                            strokeDasharray={isReusable ? undefined : "3 3"}
                          />
                          {offcutW > 70 && (
                            <text
                              x={offcutX + offcutW / 2}
                              y="26"
                              fill={isReusable ? "#ecfdf5" : "#fecaca"}
                              fontSize="11"
                              fontWeight="700"
                              textAnchor="middle"
                              style={{ pointerEvents: "none" }}
                            >
                              {isReusable
                                ? `Reusable: ${sheet.offcutLengthM.toFixed(2)}m`
                                : `Scrap: ${sheet.offcutLengthM.toFixed(2)}m`}
                            </text>
                          )}
                        </g>
                      );
                    })()}
                  </svg>

                  {/* Sheet Cut Text Details */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.75rem",
                      color: "#94a3b8",
                      marginTop: "6px",
                    }}
                  >
                    <div>
                      {sheet.cuts.map((c) => `${c.label} (${c.lengthM.toFixed(2)}m)`).join(" + ")}
                      <span style={{ color: "#ef4444", marginLeft: "6px" }}>
                        +{sheet.cuts.length * kerfMm}mm kerf
                      </span>
                    </div>
                    <div>
                      {sheet.offcutClassification === "reusable" ? (
                        <span style={{ color: "#34d399", fontWeight: 600 }}>
                          Offcut: {sheet.offcutLengthM.toFixed(2)}m (Reusable Stock — Credit: $
                          {sheet.salvageCredit.toFixed(2)})
                        </span>
                      ) : (
                        <span style={{ color: "#f87171" }}>
                          Offcut: {sheet.offcutLengthM.toFixed(2)}m (Scrap Waste — $0.00 credit)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cutting Order Breakdown Table */}
      <div
        className="industry-table-wrap"
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
            Cutting Stock Takeoff & Offcut Allocation (Deterministic 1D-BFD)
          </caption>
          <thead>
            <tr style={{ background: "#1e293b", color: "#cbd5e1", textAlign: "left" }}>
              <th style={{ padding: "8px 10px" }}>Stock Sheet</th>
              <th style={{ padding: "8px 10px" }}>Stock (m)</th>
              <th style={{ padding: "8px 10px" }}>Cuts Included</th>
              <th style={{ padding: "8px 10px" }}>Cut Net (m)</th>
              <th style={{ padding: "8px 10px" }}>Kerf (mm)</th>
              <th style={{ padding: "8px 10px" }}>Offcut (m)</th>
              <th style={{ padding: "8px 10px" }}>Classification</th>
              <th style={{ padding: "8px 10px" }}>Net Cost</th>
            </tr>
          </thead>
          <tbody>
            {nestingSummary.sheets.map((s) => (
              <tr key={s.sheetIndex} style={{ borderBottom: "1px solid #1e293b" }}>
                <td style={{ padding: "8px 10px", fontWeight: 600, color: "#38bdf8" }}>
                  Sheet #{s.sheetIndex + 1}
                </td>
                <td style={{ padding: "8px 10px", color: "#f8fafc" }}>{s.stockLengthM.toFixed(1)}m</td>
                <td style={{ padding: "8px 10px", color: "#cbd5e1" }}>
                  {s.cuts.map((c) => c.label).join(", ")}
                </td>
                <td style={{ padding: "8px 10px", color: "#f8fafc" }}>{s.usedLengthM.toFixed(2)}</td>
                <td style={{ padding: "8px 10px", color: "#ef4444" }}>
                  {(s.kerfLossM * 1000).toFixed(0)}mm
                </td>
                <td
                  style={{
                    padding: "8px 10px",
                    fontWeight: 600,
                    color: s.offcutClassification === "reusable" ? "#34d399" : "#f87171",
                  }}
                >
                  {s.offcutLengthM.toFixed(2)}m
                </td>
                <td style={{ padding: "8px 10px" }}>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      background:
                        s.offcutClassification === "reusable"
                          ? "rgba(16, 185, 129, 0.2)"
                          : "rgba(244, 63, 94, 0.2)",
                      color: s.offcutClassification === "reusable" ? "#34d399" : "#fb7185",
                    }}
                  >
                    {s.offcutClassification.toUpperCase()}
                  </span>
                </td>
                <td style={{ padding: "8px 10px", fontWeight: 700, color: "#fbbf24" }}>
                  ${s.netCost.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: "#1e293b", fontWeight: 700, color: "#f8fafc" }}>
              <td style={{ padding: "8px 10px" }}>Total ({nestingSummary.totalStockSheets} sheets)</td>
              <td style={{ padding: "8px 10px" }}>{nestingSummary.totalStockLengthM.toFixed(1)}m</td>
              <td style={{ padding: "8px 10px" }}>{activeCuts.length} cuts</td>
              <td style={{ padding: "8px 10px" }}>{nestingSummary.totalRequiredCutLengthM.toFixed(2)}m</td>
              <td style={{ padding: "8px 10px", color: "#ef4444" }}>
                {(nestingSummary.totalKerfLossM * 1000).toFixed(0)}mm
              </td>
              <td style={{ padding: "8px 10px", color: "#34d399" }}>
                {nestingSummary.totalReusableOffcutM.toFixed(2)}m reuse
              </td>
              <td style={{ padding: "8px 10px" }}>
                {nestingSummary.totalScrapM.toFixed(2)}m scrap
              </td>
              <td style={{ padding: "8px 10px", color: "#fbbf24" }}>
                ${nestingSummary.netMaterialCost.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
