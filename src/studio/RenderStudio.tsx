import { useState } from "react";
import { Camera, Download, Image as ImageIcon, Shield, Sliders } from "lucide-react";
import { useStudio } from "./store";

export function RenderStudio() {
  const s = useStudio();
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const materials = s.renderMaterials;

  const handleCaptureCamera = () => {
    const camera = `Azimuth: ${s.az.toFixed(2)}rad, Elevation: ${s.el.toFixed(2)}rad, Zoom: ${s.dist.toFixed(1)}x`;
    s.setCapturedView(camera);
    setStatusMsg(`Local camera recorded: ${camera}`);
  };

  const handleExportBrief = () => {
    const brief = {
      kind: "xray-local-render-brief",
      planName: s.activePlanBinary?.name ?? null,
      sheet: s.sheet + 1,
      camera: s.capturedView,
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
          Record a local camera and appearance direction. No image provider, reference-photo importer, MCP connection,
          or generated render is available in this build.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatusCard label="Verified plan bytes" value={s.activePlanBinary ? "Ready" : "Missing"} note={s.activePlanBinary?.name ?? "Open a plan first"} />
        <StatusCard label="Selected sheet" value={`Sheet ${s.sheet + 1}`} note="Local workbench selection" />
        <StatusCard label="Camera brief" value={s.capturedView ? "Recorded" : "Not recorded"} note={s.capturedView ?? "Capture the current model view"} />
        <StatusCard label="Render provider" value="Unavailable" note="No authenticated provider is connected" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="pill inline-flex items-center gap-1.5" onClick={() => s.setPane("model")}>
          <Sliders className="size-3.5 text-cyan" /> Adjust local camera
        </button>
        <button type="button" className="pill inline-flex items-center gap-1.5" onClick={handleCaptureCamera}>
          <Camera className="size-3.5 text-cyan" /> Record camera
        </button>
        <button type="button" className="pill inline-flex items-center gap-1.5" onClick={handleExportBrief}>
          <Download className="size-3.5 text-cyan" /> Download local brief
        </button>
        {statusMsg && <span className="ml-2 font-mono text-xs text-cyan" role="status">{statusMsg}</span>}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <section className="flex min-h-[260px] flex-col rounded-2xl border border-line bg-card p-3.5">
          <div className="flex items-center justify-between border-b border-line pb-2 font-mono text-[11px]">
            <span className="uppercase tracking-wider text-muted">Local camera</span>
            <span className="text-cyan">{s.capturedView ? "RECORDED" : "LIVE"}</span>
          </div>
          <div className="mt-2 flex flex-1 flex-col items-center justify-center rounded-xl border border-line bg-navy p-6 text-center">
            <Camera className="mb-2 size-10 text-cyan" />
            <div className="text-sm font-medium text-paper">{s.capturedView ? "Camera parameters recorded" : "No camera recorded"}</div>
            <p className="mt-1 max-w-xs text-xs text-muted">{s.capturedView ?? "Adjust the wireframe in Model, then record its local camera parameters."}</p>
          </div>
        </section>

        <section className="flex min-h-[260px] flex-col rounded-2xl border border-line bg-card p-3.5">
          <div className="flex items-center justify-between border-b border-line pb-2 font-mono text-[11px]">
            <span className="uppercase tracking-wider text-muted">Generated output</span>
            <span className="text-muted">UNAVAILABLE</span>
          </div>
          <div className="mt-2 flex flex-1 flex-col items-center justify-center rounded-xl border border-line bg-navy p-6 text-center">
            <Shield className="mb-2 size-9 text-muted" />
            <div className="text-sm font-medium text-paper">No provider connected</div>
            <p className="mt-1 max-w-sm text-xs text-muted">A production render requires an authenticated provider, an explicit request, and a returned asset with provenance.</p>
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

      <div className="flex flex-wrap gap-2" aria-label="Unavailable render actions">
        <button type="button" className="pill inline-flex items-center gap-1.5" disabled title="No reference-photo importer is connected">
          <ImageIcon className="size-3.5" /> Reference import unavailable
        </button>
        <button type="button" className="pill" disabled title="No authenticated render provider is connected">Generate unavailable</button>
        <button type="button" className="pill" disabled title="No MCP transport is connected">MCP unavailable</button>
      </div>
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
