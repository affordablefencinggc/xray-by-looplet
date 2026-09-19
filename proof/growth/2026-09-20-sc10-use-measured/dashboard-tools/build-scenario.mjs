/**
 * Source-derived dashboard browser scenario. Building JSON is source generation,
 * not product-test evidence. Execute only through the DANS1 raw-CDP runner.
 * Regenerate after ledger, checklist, or curated proof changes.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const outputDirectory = dirname(fileURLToPath(import.meta.url));
const root = resolve(outputDirectory, "../../..");
const sourcePaths = [
  "XRAY-PRODUCTION-CLOSEOUT-LEDGER.md",
  "PROFESSIONAL-A-Z-CHECKLIST.md",
  "dashboard-curated-images.json",
  "scripts/build-full-dashboard.mjs",
];
const sources = Object.fromEntries(sourcePaths.map(file => [file, readFileSync(resolve(root, file))]));
const ledger = sources[sourcePaths[0]].toString("utf8");
const checklist = sources[sourcePaths[1]].toString("utf8");
const images = JSON.parse(sources[sourcePaths[2]].toString("utf8"))
  .map(({ category, title, slice, relPath, description }) => ({ category, title, slice, relPath, description }));
const sourceHashes = Object.fromEntries(sourcePaths.map(file => [file, createHash("sha256").update(sources[file]).digest("hex")]));

const slices = [];
const portions = [];
let portion;
let slice;
for (const line of ledger.split(/\r?\n/)) {
  const portionMatch = line.match(/^### PORTION (\d+): (.+)$/);
  const sliceMatch = line.match(/^#### (SC-\d+) [\u2014-] (.+) `\[\[(done|partial|pending|blocked)\]\]`$/);
  if (portionMatch) {
    portion = { number: Number(portionMatch[1]), label: `Portion ${portionMatch[1]}: ${portionMatch[2]}` };
    portions.push(portion);
    slice = null;
  } else if (sliceMatch) {
    if (!portion) throw Error("Slice has no source portion");
    slice = { id: sliceMatch[1], title: sliceMatch[2], status: sliceMatch[3], portion: portion.number, body: [] };
    slices.push(slice);
  } else if (/^## /.test(line)) {
    slice = null;
  } else if (slice) {
    slice.body.push(line);
  }
}
if (!slices.length || !images.length) throw Error("Dashboard source contains no slices or proof images");

const requirements = [];
let category;
for (const line of checklist.split(/\r?\n/)) {
  const categoryMatch = line.match(/^### ([A-Z]|SO|PH) [\u2014-] (.+)$/);
  if (categoryMatch) category = categoryMatch[1];
  const row = line.match(/^- \[([ xX])\] \*\*([A-Z0-9-]+) (.*?)\*\* [\u2014-] (.+)$/);
  if (!row || !category) continue;
  const recordedState = row[4].match(/State:\s*(verified|partial|dependency-blocked|failed|gap)\b/i)?.[1].toLowerCase();
  requirements.push({ id: row[2], title: row[3], category, state: row[1].toLowerCase() === "x" ? "verified" : recordedState ?? "gap", description: row[4] });
}
if (!requirements.length) throw Error("No A-Z source requirements parsed");
const countBy = (values, field, states) => Object.fromEntries(states.map(state => [state, values.filter(value => value[field] === state).length]));
const sliceCounts = countBy(slices, "status", ["done", "partial", "blocked", "pending"]);
const azCounts = countBy(requirements, "state", ["verified", "partial", "dependency-blocked", "gap", "failed"]);
const gateLine = ledger.match(/^\*\*Last executed machine gate\*\*:\s*(.+)$/m)?.[1] ?? "";
const gateMatch = gateLine.match(/([\d,]+)\s*\/\s*([\d,]+)\s+passing\b/i);
const suitesMatch = gateLine.match(/\bacross\s+([\d,]+)\s+suites\b/i);
const gate = gateMatch ? {
  passing: Number(gateMatch[1].replaceAll(",", "")), total: Number(gateMatch[2].replaceAll(",", "")), suites: suitesMatch ? Number(suitesMatch[1].replaceAll(",", "")) : "unknown",
} : { passing: "unknown", total: "unknown", suites: "unknown" };
gate.tsc = /(?:tsc|typescript|typecheck)[^\n;]*exit\s+0/i.test(gateLine) ? "exit-0" : "unknown";

// Only values rendered in the dashboard are eligible Markdown fixtures.
const renderedMarkdown = requirements.map(row => row.description);
for (const entry of slices) {
  let selectedField = false;
  for (const line of entry.body) {
    const field = line.match(/^\*\s+\*\*([^*]+)\*\*:\s*(.*)$/);
    if (field) {
      selectedField = /^(Goal|DONE \(machine\)|DONE \(human\)|NOT DONE \(human\)|Proof|Machine evidence|BLOCKED.*)$/.test(field[1]);
      if (selectedField) renderedMarkdown.push(field[2]);
    } else if (/^#{1,6}\s|^---\s*$/.test(line)) selectedField = false;
    else if (selectedField) renderedMarkdown.push(line);
  }
}
const safeHref = href => {
  const value = href.trim().replaceAll("\\", "/");
  return value && !/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|[a-z]:\/)/i.test(value) && !value.split("/").includes("..") ? value : null;
};
const markdownTokens = renderedMarkdown.flatMap(text => [...text.matchAll(/(`[^`\n]+`|\[[^\]\n]+\]\([^)\n]+\)|\*\*[^*\n]+\*\*)/g)].map(match => match[0]));
const markdownLinks = markdownTokens.filter(token => token.startsWith("[")).map(token => token.match(/^\[([^\]]+)\]\(([^)]+)\)$/))
  .map(match => ({ label: match[1], href: safeHref(match[2]) })).filter(link => link.href);
const markdownCodes = [...new Set(markdownTokens.filter(token => token.startsWith("`")).map(token => token.slice(1, -1)))];
if (!markdownLinks.length || !markdownCodes.length) throw Error("Source has no local Markdown link/code examples to verify");

const expected = {
  slices: slices.map(({ body, ...rest }) => rest), portions, sliceCounts,
  requirements: requirements.map(({ description, ...rest }) => rest), azCounts,
  gate, images, markdownLinks, markdownCodes,
};
const target = slices.find(entry => entry.id === "SC-10") ?? slices[0];
const targetPortion = portions.find(entry => entry.number === target.portion);
const filterStatus = target.status === "blocked" ? "partial" : target.status;
const filterLabel = {
  done: `Done (${sliceCounts.done})`, partial: `Partial / Blocked (${sliceCounts.partial + sliceCounts.blocked})`, pending: `Pending (${sliceCounts.pending})`,
}[filterStatus];
const otherStatus = ["done", "pending", "partial"].find(state => state !== filterStatus && (state !== "partial" || target.status !== "blocked"));
const otherLabel = {
  done: `Done (${sliceCounts.done})`, partial: `Partial / Blocked (${sliceCounts.partial + sliceCounts.blocked})`, pending: `Pending (${sliceCounts.pending})`,
}[otherStatus];
const imageTarget = images[0];
const azTarget = requirements.find(row => row.state === "failed") ?? requirements.find(row => row.state !== "verified") ?? requirements[0];
const azLabel = state => state === "dependency-blocked" ? "Blocked" : state === "gap" ? "Gaps" : state[0].toUpperCase() + state.slice(1);

const helpers = `
const expected = window.__dashboardExpected;
const assert = (condition, message) => { if (!condition) throw Error(message); };
const norm = value => String(value).replace(/\\s+/g, ' ').trim();
const same = (actual, wanted, message) => assert(JSON.stringify(actual) === JSON.stringify(wanted), message + ': ' + JSON.stringify({actual,wanted}));
const visible = element => !!element && !element.closest('[hidden]') && element.getClientRects().length > 0;
const shownSlices = () => [...document.querySelectorAll('.slice-card')].filter(visible).map(card => card.dataset.sliceId);
const shownProofs = () => [...document.querySelectorAll('.proof-card')].filter(visible).map(card => card.dataset.path);
const shownRequirements = () => [...document.querySelectorAll('#azTable tbody tr')].filter(visible).map(row => row.querySelector('.az-id').textContent.trim());
const search = query => { const input = document.getElementById('globalSearch'); assert(input, 'Search missing'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input,query); input.dispatchEvent(new Event('input',{bubbles:true})); };
const selectedTab = id => {
  same([...document.querySelectorAll('[role=tab]')].filter(tab => tab.getAttribute('aria-selected') === 'true').map(tab => tab.dataset.tab), [id], 'Exactly one selected tab');
  same([...document.querySelectorAll('[role=tabpanel]')].filter(visible).map(panel => panel.id), ['tab-' + id], 'Exactly one visible panel');
  const tabs = [...document.querySelectorAll('[role=tab]')]; assert(tabs.every(tab => tab.tabIndex === (tab.dataset.tab === id ? 0 : -1)), 'Tab roving tabindex');
};
const layout = (width,height) => {
  same([innerWidth,innerHeight],[width,height],'Viewport');
  assert(document.documentElement.scrollWidth <= innerWidth + 1, 'Page horizontal overflow');
  const header = document.querySelector('header'); assert(header.getBoundingClientRect().height < innerHeight * .75, 'Header consumes supported viewport');
  const bad = [...document.querySelectorAll('button,input')].filter(visible).filter(element => element.getBoundingClientRect().height < 43.5).map(element => norm(element.textContent || element.id));
  same(bad, [], 'Interactive control minimum height');
  assert([...document.querySelectorAll('main .tab-content.active')].some(element => visible(element) && norm(element.textContent).length > 30), 'Visible product content');
  return {viewport:[innerWidth,innerHeight], pageWidth:document.documentElement.scrollWidth, headerHeight:header.getBoundingClientRect().height};
};
const frame = selector => {const element = document.querySelector(selector); assert(visible(element),'Screenshot target missing: ' + selector); const header = document.querySelector('header'); const inset = ['sticky','fixed'].includes(getComputedStyle(header).position) ? header.getBoundingClientRect().height : 0; const top = element.getBoundingClientRect().top + scrollY - inset - 12; scrollTo(0,Math.max(0,top));};
`;
const operations = [];
const evaluate = body => operations.push(["eval", `(() => {${helpers}${body}})()`]);
const click = (role, name, exact = true) => {
  // Restore the controls area before filtering a previously scrolled view.
  // This is a user-visible scroll, not a synthetic click bypassing hit testing.
  if (role === "button") evaluate(`const filter=[...document.querySelectorAll('[data-filter-group]')].find(button => visible(button) && norm(button.textContent) === ${JSON.stringify(name)}); if(filter) scrollTo({top:0,left:0,behavior:'instant'});`);
  operations.push(["find", "role", role, "click", "--name", name, ...(exact ? ["--exact"] : [])]);
};
const tab = name => click("tab", name, false);
const screenshot = name => operations.push(["screenshot", `captures/${name}.png`]);
const keyboard = (key, modifiers) => operations.push(["key", key, ...(modifiers === undefined ? [] : [modifiers])]);

operations.push(["set", "viewport", "1600", "1000"]);
operations.push(["open", "{{ORIGIN}}/XRAY-STATUS-AND-PROOF-DASHBOARD.html"]);
operations.push(["wait", "--fn", "document.readyState === 'complete' && !!document.querySelector('[data-source-slices]') && !!document.querySelector('#slice-control-sc-01')"]);
operations.push(["eval", `window.__dashboardExpected = ${JSON.stringify(expected)}; ({sourceHashes:${JSON.stringify(sourceHashes)},sourceCounts:{slices:${slices.length},requirements:${requirements.length},proofs:${images.length}}})`]);
evaluate(`
  same(Number(document.body.dataset.sourceSlices),expected.slices.length,'Source slice count');
  same(Number(document.body.dataset.sourceRequirements),expected.requirements.length,'Source A-Z count');
  same(Number(document.body.dataset.sourceProofs),expected.images.length,'Source image count');
  const cards = [...document.querySelectorAll('.slice-card')];
  same(cards.map(card => ({id:card.dataset.sliceId,title:card.querySelector('.slice-title').textContent.trim(),status:card.dataset.status,portion:Number(card.dataset.portion)})),expected.slices,'Source slice identities/statuses/portions');
  same(cards.map(card => card.querySelector('.slice-tick').dataset.tick),expected.slices.map(entry => entry.status === 'done' ? 'done' : 'open'),'Completion ticks');
  same(cards.filter(card => card.querySelector('.slice-completed')).map(card => card.dataset.sliceId),expected.slices.filter(entry => entry.status === 'done').map(entry => entry.id),'Only done slices display completion-date chips');
  const rows = [...document.querySelectorAll('#azTable tbody tr')];
  same(rows.map(row => ({id:row.querySelector('.az-id').textContent.trim(),title:row.querySelector('.az-title').textContent.trim(),category:row.dataset.category,state:row.dataset.state})),expected.requirements,'All source A-Z rows and states');
  const sliceKpi = document.querySelector('[data-kpi=slices]');
  for(const [state,count] of Object.entries(expected.sliceCounts)) same(Number(sliceKpi.dataset[state]),count,'Slice KPI ' + state);
  same(sliceKpi.querySelector('.kpi-value').textContent.trim(),Math.round(expected.sliceCounts.done / expected.slices.length * 100) + '%','Visible slice percentage');
  same(norm(sliceKpi.querySelector('.kpi-sub').textContent),expected.sliceCounts.done + ' Done, ' + expected.sliceCounts.partial + ' Partial, ' + expected.sliceCounts.blocked + ' Blocked, ' + expected.sliceCounts.pending + ' Pending','Visible slice counts');
  const testKpi = document.querySelector('[data-kpi=tests]');
  for(const [field,value] of Object.entries(expected.gate)) same(testKpi.dataset[field],String(value),'Recorded machine gate ' + field);
  same(testKpi.querySelector('.kpi-value').textContent.trim(),expected.gate.passing === 'unknown' ? 'Unknown' : Number(expected.gate.passing).toLocaleString('en-AU'),'Visible machine test count');
  same(Number(document.querySelector('[data-kpi=proofs] .kpi-value').textContent),expected.images.length,'Visible proof KPI');
  const azKpi = document.querySelector('[data-kpi=az]');
  for(const [state,count] of Object.entries(expected.azCounts)) same(Number(azKpi.dataset[state === 'dependency-blocked' ? 'blocked' : state]),count,'A-Z KPI ' + state);
  same(norm(azKpi.querySelector('.kpi-value').textContent),(expected.azCounts.verified+expected.azCounts.partial)+' / '+expected.requirements.length,'Visible A-Z coverage');
  same([...document.querySelectorAll('.proof-card')].map(card => ({category:card.dataset.category,title:card.dataset.title,slice:card.querySelector('.proof-slice-tag').textContent.trim(),relPath:card.dataset.path,description:card.dataset.desc})),expected.images,'All curated image identities and captions');
  same([...document.querySelectorAll('#tab-gaps .timeline-item strong')].map(entry => entry.textContent.trim()),expected.slices.filter(entry => entry.status !== 'done').map(entry => entry.id),'Open roadmap excludes completed slices');
  same([...document.querySelectorAll('[data-filter-group=slice-portion]')].map(button => button.dataset.filterValue),['all',...expected.portions.map(entry => String(entry.number))],'Every source portion has exact numeric filter');
  selectedTab('slices'); return {sliceCounts:expected.sliceCounts,azCounts:expected.azCounts,gate:expected.gate,layout:layout(1600,1000)};
`);
screenshot("dashboard-summary-desktop-1600x1000");

click("button", filterLabel);
evaluate(`same(shownSlices(),expected.slices.filter(entry => entry.status === ${JSON.stringify(filterStatus)} || (${JSON.stringify(filterStatus)} === 'partial' && entry.status === 'blocked')).map(entry => entry.id),'Status filter source result');`);
click("button", `${targetPortion.label} (${slices.filter(entry => entry.portion === target.portion).length})`);
evaluate(`same(shownSlices(),expected.slices.filter(entry => entry.portion === ${target.portion} && (entry.status === ${JSON.stringify(filterStatus)} || (${JSON.stringify(filterStatus)} === 'partial' && entry.status === 'blocked'))).map(entry => entry.id),'Combined status and exact portion result'); search(${JSON.stringify(target.id)}); same(shownSlices(),[${JSON.stringify(target.id)}],'Combined status, portion and search'); same([...document.querySelectorAll('.portion-group')].filter(visible).map(group => group.dataset.portionGroup),[${JSON.stringify(String(target.portion))}],'Empty portions hidden');`);
screenshot("dashboard-combined-filters-desktop-1600x1000");
click("button", otherLabel);
evaluate(`same(shownSlices(),[],'Status change preserves query and portion intersection'); same([...document.querySelectorAll('.portion-group')].filter(visible).length,0,'Empty result has no orphan portion headers');`);
click("button", `All (${slices.length})`);
evaluate(`same(shownSlices(),[${JSON.stringify(target.id)}],'All status preserves selected portion and query'); search('');`);
click("button", "All Portions");
evaluate(`same(shownSlices(),expected.slices.map(entry => entry.id),'Filter reset restores all slices');`);
click("button", target.id, false);
evaluate(`const control=document.getElementById('slice-control-${target.id.toLowerCase()}'); const details=document.getElementById(control.getAttribute('aria-controls')); assert(control.getAttribute('aria-expanded') === 'true' && visible(details),'Accordion expands linked details'); frame('#' + details.id); return {slice:${JSON.stringify(target.id)},expanded:true};`);
screenshot("dashboard-expanded-evidence-desktop-1600x1000");
evaluate(`
  const codes = [...document.querySelectorAll('.detail-body code,#azTable code,.slice-goal code')].map(element => element.textContent);
  for(const code of expected.markdownCodes) assert(codes.includes(code),'Source inline code missing: ' + code);
  const links = [...document.querySelectorAll('a.md-link')];
  for(const link of expected.markdownLinks) assert(links.some(anchor => anchor.getAttribute('href') === link.href && anchor.textContent === link.label),'Source Markdown link missing: ' + link.href);
  const unsafe = [...document.querySelectorAll('a.md-link,a.file-tag')].filter(anchor => {const href=anchor.getAttribute('href') || ''; return !href || /^(?:[a-z][a-z0-9+.-]*:|\\/\\/|\\/)/i.test(href) || href.split('/').includes('..');});
  same(unsafe.map(anchor => anchor.outerHTML),[],'Local link scheme/path safety');
  same(document.querySelectorAll('.detail-body script,.detail-body iframe,#azTable script,#azTable iframe').length,0,'Markdown cannot inject executable elements');
  return {localLinks:links.length,inlineCodes:codes.length};
`);
evaluate(`document.getElementById('slice-control-${target.id.toLowerCase()}').focus();`);
keyboard("Space");
evaluate(`const control=document.getElementById('slice-control-${target.id.toLowerCase()}'); assert(control.getAttribute('aria-expanded') === 'false' && document.getElementById(control.getAttribute('aria-controls')).hidden,'Space collapses linked accordion details');`);
keyboard("Enter");
evaluate(`assert(document.getElementById('slice-control-${target.id.toLowerCase()}').getAttribute('aria-expanded') === 'true','Enter expands accordion');`);
keyboard("Enter");
evaluate(`assert(document.getElementById('slice-control-${target.id.toLowerCase()}').getAttribute('aria-expanded') === 'false','Enter collapses accordion'); scrollTo(0,0); document.getElementById('tab-button-slices').focus();`);

keyboard("ArrowRight");
evaluate("selectedTab('gallery'); assert(document.activeElement.id === 'tab-button-gallery','ArrowRight focuses gallery tab');");
keyboard("End");
evaluate("selectedTab('invariants'); assert(document.activeElement.id === 'tab-button-invariants','End focuses last tab');");
keyboard("ArrowRight");
evaluate("selectedTab('slices'); assert(document.activeElement.id === 'tab-button-slices','ArrowRight wraps last to first');");
keyboard("ArrowLeft");
evaluate("selectedTab('invariants'); assert(document.activeElement.id === 'tab-button-invariants','ArrowLeft wraps first to last');");
keyboard("Home");
evaluate("selectedTab('slices'); assert(document.activeElement.id === 'tab-button-slices','Home focuses first tab');");

tab("Visual Proof Gallery");
evaluate(`selectedTab('gallery'); same(shownProofs(),expected.images.map(entry => entry.relPath),'Gallery initial source count');`);
operations.push(["eval", `(async () => { const paths = [...new Set(window.__dashboardExpected.images.map(image => image.relPath))]; const decoded = await Promise.all(paths.map(async path => { const image = new Image(); image.src = new URL(path,location.href).href; await image.decode(); if(image.naturalWidth < 1 || image.naturalHeight < 1) throw Error('Empty image ' + path); return {path,width:image.naturalWidth,height:image.naturalHeight}; })); return {decodedImages:decoded.length,images:decoded}; })()`]);
click("button", `${imageTarget.category} (${images.filter(image => image.category === imageTarget.category).length})`);
evaluate(`same(shownProofs(),expected.images.filter(entry => entry.category === ${JSON.stringify(imageTarget.category)}).map(entry => entry.relPath),'Source gallery category'); search(${JSON.stringify(imageTarget.title)}); same(shownProofs(),[${JSON.stringify(imageTarget.relPath)}],'Gallery category and search intersection'); frame('.proof-card:not([hidden])');`);
screenshot("dashboard-filtered-gallery-desktop-1600x1000");
click("button", `Inspect proof: ${imageTarget.title}`);
operations.push(["wait", "--fn", "!document.getElementById('lightboxModal').hidden && document.getElementById('modalImage').complete && document.getElementById('modalImage').naturalWidth > 0"]);
evaluate(`const modal=document.getElementById('lightboxModal'); assert(visible(modal) && modal.querySelector('[role=dialog]').getAttribute('aria-modal') === 'true','Lightbox is accessible modal'); same(document.getElementById('modalTitle').textContent,${JSON.stringify(imageTarget.title)},'Lightbox source title'); same(document.getElementById('modalPath').textContent,${JSON.stringify(imageTarget.relPath)},'Lightbox source path'); same(document.getElementById('modalDesc').textContent,${JSON.stringify(imageTarget.description)},'Lightbox source description'); assert(document.activeElement.classList.contains('close-btn'),'Modal initial focus');`);
keyboard("Tab");
evaluate("assert(document.activeElement.classList.contains('close-btn'),'Modal traps Tab focus');");
keyboard("Tab", 8);
evaluate("assert(document.activeElement.classList.contains('close-btn'),'Modal traps Shift+Tab focus');");
screenshot("dashboard-lightbox-desktop-1600x1000");
keyboard("Escape");
evaluate(`assert(document.getElementById('lightboxModal').hidden,'Escape closes lightbox'); same(document.activeElement.dataset.path,${JSON.stringify(imageTarget.relPath)},'Lightbox returns trigger focus'); search('');`);
click("button", `All (${images.length})`);
tab("Professional");
click("button", `${azLabel(azTarget.state)} (${azCounts[azTarget.state]})`);
evaluate(`same(shownRequirements(),expected.requirements.filter(entry => entry.state === ${JSON.stringify(azTarget.state)}).map(entry => entry.id),'A-Z source state filter'); search(${JSON.stringify(azTarget.id)}); same(shownRequirements(),[${JSON.stringify(azTarget.id)}],'A-Z state and search intersection'); scrollTo(0,0);`);
screenshot("dashboard-az-filter-desktop-1600x1000");
evaluate("search('');");
click("button", `All (${requirements.length})`);
tab("What Hasn't Been Done");
evaluate("selectedTab('gaps'); scrollTo(0,0); layout(1600,1000);");
screenshot("dashboard-open-roadmap-desktop-1600x1000");

operations.push(["set", "viewport", "1024", "768"]);
tab("Closeout Slices");
evaluate("scrollTo(0,0); selectedTab('slices'); return layout(1024,768);");
screenshot("dashboard-summary-tablet-1024x768");
click("button", filterLabel);
click("button", `${targetPortion.label} (${slices.filter(entry => entry.portion === target.portion).length})`);
evaluate(`search(${JSON.stringify(target.id)}); same(shownSlices(),[${JSON.stringify(target.id)}],'Tablet combined filters'); frame('.slice-card:not([hidden])'); return layout(1024,768);`);
click("button", target.id, false);
evaluate(`const control=document.getElementById('slice-control-${target.id.toLowerCase()}'); assert(control.getAttribute('aria-expanded') === 'true','Tablet accordion expands'); frame('#slice-details-${target.id.toLowerCase()}'); return layout(1024,768);`);
screenshot("dashboard-expanded-evidence-tablet-1024x768");
evaluate("search('');");
tab("Visual Proof Gallery");
evaluate(`search(${JSON.stringify(imageTarget.title)}); same(shownProofs(),[${JSON.stringify(imageTarget.relPath)}],'Tablet proof search'); frame('.proof-card:not([hidden])'); return layout(1024,768);`);
click("button", `Inspect proof: ${imageTarget.title}`);
operations.push(["wait", "--fn", "!document.getElementById('lightboxModal').hidden && document.getElementById('modalImage').complete && document.getElementById('modalImage').naturalWidth > 0"]);
evaluate("return layout(1024,768);");
screenshot("dashboard-lightbox-tablet-1024x768");
click("button", "Close screenshot inspection");
evaluate("assert(document.getElementById('lightboxModal').hidden,'Tablet close button closes modal'); search('');");
tab("Professional");
click("button", `${azLabel(azTarget.state)} (${azCounts[azTarget.state]})`);
evaluate(`search(${JSON.stringify(azTarget.id)}); same(shownRequirements(),[${JSON.stringify(azTarget.id)}],'Tablet A-Z filtered row'); frame('.az-table-container'); return layout(1024,768);`);
screenshot("dashboard-az-filter-tablet-1024x768");
operations.push(["errors"]);

const scenario = {
  schemaVersion: 1,
  name: "Source-grounded X-Ray status and proof dashboard",
  executionHost: "DANS1",
  sourceHashes,
  expectedCounts: { slices: slices.length, sliceCounts, requirements: requirements.length, azCounts, proofs: images.length, machineGate: gate },
  limitations: [
    "Scenario generation is not execution evidence; use the DANS1 runner and inspect all captured screenshots.",
    "Keyboard checks use raw CDP Input.dispatchKeyEvent down/up; physical keyboard and operating-system accessibility technology are outside this browser campaign.",
    "All curated image bytes are decoded from the served origin. This does not attest the behavior shown in historical screenshots.",
    "Desktop and tablet viewport emulation do not establish deployed or physical-device verification.",
  ],
  operations,
};
writeFileSync(resolve(outputDirectory, "dashboard-refresh.scenario.json"), `${JSON.stringify(scenario, null, 2)}\n`);
console.log(JSON.stringify({ generated: "dashboard-refresh.scenario.json", operations: operations.length, screenshots: operations.filter(operation => operation[0] === "screenshot").length, expectedCounts: scenario.expectedCounts, sourceHashes }, null, 2));
