import { useState, useSyncExternalStore } from "react";
import { Bot, Camera, Download, Image as ImageIcon, Shield, Sliders } from "lucide-react";
import { useStudio } from "./store";
import { latestModelView, recordedModelView, matchingModelView, recordModelView, subscribeModelViews, type ModelViewSnapshot } from "./modelViewSnapshot";
import { McpChatDialog } from "./McpChatDialog";

const emptyView = () => null;
const cameraSummary = (snapshot: ModelViewSnapshot) => `${snapshot.camera.projection} · position ${snapshot.camera.position.map(value => value.toFixed(2)).join(", ")} · zoom ${snapshot.camera.zoom.toFixed(2)}`;

export function RenderStudio() {
  const s = useStudio();
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [mcpOpen, setMcpOpen] = useState(false);
  const materials = s.renderMaterials;
  const latest = useSyncExternalStore(subscribeModelViews, latestModelView, emptyView);
  const saved = useSyncExternalStore(subscribeModelViews, recordedModelView, emptyView);
  const source = s.activePlanBinary;
  const available = matchingModelView(latest, source?.documentId, source?.sha256);
  const captured = matchingModelView(saved, source?.documentId, source?.sha256);

  const handleCaptureCamera = () => {
    if (!source || !available) return;
    const view = recordModelView(source.documentId, source.sha256);
    setStatusMsg(`Model camera recorded: ${cameraSummary(view)}`);
  };

  const handleExportBrief = () => {
    if (!source || !captured) return;
    const brief = {
      kind: "xray-local-render-brief",
      planName: source.name,
      sourceDocumentId: source.documentId,
      sourceSha256: source.sha256,
      sheet: s.sheet + 1,
      camera: captured.camera,
      modelView: captured,
      appearanceDirection: materials,
      provider: null,
      renderStatus: "unavailable",
      note: "This local brief contains no generated image and makes no geometry-verification claim.",
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(brief, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `xray-render-brief-sheet-${s.sheet + 1}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatusMsg("Local camera/reference brief downloaded.");
  };

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
      <div>
        <div className="kicker">Camera / reference brief</div>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">Render</h1>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">
          Record the last source-matched Model camera and an appearance direction. This brief contains structured
          camera data and source identity. Image generation and reference-photo import are unavailable.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatusCard label="Verified plan bytes" value={s.activePlanBinary ? "Ready" : "Missing"} note={s.activePlanBinary?.name ?? "Open a plan first"} />
        <StatusCard label="Selected sheet" value={`Sheet ${s.sheet + 1}`} note="Local workbench selection" />
        <StatusCard label="Camera brief" value={captured ? "Recorded" : "Not recorded"} note={captured ? cameraSummary(captured) : "Visit Model with this source, then record its camera"} />
        <StatusCard label="Image renderer" value="Unavailable" note="No image renderer is implemented" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="pill inline-flex items-center gap-1.5" onClick={() => s.setPane("model")}>
          <Sliders className="size-3.5 text-cyan" /> Adjust Model camera
        </button>
        <button type="button" className="pill inline-flex items-center gap-1.5" onClick={handleCaptureCamera} disabled={!available} title={available ? "Record the last source-matched Model camera" : "Open this source in Model first"}>
          <Camera className="size-3.5 text-cyan" /> Record camera
        </button>
        <button type="button" className="pill inline-flex items-center gap-1.5" onClick={handleExportBrief} disabled={!captured}>
          <Download className="size-3.5 text-cyan" /> Download local brief
        </button>
        {statusMsg && captured && <span className="ml-2 font-mono text-xs text-cyan" role="status">{statusMsg}</span>}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <section className="flex min-h-[260px] flex-col rounded-2xl border border-line bg-card p-3.5">
          <div className="flex items-center justify-between border-b border-line pb-2 font-mono text-[11px]">
            <span className="uppercase tracking-wider text-muted">Model camera snapshot</span>
            <span className="text-cyan">{captured ? "RECORDED" : available ? "AVAILABLE" : "UNAVAILABLE"}</span>
          </div>
          <div className="mt-2 flex flex-1 flex-col items-center justify-center rounded-xl border border-line bg-navy p-6 text-center">
            <Camera className="mb-2 size-10 text-cyan" />
            <div className="text-sm font-medium text-paper">{captured ? "Model camera recorded" : "No camera recorded"}</div>
            <p className="mt-1 max-w-xs text-xs text-muted">{captured ? cameraSummary(captured) : available ? "The last Model view matches this source. Record it to include its exact camera in the brief." : "Open this source in Model, adjust the view, then return here to record it."}</p>
            {captured && <p className="mt-2 text-xs text-muted">Scene {captured.sceneId} · {new Date(captured.capturedAt).toLocaleTimeString()} · session snapshot</p>}
          </div>
        </section>

        <section className="flex min-h-[260px] flex-col rounded-2xl border border-line bg-card p-3.5">
          <div className="flex items-center justify-between border-b border-line pb-2 font-mono text-[11px]">
            <span className="uppercase tracking-wider text-muted">Generated output</span>
            <span className="text-muted">UNAVAILABLE</span>
          </div>
          <div className="mt-2 flex flex-1 flex-col items-center justify-center rounded-xl border border-line bg-navy p-6 text-center">
            <Shield className="mb-2 size-9 text-muted" />
            <div className="text-sm font-medium text-paper">Image renderer unavailable</div>
            <p className="mt-1 max-w-sm text-xs text-muted">This page exports a camera and appearance brief. It does not create an image.</p>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-line bg-card p-3.5">
        <div className="kicker">Appearance direction</div>
        <p className="mt-1 text-[11px] text-muted">These notes are saved only in the local brief. They do not change or verify geometry.</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <BriefField label="Roof" value={materials.roof} onChange={(value) => s.setRenderMaterial("roof", value)} />
          <BriefField label="Walls" value={materials.walls} onChange={(value) => s.setRenderMaterial("walls", value)} />
          <BriefField label="Windows" value={materials.windows} onChange={(value) => s.setRenderMaterial("windows", value)} />
          <BriefField label="Landscape" value={materials.landscaping} onChange={(value) => s.setRenderMaterial("landscaping", value)} />
          <BriefField label="Lighting" value={materials.lighting} onChange={(value) => s.setRenderMaterial("lighting", value)} />
          <BriefField label="Style" value={materials.style} onChange={(value) => s.setRenderMaterial("style", value)} />
        </div>
        <div className="mt-2">
          <BriefField label="Additional direction" value={materials.direction} onChange={(value) => s.setRenderMaterial("direction", value)} />
        </div>
      </section>

      <div className="flex flex-wrap gap-2" aria-label="Render actions and assistant tools">
        <button type="button" className="pill inline-flex items-center gap-1.5" disabled title="No reference-photo importer is connected">
          <ImageIcon className="size-3.5" /> Reference import unavailable
        </button>
        <button type="button" className="pill" disabled title="No image renderer is implemented">Generate unavailable</button>
        <button
          type="button"
          className="pill inline-flex items-center gap-1.5 border-cyan/50 text-cyan hover:border-cyan hover:bg-cyan/10 transition"
          onClick={() => setMcpOpen(true)}
          title="Open MCP Copilot & Chat (FastMCP connected)"
        >
          <Bot className="size-3.5 text-cyan" />
          <span>MCP Copilot & Chat</span>
          <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
        </button>
      </div>

      <McpChatDialog isOpen={mcpOpen} onClose={() => setMcpOpen(false)} />
    </div>
  );
}

function StatusCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-line bg-card p-3">
      <div className="kicker">{label}</div>
      <div className="mt-1 text-lg font-medium">{value}</div>
      <div className="truncate text-[11px] text-muted" title={note}>{note}</div>
    </div>
  );
}

function BriefField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-[10px] font-mono uppercase text-muted">
      {label}
      <input className="mt-0.5 w-full rounded border border-line bg-navy px-2.5 py-2 text-xs text-paper outline-none focus:border-cyan" type="text" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
