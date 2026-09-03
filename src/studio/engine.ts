/** Host-agnostic bridge — same contract as desktop/renderer/engine-client.js. */

export type XRayHost = "electron" | "tauri" | "web";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function detectHost(): XRayHost {
  if (typeof window === "undefined") return "web";
  const w = window as Window & {
    xray?: { runTakeoff?: (p: string) => Promise<unknown> };
  };
  if (w.xray?.runTakeoff) return "electron";
  if (isTauri()) return "tauri";
  return "web";
}

const PLAN_FILTER = {
  name: "Plans (PDF / DXF / SVG)",
  extensions: ["pdf", "dxf", "svg"],
};

export async function pickAndRunTakeoff(): Promise<{
  name: string;
  takeoff: unknown | null;
  note: string;
}> {
  const host = detectHost();
  if (host === "tauri") {
    const { invoke } = await import("@tauri-apps/api/core");
    let picked: string | null = await invoke("xray_pick_plan");
    if (!picked) {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const viaPlugin = await open({ multiple: false, filters: [PLAN_FILTER] });
      picked = !viaPlugin || Array.isArray(viaPlugin) ? null : String(viaPlugin);
    }
    if (!picked) return { name: "", takeoff: null, note: "cancelled" };
    const takeoff = await invoke("xray_run_takeoff", { pdfPath: picked });
    const name = String(picked).split(/[/\\]/).pop() || String(picked);
    return { name, takeoff, note: "engine" };
  }

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf,.pdf,.dxf,.svg,image/svg+xml";
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) {
        resolve({ name: "", takeoff: null, note: "cancelled" });
        return;
      }
      resolve({
        name: f.name,
        takeoff: null,
        note: "web preview — filename only; PDF engine runs in the Tauri shell",
      });
    };
    input.click();
  });
}
