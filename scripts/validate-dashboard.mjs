import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const htmlPath = path.resolve(process.argv[2] ?? "XRAY-STATUS-AND-PROOF-DASHBOARD.html");
const errors = [];
const checks = [];

function check(condition, message) {
  checks.push({ ok: Boolean(condition), message });
  if (!condition) errors.push(message);
}

function readRequired(relativePath) {
  const absolutePath = path.resolve(root, relativePath);
  check(fs.existsSync(absolutePath), `Required file exists: ${relativePath}`);
  return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, "utf8") : "";
}

const html = readRequired(path.relative(root, htmlPath));
const ledger = readRequired("XRAY-PRODUCTION-CLOSEOUT-LEDGER.md");
const checklist = readRequired("PROFESSIONAL-A-Z-CHECKLIST.md");
const curatedSource = readRequired("dashboard-curated-images.json");
let curatedImages = [];
try {
  curatedImages = JSON.parse(curatedSource);
  check(Array.isArray(curatedImages), "Curated proof manifest is an array");
} catch (error) {
  check(false, `Curated proof manifest parses as JSON: ${error.message}`);
}

function parseFields(body) {
  const fields = new Map();
  let active = null;
  for (const line of body.split(/\r?\n/)) {
    const heading = line.match(/^\*\s+\*\*([^*]+)\*\*:\s*(.*)$/);
    if (heading) {
      active = heading[1].trim();
      fields.set(active, [heading[2]]);
      continue;
    }
    if (/^#{1,6}\s|^---\s*$/.test(line)) {
      active = null;
      continue;
    }
    if (active) fields.get(active).push(line);
  }
  return new Map([...fields].map(([name, lines]) => [name, lines.join("\n").trim()]));
}

function parseSlices(source) {
  const result = [];
  let portion = 0;
  let active = null;
  const finish = () => {
    if (!active) return;
    active.fields = parseFields(active.body.join("\n"));
    delete active.body;
    result.push(active);
    active = null;
  };
  for (const line of source.split(/\r?\n/)) {
    const portionHeading = line.match(/^###\s+PORTION\s+(\d+):\s+(.+)$/);
    if (portionHeading) {
      finish();
      portion = Number(portionHeading[1]);
      continue;
    }
    const sliceHeading = line.match(/^####\s+(SC-\d+)\s+[—-]\s+(.+?)\s+`\[\[(done|partial|pending|blocked)\]\]`\s*$/i);
    if (sliceHeading) {
      finish();
      active = { id: sliceHeading[1], title: sliceHeading[2], status: sliceHeading[3].toLowerCase(), portion, body: [] };
      continue;
    }
    if (active && /^##\s+/.test(line)) {
      finish();
      continue;
    }
    if (active) active.body.push(line);
  }
  finish();
  return result;
}

function parseRequirements(source) {
  const rows = [];
  let category = null;
  for (const line of source.split(/\r?\n/)) {
    const categoryHeading = line.match(/^###\s+([A-Z]|SO|PH)\s+[—-]\s+(.+)$/);
    if (categoryHeading) {
      category = categoryHeading[1];
      continue;
    }
    const row = line.match(/^-\s+\[([ xX])\]\s+\*\*([A-Z0-9-]+)\s+(.*?)\*\*\s+[—-]\s+(.+)$/);
    if (!row || !category) continue;
    const description = row[4];
    const checked = row[1].toLowerCase() === "x";
    const state = /State:\s*verified/i.test(description) || checked ? "verified"
      : /State:\s*partial/i.test(description) ? "partial"
        : /State:\s*dependency-blocked/i.test(description) ? "dependency-blocked"
          : /State:\s*failed/i.test(description) ? "failed"
            : "gap";
    rows.push({ id: row[2], category, state });
  }
  return rows;
}

function decodeEntities(value) {
  return String(value ?? "")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function parseAttributes(source) {
  const attributes = {};
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    attributes[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attributes;
}

function parseHtml(source) {
  const document = { tag: "#document", attrs: {}, children: [], parent: null };
  const elements = [];
  const parseErrors = [];
  const stack = [document];
  const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  const tokenPattern = /<!--[\s\S]*?-->|<!DOCTYPE[^>]*>|<\/?[A-Za-z][^<>]*?>/gi;
  let token;
  while ((token = tokenPattern.exec(source)) !== null) {
    const value = token[0];
    if (/^<!--/.test(value) || /^<!DOCTYPE/i.test(value)) continue;
    const closing = value.match(/^<\/\s*([A-Za-z][\w:-]*)\s*>$/);
    if (closing) {
      const tag = closing[1].toLowerCase();
      let index = stack.length - 1;
      while (index > 0 && stack[index].tag !== tag) index -= 1;
      if (index === 0) parseErrors.push(`Closing tag has no open element: </${tag}>`);
      else {
        if (index !== stack.length - 1) parseErrors.push(`Closing </${tag}> crosses open <${stack.at(-1).tag}>`);
        stack.length = index;
      }
      continue;
    }
    const opening = value.match(/^<\s*([A-Za-z][\w:-]*)([\s\S]*?)\/?\s*>$/);
    if (!opening) continue;
    const tag = opening[1].toLowerCase();
    const node = { tag, attrs: parseAttributes(opening[2]), children: [], parent: stack.at(-1) };
    stack.at(-1).children.push(node);
    elements.push(node);
    if (!voidTags.has(tag) && !/\/>$/.test(value)) stack.push(node);
  }
  if (stack.length > 1) parseErrors.push(`Unclosed elements: ${stack.slice(1).map(node => node.tag).join(", ")}`);
  return { document, elements, parseErrors };
}

function hasClass(node, className) {
  return (node.attrs.class ?? "").split(/\s+/).includes(className);
}

function hasAncestor(node, predicate) {
  let current = node.parent;
  while (current) {
    if (predicate(current)) return true;
    current = current.parent;
  }
  return false;
}

function isSafeLocalPath(value) {
  const localPath = String(value ?? "").trim().replaceAll("\\", "/");
  return Boolean(localPath)
    && !/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|[a-z]:\/)/i.test(localPath)
    && !localPath.split("/").includes("..");
}

const slices = parseSlices(ledger);
const requirements = parseRequirements(checklist);
const gateLine = ledger.match(/^\*\*Last executed machine gate\*\*:\s*(.+)$/im)?.[1] ?? "";
const gate = gateLine.match(/([\d,]+)\s*\/\s*([\d,]+)\s+passing\b/i);
const suites = gateLine.match(/\bacross\s+([\d,]+)\s+suites\b/i);
const expected = {
  slices: slices.length,
  done: slices.filter(slice => slice.status === "done").length,
  partial: slices.filter(slice => slice.status === "partial").length,
  blocked: slices.filter(slice => slice.status === "blocked").length,
  pending: slices.filter(slice => slice.status === "pending").length,
  requirements: requirements.length,
  proofs: curatedImages.length,
  testsPassing: gate ? Number(gate[1].replaceAll(",", "")) : null,
  testsTotal: gate ? Number(gate[2].replaceAll(",", "")) : null,
  testSuites: suites ? Number(suites[1].replaceAll(",", "")) : "unknown",
  tscExitZero: /(?:tsc|typescript|typecheck)[^\n;]*exit\s+0/i.test(gateLine),
};
const requirementStates = Object.fromEntries(["verified", "partial", "dependency-blocked", "gap", "failed"]
  .map(state => [state, requirements.filter(row => row.state === state).length]));

check(/^<!DOCTYPE html>/i.test(html.trimStart()), "HTML has an HTML5 doctype");
const dom = parseHtml(html);
dom.parseErrors.forEach(error => check(false, `DOM parse: ${error}`));
const { elements } = dom;
const ids = new Map();
for (const element of elements) {
  if (!element.attrs.id) continue;
  if (ids.has(element.attrs.id)) check(false, `Duplicate id: ${element.attrs.id}`);
  ids.set(element.attrs.id, element);
}

const sliceCards = elements.filter(element => hasClass(element, "slice-card"));
const proofCards = elements.filter(element => hasClass(element, "proof-card"));
const azRows = elements.filter(element => element.tag === "tr" && element.attrs["data-state"] && hasAncestor(element, ancestor => ancestor.attrs.id === "azTable"));
const tabPanels = elements.filter(element => element.attrs.role === "tabpanel");
const tabs = elements.filter(element => element.attrs.role === "tab");
const filterButtons = elements.filter(element => element.attrs["data-filter-group"]);

check(sliceCards.length === expected.slices, `Rendered slice cards match ledger (${sliceCards.length}/${expected.slices})`);
check(proofCards.length === expected.proofs, `Rendered proof cards match manifest (${proofCards.length}/${expected.proofs})`);
check(azRows.length === expected.requirements, `Rendered A-Z rows match checklist (${azRows.length}/${expected.requirements})`);
check(tabPanels.length === 5 && tabs.length === 5, "Five parsed tabs and tab panels are present");

for (const slice of slices) {
  const card = sliceCards.find(element => element.attrs["data-slice-id"] === slice.id);
  check(Boolean(card), `${slice.id} has one rendered card`);
  if (!card) continue;
  check(card.attrs["data-status"] === slice.status, `${slice.id} status matches the ledger`);
  check(card.attrs["data-portion"] === String(slice.portion), `${slice.id} has exact numeric data-portion=${slice.portion}`);
  const completionChips = elements.filter(element => hasClass(element, "slice-completed") && hasAncestor(element, ancestor => ancestor === card));
  check(completionChips.length === (slice.status === "done" ? 1 : 0), `${slice.id} completion-date chip appears only for done status`);
  if (slice.status === "done") {
    check(Boolean(slice.fields.get("DONE (machine)")), `${slice.id} done status has machine evidence`);
    check(Boolean(slice.fields.get("DONE (human)")), `${slice.id} done status has human/visual evidence`);
    check(curatedImages.some(image => image.slice === slice.id), `${slice.id} done status has a curated visual proof`);
  }
}

for (const proof of curatedImages) {
  check(isSafeLocalPath(proof.relPath), `Proof path is safe and local: ${proof.relPath}`);
  check(fs.existsSync(path.resolve(root, proof.relPath)), `Proof file exists: ${proof.relPath}`);
  check(proofCards.some(card => card.attrs["data-src"] === proof.relPath), `Proof is rendered: ${proof.relPath}`);
}

const expectedCategories = [...new Set(curatedImages.map(image => image.category))].sort();
const galleryFilters = filterButtons.filter(button => button.attrs["data-filter-group"] === "gallery-category");
check(galleryFilters.length === expectedCategories.length + 1, "Gallery filters are generated from every current category plus All");
check(expectedCategories.every(category => galleryFilters.some(button => button.attrs["data-filter-value"] === category)), "Every gallery category has an exact filter");
const expectedPortions = [...new Set(slices.map(slice => String(slice.portion)))].sort();
const portionFilters = filterButtons.filter(button => button.attrs["data-filter-group"] === "slice-portion");
check(portionFilters.length === expectedPortions.length + 1, "Portion filters are generated from every numeric ledger portion plus All");
check(expectedPortions.every(portion => portionFilters.some(button => button.attrs["data-filter-value"] === portion)), "Every numeric portion has an exact filter");

const body = elements.find(element => element.tag === "body");
check(body?.attrs["data-source-slices"] === String(expected.slices), "Body slice source count has not drifted");
check(body?.attrs["data-source-requirements"] === String(expected.requirements), "Body A-Z source count has not drifted");
check(body?.attrs["data-source-proofs"] === String(expected.proofs), "Body proof source count has not drifted");
const kpi = name => elements.find(element => element.attrs["data-kpi"] === name);
const sliceKpi = kpi("slices");
check(sliceKpi?.attrs["data-total"] === String(expected.slices), "Slice KPI total matches source");
check(sliceKpi?.attrs["data-done"] === String(expected.done), "Slice KPI done count matches source");
check(sliceKpi?.attrs["data-partial"] === String(expected.partial), "Slice KPI partial count matches source");
check(sliceKpi?.attrs["data-blocked"] === String(expected.blocked), "Slice KPI blocked count matches source");
check(sliceKpi?.attrs["data-pending"] === String(expected.pending), "Slice KPI pending count matches source");
const proofKpi = kpi("proofs");
check(proofKpi?.attrs["data-total"] === String(expected.proofs), "Proof KPI total matches source");
const azKpi = kpi("az");
check(azKpi?.attrs["data-total"] === String(expected.requirements), "A-Z KPI total matches source");
for (const [state, count] of Object.entries(requirementStates)) {
  const attribute = state === "dependency-blocked" ? "data-blocked" : `data-${state}`;
  check(azKpi?.attrs[attribute] === String(count), `A-Z KPI ${state} count matches source`);
}
check(Boolean(gate), "Ledger has an explicit current machine-gate count");
const testsKpi = kpi("tests");
if (gate) {
  check(testsKpi?.attrs["data-passing"] === String(expected.testsPassing), "Test KPI passing count matches current gate");
  check(testsKpi?.attrs["data-total"] === String(expected.testsTotal), "Test KPI total count matches current gate");
  check(testsKpi?.attrs["data-suites"] === String(expected.testSuites), "Test KPI suite count matches current gate");
  check(testsKpi?.attrs["data-tsc"] === (expected.tscExitZero ? "exit-0" : "unknown"), "TypeScript KPI matches current gate");
}

check(elements.filter(element => element.attrs.onclick).length === 0, "Generated controls do not depend on inline onclick handlers");
check(elements.filter(element => element.tag === "button").every(button => button.attrs.type === "button"), "Every button declares type=button");
check(/button,\s*\n\s*input\s*\{[^}]*min-height:\s*44px/s.test(html), "Buttons and search input have a 44px minimum target");
for (const tab of tabs) {
  check(tab.tag === "button" && tab.attrs["aria-controls"] && ids.has(tab.attrs["aria-controls"]), `Tab ${tab.attrs.id ?? "(missing id)"} controls a real panel`);
  check(["true", "false"].includes(tab.attrs["aria-selected"]), `Tab ${tab.attrs.id ?? "(missing id)"} declares aria-selected`);
}
for (const panel of tabPanels) {
  check(panel.attrs["aria-labelledby"] && ids.has(panel.attrs["aria-labelledby"]), `Panel ${panel.attrs.id ?? "(missing id)"} has a real label`);
}
const search = ids.get("globalSearch");
check(search?.tag === "input" && search.attrs.type === "search", "Global search is a semantic search input");
check(elements.some(element => element.tag === "label" && element.attrs.for === "globalSearch"), "Global search has an explicit label");
const modal = elements.find(element => element.attrs.role === "dialog");
check(modal?.attrs["aria-modal"] === "true", "Lightbox is an aria-modal dialog");
check(Boolean(modal?.attrs["aria-labelledby"] && ids.has(modal.attrs["aria-labelledby"])), "Lightbox has a real title reference");
check(Boolean(modal?.attrs["aria-describedby"] && ids.has(modal.attrs["aria-describedby"])), "Lightbox has a real description reference");
check(elements.some(element => hasClass(element, "close-btn") && element.tag === "button" && element.attrs["aria-label"]), "Lightbox has a labelled close button");
check(ids.get("lightboxModal")?.attrs.hidden === "", "Lightbox overlay starts hidden");
const accordionButtons = elements.filter(element => hasClass(element, "slice-top"));
check(accordionButtons.length === expected.slices, "Every slice has one accordion control");
for (const button of accordionButtons) {
  const controlled = ids.get(button.attrs["aria-controls"]);
  check(button.tag === "button" && button.attrs["aria-expanded"] === "false", `${button.attrs.id ?? "Slice"} is a collapsed semantic button`);
  check(controlled?.attrs.role === "region" && controlled.attrs.hidden === "", `${button.attrs.id ?? "Slice"} controls a hidden labelled region`);
}
check(proofCards.every(card => card.tag === "button" && card.attrs["aria-label"] && card.attrs["data-lightbox"] === ""), "Every gallery proof is a labelled button");
check(filterButtons.every(button => button.tag === "button" && ["true", "false"].includes(button.attrs["aria-pressed"])), "Every filter is a pressed-state button");
for (const element of elements) {
  for (const attribute of ["aria-controls", "aria-labelledby", "aria-describedby"]) {
    if (!element.attrs[attribute]) continue;
    for (const reference of element.attrs[attribute].split(/\s+/)) check(ids.has(reference), `${attribute} references existing id ${reference}`);
  }
}

const localAnchors = elements.filter(element => element.tag === "a");
check(localAnchors.every(anchor => isSafeLocalPath(anchor.attrs.href)), "All rendered anchors use safe local paths");
check(localAnchors.some(anchor => hasClass(anchor, "md-link")), "Ledger Markdown links render as local anchors");
check(elements.some(element => element.tag === "code" && hasAncestor(element, ancestor => hasClass(ancestor, "detail-body"))), "Ledger code spans render as code elements");
const detailBodies = [...html.matchAll(/<div class="detail-body"[^>]*>([\s\S]*?)<\/div>/g)].map(match => match[1]);
check(detailBodies.every(bodyHtml => !/`[^`]+`|\[[^\]]+\]\([^)]+\)/.test(bodyHtml)), "Rendered detail bodies contain no raw Markdown links or code ticks");
check(html.includes("statusMatch && portionMatch && searchMatch"), "Slice status, exact portion, and search filters are combined");
check(html.includes("categoryMatch && searchMatch"), "Gallery category and search filters are combined");
check(html.includes("stateMatch && searchMatch"), "A-Z state and search filters are combined");

for (const result of checks.filter(result => !result.ok)) console.error(`FAIL ${result.message}`);
console.log(`${errors.length ? "FAIL" : "PASS"} Dashboard validation: ${checks.length - errors.length}/${checks.length} checks passed.`);
if (errors.length) {
  console.error(`Validation failed with ${errors.length} error(s).`);
  process.exitCode = 1;
}
