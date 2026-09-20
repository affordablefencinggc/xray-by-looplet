import fs from "node:fs";
import path from "node:path";

console.log("Reading input files...");
const closeoutLedger = fs.readFileSync("XRAY-PRODUCTION-CLOSEOUT-LEDGER.md", "utf8");
const proofBranch = closeoutLedger.match(/^Current execution branch: `([^`]+)`/m)?.[1] ?? closeoutLedger.match(/^Baseline branch: `([^`]+)`/m)?.[1] ?? "Unrecorded";
const azChecklist = fs.readFileSync("PROFESSIONAL-A-Z-CHECKLIST.md", "utf8");
const curatedImages = JSON.parse(fs.readFileSync("dashboard-curated-images.json", "utf8"));

// 1. Parse Closeout Slices. This is deliberately line-oriented: each ledger
// field ends at the next field marker, so a DONE section can never swallow the
// Files, Proof, Depends on, or Commit heading that follows it.
const slices = [];
let currentPortion = { number: 0, title: "Unassigned" };
let currentSlice = null;

function parseLedgerFields(body) {
  const fields = new Map();
  let currentField = null;
  for (const line of body.split(/\r?\n/)) {
    const fieldHeading = line.match(/^\*\s+\*\*([^*]+)\*\*:\s*(.*)$/);
    if (fieldHeading) {
      currentField = fieldHeading[1].trim();
      fields.set(currentField, [fieldHeading[2]]);
      continue;
    }
    if (/^#{1,6}\s|^---\s*$/.test(line)) {
      currentField = null;
      continue;
    }
    if (currentField) fields.get(currentField).push(line);
  }
  return new Map([...fields].map(([key, lines]) => [key, lines.join("\n").trim()]));
}

function parseFileList(value) {
  return value.split(/\r?\n/).map(line => {
    const cleaned = line.replace(/^\s*-\s*/, "").trim();
    return cleaned.match(/`([^`]+)`/)?.[1] ?? cleaned;
  }).filter(Boolean);
}

function finishSlice() {
  if (!currentSlice) return;
  const fields = parseLedgerFields(currentSlice.body.join("\n"));
  const completedValue = fields.get("Completed") ?? "";
  const completedMatch = completedValue.match(/(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})?)?)/);
  const humanField = fields.has("DONE (human)") ? "DONE (human)"
    : fields.has("NOT DONE (human)") ? "NOT DONE (human)"
      : "";
  slices.push({
    id: currentSlice.id,
    title: currentSlice.title,
    status: currentSlice.status,
    portionNumber: currentSlice.portion.number,
    portion: `Portion ${currentSlice.portion.number}: ${currentSlice.portion.title}`,
    goal: fields.get("Goal") ?? "",
    machineDone: fields.get("DONE (machine)") ?? "",
    humanDone: humanField ? fields.get(humanField) : "",
    humanGateOpen: humanField === "NOT DONE (human)",
    proof: fields.get("Proof") ?? fields.get("Machine evidence") ?? "",
    files: parseFileList(fields.get("Files") ?? ""),
    blockedNote: [...fields]
      .filter(([name]) => /^BLOCKED/i.test(name))
      .map(([, value]) => value)
      .join("\n"),
    completedAt: completedMatch?.[1] ?? "",
    images: curatedImages.filter(image => image.slice === currentSlice.id),
  });
  currentSlice = null;
}

for (const line of closeoutLedger.split(/\r?\n/)) {
  const portionHeading = line.match(/^###\s+PORTION\s+(\d+):\s+(.+)$/);
  if (portionHeading) {
    finishSlice();
    currentPortion = { number: Number(portionHeading[1]), title: portionHeading[2].trim() };
    continue;
  }
  const sliceHeading = line.match(/^####\s+(SC-\d+)\s+[—-]\s+(.+?)\s+`\[\[(done|partial|pending|blocked)\]\]`\s*$/i);
  if (sliceHeading) {
    finishSlice();
    currentSlice = {
      id: sliceHeading[1],
      title: sliceHeading[2],
      status: sliceHeading[3].toLowerCase(),
      portion: { ...currentPortion },
      body: [],
    };
    continue;
  }
  if (currentSlice && /^##\s+/.test(line)) {
    finishSlice();
    continue;
  }
  if (currentSlice) currentSlice.body.push(line);
}
finishSlice();

console.log(`Parsed ${slices.length} closeout slices.`);

// 2. Parse A-Z Checklist Categories and Rows
const azLines = azChecklist.split("\n");
const categories = [];
let currentCat = null;
const allRequirements = [];

for (const line of azLines) {
  const catMatch = line.match(/^###\s+([A-Z]|SO|PH)\s+[—-]\s+(.*)/);
  if (catMatch) {
    if (currentCat) categories.push(currentCat);
    currentCat = {
      code: catMatch[1],
      name: catMatch[2].trim(),
      rows: []
    };
    continue;
  }

  const rowMatch = line.match(/^-\s+\[([ xX])\]\s+\*\*([A-Z0-9-]+)\s+(.*?)\*\*\s+[—-]\s+([\s\S]*)/);
  if (rowMatch && currentCat) {
    const isChecked = rowMatch[1].toLowerCase() === "x";
    const reqId = rowMatch[2];
    const reqTitle = rowMatch[3];
    const desc = rowMatch[4].trim();

    // Determine state
    let state = "gap";
    if (/State:\s*verified/i.test(desc) || isChecked) state = "verified";
    else if (/State:\s*partial/i.test(desc)) state = "partial";
    else if (/State:\s*dependency-blocked/i.test(desc)) state = "dependency-blocked";
    else if (/State:\s*failed/i.test(desc)) state = "failed";
    else if (/State:\s*gap/i.test(desc)) state = "gap";

    const rowObj = {
      id: reqId,
      title: reqTitle,
      category: currentCat.code,
      categoryName: currentCat.name,
      description: desc,
      state
    };
    currentCat.rows.push(rowObj);
    allRequirements.push(rowObj);
  }
}
if (currentCat) categories.push(currentCat);

console.log(`Parsed ${categories.length} A-Z categories with ${allRequirements.length} requirements.`);

// Summary stats. The test and suite figures are read from the ledger's own
// recorded test-count line rather than typed in here, because a hardcoded number
// is a fabricated measurement wearing the shape of a result: it stays right for
// exactly as long as nobody adds a test, and then quietly lies.
const currentGateLine = closeoutLedger.match(/^\*\*Last executed machine gate\*\*:\s*(.+)$/im)?.[1] ?? "";
const testsMatch = currentGateLine.match(/([\d,]+)\s*\/\s*([\d,]+)\s+passing\b/i);
const suitesMatch = currentGateLine.match(/\bacross\s+([\d,]+)\s+suites\b/i);
if (!testsMatch) console.warn("No explicit current machine-gate count found; test KPIs will be marked unknown.");
const stats = {
  slicesTotal: slices.length,
  slicesDone: slices.filter(s => s.status === "done").length,
  slicesPartial: slices.filter(s => s.status === "partial").length,
  slicesBlocked: slices.filter(s => s.status === "blocked").length,
  slicesPending: slices.filter(s => s.status === "pending").length,
  testsPassing: testsMatch ? Number(testsMatch[1].replaceAll(",", "")) : null,
  testsTotal: testsMatch ? Number(testsMatch[2].replaceAll(",", "")) : null,
  testSuites: suitesMatch ? Number(suitesMatch[1].replaceAll(",", "")) : null,
  tscStatus: /(?:tsc|typescript|typecheck)[^\n;]*exit\s+0/i.test(currentGateLine) ? "Clean (Exit 0)" : "Not recorded",
  azTotal: allRequirements.length,
  azVerified: allRequirements.filter(r => r.state === "verified").length,
  azPartial: allRequirements.filter(r => r.state === "partial").length,
  azBlocked: allRequirements.filter(r => r.state === "dependency-blocked").length,
  azFailed: allRequirements.filter(r => r.state === "failed").length,
  azGaps: allRequirements.filter(r => r.state === "gap").length,
  totalScreenshots: curatedImages.length
};

const portions = [...new Map(slices.map(slice => [slice.portionNumber, slice.portion])).entries()]
  .map(([number, label]) => ({ number, label, count: slices.filter(slice => slice.portionNumber === number).length }))
  .sort((a, b) => a.number - b.number);
const galleryCategories = [...new Set(curatedImages.map(image => image.category))]
  .sort((a, b) => a.localeCompare(b));
const azStates = ["verified", "partial", "dependency-blocked", "gap", "failed"];

console.log("Stats:", stats);

// Now generate HTML
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>X-Ray Architectural CAD & Takeoff — Interactive Status & Proof Ledger</title>
  <link rel="icon" type="image/svg+xml" href="public/favicon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-base: #0a0e14;
      --bg-surface: #111722;
      --bg-surface-elevated: #182130;
      --bg-card: #141c28;
      --border-subtle: #1f2c3f;
      --border-focus: #3b82f6;
      
      --text-main: #f1f5f9;
      --text-muted: #94a3b8;
      --text-dim: #91a1b7;
      
      --accent-emerald: #10b981;
      --accent-emerald-glow: rgba(16, 185, 129, 0.2);
      --accent-amber: #f59e0b;
      --accent-amber-glow: rgba(245, 158, 11, 0.2);
      --accent-blue: #3b82f6;
      --accent-blue-glow: rgba(59, 130, 246, 0.2);
      --accent-purple: #8b5cf6;
      --accent-crimson: #ef4444;
      --accent-cyan: #06b6d4;

      --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      --font-heading: 'Outfit', sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    button,
    input {
      min-height: 44px;
    }

    button:focus-visible,
    input:focus-visible,
    a:focus-visible {
      outline: 3px solid #93c5fd;
      outline-offset: 3px;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    [hidden] {
      display: none !important;
    }

    body {
      background-color: var(--bg-base);
      color: var(--text-main);
      font-family: var(--font-sans);
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      padding-bottom: 80px;
    }

    /* HEADER */
    header {
      background: linear-gradient(180deg, #131c2a 0%, #0a0e14 100%);
      border-bottom: 1px solid var(--border-subtle);
      padding: 32px 40px 24px;
      position: sticky;
      top: 0;
      z-index: 100;
      backdrop-filter: blur(12px);
    }

    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 20px;
      margin-bottom: 24px;
    }

    .title-group h1 {
      font-family: var(--font-heading);
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.02em;
      background: linear-gradient(90deg, #ffffff, #93c5fd);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .badge-branch {
      background: rgba(59, 130, 246, 0.15);
      color: #60a5fa;
      border: 1px solid rgba(59, 130, 246, 0.3);
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 6px;
      letter-spacing: 0;
      -webkit-text-fill-color: #60a5fa;
    }

    .title-group p {
      color: var(--text-muted);
      font-size: 14px;
      margin-top: 6px;
    }

    .meta-pills {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .pill {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 500;
      color: var(--text-muted);
    }

    .pill-green {
      border-color: rgba(16, 185, 129, 0.4);
      color: #34d399;
      background: rgba(16, 185, 129, 0.08);
    }

    .pill-blue {
      border-color: rgba(59, 130, 246, 0.4);
      color: #60a5fa;
      background: rgba(59, 130, 246, 0.08);
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
      box-shadow: 0 0 8px currentColor;
    }

    /* KPI CARDS */
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .kpi-card {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      padding: 16px 20px;
      position: relative;
      overflow: hidden;
      transition: border-color 0.2s, transform 0.2s;
    }

    .kpi-card:hover {
      border-color: var(--border-focus);
      transform: translateY(-2px);
    }

    .kpi-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-dim);
      font-weight: 600;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
    }

    .kpi-value {
      font-family: var(--font-heading);
      font-size: 26px;
      font-weight: 700;
      color: #fff;
    }

    .kpi-sub {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 4px;
    }

    /* CONTROLS: TABS & SEARCH */
    .nav-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }

    .tabs {
      display: flex;
      gap: 8px;
      background: var(--bg-surface);
      padding: 4px;
      border-radius: 10px;
      border: 1px solid var(--border-subtle);
      overflow-x: auto;
    }

    .tab-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-family: var(--font-sans);
      font-size: 13px;
      font-weight: 600;
      padding: 10px 18px;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
      white-space: nowrap;
    }

    .tab-btn:hover {
      color: var(--text-main);
      background: rgba(255, 255, 255, 0.04);
    }

    .tab-btn.active {
      background: var(--bg-surface-elevated);
      color: #fff;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
      border: 1px solid var(--border-subtle);
    }

    .tab-badge {
      background: rgba(255, 255, 255, 0.1);
      padding: 2px 7px;
      border-radius: 9999px;
      font-size: 11px;
    }

    .search-box {
      position: relative;
      min-width: 280px;
    }

    .search-input {
      width: 100%;
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      color: #fff;
      font-family: var(--font-sans);
      font-size: 13px;
      padding: 10px 14px 10px 40px;
      border-radius: 8px;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .search-input:focus {
      border-color: var(--border-focus);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
    }

    .search-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-dim);
      font-size: 14px;
    }

    /* MAIN CONTENT */
    main {
      max-width: 1560px;
      margin: 0 auto;
      padding: 32px 40px;
    }

    .tab-content {
      display: none;
    }

    .tab-content.active {
      display: block;
    }

    /* FILTER BAR */
    .filter-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border-subtle);
    }

    .filter-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-right: 6px;
    }

    .filter-chip {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      color: var(--text-muted);
      font-size: 12px;
      font-weight: 500;
      padding: 8px 14px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .filter-chip:hover {
      color: #fff;
      border-color: var(--border-focus);
    }

    .filter-chip.active {
      background: rgba(59, 130, 246, 0.15);
      border-color: var(--accent-blue);
      color: #93c5fd;
      font-weight: 600;
    }

    /* SLICE CARDS */
    .slices-grid {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .portion-header {
      margin-top: 24px;
      margin-bottom: 12px;
      padding-left: 4px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .portion-title {
      font-family: var(--font-heading);
      font-size: 17px;
      font-weight: 700;
      color: #e2e8f0;
    }

    .slice-card {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      overflow: hidden;
      transition: all 0.2s;
    }

    .slice-card:hover {
      border-color: #334155;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
    }

    .slice-card.done {
      border-left: 4px solid var(--accent-emerald);
    }

    .slice-card.partial {
      border-left: 4px solid var(--accent-amber);
    }

    .slice-card.pending {
      border-left: 4px solid var(--text-dim);
    }

    .slice-card.blocked {
      border-left: 4px solid var(--accent-crimson);
    }

    .slice-top {
      width: 100%;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
      padding: 18px 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      cursor: pointer;
      user-select: none;
    }

    .slice-info {
      flex: 1;
    }

    .slice-header {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }

    .slice-id {
      font-family: var(--font-mono);
      font-size: 13px;
      font-weight: 700;
      color: #93c5fd;
      background: rgba(59, 130, 246, 0.1);
      padding: 2px 8px;
      border-radius: 4px;
    }

    .slice-title {
      font-family: var(--font-heading);
      font-size: 16px;
      font-weight: 700;
      color: #fff;
    }

    .status-badge {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 4px 10px;
      border-radius: 9999px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .badge-done {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .slice-tick {
      font-size: 16px;
      line-height: 1;
      flex: 0 0 auto;
      color: var(--text-dim);
      cursor: default;
    }

    .slice-tick[data-tick="done"] {
      color: #34d399;
      text-shadow: 0 0 10px rgba(52, 211, 153, 0.45);
    }

    .slice-completed {
      font-size: 11px;
      font-weight: 600;
      color: #34d399;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.28);
      border-radius: 999px;
      padding: 2px 9px;
      white-space: nowrap;
      flex: 0 0 auto;
    }

    .badge-partial {
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }

    .badge-pending {
      background: rgba(100, 116, 139, 0.15);
      color: #94a3b8;
      border: 1px solid rgba(100, 116, 139, 0.3);
    }

    .badge-blocked {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .slice-goal {
      color: var(--text-muted);
      font-size: 13.5px;
      line-height: 1.5;
    }

    .slice-chevron {
      color: var(--text-dim);
      transition: transform 0.2s;
      padding-top: 4px;
    }

    .slice-card.expanded .slice-chevron {
      transform: rotate(180deg);
    }

    .slice-details {
      display: none;
      padding: 0 24px 24px;
      border-top: 1px solid rgba(255, 255, 255, 0.04);
      background: rgba(10, 14, 20, 0.3);
    }

    .slice-card.expanded .slice-details {
      display: block;
    }

    .detail-section {
      margin-top: 18px;
    }

    .detail-heading {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #93c5fd;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .detail-body {
      font-size: 13px;
      color: var(--text-muted);
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 14px 18px;
      line-height: 1.6;
    }

    .detail-body p + p,
    .detail-body ul + p,
    .detail-body p + ul {
      margin-top: 10px;
    }

    .detail-body ul {
      padding-left: 20px;
    }

    .detail-body code,
    .md-link,
    .file-tag {
      overflow-wrap: anywhere;
    }

    .detail-body code {
      font-family: var(--font-mono);
      color: #dbeafe;
      background: rgba(59, 130, 246, 0.12);
      border-radius: 4px;
      padding: 1px 4px;
    }

    .md-link,
    a.file-tag {
      color: #93c5fd;
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    .files-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 6px;
    }

    .file-tag {
      font-family: var(--font-mono);
      font-size: 11px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-subtle);
      color: #cbd5e1;
      padding: 3px 8px;
      border-radius: 4px;
    }

    /* PROOF GALLERY */
    .gallery-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 24px;
    }

    .proof-card {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex;
      flex-direction: column;
      width: 100%;
      padding: 0;
      color: inherit;
      font: inherit;
      text-align: left;
    }

    .proof-card:hover {
      transform: translateY(-4px);
      border-color: var(--border-focus);
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5);
    }

    .thumb-wrapper {
      position: relative;
      height: 220px;
      background: #000;
      overflow: hidden;
    }

    .proof-thumb {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top;
      transition: transform 0.3s;
    }

    .proof-card:hover .proof-thumb {
      transform: scale(1.03);
    }

    .thumb-overlay {
      position: absolute;
      top: 10px;
      left: 10px;
      right: 10px;
      display: flex;
      justify-content: space-between;
      pointer-events: none;
    }

    .category-tag {
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(8px);
      color: #93c5fd;
      font-size: 11px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .proof-slice-tag {
      background: rgba(16, 185, 129, 0.8);
      color: #fff;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      padding: 4px 8px;
      border-radius: 6px;
    }

    .proof-content {
      padding: 16px 20px;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .proof-title {
      display: block;
      font-family: var(--font-heading);
      font-size: 15px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 6px;
    }

    .proof-desc {
      display: block;
      font-size: 12.5px;
      color: var(--text-muted);
      line-height: 1.5;
      margin-bottom: 12px;
    }

    .proof-path {
      display: block;
      font-family: var(--font-mono);
      font-size: 10.5px;
      color: var(--text-dim);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      border-top: 1px solid var(--border-subtle);
      padding-top: 8px;
    }

    /* LIGHTBOX MODAL */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.88);
      backdrop-filter: blur(12px);
      z-index: 1000;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 30px;
    }

    .modal-overlay.active {
      display: flex;
    }

    .modal-container {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 16px;
      max-width: 1400px;
      max-height: 94vh;
      width: 100%;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.8);
    }

    .modal-header {
      padding: 16px 24px;
      border-bottom: 1px solid var(--border-subtle);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--bg-surface-elevated);
    }

    .modal-title {
      font-family: var(--font-heading);
      font-size: 18px;
      font-weight: 700;
      color: #fff;
    }

    .close-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 24px;
      cursor: pointer;
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
    }

    .close-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }

    .modal-body {
      padding: 20px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      background: #080c10;
    }

    .modal-image {
      max-width: 100%;
      max-height: 72vh;
      object-fit: contain;
      border-radius: 8px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.6);
      border: 1px solid var(--border-subtle);
    }

    .modal-meta {
      width: 100%;
      margin-top: 16px;
      padding: 14px 18px;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }

    .modal-desc {
      font-size: 13px;
      color: var(--text-muted);
      max-width: 800px;
    }

    .modal-path {
      font-family: var(--font-mono);
      font-size: 11px;
      color: #93c5fd;
      background: rgba(59, 130, 246, 0.1);
      padding: 4px 10px;
      border-radius: 6px;
    }

    .proof-mini {
      background: var(--bg-surface);
      color: var(--text-muted);
      border: 1px solid var(--border-subtle);
      border-radius: 6px;
      overflow: hidden;
      width: min(220px, 100%);
      padding: 0;
      text-align: left;
    }

    .proof-mini img {
      display: block;
      width: 100%;
      height: 120px;
      object-fit: cover;
    }

    /* A-Z TABLE */
    .az-table-container {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      overflow: hidden;
    }

    .az-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    .az-table th {
      background: var(--bg-surface-elevated);
      padding: 12px 18px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-dim);
      font-weight: 700;
      border-bottom: 1px solid var(--border-subtle);
    }

    .az-table td {
      padding: 14px 18px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.03);
      font-size: 13px;
      vertical-align: top;
    }

    .az-table tr:hover td {
      background: rgba(255, 255, 255, 0.02);
    }

    .az-id {
      font-family: var(--font-mono);
      font-weight: 700;
      color: #93c5fd;
      white-space: nowrap;
    }

    .az-title {
      font-weight: 600;
      color: #fff;
    }

    .badge-state {
      font-size: 10.5px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: 9999px;
      display: inline-block;
      white-space: nowrap;
    }

    .state-verified { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
    .state-partial { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
    .state-blocked { background: rgba(139, 92, 246, 0.15); color: #c084fc; border: 1px solid rgba(139, 92, 246, 0.3); }
    .state-failed { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
    .state-gap { background: rgba(100, 116, 139, 0.15); color: #94a3b8; border: 1px solid rgba(100, 116, 139, 0.2); }

    /* GAP & ROADMAP TAB */
    .gap-section {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }

    .gap-section h3 {
      font-family: var(--font-heading);
      font-size: 18px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .gap-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 16px;
      margin-top: 16px;
    }

    .gap-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 10px;
      padding: 16px 20px;
    }

    .gap-card h4 {
      font-size: 15px;
      font-weight: 700;
      color: #f87171;
      margin-bottom: 6px;
    }

    .gap-card p {
      font-size: 13px;
      color: var(--text-muted);
      line-height: 1.5;
    }

    .roadmap-timeline {
      display: flex;
      flex-direction: column;
      gap: 14px;
      margin-top: 16px;
    }

    .timeline-item {
      display: flex;
      gap: 16px;
      padding: 16px;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 10px;
      align-items: flex-start;
    }

    .timeline-icon {
      background: rgba(59, 130, 246, 0.15);
      color: #60a5fa;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 13px;
      flex-shrink: 0;
    }

    /* RESPONSIVE */
    @media (max-width: 1100px) {
      header { position: static; padding: 24px 24px 20px; }
      main { padding: 24px; }
      .title-group, .slice-info { min-width: 0; }
      .title-group h1 { flex-wrap: wrap; font-size: 24px; }
      .tabs { max-width: 100%; flex-wrap: wrap; }
      .tab-btn { padding-inline: 12px; }
      .kpi-row { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
      .kpi-card { padding: 14px; }
      .kpi-title { flex-wrap: wrap; gap: 4px; }
      .slice-goal, .detail-body, .modal-path { overflow-wrap: anywhere; }
    }
    @media (max-width: 900px) {
      header { padding: 20px 20px 16px; }
      main { padding: 20px; }
      .title-group h1 { font-size: 22px; }
      .gallery-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body data-source-slices="${stats.slicesTotal}" data-source-requirements="${stats.azTotal}" data-source-proofs="${stats.totalScreenshots}">

  <header>
    <div class="header-top">
      <div class="title-group">
        <h1>
          <span>X-RAY PRODUCTION CLOSEOUT & PROOF DASHBOARD</span>
          <span class="badge-branch">${escapeHtml(proofBranch)}</span>
        </h1>
        <p>Recorded implementation status and proof index — local source snapshot, not deployment certification</p>
      </div>
      <div class="meta-pills">
        <div class="pill pill-green">
          <span class="dot"></span>
          <span>${stats.testsPassing === null ? "Machine gate not recorded" : `${formatNumber(stats.testsPassing)} / ${formatNumber(stats.testsTotal)} Passed`}</span>
        </div>
        <div class="pill pill-blue">
          <span class="dot"></span>
          <span>TypeScript ${escapeHtml(stats.tscStatus)}</span>
        </div>
        <div class="pill">
          <span>Source-grounded proof index</span>
        </div>
      </div>
    </div>

    <!-- KPI ROW -->
    <div class="kpi-row">
      <div class="kpi-card" data-kpi="slices" data-total="${stats.slicesTotal}" data-done="${stats.slicesDone}" data-partial="${stats.slicesPartial}" data-blocked="${stats.slicesBlocked}" data-pending="${stats.slicesPending}">
        <div class="kpi-title">
          <span>Closeout Slices</span>
          <span style="color: #34d399;">${stats.slicesDone} / ${stats.slicesTotal} DONE</span>
        </div>
        <div class="kpi-value">${stats.slicesTotal ? Math.round((stats.slicesDone / stats.slicesTotal) * 100) : 0}%</div>
        <div class="kpi-sub">${stats.slicesDone} Done, ${stats.slicesPartial} Partial, ${stats.slicesBlocked} Blocked, ${stats.slicesPending} Pending</div>
      </div>
      <div class="kpi-card" data-kpi="tests" data-passing="${stats.testsPassing ?? "unknown"}" data-total="${stats.testsTotal ?? "unknown"}" data-suites="${stats.testSuites ?? "unknown"}" data-tsc="${stats.tscStatus === "Clean (Exit 0)" ? "exit-0" : "unknown"}">
        <div class="kpi-title">
          <span>Machine Gate Tests</span>
          <span style="color: #34d399;">${stats.testsPassing !== null && stats.testsPassing === stats.testsTotal ? "100% PASS" : "SEE LEDGER"}</span>
        </div>
        <div class="kpi-value">${stats.testsPassing === null ? "Unknown" : formatNumber(stats.testsPassing)}</div>
        <div class="kpi-sub">${stats.testsPassing === null ? "Current test count not recorded" : `${formatNumber(stats.testsTotal - stats.testsPassing)} Failures · ${stats.testSuites === null ? "suite count not recorded" : `${formatNumber(stats.testSuites)} Suites`}`}</div>
      </div>
      <div class="kpi-card" data-kpi="proofs" data-total="${stats.totalScreenshots}">
        <div class="kpi-title">
          <span>Visual & Executed Proofs</span>
          <span style="color: #60a5fa;">ATTACHED</span>
        </div>
        <div class="kpi-value">${curatedImages.length}</div>
        <div class="kpi-sub">Curated historical captures; not current qualification</div>
      </div>
      <div class="kpi-card" data-kpi="az" data-total="${stats.azTotal}" data-verified="${stats.azVerified}" data-partial="${stats.azPartial}" data-blocked="${stats.azBlocked}" data-gap="${stats.azGaps}" data-failed="${stats.azFailed}">
        <div class="kpi-title">
          <span>A–Z Full Catalogue</span>
          <span style="color: #cbd5e1;">${stats.azTotal} ITEMS</span>
        </div>
        <div class="kpi-value">${stats.azVerified + stats.azPartial} / ${stats.azTotal}</div>
        <div class="kpi-sub">${stats.azVerified} Verified, ${stats.azPartial} Partial, ${stats.azBlocked} Blocked, ${stats.azGaps} Gaps, ${stats.azFailed} Failed</div>
      </div>
    </div>

    <!-- TABS AND SEARCH -->
    <div class="nav-container">
      <div class="tabs" role="tablist" aria-label="Dashboard views">
        <button type="button" class="tab-btn active" id="tab-button-slices" role="tab" aria-selected="true" aria-controls="tab-slices" data-tab="slices">
          <span>📑 Closeout Slices</span>
          <span class="tab-badge">${stats.slicesTotal}</span>
        </button>
        <button type="button" class="tab-btn" id="tab-button-gallery" role="tab" aria-selected="false" aria-controls="tab-gallery" data-tab="gallery" tabindex="-1">
          <span>🖼️ Visual Proof Gallery</span>
          <span class="tab-badge">${curatedImages.length}</span>
        </button>
        <button type="button" class="tab-btn" id="tab-button-gaps" role="tab" aria-selected="false" aria-controls="tab-gaps" data-tab="gaps" tabindex="-1">
          <span>🔍 What Hasn't Been Done</span>
          <span class="tab-badge">${stats.slicesTotal - stats.slicesDone}</span>
        </button>
        <button type="button" class="tab-btn" id="tab-button-az" role="tab" aria-selected="false" aria-controls="tab-az" data-tab="az" tabindex="-1">
          <span>📋 Professional A–Z Catalogue</span>
          <span class="tab-badge">${stats.azTotal}</span>
        </button>
        <button type="button" class="tab-btn" id="tab-button-invariants" role="tab" aria-selected="false" aria-controls="tab-invariants" data-tab="invariants" tabindex="-1">
          <span>🛡️ Architecture & Invariants</span>
        </button>
      </div>

      <div class="search-box">
        <label class="sr-only" for="globalSearch">Search slices, requirements, files, and proofs</label>
        <span class="search-icon" aria-hidden="true">🔍</span>
        <input type="search" id="globalSearch" class="search-input" placeholder="Search slices, requirements, files, proofs..." aria-controls="slicesContainer galleryContainer azTable">
      </div>
    </div>
  </header>

  <main>
    <!-- TAB 1: CLOSEOUT SLICES -->
    <section id="tab-slices" class="tab-content active" role="tabpanel" aria-labelledby="tab-button-slices">
      <div class="filter-bar" role="group" aria-label="Closeout slice filters">
        <span class="filter-label">Filter Status:</span>
        ${renderFilterButton("slice-status", "all", `All (${slices.length})`, true)}
        ${renderFilterButton("slice-status", "done", `Done (${stats.slicesDone})`)}
        ${renderFilterButton("slice-status", "partial", `Partial / Blocked (${stats.slicesPartial + stats.slicesBlocked})`)}
        ${renderFilterButton("slice-status", "pending", `Pending (${stats.slicesPending})`)}

        <span class="filter-label" style="margin-left: 20px;">Portion:</span>
        ${renderFilterButton("slice-portion", "all", "All Portions", true)}
        ${portions.map(portion => renderFilterButton("slice-portion", String(portion.number), `${portion.label} (${portion.count})`)).join("")}
      </div>

      <div class="slices-grid" id="slicesContainer">
        ${renderSlicesHtml(slices)}
      </div>
    </section>

    <!-- TAB 2: PROOF GALLERY -->
    <section id="tab-gallery" class="tab-content" role="tabpanel" aria-labelledby="tab-button-gallery" hidden>
      <div class="filter-bar" role="group" aria-label="Proof gallery filters">
        <span class="filter-label">Filter Category:</span>
        ${renderFilterButton("gallery-category", "all", `All (${curatedImages.length})`, true)}
        ${galleryCategories.map(category => renderFilterButton("gallery-category", category, `${category} (${curatedImages.filter(image => image.category === category).length})`)).join("")}
      </div>

      <div class="gallery-grid" id="galleryContainer">
        ${renderGalleryHtml(curatedImages)}
      </div>
    </section>

    <!-- TAB 3: WHAT HASN'T BEEN DONE (GAP ANALYSIS) -->
    <section id="tab-gaps" class="tab-content" role="tabpanel" aria-labelledby="tab-button-gaps" hidden>
      <div class="gap-section">
        <h3>
          <span style="color: #ef4444;">●</span>
          <span>Open Closeout Slices (${stats.slicesTotal - stats.slicesDone})</span>
        </h3>
        <p style="color: var(--text-muted); font-size: 13.5px;">
          These ${stats.slicesTotal - stats.slicesDone} slices remain partial, blocked, or pending in <code>XRAY-PRODUCTION-CLOSEOUT-LEDGER.md</code>. Completed slices are intentionally omitted from this view.
        </p>

        <div class="roadmap-timeline">
          ${renderOpenSlicesHtml(slices)}
        </div>
      </div>

      <div class="gap-section">
        <h3>
          <span style="color: #f59e0b;">●</span>
          <span>Current Evidence Gaps & Honest Absence Disclosures</span>
        </h3>
        <div class="gap-grid">
          <div class="gap-card">
            <h4>Pending closeout work</h4>
            <p>
              ${stats.slicesPending} slices remain pending, ${stats.slicesPartial} remain partial, and ${stats.slicesBlocked} are blocked. Their open gates are shown above directly from the closeout ledger.
            </p>
          </div>
          <div class="gap-card">
            <h4>Dependency-blocked A–Z requirements</h4>
            <p>
              ${stats.azBlocked} professional requirements are explicitly dependency-blocked. The catalogue retains each source assessment rather than treating blocked work as complete.
            </p>
          </div>
          <div class="gap-card">
            <h4>Unimplemented A–Z requirements</h4>
            <p>
              ${stats.azGaps} requirements are recorded as gaps and ${stats.azFailed} as failed. Search the catalogue for the exact source-grounded explanation and remaining boundary.
            </p>
          </div>
          <div class="gap-card">
            <h4>Partial A–Z requirements</h4>
            <p>
              ${stats.azPartial} requirements have useful implementation or evidence but still carry an explicit remaining limit. Partial is never counted as verified.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- TAB 4: A-Z CATALOGUE -->
    <section id="tab-az" class="tab-content" role="tabpanel" aria-labelledby="tab-button-az" hidden>
      <div class="filter-bar" role="group" aria-label="Professional requirement state filters">
        <span class="filter-label">State:</span>
        ${renderFilterButton("az-state", "all", `All (${stats.azTotal})`, true)}
        ${azStates.map(state => renderFilterButton("az-state", state, `${formatStateLabel(state)} (${allRequirements.filter(requirement => requirement.state === state).length})`)).join("")}
      </div>

      <div class="az-table-container">
        <table class="az-table" id="azTable">
          <thead>
            <tr>
              <th style="width: 100px;">Req ID</th>
              <th style="width: 140px;">Category</th>
              <th style="width: 240px;">Requirement</th>
              <th style="width: 110px;">Status</th>
              <th>Assessment & Evidence Summary</th>
            </tr>
          </thead>
          <tbody>
            ${renderAzRowsHtml(allRequirements)}
          </tbody>
        </table>
      </div>
    </section>

    <!-- TAB 5: INVARIANTS & ARCHITECTURE -->
    <section id="tab-invariants" class="tab-content" role="tabpanel" aria-labelledby="tab-button-invariants" hidden>
      <div class="gap-section">
        <h3>🛡️ Declared Architecture Contracts & Verification Boundaries</h3>
        <p style="color: var(--text-muted); font-size: 13.5px; margin-bottom: 20px;">
          These engineering contracts describe required behaviour, not blanket certification. Consult each slice’s recorded tests, visual evidence and open gates for the coverage actually demonstrated.
        </p>

        <div class="gap-grid">
          <div class="gap-card" style="border-left: 4px solid #10b981;">
            <h4 style="color: #34d399;">1. True 3D Surface Geometry</h4>
            <p>
              Sloped surfaces must distinguish true surface area from horizontal projected area: <code>Atrue = Aprojected / cos(pitch)</code>. Each supported measurement must retain its source, calibration and stated limitations.
            </p>
          </div>
          <div class="gap-card" style="border-left: 4px solid #3b82f6;">
            <h4 style="color: #60a5fa;">2. Explicit Opening Deductions</h4>
            <p>
              Opening deductions must follow the project’s declared measurement rules. Gross area, applied deductions and net area must remain distinguishable; missing geometry or deduction evidence must be disclosed.
            </p>
          </div>
          <div class="gap-card" style="border-left: 4px solid #8b5cf6;">
            <h4 style="color: #c084fc;">3. Immutable Cryptographic Delivery Freeze</h4>
            <p>
              Issued-deliverable workflows require a retained SHA-256 payload digest and rejection of altered content. This dashboard is an evidence index, not an issued or cryptographically sealed project deliverable.
            </p>
          </div>
          <div class="gap-card" style="border-left: 4px solid #f59e0b;">
            <h4 style="color: #fbbf24;">4. Compare-And-Swap (CAS) Workspace Locking</h4>
            <p>
              Project authoring requires explicit concurrency and recovery safeguards. Recorded browser tests establish only their exercised cases; a dashboard screenshot does not establish multi-device safety or universal data recovery.
            </p>
          </div>
        </div>
      </div>
    </section>
  </main>

  <!-- LIGHTBOX MODAL -->
  <div class="modal-overlay" id="lightboxModal" hidden>
    <div class="modal-container" role="dialog" aria-modal="true" aria-labelledby="modalTitle" aria-describedby="modalDesc" tabindex="-1">
      <div class="modal-header">
        <h3 class="modal-title" id="modalTitle">Screenshot Inspection</h3>
        <button type="button" class="close-btn" aria-label="Close screenshot inspection">&times;</button>
      </div>
      <div class="modal-body">
        <img src="" alt="Proof Screenshot" class="modal-image" id="modalImage">
        <div class="modal-meta">
          <div class="modal-desc" id="modalDesc"></div>
          <div class="modal-path" id="modalPath"></div>
        </div>
      </div>
    </div>
  </div>

  <script>
    const filters = {
      sliceStatus: 'all',
      slicePortion: 'all',
      galleryCategory: 'all',
      azState: 'all',
      query: '',
    };
    let modalReturnFocus = null;

    function switchTab(tabId, focusTab = false) {
      document.querySelectorAll('[role="tab"]').forEach(button => {
        const selected = button.dataset.tab === tabId;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
        if (selected && focusTab) button.focus();
      });
      document.querySelectorAll('[role="tabpanel"]').forEach(panel => {
        const selected = panel.id === 'tab-' + tabId;
        panel.classList.toggle('active', selected);
        panel.hidden = !selected;
      });
      // Each tab starts at its own controls; retaining a previous view's scroll
      // can otherwise leave the next filters obscured by the desktop header.
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }

    function applyFilters() {
      const q = filters.query;
      document.querySelectorAll('.slice-card').forEach(card => {
        const statusMatch = filters.sliceStatus === 'all'
          || card.dataset.status === filters.sliceStatus
          || (filters.sliceStatus === 'partial' && card.dataset.status === 'blocked');
        const portionMatch = filters.slicePortion === 'all' || card.dataset.portion === filters.slicePortion;
        const searchMatch = !q || card.textContent.toLowerCase().includes(q);
        card.hidden = !(statusMatch && portionMatch && searchMatch);
      });
      document.querySelectorAll('.portion-group').forEach(group => {
        group.hidden = !group.querySelector('.slice-card:not([hidden])');
      });
      document.querySelectorAll('.proof-card').forEach(card => {
        const categoryMatch = filters.galleryCategory === 'all' || card.dataset.category === filters.galleryCategory;
        const searchMatch = !q || card.textContent.toLowerCase().includes(q);
        card.hidden = !(categoryMatch && searchMatch);
      });
      document.querySelectorAll('#azTable tbody tr').forEach(row => {
        const stateMatch = filters.azState === 'all' || row.dataset.state === filters.azState;
        const searchMatch = !q || row.textContent.toLowerCase().includes(q);
        row.hidden = !(stateMatch && searchMatch);
      });
    }

    function selectFilter(button) {
      const group = button.dataset.filterGroup;
      document.querySelectorAll('[data-filter-group="' + CSS.escape(group) + '"]').forEach(candidate => {
        const selected = candidate === button;
        candidate.classList.toggle('active', selected);
        candidate.setAttribute('aria-pressed', String(selected));
      });
      if (group === 'slice-status') filters.sliceStatus = button.dataset.filterValue;
      if (group === 'slice-portion') filters.slicePortion = button.dataset.filterValue;
      if (group === 'gallery-category') filters.galleryCategory = button.dataset.filterValue;
      if (group === 'az-state') filters.azState = button.dataset.filterValue;
      applyFilters();
    }

    function toggleSlice(button) {
      const card = button.closest('.slice-card');
      const expanded = button.getAttribute('aria-expanded') !== 'true';
      card.classList.toggle('expanded', expanded);
      button.setAttribute('aria-expanded', String(expanded));
      document.getElementById(button.getAttribute('aria-controls')).hidden = !expanded;
    }

    function openLightbox(button) {
      modalReturnFocus = button;
      const modal = document.getElementById('lightboxModal');
      document.getElementById('modalImage').src = button.dataset.src;
      document.getElementById('modalImage').alt = button.dataset.title;
      document.getElementById('modalTitle').textContent = button.dataset.title;
      document.getElementById('modalDesc').textContent = button.dataset.desc;
      document.getElementById('modalPath').textContent = button.dataset.path;
      modal.hidden = false;
      modal.classList.add('active');
      modal.querySelector('.close-btn').focus();
    }

    function closeLightbox() {
      const modal = document.getElementById('lightboxModal');
      if (modal.hidden) return;
      modal.classList.remove('active');
      modal.hidden = true;
      modalReturnFocus?.focus();
      modalReturnFocus = null;
    }

    document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => switchTab(button.dataset.tab)));
    document.querySelector('[role="tablist"]').addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const tabs = [...document.querySelectorAll('[role="tab"]')];
      const current = tabs.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0
        : event.key === 'End' ? tabs.length - 1
          : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      switchTab(tabs[next].dataset.tab, true);
    });
    document.querySelectorAll('[data-filter-group]').forEach(button => button.addEventListener('click', () => selectFilter(button)));
    document.querySelectorAll('.slice-top').forEach(button => button.addEventListener('click', () => toggleSlice(button)));
    document.querySelectorAll('[data-lightbox]').forEach(button => button.addEventListener('click', () => openLightbox(button)));
    document.querySelector('.close-btn').addEventListener('click', closeLightbox);
    document.getElementById('lightboxModal').addEventListener('click', event => {
      if (event.target === event.currentTarget) closeLightbox();
    });
    document.getElementById('globalSearch').addEventListener('input', event => {
      filters.query = event.currentTarget.value.toLowerCase().trim();
      applyFilters();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeLightbox();
      const modal = document.getElementById('lightboxModal');
      if (event.key === 'Tab' && !modal.hidden) {
        event.preventDefault();
        modal.querySelector('.close-btn').focus();
      }
    });
  </script>
</body>
</html>
`;


function renderSlicesHtml(slices) {
  return portions.map(portion => {
    const portionSlices = slices.filter(slice => slice.portionNumber === portion.number);
    return `
      <section class="portion-group" data-portion-group="${portion.number}" aria-labelledby="portion-title-${portion.number}">
        <div class="portion-header">
          <h2 class="portion-title" id="portion-title-${portion.number}">📂 ${escapeHtml(portion.label)}</h2>
        </div>
        ${portionSlices.map(renderSliceCardHtml).join("")}
      </section>
    `;
  }).join("");
}

function renderSliceCardHtml(s) {
  const statusBadgeClass = s.status === "done" ? "badge-done"
    : s.status === "partial" ? "badge-partial"
      : s.status === "blocked" ? "badge-blocked"
        : "badge-pending";
  const statusText = s.status === "done" ? "✓ Done"
    : s.status === "partial" ? "⚠ Partial"
      : s.status === "blocked" ? "⛔ Blocked"
        : "○ Pending";
  const isDone = s.status === "done";
  const completedLabel = isDone ? (s.completedAt ? formatCompleted(s.completedAt) : "date not recorded") : "";
  const completedTitle = s.completedAt ? ` title="Completed ${escapeHtml(s.completedAt)}"` : "";
  const controlId = `slice-control-${s.id.toLowerCase()}`;
  const detailsId = `slice-details-${s.id.toLowerCase()}`;
  const machineHeading = s.status === "pending" ? "⚙️ Machine Completion Criteria (not yet closed)" : "⚙️ Machine Gate Verification";
  const humanHeading = s.humanGateOpen ? "⚠️ Open Human / Visual Gate"
    : s.status === "pending" ? "👁️ Human / Visual Completion Criteria (not yet closed)"
      : "👁️ Human & Visual Proof";
  return `
    <article class="slice-card ${s.status}" data-slice-id="${escapeHtml(s.id)}" data-status="${s.status}" data-portion="${s.portionNumber}">
      <button type="button" class="slice-top" id="${controlId}" aria-expanded="false" aria-controls="${detailsId}">
        <span class="slice-info">
          <span class="slice-header">
            <span class="slice-tick" data-tick="${isDone ? "done" : "open"}"${completedTitle}>${isDone ? "☑" : "☐"}</span>
            <span class="slice-id">${escapeHtml(s.id)}</span>
            <span class="slice-title">${escapeHtml(s.title)}</span>
            <span class="status-badge ${statusBadgeClass}">${statusText}</span>
            ${completedLabel ? `<span class="slice-completed"${completedTitle}>✔ ${escapeHtml(completedLabel)}</span>` : ""}
          </span>
          <span class="slice-goal">${renderInlineMarkdown(s.goal)}</span>
        </span>
        <span class="slice-chevron" aria-hidden="true">▼</span>
      </button>

      <div class="slice-details" id="${detailsId}" role="region" aria-labelledby="${controlId}" hidden>
        ${s.machineDone ? renderDetailSection(machineHeading, s.machineDone, s.status === "pending") : ""}
        ${s.humanDone ? renderDetailSection(humanHeading, s.humanDone, s.humanGateOpen || s.status === "pending") : ""}
        ${s.proof ? renderDetailSection("🔗 Recorded Proof", s.proof) : ""}
        ${s.blockedNote ? renderDetailSection("⚠️ Blocked / Environment Note", s.blockedNote, true) : ""}
        ${s.files.length ? `
          <div class="detail-section">
            <div class="detail-heading">📁 Associated Files</div>
            <div class="files-list">${s.files.map(renderFileLink).join("")}</div>
          </div>
        ` : ""}
        ${s.images.length ? `
          <div class="detail-section">
            <div class="detail-heading">📸 Attached Visual Proof</div>
            <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-top: 8px;">
              ${s.images.map(image => renderProofButton(image, true)).join("")}
            </div>
          </div>
        ` : ""}
      </div>
    </article>
  `;
}

function renderGalleryHtml(images) {
  return images.map(image => renderProofButton(image, false)).join("");
}

function renderProofButton(image, compact) {
  const data = `data-lightbox data-src="${escapeHtml(image.relPath)}" data-title="${escapeHtml(image.title)}" data-desc="${escapeHtml(image.description)}" data-path="${escapeHtml(image.relPath)}"`;
  if (compact) {
    return `
      <button type="button" class="proof-mini" ${data} aria-label="Inspect proof: ${escapeHtml(image.title)}">
        <img src="${escapeHtml(image.relPath)}" alt="" loading="lazy">
        <span style="display: block; padding: 8px; font-size: 11px;">${escapeHtml(image.title)}</span>
      </button>
    `;
  }
  return `
    <button type="button" class="proof-card" data-category="${escapeHtml(image.category)}" ${data} aria-label="Inspect proof: ${escapeHtml(image.title)}">
      <span class="thumb-wrapper">
        <img src="${escapeHtml(image.relPath)}" alt="" class="proof-thumb" loading="lazy">
        <span class="thumb-overlay">
          <span class="category-tag">${escapeHtml(image.category)}</span>
          <span class="proof-slice-tag">${escapeHtml(image.slice)}</span>
        </span>
      </span>
      <span class="proof-content">
        <span>
          <span class="proof-title">${escapeHtml(image.title)}</span>
          <span class="proof-desc">${escapeHtml(image.description)}</span>
        </span>
        <span class="proof-path">${escapeHtml(image.relPath)}</span>
      </span>
    </button>
  `;
}

function renderAzRowsHtml(rows) {
  return rows.map(r => {
    const badgeClass = "state-" + r.state;
    return `
      <tr data-state="${r.state}" data-category="${r.category}">
        <td class="az-id">${escapeHtml(r.id)}</td>
        <td><span style="font-size: 12px; color: var(--text-dim);">${escapeHtml(r.category)} — ${escapeHtml(r.categoryName)}</span></td>
        <td class="az-title">${escapeHtml(r.title)}</td>
        <td><span class="badge-state ${badgeClass}">${escapeHtml(r.state)}</span></td>
        <td style="color: var(--text-muted); font-size: 12.5px; line-height: 1.5;">${renderInlineMarkdown(r.description)}</td>
      </tr>
    `;
  }).join("");
}

function renderFilterButton(group, value, label, active = false) {
  return `<button type="button" class="filter-chip${active ? " active" : ""}" data-filter-group="${escapeHtml(group)}" data-filter-value="${escapeHtml(value)}" aria-pressed="${active}">${escapeHtml(label)}</button>`;
}

function formatStateLabel(state) {
  return state === "dependency-blocked" ? "Blocked"
    : state === "gap" ? "Gaps"
      : state.charAt(0).toUpperCase() + state.slice(1);
}

function renderOpenSlicesHtml(rows) {
  const open = rows.filter(row => row.status !== "done");
  return portions.map(portion => {
    const portionRows = open.filter(row => row.portionNumber === portion.number);
    if (!portionRows.length) return "";
    return `
      <div class="timeline-item" data-open-portion="${portion.number}">
        <div class="timeline-icon">P${portion.number}</div>
        <div>
          <h4 style="color: #fff; font-size: 15px;">${escapeHtml(portion.label)}</h4>
          <p style="color: var(--text-muted); font-size: 13px; margin-top: 4px;">
            ${portionRows.map(row => `<strong>${escapeHtml(row.id)}</strong> <span class="badge-state state-${row.status === "partial" ? "partial" : row.status === "blocked" ? "blocked" : "gap"}">${escapeHtml(row.status)}</span> ${renderInlineMarkdown(row.title)}`).join(" &bull; ")}
          </p>
        </div>
      </div>
    `;
  }).join("");
}

function renderDetailSection(heading, body, warning = false) {
  const warningStyle = warning ? "border-color: rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.05); color: #fca5a5;" : "";
  return `
    <div class="detail-section">
      <div class="detail-heading"${warning ? ' style="color: #f87171;"' : ""}>${escapeHtml(heading)}</div>
      <div class="detail-body"${warningStyle ? ` style="${warningStyle}"` : ""}>${renderMarkdownContent(body)}</div>
    </div>
  `;
}

function renderMarkdownContent(value) {
  let html = "";
  let listOpen = false;
  for (const rawLine of String(value ?? "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      if (listOpen) {
        html += "</ul>";
        listOpen = false;
      }
      continue;
    }
    const listItem = line.match(/^-\s+(.+)$/);
    if (listItem) {
      if (!listOpen) {
        html += "<ul>";
        listOpen = true;
      }
      html += `<li>${renderInlineMarkdown(listItem[1])}</li>`;
      continue;
    }
    if (listOpen) {
      html += "</ul>";
      listOpen = false;
    }
    html += `<p>${renderInlineMarkdown(line)}</p>`;
  }
  if (listOpen) html += "</ul>";
  return html;
}

function renderInlineMarkdown(value) {
  const source = String(value ?? "");
  const tokenPattern = /(`[^`\n]+`|\[[^\]\n]+\]\([^)\n]+\)|\*\*[^*\n]+\*\*)/g;
  let html = "";
  let cursor = 0;
  for (const match of source.matchAll(tokenPattern)) {
    html += escapeHtml(source.slice(cursor, match.index));
    const token = match[0];
    if (token.startsWith("`")) {
      html += `<code>${escapeHtml(token.slice(1, -1))}</code>`;
    } else if (token.startsWith("**")) {
      html += `<strong>${escapeHtml(token.slice(2, -2))}</strong>`;
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      const href = sanitizeLocalHref(link?.[2] ?? "");
      html += href
        ? `<a class="md-link" href="${escapeHtml(href)}">${escapeHtml(link[1])}</a>`
        : `<span>${escapeHtml(link?.[1] ?? token)}</span>`;
    }
    cursor = match.index + token.length;
  }
  html += escapeHtml(source.slice(cursor));
  return html;
}

function sanitizeLocalHref(value) {
  const href = String(value).trim().replaceAll("\\", "/");
  if (!href || /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|[a-z]:\/)/i.test(href)) return null;
  if (href.split("/").includes("..")) return null;
  return href;
}

function renderFileLink(file) {
  const href = sanitizeLocalHref(file);
  return href
    ? `<a class="file-tag" href="${escapeHtml(href)}">${escapeHtml(file)}</a>`
    : `<span class="file-tag">${escapeHtml(file)}</span>`;
}

function formatNumber(value) {
  return Number(value).toLocaleString("en-AU");
}

function formatCompleted(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  // Stable across build hosts; the raw source value stays on the title attribute.
  return parsed.toLocaleString("en-AU", {
    timeZone: "UTC",
    timeZoneName: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const outputPath = path.resolve(process.argv[2] ?? "XRAY-STATUS-AND-PROOF-DASHBOARD.html");
const generatedHtml = html.replace(/[\t ]+$/gm, "");
fs.writeFileSync(outputPath, generatedHtml, "utf8");
console.log(`Successfully created ${outputPath}! Size:`, Buffer.byteLength(generatedHtml, "utf8"), "bytes");
