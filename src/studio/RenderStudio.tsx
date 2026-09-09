import { useState, useSyncExternalStore } from "react";
import { Bot, Camera, Download, Image as ImageIcon, Shield, Sliders } from "lucide-react";
import { useStudio } from "./store";
import { latestModelView, recordedModelView, matchingModelView, recordModelView, subscribeModelViews, type ModelViewSnapshot } from "./modelViewSnapshot";
import { McpChatDialog } from "./McpChatDialog";
import { clearLatestRender, latestRenderMatchesProject, useLatestRender } from "./assistant/renderTool";

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
  const latestRender = useLatestRender((state) => state.latest);
  const renderMatches = latestRenderMatchesProject(latestRender, s.job.id, source?.sha256);

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

  const handleDownloadRender = () => {
    if (!latestRender || !renderMatches) return;
    const [, base64 = ""] = latestRender.imageDataUrl.split(",", 2);
    const binary = atob(base64), bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    const url = URL.createObjectURL(new Blob([bytes], { type: latestRender.mimeType }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `xray-ai-render-sheet-${latestRender.view.sheet}.${latestRender.mimeType === "image/jpeg" ? "jpg" : latestRender.mimeType === "image/webp" ? "webp" : "png"}`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatusMsg("AI render image downloaded. It is an illustration, not evidence.");
  };

  return (
    <div className="render-workspace flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
      <div>
        <div className="kicker">Camera / reference brief</div>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">Render</h1>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">
          Record the last source-matched Model camera and an appearance direction. This brief contains structured
          camera data and source identity. This page does not generate images and reference-photo import is unavailable; the
          assistant's render tool can place an AI visualisation of a captured 3D view below when the operator has enabled it.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatusCard label="Verified plan bytes" value={s.activePlanBinary ? "Ready" : "Missing"} note={s.activePlanBinary?.name ?? "Open a plan first"} />
        <StatusCard label="Selected sheet" value={`Sheet ${s.sheet + 1}`} note="Local workbench selection" />
        <StatusCard label="Camera brief" value={captured ? "Recorded" : "Not recorded"} note={captured ? cameraSummary(captured) : "Visit Model with this source, then record its camera"} />
        <StatusCard label="Image renderer" value={renderMatches && latestRender ? "AI visualisation via assistant" : "Unavailable"} note={renderMatches && latestRender ? `${latestRender.model} · ${new Date(latestRender.at).toLocaleTimeString()} · session memory only` : "No image renderer is implemented on this page"} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="pill inline-flex items-center gap-1.5" onClick={() => s.setPane("model")}>
          <Sliders className="size-3.5 text-blue" /> Adjust Model camera
        </button>
        <button type="button" className="pill inline-flex items-center gap-1.5" onClick={handleCaptureCamera} disabled={!available} title={available ? "Record the last source-matched Model camera" : "Open this source in Model first"}>
          <Camera className="size-3.5 text-blue" /> Record camera
        </button>
        <button type="button" className="pill inline-flex items-center gap-1.5" onClick={handleExportBrief} disabled={!captured}>
          <Download className="size-3.5 text-blue" /> Download local brief
        </button>
        {statusMsg && (captured || latestRender !== null) && <span className="ml-2 font-mono text-xs text-blue" role="status">{statusMsg}</span>}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <section className="flex min-h-[260px] flex-col rounded-2xl border border-line bg-card p-3.5">
          <div className="flex items-center justify-between border-b border-line pb-2 font-mono text-[11px]">
            <span className="uppercase tracking-wider text-muted">Model camera snapshot</span>
            <span className="text-blue">{captured ? "RECORDED" : available ? "AVAILABLE" : "UNAVAILABLE"}</span>
          </div>
          <div className="mt-2 flex flex-1 flex-col items-center justify-center rounded-xl border border-line bg-paper p-6 text-center">
            <Camera className="mb-2 size-10 text-blue" />
            <div className="text-sm font-medium text-ink">{captured ? "Model camera recorded" : "No camera recorded"}</div>
            <p className="mt-1 max-w-xs text-xs text-muted">{captured ? cameraSummary(captured) : available ? "The last Model view matches this source. Record it to include its exact camera in the brief." : "Open this source in Model, adjust the view, then return here to record it."}</p>
            {captured && <p className="mt-2 text-xs text-muted">Scene {captured.sceneId} · {new Date(captured.capturedAt).toLocaleTimeString()} · session snapshot</p>}
          </div>
        </section>

        <section className="flex min-h-[260px] flex-col rounded-2xl border border-line bg-card p-3.5" aria-label="Latest AI render">
          <div className="flex items-center justify-between border-b border-line pb-2 font-mono text-[11px]">
            <span className="uppercase tracking-wider text-muted">Latest AI render</span>
            <span className={renderMatches ? "text-blue" : "text-muted"}>{renderMatches ? "AI VISUALISATION" : latestRender ? "OTHER PROJECT" : "NONE"}</span>
          </div>
          {latestRender && renderMatches ? (
            <div className="mt-2 flex flex-1 flex-col gap-2">
              <img className="max-h-[420px] w-full rounded-xl border border-line bg-paper object-contain" src={latestRender.imageDataUrl} alt="AI-generated visualisation of the captured 3D view" />
              <p className="text-[11px] leading-relaxed text-muted">{latestRender.provenance}</p>
              <p className="font-mono text-[11px] text-muted">
                Model {latestRender.model} · captured {latestRender.view.target} {latestRender.width}×{latestRender.height} frame {latestRender.view.frame} · sheet {latestRender.view.sheet}
                {" · "}{latestRender.sourceSha256 ? `source ${latestRender.sourceSha256.slice(0, 12)}` : latestRender.designRevision !== null ? `design revision ${latestRender.designRevision}` : "no source link"}
                {" · "}{new Date(latestRender.at).toLocaleTimeString()} · session memory only
              </p>
              <details className="text-[11px] text-muted">
                <summary className="cursor-pointer">Prompt sent{latestRender.text ? " and model note" : ""}</summary>
                <p className="mt-1 whitespace-pre-wrap break-words font-mono">{latestRender.promptUsed}</p>
                {latestRender.text && <p className="mt-1 whitespace-pre-wrap break-words">{latestRender.text}</p>}
              </details>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="pill inline-flex items-center gap-1.5" onClick={handleDownloadRender} title="Download the AI render image; it is an illustration, not evidence">
                  <Download className="size-3.5 text-blue" /> Download image
                </button>
                <button type="button" className="pill" onClick={() => { clearLatestRender(); setStatusMsg("AI render discarded from session memory."); }}>Discard</button>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex flex-1 flex-col items-center justify-center rounded-xl border border-line bg-paper p-6 text-center">
              <Shield className="mb-2 size-9 text-muted" />
              <div className="text-sm font-medium text-ink">{latestRender ? "Last render belongs to another project or source" : "No AI render in this session"}</div>
              <p className="mt-1 max-w-sm text-xs text-muted">{latestRender ? "It is kept in session memory only. Discard it or reopen the project it was generated for." : "This page exports a camera and appearance brief and does not create an image. With a Model or Sketch 3D view open, the assistant can generate an AI visualisation here when the operator has enabled the Gemini image model."}</p>
              {latestRender && <button type="button" className="pill mt-3" onClick={() => { clearLatestRender(); setStatusMsg("AI render discarded from session memory."); }}>Discard</button>}
            </div>
          )}
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
          className="pill inline-flex items-center gap-1.5 border-blue/50 text-blue hover:border-blue hover:bg-cyan/10 transition"
          onClick={() => setMcpOpen(true)}
          title="Open AI drawing tools and provider status"
        >
          <Bot className="size-3.5 text-blue" />
          <span>AI drawing tools</span>
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
      <input className="mt-0.5 w-full rounded border border-line bg-paper px-2.5 py-2 text-xs text-ink outline-none focus:border-blue" type="text" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
