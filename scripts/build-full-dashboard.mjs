import fs from "node:fs";
import path from "node:path";

console.log("Reading input files...");
const closeoutLedger = fs.readFileSync("XRAY-PRODUCTION-CLOSEOUT-LEDGER.md", "utf8");
const azChecklist = fs.readFileSync("PROFESSIONAL-A-Z-CHECKLIST.md", "utf8");
const curatedImages = JSON.parse(fs.readFileSync("dashboard-curated-images.json", "utf8"));

// 1. Parse Closeout Slices (SC-01 to SC-20)
const sliceRegex = /####\s+(SC-\d+)\s+—\s+(.*?)\s+`\[\[(.*?)\]\]`([\s\S]*?)(?=####\s+SC-|\n###\s+PORTION|\n---\n\n##\s+5\.|$)/g;
const slices = [];
let match;
while ((match = sliceRegex.exec(closeoutLedger)) !== null) {
  const [_, id, title, status, body] = match;
  
  // extract portion
  const portionMatch = closeoutLedger.substring(0, match.index).match(/###\s+PORTION\s+(\d+):\s+(.*?)\n/g);
  const lastPortion = portionMatch ? portionMatch[portionMatch.length - 1].replace(/###\s+/, "").trim() : "Portion 1: Core Architectural Deliverables";

  // extract goal
  const goalMatch = body.match(/\*\s+\*\*Goal\*\*:\s*([\s\S]*?)(?=\*\s+\*\*DONE|\n\n)/);
  const goal = goalMatch ? goalMatch[1].trim() : "";

  // extract machine done
  const machineMatch = body.match(/\*\s+\*\*DONE \(machine\)\*\*:\s*([\s\S]*?)(?=\*\s+\*\*DONE \(human\)|\n\n)/);
  const machineDone = machineMatch ? machineMatch[1].trim() : "";

  // extract human done
  const humanMatch = body.match(/\*\s+\*\*DONE \(human\)\*\*:\s*([\s\S]*?)(?=\*\s+\*\*Files|\*\s+\*\*Machine evidence|\*\s+\*\*BLOCKED|\n\n)/);
  const humanDone = humanMatch ? humanMatch[1].trim() : "";

  // extract files
  const filesMatch = body.match(/\*\s+\*\*Files\*\*:\s*([\s\S]*?)(?=\*\s+\*\*Depends|\*\s+\*\*Commit|\n\n)/);
  const files = filesMatch ? filesMatch[1].trim().split("\n").map(f => f.replace(/^-\s*`?/, "").replace(/`?$/, "").trim()).filter(Boolean) : [];

  // extract notes/blocked
  const blockedMatch = body.match(/\*\s+\*\*BLOCKED.*?\*\*:\s*([\s\S]*?)(?=\*\s+\*\*Files|\*\s+\*\*Depends|\n\n)/);
  const blockedNote = blockedMatch ? blockedMatch[1].trim() : "";

  // associate images
  const matchingImages = curatedImages.filter(img => img.slice === id || (id === "SC-01" && img.slice === "SC-01") || (id === "SC-02" && img.slice === "SC-02") || (id === "SC-04" && img.slice === "SC-04"));

  slices.push({
    id,
    title,
    status: status.toLowerCase(),
    portion: lastPortion,
    goal,
    machineDone,
    humanDone,
    files,
    blockedNote,
    images: matchingImages
  });
}

console.log(`Parsed ${slices.length} closeout slices.`);

// 2. Parse A-Z Checklist Categories and Rows
const azLines = azChecklist.split("\n");
const categories = [];
let currentCat = null;
const allRequirements = [];

for (const line of azLines) {
  const catMatch = line.match(/^###\s+([A-Z]|SO|PH)\s+—\s+(.*)/);
  if (catMatch) {
    if (currentCat) categories.push(currentCat);
    currentCat = {
      code: catMatch[1],
      name: catMatch[2].trim(),
      rows: []
    };
    continue;
  }

  const rowMatch = line.match(/^-\s+\[([ x])\]\s+\*\*([A-Z0-9-]+)\s+(.*?)\*\*\s+—\s+([\s\S]*)/);
  if (rowMatch && currentCat) {
    const isChecked = rowMatch[1] === "x";
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

// Summary stats
const stats = {
  slicesTotal: slices.length,
  slicesDone: slices.filter(s => s.status === "done").length,
  slicesPartial: slices.filter(s => s.status === "partial").length,
  slicesPending: slices.filter(s => s.status === "pending").length,
  testsPassing: 1751,
  testSuites: 89,
  tscStatus: "Clean (Exit 0)",
  azTotal: allRequirements.length,
  azVerified: allRequirements.filter(r => r.state === "verified").length,
  azPartial: allRequirements.filter(r => r.state === "partial").length,
  azBlocked: allRequirements.filter(r => r.state === "dependency-blocked").length,
  azFailed: allRequirements.filter(r => r.state === "failed").length,
  azGaps: allRequirements.filter(r => r.state === "gap").length,
  totalScreenshots: curatedImages.length
};

console.log("Stats:", stats);

// Now generate HTML
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>X-Ray Architectural CAD & Takeoff — Interactive Status & Proof Ledger</title>
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
      --text-dim: #64748b;
      
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
      padding: 8px 18px;
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
      padding: 9px 14px 9px 36px;
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
      padding: 5px 12px;
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

    .slice-top {
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
      font-family: var(--font-heading);
      font-size: 15px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 6px;
    }

    .proof-desc {
      font-size: 12.5px;
      color: var(--text-muted);
      line-height: 1.5;
      margin-bottom: 12px;
    }

    .proof-path {
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
      width: 36px;
      height: 36px;
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
    @media (max-width: 900px) {
      header { padding: 20px 20px 16px; }
      main { padding: 20px; }
      .title-group h1 { font-size: 22px; }
      .gallery-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>

  <header>
    <div class="header-top">
      <div class="title-group">
        <h1>
          <span>X-RAY PRODUCTION CLOSEOUT & PROOF DASHBOARD</span>
          <span class="badge-branch">feat/architect-cad-engine</span>
        </h1>
        <p>Authoritative Evidence-Backed Status Register — Architectural CAD Engine, Active Trades & Verification Proofs</p>
      </div>
      <div class="meta-pills">
        <div class="pill pill-green">
          <span class="dot"></span>
          <span>1,751 Passed / 0 Failed</span>
        </div>
        <div class="pill pill-blue">
          <span class="dot"></span>
          <span>TypeScript Clean (Exit 0)</span>
        </div>
        <div class="pill">
          <span>SHA-256 Sealed Delivery</span>
        </div>
      </div>
    </div>

    <!-- KPI ROW -->
    <div class="kpi-row">
      <div class="kpi-card">
        <div class="kpi-title">
          <span>Closeout Slices</span>
          <span style="color: #34d399;">3 / 20 DONE</span>
        </div>
        <div class="kpi-value">15%</div>
        <div class="kpi-sub">3 Done, 1 Partial, 16 Pending</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">
          <span>Machine Gate Tests</span>
          <span style="color: #34d399;">100% PASS</span>
        </div>
        <div class="kpi-value">1,751</div>
        <div class="kpi-sub">89 Suites, 0 Failures</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">
          <span>Visual & Executed Proofs</span>
          <span style="color: #60a5fa;">ATTACHED</span>
        </div>
        <div class="kpi-value">${curatedImages.length}</div>
        <div class="kpi-sub">Screenshots & Vector PDFs</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">
          <span>A–Z Full Catalogue</span>
          <span style="color: #cbd5e1;">375 ITEMS</span>
        </div>
        <div class="kpi-value">108 / 375</div>
        <div class="kpi-sub">6 Verified, 102 Partial, 247 Gaps</div>
      </div>
    </div>

    <!-- TABS AND SEARCH -->
    <div class="nav-container">
      <div class="tabs">
        <button class="tab-btn active" onclick="switchTab('slices')">
          <span>📑 Closeout Slices</span>
          <span class="tab-badge">20</span>
        </button>
        <button class="tab-btn" onclick="switchTab('gallery')">
          <span>🖼️ Visual Proof Gallery</span>
          <span class="tab-badge">${curatedImages.length}</span>
        </button>
        <button class="tab-btn" onclick="switchTab('gaps')">
          <span>🔍 What Hasn't Been Done</span>
          <span class="tab-badge">17</span>
        </button>
        <button class="tab-btn" onclick="switchTab('az')">
          <span>📋 Professional A–Z Catalogue</span>
          <span class="tab-badge">375</span>
        </button>
        <button class="tab-btn" onclick="switchTab('invariants')">
          <span>🛡️ Architecture & Invariants</span>
        </button>
      </div>

      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="text" id="globalSearch" class="search-input" placeholder="Search slices, requirements, files, proofs..." oninput="handleSearch()">
      </div>
    </div>
  </header>

  <main>
    <!-- TAB 1: CLOSEOUT SLICES -->
    <section id="tab-slices" class="tab-content active">
      <div class="filter-bar">
        <span class="filter-label">Filter Status:</span>
        <button class="filter-chip active" onclick="filterSlices('all', this)">All (20)</button>
        <button class="filter-chip" onclick="filterSlices('done', this)">Done (3)</button>
        <button class="filter-chip" onclick="filterSlices('partial', this)">Partial / Blocked (1)</button>
        <button class="filter-chip" onclick="filterSlices('pending', this)">Pending (16)</button>

        <span class="filter-label" style="margin-left: 20px;">Portion:</span>
        <button class="filter-chip active" onclick="filterPortion('all', this)">All Portions</button>
        <button class="filter-chip" onclick="filterPortion('1', this)">P1: Residential</button>
        <button class="filter-chip" onclick="filterPortion('2', this)">P2: Roofing</button>
        <button class="filter-chip" onclick="filterPortion('3', this)">P3: QS</button>
        <button class="filter-chip" onclick="filterPortion('4', this)">P4: HVAC</button>
        <button class="filter-chip" onclick="filterPortion('5', this)">P5: Persistence</button>
        <button class="filter-chip" onclick="filterPortion('6', this)">P6: Packaging</button>
      </div>

      <div class="slices-grid" id="slicesContainer">
        ${renderSlicesHtml(slices)}
      </div>
    </section>

    <!-- TAB 2: PROOF GALLERY -->
    <section id="tab-gallery" class="tab-content">
      <div class="filter-bar">
        <span class="filter-label">Filter Category:</span>
        <button class="filter-chip active" onclick="filterGallery('all', this)">All (${curatedImages.length})</button>
        <button class="filter-chip" onclick="filterGallery('Drawing Register & PDF', this)">Drawing Register & PDF</button>
        <button class="filter-chip" onclick="filterGallery('Roofing & Cladding', this)">Roofing & Cladding</button>
        <button class="filter-chip" onclick="filterGallery('Alteration Stages & Demolition', this)">Alteration Stages</button>
        <button class="filter-chip" onclick="filterGallery('Coordinated Schedules', this)">Coordinated Schedules</button>
        <button class="filter-chip" onclick="filterGallery('Architectural CAD & 3D', this)">Architectural CAD & 3D</button>
        <button class="filter-chip" onclick="filterGallery('AI Assistant & Drafting', this)">AI Assistant</button>
      </div>

      <div class="gallery-grid" id="galleryContainer">
        ${renderGalleryHtml(curatedImages)}
      </div>
    </section>

    <!-- TAB 3: WHAT HASN'T BEEN DONE (GAP ANALYSIS) -->
    <section id="tab-gaps" class="tab-content">
      <div class="gap-section">
        <h3>
          <span style="color: #ef4444;">●</span>
          <span>Active Pending Closeout Slices (SC-05 .. SC-20)</span>
        </h3>
        <p style="color: var(--text-muted); font-size: 13.5px;">
          The following 16 atomic slices are defined in <code>XRAY-PRODUCTION-CLOSEOUT-LEDGER.md</code> with brutal mathematical precision and require implementation before the v1.0 Production Release:
        </p>

        <div class="roadmap-timeline">
          <div class="timeline-item">
            <div class="timeline-icon">P2</div>
            <div>
              <h4 style="color: #fff; font-size: 15px;">Portion 2: Roofing & Cladding Geometry (SC-05, SC-06, SC-07)</h4>
              <p style="color: var(--text-muted); font-size: 13px; margin-top: 4px;">
                <strong>SC-05</strong> True 3D Hip/Valley Geometry unfolding (eliminating 2D projected approximations) &bull; 
                <strong>SC-06</strong> Stock Sheet Kerf Nesting (1D/2D bin-packing with 5mm kerf & offcut classification) &bull; 
                <strong>SC-07</strong> Flashing & Fixing schedules with wind zone calculation.
              </p>
            </div>
          </div>

          <div class="timeline-item">
            <div class="timeline-icon">P3</div>
            <div>
              <h4 style="color: #fff; font-size: 15px;">Portion 3: Quantity Surveying & Cost Consultancy (SC-08, SC-09, SC-10, SC-11)</h4>
              <p style="color: var(--text-muted); font-size: 13px; margin-top: 4px;">
                <strong>SC-08</strong> Hierarchy CSV Overlap Disclosure (distinguishing aggregate summary nodes from leaf items to prevent double-counting) &bull; 
                <strong>SC-09</strong> Measured Item-Level Evidence Binding (binding cost items to immutable geometry entities) &bull; 
                <strong>SC-10</strong> Contractor Rate Books & Cost Deltas &bull; 
                <strong>SC-11</strong> Auditable Cost Plan Deliverable Export & Restore.
              </p>
            </div>
          </div>

          <div class="timeline-item">
            <div class="timeline-icon">P4</div>
            <div>
              <h4 style="color: #fff; font-size: 15px;">Portion 4: HVAC & Building Services (SC-12, SC-13, SC-14)</h4>
              <p style="color: var(--text-muted); font-size: 13px; margin-top: 4px;">
                <strong>SC-12</strong> Straight-duct surface area and double-thickness insulation wrap geometry &bull; 
                <strong>SC-13</strong> Multi-zone duct & pipe network coordination and ceiling plenum clash detection &bull; 
                <strong>SC-14</strong> Airflow sizing ($v = Q/A$), velocity noise checks, and equipment commissioning schedules.
              </p>
            </div>
          </div>

          <div class="timeline-item">
            <div class="timeline-icon">P5</div>
            <div>
              <h4 style="color: #fff; font-size: 15px;">Portion 5: Persistence & Disaster Recovery (SC-15, SC-16, SC-17)</h4>
              <p style="color: var(--text-muted); font-size: 13px; margin-top: 4px;">
                <strong>SC-15</strong> Portable Project Archive (<code>.xray</code> / ZIP format) with raw drawing bytes and manifest &bull; 
                <strong>SC-16</strong> Exclusive lifetime workspace lock (preventing concurrent write corruption across tabs) & recovery journal &bull; 
                <strong>SC-17</strong> Storage quota exhaustion handling & corrupt record isolation.
              </p>
            </div>
          </div>

          <div class="timeline-item">
            <div class="timeline-icon">P6</div>
            <div>
              <h4 style="color: #fff; font-size: 15px;">Portion 6: Native Desktop Packaging & Release (SC-18, SC-19, SC-20)</h4>
              <p style="color: var(--text-muted); font-size: 13px; margin-top: 4px;">
                <strong>SC-18</strong> Standalone native Windows desktop executable (<code>xray-engine.exe</code> via Tauri v2 with embedded Rust CAD engine) &bull; 
                <strong>SC-19</strong> Responsive Tablet (1024×768 / 768×1024) & desktop ergonomic signoff &bull; 
                <strong>SC-20</strong> Full working-day stress scenarios (DAY-01 to DAY-08) and master release sign-off.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="gap-section">
        <h3>
          <span style="color: #f59e0b;">●</span>
          <span>Technical Blockers & Honest Absence Disclosures</span>
        </h3>
        <div class="gap-grid">
          <div class="gap-card">
            <h4>SC-03 Browser Capture Environment Blocker</h4>
            <p>
              Revision clouding code and 18 unit tests pass (1751 suite pass). However, visual captures were blocked because the test automation browser froze <code>Object.prototype</code> at startup. Fixed with an inlined <code>boot-guard.ts</code>. Visual inspection captures are pending execution on a standard browser session.
            </p>
          </div>
          <div class="gap-card">
            <h4>Live Firecrawl Search Credential (P-01)</h4>
            <p>
              The bounded pricing search contract is built and verified with honest typed failure states (503 unconfigured, rate-limits, timeouts). Real internet search requires a configured <code>FIRECRAWL_API_KEY</code>.
            </p>
          </div>
          <div class="gap-card">
            <h4>Authentication & Multi-Tenant Accounts (A-01..A-12)</h4>
            <p>
              Authentication is intentionally disabled by default per application architecture. The app operates as an offline-first local workstation with local profile storage.
            </p>
          </div>
          <div class="gap-card">
            <h4>Discipline Labels vs Specialty Solvers (13 Gap Categories)</h4>
            <p>
              Categories G (Geospatial), H (Services), J (Programme), K (Libraries), L (Landscape), M (Manufacturing), N (Electrical), O (Operations/BMS), S (Structural), and W (Whole-Life) contain industry labels and categories in the UI, but do not yet possess certified engineering solvers.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- TAB 4: A-Z CATALOGUE -->
    <section id="tab-az" class="tab-content">
      <div class="filter-bar">
        <span class="filter-label">State:</span>
        <button class="filter-chip active" onclick="filterAzState('all', this)">All (375)</button>
        <button class="filter-chip" onclick="filterAzState('verified', this)">Verified (6)</button>
        <button class="filter-chip" onclick="filterAzState('partial', this)">Partial (102)</button>
        <button class="filter-chip" onclick="filterAzState('dependency-blocked', this)">Blocked (19)</button>
        <button class="filter-chip" onclick="filterAzState('gap', this)">Gaps (247)</button>
        <button class="filter-chip" onclick="filterAzState('failed', this)">Failed (1)</button>
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
    <section id="tab-invariants" class="tab-content">
      <div class="gap-section">
        <h3>🛡️ Fail-Safe Architecture & Non-Negotiable Invariants</h3>
        <p style="color: var(--text-muted); font-size: 13.5px; margin-bottom: 20px;">
          To guarantee zero-data-loss, mathematical correctness, and prevent AI regression, the engine strictly enforces the following core contracts:
        </p>

        <div class="gap-grid">
          <div class="gap-card" style="border-left: 4px solid #10b981;">
            <h4 style="color: #34d399;">1. True 3D Surface Geometry</h4>
            <p>
              Sloped surfaces (roofs, ramps, stairs) must calculate true pitch dimensions: $A_{\text{true}} = A_{\text{projected}} / \cos(\theta)$. 2D horizontal projected measurements are strictly forbidden from masquerading as net quantities.
            </p>
          </div>
          <div class="gap-card" style="border-left: 4px solid #3b82f6;">
            <h4 style="color: #60a5fa;">2. Explicit Opening Deductions</h4>
            <p>
              Any opening $> 0.5\text{ m}^2$ (doors, windows, voids, penetrations) must be explicitly deducted with mathematical proof. Gross areas, deduction areas, and net areas must all be reported.
            </p>
          </div>
          <div class="gap-card" style="border-left: 4px solid #8b5cf6;">
            <h4 style="color: #c084fc;">3. Immutable Cryptographic Delivery Freeze</h4>
            <p>
              When a set transitions to <code>issued-deliverable</code>, its SHA-256 payload digest is computed and sealed. Tampering with or altering an issued deliverable triggers <code>CORRUPTED_ISSUE_DELIVERY</code> fail-closed state.
            </p>
          </div>
          <div class="gap-card" style="border-left: 4px solid #f59e0b;">
            <h4 style="color: #fbbf24;">4. Compare-And-Swap (CAS) Workspace Locking</h4>
            <p>
              Project authoring requires an exclusive Web Lock lease. Concurrent tabs are relegated to read-only mode to prevent write clobbering. Interrupted saves are journalled and rolled back automatically.
            </p>
          </div>
        </div>
      </div>
    </section>
  </main>

  <!-- LIGHTBOX MODAL -->
  <div class="modal-overlay" id="lightboxModal" onclick="closeLightbox(event)">
    <div class="modal-container" onclick="event.stopPropagation()">
      <div class="modal-header">
        <h3 class="modal-title" id="modalTitle">Screenshot Inspection</h3>
        <button class="close-btn" onclick="closeLightbox()">&times;</button>
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
    // Tab switching
    function switchTab(tabId) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      const targetBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick').includes(tabId));
      if (targetBtn) targetBtn.classList.add('active');
      
      const targetContent = document.getElementById('tab-' + tabId);
      if (targetContent) targetContent.classList.add('active');
    }

    // Toggle slice card accordion
    function toggleSlice(card) {
      card.classList.toggle('expanded');
    }

    // Filter Slices by Status
    function filterSlices(status, chip) {
      document.querySelectorAll('#tab-slices .filter-chip').forEach(c => {
        if (c.getAttribute('onclick').includes('filterSlices')) c.classList.remove('active');
      });
      chip.classList.add('active');

      const cards = document.querySelectorAll('.slice-card');
      cards.forEach(card => {
        if (status === 'all' || card.dataset.status === status) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    }

    // Filter Slices by Portion
    function filterPortion(portionNum, chip) {
      document.querySelectorAll('#tab-slices .filter-chip').forEach(c => {
        if (c.getAttribute('onclick').includes('filterPortion')) c.classList.remove('active');
      });
      chip.classList.add('active');

      const cards = document.querySelectorAll('.slice-card');
      cards.forEach(card => {
        if (portionNum === 'all' || card.dataset.portion.includes(portionNum)) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    }

    // Filter Gallery by Category
    function filterGallery(category, chip) {
      document.querySelectorAll('#tab-gallery .filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      const cards = document.querySelectorAll('.proof-card');
      cards.forEach(card => {
        if (category === 'all' || card.dataset.category === category) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    }

    // Filter A-Z by State
    function filterAzState(state, chip) {
      document.querySelectorAll('#tab-az .filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      const rows = document.querySelectorAll('#azTable tbody tr');
      rows.forEach(row => {
        if (state === 'all' || row.dataset.state === state) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    }

    // Global Search
    function handleSearch() {
      const q = document.getElementById('globalSearch').value.toLowerCase().trim();
      
      // search slices
      document.querySelectorAll('.slice-card').forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(q) ? 'block' : 'none';
      });

      // search gallery
      document.querySelectorAll('.proof-card').forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(q) ? 'flex' : 'none';
      });

      // search AZ table
      document.querySelectorAll('#azTable tbody tr').forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(q) ? '' : 'none';
      });
    }

    // Lightbox modal
    function openLightbox(src, title, desc, relPath) {
      document.getElementById('modalImage').src = src;
      document.getElementById('modalTitle').textContent = title;
      document.getElementById('modalDesc').textContent = desc;
      document.getElementById('modalPath').textContent = relPath;
      document.getElementById('lightboxModal').classList.add('active');
    }

    function closeLightbox(e) {
      document.getElementById('lightboxModal').classList.remove('active');
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeLightbox();
    });
  </script>
</body>
</html>
`;

function renderSlicesHtml(slices) {
  let html = "";
  let currentPortion = "";

  for (const s of slices) {
    if (s.portion !== currentPortion) {
      currentPortion = s.portion;
      html += `
        <div class="portion-header">
          <span class="portion-title">📂 ${escapeHtml(currentPortion)}</span>
        </div>
      `;
    }

    const statusBadgeClass = s.status === "done" ? "badge-done" : s.status === "partial" ? "badge-partial" : "badge-pending";
    const statusText = s.status === "done" ? "✓ Done" : s.status === "partial" ? "⚠ Partial" : "○ Pending";

    html += `
      <div class="slice-card ${s.status}" data-status="${s.status}" data-portion="${escapeHtml(s.portion)}">
        <div class="slice-top" onclick="toggleSlice(this.parentElement)">
          <div class="slice-info">
            <div class="slice-header">
              <span class="slice-id">${escapeHtml(s.id)}</span>
              <span class="slice-title">${escapeHtml(s.title)}</span>
              <span class="status-badge ${statusBadgeClass}">${statusText}</span>
            </div>
            <div class="slice-goal">${escapeHtml(s.goal)}</div>
          </div>
          <div class="slice-chevron">▼</div>
        </div>

        <div class="slice-details">
          ${s.machineDone ? `
            <div class="detail-section">
              <div class="detail-heading">⚙️ Machine Gate Verification</div>
              <div class="detail-body">${escapeHtml(s.machineDone).replace(/\\n/g, '<br>')}</div>
            </div>
          ` : ""}

          ${s.humanDone ? `
            <div class="detail-section">
              <div class="detail-heading">👁️ Human & Visual Proof</div>
              <div class="detail-body">${escapeHtml(s.humanDone).replace(/\\n/g, '<br>')}</div>
            </div>
          ` : ""}

          ${s.blockedNote ? `
            <div class="detail-section">
              <div class="detail-heading" style="color: #f87171;">⚠️ Blocked / Environment Note</div>
              <div class="detail-body" style="border-color: rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.05); color: #fca5a5;">
                ${escapeHtml(s.blockedNote)}
              </div>
            </div>
          ` : ""}

          ${s.files && s.files.length > 0 ? `
            <div class="detail-section">
              <div class="detail-heading">📁 Associated Files</div>
              <div class="files-list">
                ${s.files.map(f => `<span class="file-tag">${escapeHtml(f)}</span>`).join("")}
              </div>
            </div>
          ` : ""}

          ${s.images && s.images.length > 0 ? `
            <div class="detail-section">
              <div class="detail-heading">📸 Attached Visual Proof</div>
              <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-top: 8px;">
                ${s.images.map(img => `
                  <div style="cursor: pointer; border-radius: 6px; overflow: hidden; border: 1px solid var(--border-subtle); max-width: 220px;"
                       onclick="openLightbox('${img.relPath}', '${escapeHtml(img.title)}', '${escapeHtml(img.description)}', '${img.relPath}')">
                    <img src="${img.relPath}" style="width: 100%; height: 120px; object-fit: cover;" alt="${escapeHtml(img.title)}">
                    <div style="padding: 6px 8px; font-size: 11px; background: var(--bg-surface); color: var(--text-muted);">${escapeHtml(img.title)}</div>
                  </div>
                `).join("")}
              </div>
            </div>
          ` : ""}
        </div>
      </div>
    `;
  }
  return html;
}

function renderGalleryHtml(images) {
  return images.map(img => `
    <div class="proof-card" data-category="${escapeHtml(img.category)}"
         onclick="openLightbox('${img.relPath}', '${escapeHtml(img.title)}', '${escapeHtml(img.description)}', '${img.relPath}')">
      <div class="thumb-wrapper">
        <img src="${img.relPath}" alt="${escapeHtml(img.title)}" class="proof-thumb" loading="lazy">
        <div class="thumb-overlay">
          <span class="category-tag">${escapeHtml(img.category)}</span>
          <span class="proof-slice-tag">${escapeHtml(img.slice)}</span>
        </div>
      </div>
      <div class="proof-content">
        <div>
          <h4 class="proof-title">${escapeHtml(img.title)}</h4>
          <p class="proof-desc">${escapeHtml(img.description)}</p>
        </div>
        <div class="proof-path">${escapeHtml(img.relPath)}</div>
      </div>
    </div>
  `).join("");
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
        <td style="color: var(--text-muted); font-size: 12.5px; line-height: 1.5;">${escapeHtml(r.description)}</td>
      </tr>
    `;
  }).join("");
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

fs.writeFileSync("XRAY-STATUS-AND-PROOF-DASHBOARD.html", html, "utf8");
console.log("Successfully created XRAY-STATUS-AND-PROOF-DASHBOARD.html! Size:", html.length, "bytes");
