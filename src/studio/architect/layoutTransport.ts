import { layoutRequestSchema, layoutResultSchema, type LayoutRequest } from "./layoutAi";
export async function requestLayout(r: LayoutRequest, signal: AbortSignal) {
  layoutRequestSchema.parse(r);
  const raw = JSON.stringify(r);
  let run: any;
  if ("__TAURI_INTERNALS__" in window) {
    const { invoke } = await import("@tauri-apps/api/core"),
      cancel = () => {
        void invoke("xray_cancel_material_ai", { requestId: r.requestId });
      };
    signal.addEventListener("abort", cancel, { once: true });
    try {
      if (signal.aborted) throw Error("Cancelled");
      run = await invoke("xray_propose_architect_ai", { requestJson: raw });
    } finally {
      signal.removeEventListener("abort", cancel);
    }
  } else {
    const response = await fetch("/api/architect-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: raw,
      signal,
    });
    const body = await response.json();
    if (!response.ok) throw Error(body.error ?? "Layout proposal failed.");
    run = body.run;
  }
  const digest = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw))),
  )
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
  if (signal.aborted) throw Error("Cancelled; nothing saved.");
  if (
    run?.schema !== "xray.architect-ai/v1" ||
    run.id !== r.requestId ||
    run.projectId !== r.projectId ||
    run.designRevision !== r.designRevision ||
    run.requestDigest !== digest
  )
    throw Error("AI response does not match this design request.");
  return { ...run, result: layoutResultSchema.parse(run.result) };
}
