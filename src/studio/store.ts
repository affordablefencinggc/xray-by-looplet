import { create } from "zustand";
import { SHEETS, type SheetKind } from "./geometry";

export type Pane =
  | "overview"
  | "sheets"
  | "measure"
  | "sketch"
  | "components"
  | "model"
  | "render"
  | "review"
  | "cost"
  | "proof";

export type Tool = "none" | "length" | "area" | "count" | "sketch";

export type Markup = {
  id: string;
  kind: "length" | "area" | "count" | "sketch";
  label: string;
  value: number;
  unit: string;
  sheet: number;
  points: { x: number; y: number }[];
};

export type Trade = { id: string; name: string; note: string };

type StudioState = {
  pane: Pane;
  sheet: number;
  skin: "navy" | "paper";
  lifted: boolean;
  chromeHidden: boolean;
  showSrc: boolean;
  showBld: boolean;
  showRoof: boolean;
  showMan: boolean;
  pose: "standing" | "laid";
  cam: "plan" | "iso";
  height: number;
  az: number;
  el: number;
  dist: number;
  planName: string | null;
  takeoff: unknown | null;
  engineNote: string;
  scaleM: number;
  tool: Tool;
  pending: { x: number; y: number }[];
  markups: Markup[];
  trades: Trade[];
  capsOpen: boolean;
  rightCollapsed: boolean;
  zoom2d: number;
  pan2d: { x: number; y: number };
  snappingEnabled: boolean;
  floors: number;
  explodeFloors: number;
  activeFloor: number | null;
  showSurfaces: boolean;
  projectPreset: "wtc" | "highrise" | "fencing" | "ruffles";
  wtcLayers: { perimeter: boolean; core: boolean; floors: boolean };
  renderMaterials: {
    roof: string;
    walls: string;
    windows: string;
    landscaping: string;
    lighting: string;
    style: string;
    direction: string;
  };
  capturedView: string | null;
  geometryLock: boolean;
  setProjectPreset: (preset: "wtc" | "highrise" | "fencing" | "ruffles") => void;
  toggleWtcLayer: (layer: "perimeter" | "core" | "floors") => void;
  setRenderMaterial: (key: string, val: string) => void;
  setCapturedView: (val: string | null) => void;
  toggleGeometryLock: () => void;
  setPane: (pane: Pane) => void;
  setSheet: (sheet: number) => void;
  toggle: (k: "showSrc" | "showBld" | "showRoof" | "showMan" | "rightCollapsed" | "capsOpen" | "snappingEnabled" | "showSurfaces") => void;
  toggleSnapping: () => void;
  toggleSurfaces: () => void;
  setFloors: (floors: number) => void;
  setExplodeFloors: (val: number) => void;
  setActiveFloor: (floor: number | null) => void;
  setSkin: (skin: "navy" | "paper") => void;
  lift: () => void;
  hideChrome: () => void;
  stand: () => void;
  lay: () => void;
  setCam: (cam: "plan" | "iso") => void;
  fit: () => void;
  setOrbit: (az: number, el: number) => void;
  setDist: (dist: number) => void;
  setHeight: (h: number) => void;
  setScale: (m: number) => void;
  setTool: (t: Tool) => void;
  setZoom2d: (zoom: number) => void;
  setPan2d: (pan: { x: number; y: number }) => void;
  setPlanName: (name: string | null) => void;
  setPlan: (name: string, takeoff: unknown | null, note: string) => void;
  addPoint: (p: { x: number; y: number }) => void;
  commitPending: () => void;
  clearPending: () => void;
  removeMarkup: (id: string) => void;
  addTrade: (name: string) => void;
  removeTrade: (id: string) => void;
};

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function dist2(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function polyArea(pts: { x: number; y: number }[]) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    s += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(s) / 2;
}

export const useStudio = create<StudioState>((set, get) => ({
  pane: "model",
  sheet: 16,
  skin: "navy",
  lifted: false,
  chromeHidden: false,
  showSrc: true,
  showBld: true,
  showRoof: true,
  showMan: false,
  pose: "standing",
  cam: "iso",
  height: 0,
  az: -0.7,
  el: 0.35,
  dist: 1,
  planName: "Ruffles.pdf",
  takeoff: null,
  engineNote: "demo filename — PDF engine runs in the Tauri shell",
  scaleM: 1,
  tool: "none",
  pending: [],
  markups: [],
  trades: [],
  capsOpen: false,
  rightCollapsed: false,
  zoom2d: 1,
  pan2d: { x: 0, y: 0 },
  snappingEnabled: true,
  floors: 1,
  explodeFloors: 0,
  activeFloor: null,
  showSurfaces: true,
  projectPreset: "wtc",
  wtcLayers: { perimeter: true, core: true, floors: true },
  renderMaterials: {
    roof: "Standing-seam metal - warm white",
    walls: "Light cream masonry and restrained natural ac",
    windows: "Charcoal aluminium frames - clear glazing",
    landscaping: "Subtropical Australian planting - retained site i",
    lighting: "Warm late-afternoon daylight - physically plau",
    style: "Photoreal architectural visualisation",
    direction: "Optional finish, weather or presentation direction",
  },
  capturedView: null,
  geometryLock: true,
  setProjectPreset: (preset) => {
    if (preset === "wtc") {
      set({
        projectPreset: preset,
        planName: "WTC.DXF",
        floors: 110,
        pane: "model",
        cam: "iso",
        az: -0.75,
        el: 0.28,
        dist: 1.4,
      });
    } else if (preset === "highrise") {
      set({
        projectPreset: preset,
        planName: "191217_752 HIGH_FOR CONSTRUCTION L...",
        floors: 40,
        pane: "model",
        cam: "iso",
        az: -0.65,
        el: 0.32,
      });
    } else if (preset === "fencing") {
      set({
        projectPreset: preset,
        planName: "fencing-boundary.dxf",
        floors: 1,
        pane: "cost",
      });
    } else {
      set({
        projectPreset: "ruffles",
        planName: "10558 REV C - 356 RUFFLES RD, WILLOW...",
        floors: 1,
        pane: "model",
        sheet: 16,
      });
    }
  },
  toggleWtcLayer: (layer) =>
    set({
      wtcLayers: {
        ...get().wtcLayers,
        [layer]: !get().wtcLayers[layer],
      },
    }),
  setRenderMaterial: (key, val) =>
    set({
      renderMaterials: {
        ...get().renderMaterials,
        [key]: val,
      },
    }),
  setCapturedView: (val) => set({ capturedView: val }),
  toggleGeometryLock: () => set({ geometryLock: !get().geometryLock }),
  toggleSnapping: () => set({ snappingEnabled: !get().snappingEnabled }),
  toggleSurfaces: () => set({ showSurfaces: !get().showSurfaces }),
  setFloors: (floors) => set({ floors: Math.max(1, Math.min(100, floors)) }),
  setExplodeFloors: (val) => set({ explodeFloors: Math.max(0, Math.min(3, val)) }),
  setActiveFloor: (floor) => set({ activeFloor: floor }),
  setPane: (pane) => set({ pane, lifted: pane === "model" ? get().lifted : false, chromeHidden: false }),
  setSheet: (sheet) => {
    const kind: SheetKind = SHEETS[sheet]?.kind ?? "plan";
    if (kind === "elev") {
      set({ sheet, pose: "standing", cam: "iso", az: -0.7, el: 0.35 });
    } else {
      set({ sheet, pose: "laid", cam: "plan", az: -Math.PI / 2, el: 1.38 });
    }
  },
  toggle: (k) => set({ [k]: !get()[k] } as Partial<StudioState>),
  setSkin: (skin) => set({ skin }),
  lift: () =>
    set((s) => {
      if (!s.lifted) return { lifted: true, chromeHidden: false };
      if (!s.chromeHidden) return { chromeHidden: true };
      return { lifted: false, chromeHidden: false };
    }),
  hideChrome: () => set({ chromeHidden: !get().chromeHidden }),
  stand: () => set({ pose: "standing", cam: "iso", az: -0.7, el: 0.35 }),
  lay: () => set({ pose: "laid", cam: "plan", az: -Math.PI / 2, el: 1.38 }),
  setCam: (cam) =>
    set(
      cam === "plan"
        ? { cam, az: -Math.PI / 2, el: 1.38, pose: "laid" }
        : { cam, az: -0.7, el: 0.35, pose: "standing" },
    ),
  fit: () =>
    set({
      dist: 1,
      az: get().cam === "plan" ? -Math.PI / 2 : -0.7,
      el: get().cam === "plan" ? 1.38 : 0.35,
      zoom2d: 1,
      pan2d: { x: 0, y: 0 },
    }),
  setOrbit: (az, el) => set({ az, el }),
  setDist: (dist) => set({ dist }),
  setHeight: (h) => set({ height: h }),
  setScale: (m) => set({ scaleM: Math.max(0.001, m) }),
  setTool: (t) => set({ tool: t, pending: [] }),
  setZoom2d: (zoom2d) => set({ zoom2d }),
  setPan2d: (pan2d) => set({ pan2d }),
  setPlanName: (name) => set({ planName: name }),
  setPlan: (name, takeoff, note) => set({ planName: name, takeoff, engineNote: note }),
  addPoint: (p) => {
    const { tool, pending, sheet, scaleM, markups } = get();
    if (tool === "count") {
      set({
        markups: [
          ...markups,
          {
            id: uid(),
            kind: "count",
            label: "Count",
            value: 1,
            unit: "ea",
            sheet,
            points: [p],
          },
        ],
      });
      return;
    }
    const next = [...pending, p];
    if (tool === "length" && next.length === 2) {
      const metres = dist2(next[0], next[1]) * scaleM;
      set({
        pending: [],
        markups: [
          ...markups,
          {
            id: uid(),
            kind: "length",
            label: "Length",
            value: metres,
            unit: "m",
            sheet,
            points: next,
          },
        ],
      });
      return;
    }
    set({ pending: next });
  },
  commitPending: () => {
    const { tool, pending, sheet, scaleM, markups } = get();
    if (tool === "area" && pending.length >= 3) {
      set({
        pending: [],
        markups: [
          ...markups,
          {
            id: uid(),
            kind: "area",
            label: "Area",
            value: polyArea(pending) * scaleM * scaleM,
            unit: "m²",
            sheet,
            points: pending,
          },
        ],
      });
      return;
    }
    if (tool === "sketch" && pending.length >= 2) {
      const metres = pending.slice(1).reduce((acc, pt, i) => acc + dist2(pending[i], pt) * scaleM, 0);
      set({
        pending: [],
        markups: [
          ...markups,
          {
            id: uid(),
            kind: "sketch",
            label: "Manual trace",
            value: metres,
            unit: "m",
            sheet,
            points: pending,
          },
        ],
      });
    }
  },
  clearPending: () => set({ pending: [] }),
  removeMarkup: (id) => set({ markups: get().markups.filter((m) => m.id !== id) }),
  addTrade: (name) => {
    const n = name.trim();
    if (!n) return;
    set({ trades: [...get().trades, { id: uid(), name: n, note: "Open-ended — from this sheet, not a default pack" }] });
  },
  removeTrade: (id) => set({ trades: get().trades.filter((t) => t.id !== id) }),
}));
