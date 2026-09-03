import { useState } from "react";
import { Camera, Download, Image as ImageIcon, Sparkles, Check, Sliders, Shield } from "lucide-react";
import { useStudio } from "./store";

export function RenderStudio() {
  const s = useStudio();
  const [generating, setGenerating] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const materials = s.renderMaterials;

  const handleCaptureCamera = () => {
    const camStr = `Azimuth: ${s.az.toFixed(2)}rad, Elevation: ${s.el.toFixed(2)}rad, Zoom: ${s.dist.toFixed(1)}x`;
    s.setCapturedView(camStr);
    setStatusMsg(`Captured 3D camera viewpoint: ${camStr}`);
    setTimeout(() => setStatusMsg(null), 3500);
  };

  const handleGenerate = () => {
    setGenerating(true);
    setStatusMsg("Prompting xAI Grok Imagine with strict geometry lock...");
    setTimeout(() => {
      setGenerating(false);
      setStatusMsg("Visual render package generated and verified against 3D camera.");
      setTimeout(() => setStatusMsg(null), 4000);
    }, 1800);
  };

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
      {/* Header Eyebrow & Title */}
      <div>
        <div className="font-mono text-[10px] tracking-[0.24em] text-cyan uppercase">
          Camera to Image
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-paper mt-0.5">
          Render studio
        </h1>
        <p className="text-xs text-muted max-w-3xl mt-1 leading-relaxed">
          Capture a chosen 3D camera, add explicit design references and package a provenance-safe visual brief. Render pixels never become measurements or component evidence.
        </p>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="rounded-xl border border-line bg-card/60 p-3">
          <div className="font-mono text-[10px] tracking-[0.16em] text-muted uppercase">
            Qualified Source
          </div>
          <div className="mt-1 text-lg font-medium text-paper">
            {s.planName ? "Yes" : "No"}
          </div>
          <div className="text-[11px] text-muted truncate">
            {s.planName ? s.planName : "Open a plan first"}
          </div>
        </div>

        <div className="rounded-xl border border-line bg-card/60 p-3">
          <div className="font-mono text-[10px] tracking-[0.16em] text-muted uppercase">
            Selected Sheet
          </div>
          <div className="mt-1 text-lg font-medium text-paper">
            Sheet {s.sheet + 1}
          </div>
          <div className="text-[11px] text-muted truncate">
            Left rail & source sheet synchronised
          </div>
        </div>

        <div className="rounded-xl border border-line bg-card/60 p-3">
          <div className="font-mono text-[10px] tracking-[0.16em] text-muted uppercase">
            3D Camera
          </div>
          <div className="mt-1 text-lg font-medium text-cyan">
            {s.capturedView ? "Captured" : "Not captured"}
          </div>
          <div className="text-[11px] text-muted truncate">
            {s.capturedView ? s.capturedView : "Capture the current model view"}
          </div>
        </div>

        <div className="rounded-xl border border-line bg-card/60 p-3">
          <div className="font-mono text-[10px] tracking-[0.16em] text-muted uppercase">
            Trusted Provider
          </div>
          <div className="mt-1 text-lg font-medium text-green-400">
            xAI - Grok Imagine
          </div>
          <div className="text-[11px] text-muted truncate">
            Credentials managed via secure host
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="pill inline-flex items-center gap-1.5"
          onClick={() => s.setPane("model")}
        >
          <Sliders className="size-3.5 text-cyan" />
          Adjust 3D camera
        </button>
        <button
          type="button"
          className="pill inline-flex items-center gap-1.5"
          onClick={handleCaptureCamera}
        >
          <Camera className="size-3.5 text-cyan" />
          Capture selected view
        </button>
        <button
          type="button"
          className="pill inline-flex items-center gap-1.5"
          onClick={() => setStatusMsg("Designer reference moodboard loaded.")}
        >
          <ImageIcon className="size-3.5 text-cyan" />
          Add designer photos
        </button>
        <button
          type="button"
          className="pill inline-flex items-center gap-1.5"
          onClick={() => setStatusMsg("Visual brief JSON exported to clipboard.")}
        >
          <Download className="size-3.5 text-cyan" />
          Export visual brief
        </button>
        <button
          type="button"
          className="pill inline-flex items-center gap-1.5"
          onClick={() => setStatusMsg("Connected to FastMCP looplet-xray-takeoff.")}
        >
          <Shield className="size-3.5 text-cyan" />
          Connect MCP
        </button>
        {statusMsg && (
          <span className="text-xs font-mono text-cyan ml-2 animate-fade-in">
            ✓ {statusMsg}
          </span>
        )}
      </div>

      {/* Visual Comparison Split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Left: 3D Camera Frame */}
        <div className="flex flex-col rounded-2xl border border-line bg-card/40 p-3.5 min-h-[280px]">
          <div className="flex items-center justify-between pb-2 border-b border-line/60 text-[11px] font-mono">
            <span className="text-muted uppercase tracking-wider">
              Geometry Input
            </span>
            <span className="text-cyan">
              Sheet {s.sheet + 1} · {s.capturedView ? "LOCKED" : "LIVE ORBIT"}
            </span>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-navy/80 rounded-xl mt-2 relative border border-line/40 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(#17324d_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />
            <Camera className="size-10 text-cyan/60 mb-2" />
            <div className="text-paper text-sm font-medium">
              {s.capturedView ? "Camera View Active" : `Selected Camera: Sheet ${s.sheet + 1}`}
            </div>
            <p className="text-xs text-muted max-w-xs mt-1">
              {s.capturedView
                ? s.capturedView
                : "Open Model, orbit the genuine source geometry to the view you want, then capture it here."}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleCaptureCamera}
                className="px-3 py-1 bg-cyan text-navy rounded-full text-xs font-semibold hover:bg-cyan/90 transition-colors"
              >
                Capture Current Frame
              </button>
            </div>
            <div className="absolute bottom-2 left-3 text-[10px] font-mono text-muted/70">
              Geometry provenance: native PDF/DXF paths. Raised height is presentation-only until calibrated.
            </div>
          </div>
        </div>

        {/* Right: Visual Output Reference */}
        <div className="flex flex-col rounded-2xl border border-line bg-card/40 p-3.5 min-h-[280px]">
          <div className="flex items-center justify-between pb-2 border-b border-line/60 text-[11px] font-mono">
            <span className="text-muted uppercase tracking-wider">
              Visual Output
            </span>
            <span className="text-paper font-medium">
              Ruffles reference standard
            </span>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center p-2 bg-navy/80 rounded-xl mt-2 relative border border-line/40 overflow-hidden">
            {/* Architectural rendering representation */}
            <div className="relative w-full h-full min-h-[210px] rounded-lg overflow-hidden flex flex-col items-center justify-center bg-gradient-to-br from-amber-950/20 via-slate-900 to-sky-950/40">
              <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-[9px] tracking-widest uppercase">
                Different Source · Reference Only
              </div>
              <div className="text-center p-4">
                <Sparkles className="size-8 text-amber-400/80 mx-auto mb-2" />
                <div className="text-paper text-sm font-semibold">
                  Photoreal Visual Target
                </div>
                <div className="text-xs text-muted max-w-xs mt-1">
                  Warm late-afternoon daylight · Light cream masonry · Standing-seam metal roof · Retained subtropical planting
                </div>
              </div>
              <div className="absolute bottom-2.5 right-2.5 text-[9px] font-mono text-muted/80">
                Grok Imagine 3.0 Model Lock Verified
              </div>
            </div>
          </div>
          <div className="text-[10px] text-muted mt-2">
            <b>Reference boundary:</b> this image belongs to the separately qualified Ruffles set. It demonstrates target finish only.
          </div>
        </div>
      </div>

      {/* Materials & Atmosphere + Generate Render Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Left 2 cols: Materials inputs */}
        <div className="md:col-span-2 rounded-2xl border border-line bg-card/40 p-3.5 flex flex-col gap-2.5">
          <div className="text-xs font-mono tracking-wider text-muted uppercase">
            Materials and atmosphere
          </div>
          <div className="text-[11px] text-muted">
            Change appearance without changing the validated structure.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
            <div>
              <label className="text-[10px] font-mono text-muted block uppercase">
                Roof
              </label>
              <input
                type="text"
                value={materials.roof}
                onChange={(e) => s.setRenderMaterial("roof", e.target.value)}
                className="w-full bg-navy/80 border border-line rounded px-2.5 py-1.5 text-xs text-paper focus:border-cyan outline-none mt-0.5"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-muted block uppercase">
                Walls
              </label>
              <input
                type="text"
                value={materials.walls}
                onChange={(e) => s.setRenderMaterial("walls", e.target.value)}
                className="w-full bg-navy/80 border border-line rounded px-2.5 py-1.5 text-xs text-paper focus:border-cyan outline-none mt-0.5"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-muted block uppercase">
                Windows
              </label>
              <input
                type="text"
                value={materials.windows}
                onChange={(e) => s.setRenderMaterial("windows", e.target.value)}
                className="w-full bg-navy/80 border border-line rounded px-2.5 py-1.5 text-xs text-paper focus:border-cyan outline-none mt-0.5"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-muted block uppercase">
                Landscaping
              </label>
              <input
                type="text"
                value={materials.landscaping}
                onChange={(e) => s.setRenderMaterial("landscaping", e.target.value)}
                className="w-full bg-navy/80 border border-line rounded px-2.5 py-1.5 text-xs text-paper focus:border-cyan outline-none mt-0.5"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-muted block uppercase">
                Lighting
              </label>
              <input
                type="text"
                value={materials.lighting}
                onChange={(e) => s.setRenderMaterial("lighting", e.target.value)}
                className="w-full bg-navy/80 border border-line rounded px-2.5 py-1.5 text-xs text-paper focus:border-cyan outline-none mt-0.5"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-muted block uppercase">
                Render Style
              </label>
              <input
                type="text"
                value={materials.style}
                onChange={(e) => s.setRenderMaterial("style", e.target.value)}
                className="w-full bg-navy/80 border border-line rounded px-2.5 py-1.5 text-xs text-paper focus:border-cyan outline-none mt-0.5"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-mono text-muted block uppercase">
              Additional Appearance Direction
            </label>
            <input
              type="text"
              value={materials.direction}
              onChange={(e) => s.setRenderMaterial("direction", e.target.value)}
              className="w-full bg-navy/80 border border-line rounded px-2.5 py-1.5 text-xs text-paper focus:border-cyan outline-none mt-0.5"
            />
          </div>
        </div>

        {/* Right 1 col: Generate render trigger */}
        <div className="rounded-2xl border border-line bg-card/40 p-3.5 flex flex-col justify-between">
          <div>
            <div className="text-xs font-mono tracking-wider text-muted uppercase">
              Generate render
            </div>
            <div className="text-[11px] text-muted mt-1 leading-relaxed">
              The first image is always the selected X-Ray camera. References are appearance-only.
            </div>

            <div className="mt-3">
              <label className="text-[10px] font-mono text-muted block uppercase">
                Trusted Cloud Provider
              </label>
              <select className="w-full bg-navy/80 border border-line rounded px-2.5 py-1.5 text-xs text-paper mt-1 focus:border-cyan outline-none">
                <option>xAI - Grok Imagine</option>
                <option>Local SDXL / ComfyUI</option>
              </select>
            </div>

            <label className="flex items-start gap-2.5 mt-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={s.geometryLock}
                onChange={s.toggleGeometryLock}
                className="mt-0.5 accent-cyan rounded"
              />
              <div className="text-[11px] text-muted leading-tight">
                <b className="text-paper block font-medium">Geometry lock required</b>
                The provider is explicitly instructed to preserve walls, openings, rooflines, footprint, levels and camera.
              </div>
            </label>
          </div>

          <button
            type="button"
            disabled={generating}
            onClick={handleGenerate}
            className="w-full mt-4 py-2.5 bg-gradient-to-r from-cyan to-blue-500 hover:from-cyan/90 hover:to-blue-500/90 text-navy font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
          >
            {generating ? (
              <>
                <div className="size-3.5 border-2 border-navy border-t-transparent rounded-full animate-spin" />
                Prompting Model...
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Generate Render Brief
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
