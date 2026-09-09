export interface BlueprintSheetMetadata {
  projectTitle: string;
  phaseLabel: string;
  storeyLabel: string;
  elevationMetres: number;
  meshCount: number;
  totalMeshes: number;
  speed: number;
  dateStr?: string;
  sourceSha256?: string;
}

export interface BlueprintSheetResult {
  canvas: HTMLCanvasElement;
  dataUrl: string;
  download: (filename?: string) => void;
}

/**
 * Procedurally composits a classical architectural blueprint sheet
 * around the current 3D WebGL render framebuffer.
 */
export function createBlueprintSheet(
  sourceCanvas: HTMLCanvasElement,
  metadata: BlueprintSheetMetadata
): BlueprintSheetResult {
  const doc = sourceCanvas.ownerDocument || document;
  const canvas = doc.createElement("canvas");
  
  // High resolution blueprint sheet (16:10 ratio)
  const targetW = 1920;
  const targetH = 1200;
  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw Error("Failed to create 2D canvas rendering context for blueprint sheet.");
  }

  // 1. Classical Blueprint Prussian Blue background
  const bgGrad = ctx.createLinearGradient(0, 0, targetW, targetH);
  bgGrad.addColorStop(0, "#081524");
  bgGrad.addColorStop(0.5, "#0b1d33");
  bgGrad.addColorStop(1, "#071220");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, targetW, targetH);

  // 2. Blueprint Architectural Grid
  ctx.save();
  ctx.strokeStyle = "rgba(42, 88, 140, 0.22)";
  ctx.lineWidth = 1;
  const gridSize = 40;
  ctx.beginPath();
  for (let x = 0; x < targetW; x += gridSize) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, targetH);
  }
  for (let y = 0; y < targetH; y += gridSize) {
    ctx.moveTo(0, y);
    ctx.lineTo(targetW, y);
  }
  ctx.stroke();

  // Major grid lines every 200px
  ctx.strokeStyle = "rgba(70, 130, 195, 0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = 0; x < targetW; x += gridSize * 5) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, targetH);
  }
  for (let y = 0; y < targetH; y += gridSize * 5) {
    ctx.moveTo(0, y);
    ctx.lineTo(targetW, y);
  }
  ctx.stroke();
  ctx.restore();

  // 3. Precision Technical Frame & Border
  const margin = 40;
  const innerMargin = 48;
  ctx.save();
  ctx.strokeStyle = "#5a9ad6";
  ctx.lineWidth = 2.5;
  ctx.strokeRect(margin, margin, targetW - margin * 2, targetH - margin * 2);

  ctx.strokeStyle = "#326293";
  ctx.lineWidth = 1.0;
  ctx.strokeRect(innerMargin, innerMargin, targetW - innerMargin * 2, targetH - innerMargin * 2);

  // Corner registration ticks
  const tickLen = 20;
  ctx.strokeStyle = "#80b8ee";
  ctx.lineWidth = 2;
  const corners = [
    [margin - 10, margin - 10],
    [targetW - margin + 10, margin - 10],
    [margin - 10, targetH - margin + 10],
    [targetW - margin + 10, targetH - margin + 10],
  ];
  for (const [cx, cy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx - tickLen, cy);
    ctx.lineTo(cx + tickLen, cy);
    ctx.moveTo(cx, cy - tickLen);
    ctx.lineTo(cx, cy + tickLen);
    ctx.stroke();
  }
  ctx.restore();

  // 4. Draw 3D Viewport in Drawing Area
  const drawAreaX = innerMargin + 30;
  const drawAreaY = innerMargin + 30;
  const drawAreaW = targetW - innerMargin * 2 - 60;
  const drawAreaH = targetH - innerMargin * 2 - 190;

  if (sourceCanvas.width > 0 && sourceCanvas.height > 0) {
    ctx.save();
    // Maintain aspect ratio centered in draw area
    const scale = Math.min(drawAreaW / sourceCanvas.width, drawAreaH / sourceCanvas.height);
    const renderW = sourceCanvas.width * scale;
    const renderH = sourceCanvas.height * scale;
    const renderX = drawAreaX + (drawAreaW - renderW) / 2;
    const renderY = drawAreaY + (drawAreaH - renderH) / 2;

    // Draw blueprint glow underlay
    ctx.shadowColor = "rgba(90, 180, 255, 0.35)";
    ctx.shadowBlur = 25;
    ctx.drawImage(sourceCanvas, renderX, renderY, renderW, renderH);
    ctx.restore();
  }

  // 5. Left Elevation Benchmark Datum Ruler
  ctx.save();
  ctx.font = "bold 11px monospace";
  ctx.fillStyle = "#6faee8";
  ctx.strokeStyle = "rgba(100, 160, 220, 0.6)";
  ctx.lineWidth = 1;
  const rulerX = innerMargin + 25;
  const rulerTopY = innerMargin + 50;
  const rulerBottomY = drawAreaY + drawAreaH - 20;

  ctx.beginPath();
  ctx.moveTo(rulerX, rulerTopY);
  ctx.lineTo(rulerX, rulerBottomY);
  ctx.stroke();

  const totalSteps = 8;
  for (let i = 0; i <= totalSteps; i++) {
    const y = rulerBottomY - ((rulerBottomY - rulerTopY) * i) / totalSteps;
    const elev = (metadata.elevationMetres * (i / totalSteps)).toFixed(1);
    ctx.beginPath();
    ctx.moveTo(rulerX - 6, y);
    ctx.lineTo(rulerX + 6, y);
    ctx.stroke();
    ctx.fillText(`+${elev}m`, rulerX + 10, y + 4);
  }
  ctx.restore();

  // 6. Classical Architectural Title Block (Bottom-Right)
  const tbW = 560;
  const tbH = 150;
  const tbX = targetW - innerMargin - tbW - 10;
  const tbY = targetH - innerMargin - tbH - 10;

  ctx.save();
  // Title block container
  ctx.fillStyle = "rgba(10, 26, 46, 0.92)";
  ctx.fillRect(tbX, tbY, tbW, tbH);
  ctx.strokeStyle = "#5a9ad6";
  ctx.lineWidth = 2;
  ctx.strokeRect(tbX, tbY, tbW, tbH);

  // Compartment horizontal dividing lines
  ctx.strokeStyle = "rgba(90, 154, 214, 0.6)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tbX, tbY + 40);
  ctx.lineTo(tbX + tbW, tbY + 40);
  ctx.moveTo(tbX, tbY + 80);
  ctx.lineTo(tbX + tbW, tbY + 80);
  ctx.moveTo(tbX, tbY + 115);
  ctx.lineTo(tbX + tbW, tbY + 115);
  // Vertical dividing line
  ctx.moveTo(tbX + 340, tbY + 40);
  ctx.lineTo(tbX + 340, tbY + 115);
  ctx.stroke();

  // Title Block Header
  ctx.fillStyle = "#79b7f5";
  ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
  ctx.fillText("X-RAY BY LOOPLET · ARCHITECTURAL CAD STUDIO", tbX + 16, tbY + 25);
  ctx.font = "10px monospace";
  ctx.fillStyle = "#4882b8";
  ctx.fillText("ENGINE: MAGIC PENCIL 3D", tbX + tbW - 170, tbY + 25);

  // Row 1: Project & Sheet Title
  ctx.fillStyle = "#8dc2f8";
  ctx.font = "10px sans-serif";
  ctx.fillText("PROJECT RECONSTRUCTION:", tbX + 16, tbY + 54);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 14px system-ui, -apple-system, sans-serif";
  ctx.fillText(metadata.projectTitle, tbX + 16, tbY + 72, 308);

  ctx.fillStyle = "#8dc2f8";
  ctx.font = "10px sans-serif";
  ctx.fillText("DRAWING TITLE:", tbX + 355, tbY + 54);
  ctx.fillStyle = "#9ad2ff";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText("3D MODEL SNAPSHOT", tbX + 355, tbY + 72, 190);

  // Row 2: Phase, Storey Frontier & Progress
  ctx.fillStyle = "#8dc2f8";
  ctx.font = "10px sans-serif";
  ctx.fillText("DRAFTING STAGE & FRONTIER:", tbX + 16, tbY + 95);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 12px monospace";
  ctx.fillText(
    `${metadata.phaseLabel} · ${metadata.storeyLabel}`,
    tbX + 16,
    tbY + 109,
    308
  );

  ctx.fillStyle = "#8dc2f8";
  ctx.font = "10px sans-serif";
  ctx.fillText("MODEL PARTS:", tbX + 355, tbY + 95);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 12px monospace";
  ctx.fillText(`${metadata.meshCount} / ${metadata.totalMeshes} PARTS`, tbX + 355, tbY + 109);

  // Row 3: Date, Revision, Elevation
  const dateStr = metadata.dateStr || new Date().toISOString().slice(0, 10);
  ctx.fillStyle = "#7aa9d6";
  ctx.font = "10px monospace";
  ctx.fillText(`DATE: ${dateStr} · MODEL ELEVATION: ${metadata.elevationMetres.toFixed(2)}M`, tbX + 16, tbY + 128, 528);
  ctx.fillText("PREVIEW · NTS · NOT FOR CONSTRUCTION", tbX + 16, tbY + 143, 528);
  ctx.restore();

  // Perspective snapshots have no verified north direction or physical print scale.
  const dataUrl = canvas.toDataURL("image/png");

  const download = (filename?: string) => {
    const defaultName = `${metadata.projectTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-blueprint.png`;
    const link = doc.createElement("a");
    link.href = dataUrl;
    link.download = filename || defaultName;
    doc.body.appendChild(link);
    link.click();
    doc.body.removeChild(link);
  };

  return {
    canvas,
    dataUrl,
    download,
  };
}
