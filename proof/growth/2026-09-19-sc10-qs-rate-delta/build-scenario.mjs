/**
 * SC10 mounted-QS workflow. Authoring this JSON is not execution evidence.
 * Run only on DANS1 with scripts/fast-cdp.mjs; preserve failures and screenshots.
 * Initial source / supplier fixtures are schema-validated. Every binding, rate,
 * option, geometry edit and recorded cost revision thereafter uses product UI.
 * Assertions use independently worked integer-cent examples, not the calculator
 * under test as an oracle. No post-seed store or pricing-storage mutation occurs.
 */
import { mkdirSync, writeFileSync } from "node:fs";

const directory = "proof/growth/2026-09-19-sc10-qs-rate-delta";
const captures = directory + "/captures";
const projectId = "job-sc10-rate-delta";
const supplierId = "10000000-0000-4000-8000-000000000010";
const proofKey = "sc10-rate-delta-proof-observer";
const expression = (fn, ...args) => "(" + fn.toString() + ")(" + args.map(value => JSON.stringify(value)).join(",") + ")";

function browserHelpers() {
  const fail = message => { throw Error(message); };
  const control = name => {
    const direct = [...document.querySelectorAll("input,select,textarea")].find(element => element.getAttribute("aria-label") === name);
    const label = [...document.querySelectorAll("label")].find(element => [...element.childNodes]
      .filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join("").trim() === name);
    const element = direct || label?.querySelector("input,select,textarea");
    if (!element) fail("Missing form control: " + name);
    return element;
  };
  const set = (name, value) => {
    const element = control(name);
    if (element.matches(":disabled")) fail("Disabled form control: " + name);
    if (element.tagName === "SELECT" && ![...element.options].some(option => option.value === value && !option.disabled))
      fail("Unavailable option " + value + " in " + name);
    const prototype = element.tagName === "SELECT" ? HTMLSelectElement.prototype
      : element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value").set.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return { control: name, value };
  };
  const button = name => {
    const element = [...document.querySelectorAll("button")].find(entry => (entry.getAttribute("aria-label") || entry.textContent.trim()) === name);
    if (!element) fail("Missing button: " + name);
    if (element.matches(":disabled")) fail("Disabled button: " + name);
    return element;
  };
  const click = name => { button(name).click(); return name; };
  const frame = selector => {
    const element = document.querySelector(selector);
    if (!element) fail("Missing screenshot boundary: " + selector);
    element.scrollIntoView({ block: "center", inline: "nearest" });
    return selector;
  };
  const minor = selector => {
    const element = document.querySelector(selector + " [data-total-minor]");
    if (!element) fail("Missing monetary evidence: " + selector);
    return Number(element.getAttribute("data-total-minor"));
  };
  const equal = (actual, expected, label) => { if (actual !== expected) fail(label + ": expected " + expected + ", got " + actual); };
  const saved = () => document.querySelector('[data-draft-industry="quantity-surveying"]')?.getAttribute("data-draft-save") === "saved";
  return { fail, control, set, button, click, frame, minor, equal, saved };
}

const uiExpression = (fn, ...args) => "(" + fn.toString() + ")((" + browserHelpers.toString() + ")()" + args.map(value => "," + JSON.stringify(value)).join("") + ")";
const scenario = [];
const evaluate = (fn, ...args) => scenario.push(["eval", expression(fn, ...args)]);
const ui = (fn, ...args) => scenario.push(["eval", uiExpression(fn, ...args)]);
const waitUI = (fn, ...args) => scenario.push(["wait", "--fn", uiExpression(fn, ...args)]);
const set = (name, value) => {
  ui((u, label, next) => u.set(label, next), name, value);
  waitUI((u, label, next) => u.control(label).value === next, name, value);
};
const click = name => ui((u, label) => u.click(label), name);
const waitSaved = () => waitUI(u => u.saved());
const screenshot = (name, boundary) => {
  if (boundary) ui((u, selector) => u.frame(selector), boundary);
  scenario.push(["screenshot", captures + "/" + name + ".png"]);
};
const totals = (base, accepted) => {
  waitUI((u, b, a) => !!document.querySelector('[data-testid="qs-cost-base-total"]') && u.minor('[data-testid="qs-cost-base-total"]') === b && u.minor('[data-testid="qs-cost-accepted-total"]') === a, base, accepted);
  ui((u, b, a) => {
    u.equal(u.minor('[data-testid="qs-cost-base-total"]'), b, "Base tender minor units");
    u.equal(u.minor('[data-testid="qs-cost-accepted-total"]'), a, "Accepted minor units");
    if (document.querySelector('[data-testid="qs-cost-blockers"]')) u.fail("Totals coexist with a blocker");
    return { baseMinor: b, acceptedMinor: a };
  }, base, accepted);
};
const saveRevision = revision => {
  click("Save immutable cost revision " + revision);
  waitUI((u, n) => document.querySelector('[data-testid="qs-cost-history"]')?.textContent.startsWith(n + " recorded cost revision"), revision);
  waitSaved();
};
const openWorksheet = () => {
  ui(u => {
    const workbench = document.querySelector(".industry-workbench");
    if (!workbench) u.fail("Industry workbench is absent");
    workbench.open = true;
    const selector = document.querySelector(".industry-picker select");
    if (!selector) u.fail("Industry picker is absent");
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(selector, "quantity-surveying");
    selector.dispatchEvent(new Event("change", { bubbles: true }));
    return "Opened actual quantity-surveying worksheet";
  });
  scenario.push(["wait", "--fn", "!!document.querySelector('[data-testid=\"qs-cost-worksheet\"]') && document.querySelector('[aria-label=\"Quantity cost pricing\"]')?.getAttribute('aria-disabled') === 'false'"]);
  waitSaved();
};
const sourcePin = (component, revision, line) => {
  set(component + " supplier book", supplierId);
  set(component + " supplier revision", String(revision));
  set(component + " supplier source line", String(line));
};
const firstRate = (itemKey, reference) => {
  set("Cost item to price", itemKey);
  sourcePin("Material", 1, 2);
  set("Labour treatment", "pinned");
  sourcePin("Labour", 1, 3);
  set("Labour basis or exclusion reason", "Separate installation labour per measured metre; material wastage does not multiply labour.");
  set("Material wastage %", "10");
  set("Net cost markup %", "20");
  click("Save rate revision for " + reference);
  waitUI(() => !document.querySelector(".qs-cost-warning[role='alert']"));
  waitSaved();
};

async function seedFixture(projectId, supplierId, proofKey) {
  const { useStudio } = await import("/src/studio/store.ts");
  const domain = await import("/src/studio/domain.ts");
  const documents = await import("/src/studio/documents.ts");
  const price = await import("/src/studio/pricing/priceBooks.ts");
  const { industryDraftKey } = await import("/src/studio/industries/draftStorage.ts");
  const now = new Date().toISOString();
  const digest = async bytes => [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(byte => byte.toString(16).padStart(2, "0")).join("");
  const sourceText = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="#f4f1e8"/><path d="M40 40H560V360H40Z M100 120H500 M100 280H420" fill="none" stroke="#77818c" stroke-width="2"/><text x="44" y="30" font-family="sans-serif" font-size="14">SC10 calibrated 5 m / 4 m wall source</text></svg>';
  const bytes = new TextEncoder().encode(sourceText);
  const sourceSha256 = await digest(bytes);
  const source = { id: "doc-sc10-source", name: "SC10 measured walls Rev C.svg", kind: "svg", importedAt: now, pageCount: 1, sha256: sourceSha256, source: "web" };
  const points = [{ x: 100, y: 40 }, { x: 500, y: 40 }];
  const candidate = { id: "cal-sc10-grid-5m", source: "manual", metresPerUnit: 0.0125, confidence: 1,
    inputDistance: { value: 5, unit: "m" }, knownDistanceM: 5, points,
    provenance: { method: "two-point", evidence: "SC10 controlled 5 m reference", documentId: source.id } };
  const calibration = { sheet: 0, coordinateSpace: "source-page-v1", metresPerUnit: 0.0125, source: "manual", confidence: 1, locked: true,
    knownDistanceM: 5, points, transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, inputDistance: candidate.inputDistance,
    candidates: [candidate], selectedCandidateId: candidate.id, conflict: null };
  const run = (id, y, endX, lengthM, assembly) => ({ id, revision: 1, sheet: 0, label: "Measured wall " + (id.endsWith("a") ? "A" : "B"),
    points: [{ x: 100, y }, { x: endX, y }], lengthM, grossLengthM: lengthM, gateDeductionM: 0, netLengthM: lengthM,
    specification: { ...domain.createRunSpecification(), constructionEnabled: true,
      construction: { assembly, trade: "General construction", quantity: "length", widthM: null, depthM: null, reference: "SC10 source-bound measured geometry" } },
    photoIds: [], review: domain.createReviewDecision() });
  const job = domain.fencingJobSchema.parse({ ...domain.createDefaultJob(now), id: projectId, revision: 1, name: "SC10 measured cost revisions", updatedAt: now,
    documents: [source], activeDocumentId: source.id, calibrations: [calibration], runs: [run("run-sc10-a", 120, 500, 5, "wall"), run("run-sc10-b", 280, 420, 4, "partition")],
    gates: [], photos: [], bom: [], quoteDraft: null, revisionHistory: [] });
  // Exact CSV bytes are parsed through the existing supplier import boundary.
  let library = price.emptyPriceBookLibrary(projectId);
  const supplierHashes = [];
  for (const [revision, material, taxBasis] of [[1, 10, "exclusive"], [2, 12, "exclusive"], [3, 12, "unspecified"]]) {
    const csv = "Stock code,Description,Unit,Rate\r\nWALL-MAT,Wall material,m," + material + "\r\nWALL-LAB,Installation labour,m,2\r\n";
    const csvBytes = new TextEncoder().encode(csv);
    const hash = await digest(csvBytes);
    const table = price.parsePriceCsv(csv);
    const mapping = price.suggestPriceMapping(table.headers);
    const preview = price.previewPriceRows(table, mapping);
    if (preview.errors.length) throw Error(preview.errors.join(" "));
    library = price.appendPriceBookRevision(library, {
      metadata: { supplier: "Controlled SC10 Supplier", currency: "AUD", amountDecimals: 2, taxBasis, taxPercent: taxBasis === "unspecified" ? null : 10,
        effectiveDate: "2026-09-19", sourceReference: "SC10 controlled supplier schedule revision " + revision },
      source: { fileName: "sc10-supplier-r" + revision + ".csv", sha256: hash, sizeBytes: csvBytes.byteLength, kind: "csv", delimiter: ",", headers: table.headers, mapping }, rows: preview.rows,
    }, "SC10 material and labour", revision === 1 ? null : supplierId, () => supplierId, now);
    supplierHashes.push({ revision, sha256: hash, sourceReference: library.books[0].revisions[revision - 1].metadata.sourceReference });
  }
  localStorage.setItem(price.priceBookKey(projectId), JSON.stringify(library));
  localStorage.setItem(industryDraftKey(projectId), JSON.stringify({ format: "xray.industry-drafts/1", projectId, revision: 1,
    drafts: { "quantity-surveying": { revision: 1, form: { hierarchyId: "SC10 measured walls", hierarchyRevision: "Rev C", calculated: false, binding: null,
      nodes: [{ key: "node-wall-a", code: "A", label: "External wall", parentKey: "" }, { key: "node-wall-b", code: "B", label: "Alternative partition", parentKey: "" }],
      items: [{ key: "item-wall-a", reference: "QS-WALL-A", quantity: "5", unit: "m", evidence: "unverified", nodeKey: "node-wall-a" },
        { key: "item-wall-b", reference: "QS-WALL-B", quantity: "4", unit: "m", evidence: "unverified", nodeKey: "node-wall-b" }] } } } }));
  // The source binary is genuinely durable, so reload must hydrate it normally.
  const binary = { documentId: source.id, name: source.name, kind: source.kind, mimeType: "image/svg+xml", sizeBytes: bytes.byteLength, sha256: sourceSha256 };
  await documents.createBrowserPlanStore().put({ ...binary, bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
  useStudio.setState({ pane: "cost", sheet: 0, job, selectedRunId: null, selectedVertexIndex: null, selectedGateId: null, traceError: null,
    traceUndoStack: [], traceRedoStack: [], tool: "none", pending: [], currentCalibration: calibration, scaleM: 0.0125, zoom2d: 1, pan2d: { x: 0, y: 0 },
    persistenceHydrated: true, persistenceRecoveryBlocked: false, hydrationStatus: "ready", persistenceError: null,
    assetReadiness: { document: { state: "ready", message: null }, photos: {} }, activePlanBinary: { ...binary, bytes } });
  const proof = { projectId, sourceSha256, supplierHashes, initialRunA: job.runs[0], initialRunB: job.runs[1], recordedSnapshots: [] };
  window.__SC10_PROOF__ = proof;
  sessionStorage.setItem(proofKey, JSON.stringify(proof));
  return { fixtureOnly: true, projectId, sourceSha256, supplierHashes, measuredQuantities: ["5", "4"], bindingsSeeded: false, costRatesSeeded: false };
}

async function rememberSaved(revision, projectId, proofKey) {
  const { industryDraftKey } = await import("/src/studio/industries/draftStorage.ts");
  const envelope = JSON.parse(localStorage.getItem(industryDraftKey(projectId)) || "null");
  const pricing = envelope?.drafts?.["quantity-surveying"]?.form?.pricing;
  if (envelope?.projectId !== projectId || pricing?.projectId !== projectId || pricing.snapshots.length !== revision)
    throw Error("Durable project envelope did not contain exactly " + revision + " cost revisions");
  const proof = JSON.parse(sessionStorage.getItem(proofKey));
  for (const [index, previous] of proof.recordedSnapshots.entries()) {
    if (JSON.stringify(pricing.snapshots[index]) !== previous) throw Error("Recorded snapshot " + (index + 1) + " changed in storage");
  }
  proof.recordedSnapshots = pricing.snapshots.map(snapshot => JSON.stringify(snapshot));
  proof.pricing = JSON.stringify(pricing);
  sessionStorage.setItem(proofKey, JSON.stringify(proof));
  return { durableProjectId: projectId, savedRevisionCount: revision, earlierSnapshotBytesPreserved: true,
    materialPins: pricing.snapshots[revision - 1].items.map(item => ({ itemId: item.itemId, supplier: item.materialSource.supplier,
      revision: item.materialSource.bookRevision, sourceSha256: item.materialSource.sourceSha256 })) };
}

function assertDelta(u, quantity, rate, scope, total, statuses) {
  const section = document.querySelector('[data-testid="qs-cost-delta-totals"]');
  if (!section) u.fail("Delta totals are absent");
  const money = value => "AUD " + (value < 0 ? "−" : value > 0 ? "+" : "") + (Math.abs(value) / 100).toFixed(2);
  const values = [...section.querySelectorAll("strong")].map(element => element.textContent.trim());
  [quantity, rate, scope, total].forEach((value, index) => u.equal(values[index], money(value), "Delta contribution " + index));
  u.equal(quantity + rate + scope, total, "Independent delta reconciliation");
  for (const [reference, status] of Object.entries(statuses)) {
    const row = document.querySelector('[data-testid="qs-cost-delta-' + reference + '"]');
    u.equal(row?.getAttribute("data-change"), status, reference + " delta category");
    if (!row?.querySelector(".qs-cost-change")?.textContent.toLowerCase().includes(status)) u.fail("Change category relies on colour alone");
  }
  return { quantityMinor: quantity, rateMinor: rate, scopeMinor: scope, totalMinor: total, statuses };
}

function assertLayout(u, dialogExpected) {
  const root = document.querySelector(dialogExpected ? ".qs-cost-comparison[open]" : '[data-testid="qs-cost-worksheet"]');
  if (!root) u.fail("Expected visible pricing surface is absent");
  if (document.documentElement.scrollWidth > innerWidth + 1) u.fail("Page-level horizontal overflow");
  const rect = root.getBoundingClientRect();
  if (rect.left < -1 || rect.right > innerWidth + 1 || rect.width < 400) u.fail("Pricing surface escapes its pane");
  if (dialogExpected && (rect.top < -1 || rect.bottom > innerHeight + 1)) u.fail("Comparison escapes the viewport");
  const rgb = value => {
    const channels = value.match(/[\d.]+/g)?.map(Number);
    if (!channels || channels.length < 3) u.fail("Unsupported computed colour: " + value);
    if (value.startsWith("color(srgb ")) return [channels[0] * 255, channels[1] * 255, channels[2] * 255, channels[3] ?? 1];
    if (!value.startsWith("rgb")) u.fail("Unsupported computed colour space: " + value);
    return [channels[0], channels[1], channels[2], channels[3] ?? 1];
  };
  const composite = (top, bottom) => top.slice(0, 3).map((channel, index) => channel * top[3] + bottom[index] * (1 - top[3]));
  const background = element => {
    const chain = [];
    for (let current = element; current; current = current.parentElement) chain.push(current);
    return chain.reverse().reduce((colour, current) => composite(rgb(getComputedStyle(current).backgroundColor), colour), [255, 255, 255]);
  };
  const luminance = colour => colour.map(channel => channel / 255).map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  const checks = [];
  for (const element of root.querySelectorAll("h3,h4,p,legend,label,dt,dd,th,td,strong,.qs-cost-change")) {
    if (!element.getClientRects().length || element.closest("dialog:not([open])") || element.matches(":disabled") || element.closest("fieldset:disabled")) continue;
    const ownText = [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent.trim()).join("");
    if (!ownText) continue;
    const style = getComputedStyle(element), bg = background(element), fg = composite(rgb(style.color), bg);
    const a = luminance(bg), b = luminance(fg), ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const size = parseFloat(style.fontSize), large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
    if (ratio + 0.01 < (large ? 3 : 4.5)) u.fail("Low contrast " + ratio.toFixed(2) + ": " + ownText.slice(0, 80));
    checks.push({ text: ownText.slice(0, 70), ratio: Number(ratio.toFixed(2)) });
  }
  for (const element of root.querySelectorAll("button,input:not([type=checkbox]),select,textarea")) {
    if (!element.getClientRects().length || element.closest("dialog:not([open])")) continue;
    const bounds = element.getBoundingClientRect();
    if (bounds.height < 43) u.fail("Touch target height below 44px: " + (element.getAttribute("aria-label") || element.textContent.trim()));
    if (bounds.left < rect.left - 1 || bounds.right > rect.right + 1) u.fail("Control escapes pricing pane");
  }
  if (checks.length < 5) u.fail("Too little visible text to audit contrast");
  return { viewport: [innerWidth, innerHeight], dialogExpected, boundedHorizontalTableScrollAllowed: true, textContrast: checks };
}

scenario.push(["expect-cancelled-fetch", "http://127.0.0.1:8080/api/pricing-research", 6,
  "PricingResearchPanel effect cleanup aborts its GET provider-status probe on pane unmount/reload; no failed asset or search is exempted."]);
scenario.push(["set", "viewport", "1600", "1000"], ["open", "http://127.0.0.1:8080/"],
  ["wait", "--fn", "document.querySelector('[data-hydration-status]')?.getAttribute('data-hydration-status') === 'ready'"]);
evaluate(seedFixture, projectId, supplierId, proofKey);
scenario.push(["wait", "--fn", "!!document.querySelector('.industry-workbench')"]);
openWorksheet();
waitUI(() => !!document.querySelector('[data-testid="qs-entity-select-1"] option[value="run-sc10-a"]:not([disabled])'));
set("Measured entity 1", "run-sc10-a");
set("Measured entity 2", "run-sc10-b");
click("Calculate classification");
waitUI(() => ["QS-WALL-A", "QS-WALL-B"].every(id => document.querySelector('[data-testid="qs-binding-row-' + id + '"]')?.getAttribute("data-binding-status") === "verified"));
set("Cost preparer", "SC10 controlled estimator");
firstRate("item-wall-a", "QS-WALL-A");
firstRate("item-wall-b", "QS-WALL-B");
totals(15444, 15444);
ui(u => {
  u.equal(u.minor('[data-testid="qs-priced-item-QS-WALL-A"]'), 8580, "5 m wall all-in cost");
  u.equal(u.minor('[data-testid="qs-priced-item-QS-WALL-B"]'), 6864, "4 m wall all-in cost");
  const proof = window.__SC10_PROOF__, provenance = [...document.querySelectorAll(".qs-source-provenance")];
  if (provenance.length !== 2 || provenance.some(element => !element.textContent.includes(proof.supplierHashes[0].sha256) || !element.textContent.includes("exclusive · 10%")))
    u.fail("Material and labour must show exact supplier hash and explicit 10% GST basis");
  return { materialPerMetre: "10", labourPerMetre: "2", materialWastagePercent: "10", netMarkupPercent: "20", gstPercent: "10", explicitSupplierProvenance: true };
});
screenshot("sc10-supplier-provenance-desktop-1600x1000", ".qs-rate-source");
click("Add alternative option");
set("Option 1 label", "Alternative partition");
ui(u => {
  const option = [...u.control("Cost scope").options].find(entry => entry.textContent === "Alternative partition");
  if (!option) u.fail("New alternative option is absent from scope picker");
  u.set("Cost scope", option.value);
  return { optionId: option.value, status: "proposed" };
});
totals(8580, 8580);
ui(u => {
  const option = document.querySelector(".qs-cost-option-total");
  u.equal(option?.getAttribute("data-active"), "false", "Proposed option status");
  u.equal(Number(option?.querySelector("[data-total-minor]")?.getAttribute("data-total-minor")), 6864, "Proposal separate from base");
  return { baseMinor: 8580, excludedProposalMinor: 6864 };
});
saveRevision(1);
evaluate(rememberSaved, 1, projectId, proofKey);
screenshot("sc10-proposed-option-excluded-desktop-1600x1000", ".qs-cost-totals");
ui(u => {
  const checkbox = document.querySelector(".qs-cost-option[data-option-id] input[type=checkbox]");
  if (!checkbox || checkbox.checked || checkbox.matches(":disabled")) u.fail("Option acceptance checkbox is unavailable");
  checkbox.click();
  return "Accepted alternative through its real checkbox";
});
totals(8580, 15444);
saveRevision(2);
evaluate(rememberSaved, 2, projectId, proofKey);

// Keyboard opens the actual native modal; raw CDP keys prove focus containment.
ui(u => { const trigger = u.button("Compare cost revisions"); trigger.scrollIntoView({ block: "center" }); trigger.focus(); return document.activeElement === trigger; });
scenario.push(["key", "Enter"]);
waitUI(() => document.querySelector(".qs-cost-comparison")?.open === true);
set("Later cost revision", "2");
set("Earlier cost revision", "1");
ui(assertDelta, 0, 0, 6864, 6864, { "QS-WALL-A": "unchanged", "QS-WALL-B": "modified" });
for (let index = 0; index < 6; index++) {
  scenario.push(["key", "Tab"]);
  ui(u => {
    const dialog = document.querySelector(".qs-cost-comparison[open]"), active = document.activeElement;
    const focus = { tag: active?.tagName, id: active?.id, role: active?.getAttribute("role"), label: active?.getAttribute("aria-label"),
      className: active?.className, documentHasFocus: document.hasFocus(), nativeModal: dialog?.matches(":modal"),
      dialogOpen: dialog?.open, activeInsideModal: Boolean(dialog?.contains(active)) };
    if (!focus.activeInsideModal) u.fail("Keyboard focus escaped modal: " + JSON.stringify(focus));
    return focus;
  });
}
ui(assertLayout, true);
screenshot("sc10-option-scope-delta-desktop-1600x1000");
scenario.push(["key", "Escape"]);
waitUI(u => !document.querySelector(".qs-cost-comparison")?.open && document.activeElement === u.button("Compare cost revisions"));

// Explicit unknown tax and mixed-currency selections must withhold, not assume.
set("Cost item to price", "item-wall-a");
sourcePin("Material", 3, 2);
click("Save rate revision for QS-WALL-A");
waitUI(() => !!document.querySelector('[data-testid="qs-cost-blockers"] [data-blocker-code="tax"]'));
ui(u => { if (document.querySelector('[data-testid="qs-cost-base-total"]')) u.fail("Unknown tax leaked a tender total"); return "Unknown supplier tax withheld totals"; });
screenshot("sc10-unknown-tax-withheld-desktop-1600x1000", '[data-testid="qs-cost-blockers"]');
sourcePin("Material", 1, 2);
click("Save rate revision for QS-WALL-A");
totals(8580, 15444);
set("Estimate currency", "USD");
waitUI(() => !!document.querySelector('[data-testid="qs-cost-blockers"] [data-blocker-code="currency"]'));
ui(u => { if (document.querySelector('[data-testid="qs-cost-accepted-total"]')) u.fail("Mixed currency leaked a total without reviewed FX"); return "Missing reviewed AUD/USD conversion blocked"; });
set("Estimate currency", "AUD");
totals(8580, 15444);
waitSaved();

// Real pointer handlers change source geometry, not a manufactured store edit.
ui(u => {
  const button = document.querySelector('[data-testid="qs-binding-highlight-QS-WALL-A"]');
  if (!button || button.matches(":disabled")) u.fail("Run A's real plan/3D highlight action is unavailable");
  button.click();
  return "Selected exact run A through its binding ledger action";
});
scenario.push(["find", "role", "button", "click", "--name", "Takeoff", "--exact"],
  ["wait", "--fn", "document.querySelector('.measure-document-preview')?.getAttribute('data-source-ready') === 'true' && !!document.querySelector('.trace-editor-panel')"],
  ["find", "role", "button", "click", "--name", "Move vertex", "--exact"]);
ui(u => u.frame(".measure-document-preview"));
evaluate(async () => {
  const { useStudio } = await import("/src/studio/store.ts");
  const { documentPointToCanvasPoint } = await import("/src/studio/IsoCanvas.tsx");
  const canvas = document.querySelector('.measure-document-preview canvas[aria-label="Plan drawing canvas"]');
  if (!canvas) throw Error("Measure canvas is absent");
  const state = useStudio.getState(), before = state.job.runs.find(run => run.id === "run-sc10-a");
  if (state.selectedRunId !== "run-sc10-a" || state.tool !== "none" || !before) throw Error("Measured run A is not selected for pointer editing");
  const viewport = { width: canvas.clientWidth, height: canvas.clientHeight, zoom: state.zoom2d, pan: state.pan2d,
    kind: "cover", floors: state.floors, sourceBounds: { x: 0, y: 0, width: 600, height: 400 } };
  const bounds = canvas.getBoundingClientRect();
  const client = point => { const local = documentPointToCanvasPoint(point, viewport); return { x: bounds.left + local.x * bounds.width / canvas.clientWidth, y: bounds.top + local.y * bounds.height / canvas.clientHeight }; };
  const from = client(before.points[1]), to = client({ x: 580, y: 120 });
  for (const point of [from, to]) if (point.x < Math.max(bounds.left, 0) + 1 || point.x > Math.min(bounds.right, innerWidth) - 1 || point.y < Math.max(bounds.top, 0) + 1 || point.y > Math.min(bounds.bottom, innerHeight) - 1)
    throw Error("6 m geometry drag is outside the visible source canvas; proof must not forge the edit");
  window.__SC10_PROOF__.drag = { from, to, before: structuredClone(before), untouched: structuredClone(state.job.runs.find(run => run.id === "run-sc10-b")) };
  return window.__SC10_PROOF__.drag;
});
scenario.push(["drag", "--from", "window.__SC10_PROOF__.drag.from", "--to", "window.__SC10_PROOF__.drag.to", "--steps", "8", "--button", "left"]);
evaluate(async () => {
  const { useStudio } = await import("/src/studio/store.ts");
  const state = useStudio.getState(), proof = window.__SC10_PROOF__.drag;
  const after = state.job.runs.find(run => run.id === "run-sc10-a"), other = state.job.runs.find(run => run.id === "run-sc10-b");
  if (state.traceError || after?.revision !== proof.before.revision + 1) throw Error("Canvas edit did not commit exactly one new run revision: " + state.traceError);
  if (Math.abs(after.lengthM - 6) > 0.000001) throw Error("Real pointer edit did not create the independently specified 6 m wall: " + after.lengthM);
  if (JSON.stringify(other) !== JSON.stringify(proof.untouched)) throw Error("Canvas edit altered untouched run B");
  return { before: proof.before.lengthM, after: after.lengthM, revision: after.revision, untouchedRunPreserved: true };
});
screenshot("sc10-real-geometry-edit-desktop-1600x1000", ".measure-document-preview");
scenario.push(["find", "role", "button", "click", "--name", "Estimate", "--exact"], ["wait", "--fn", "!!document.querySelector('.industry-workbench')"]);
openWorksheet();
waitUI(() => document.querySelector('[data-testid="qs-binding-row-QS-WALL-A"]')?.getAttribute("data-binding-status") === "stale-measurement");
ui(u => {
  u.equal(document.querySelector('[data-testid="qs-binding-row-QS-WALL-B"]')?.getAttribute("data-binding-status"), "verified", "Untouched binding");
  if (!document.querySelector('[data-testid="qs-cost-blockers"] [data-blocker-code="binding"]') || document.querySelector('[data-testid="qs-cost-base-total"]')) u.fail("Stale geometry did not withhold pricing");
  const save = [...document.querySelectorAll("button")].find(button => button.textContent.trim() === "Save immutable cost revision 3");
  if (!save?.disabled) u.fail("Stale geometry permits a new cost revision");
  return { edited: "stale-measurement", untouched: "verified", costTotalsWithheld: true, captureBlocked: true };
});
screenshot("sc10-stale-geometry-pricing-blocker-desktop-1600x1000", '[data-testid="qs-cost-blockers"]');
set("Quantity 1", "6");
ui(u => {
  const row = u.control("Measured entity 1").closest(".industry-fields");
  const button = [...row.querySelectorAll("button")].find(element => element.textContent.trim() === "Rebind current geometry");
  if (!button || button.disabled) u.fail("Explicit rebind control is unavailable");
  button.click();
  return "Existing rebind-only action does not overwrite the typed rounded quantity";
});
waitSaved();
ui(u => {
  const selected = u.control("Measured entity 1").selectedOptions[0]?.textContent;
  const measured = selected?.match(/ · (\d+(?:\.\d+)?) ([^·]+)$/);
  if (!measured) u.fail("Current measured quantity/unit are not visible in the selected entity");
  window.__SC10_PROOF__.exactMeasurement = { quantity: measured[1], unit: measured[2].trim() };
  u.equal(u.control("Quantity 1").value, "6", "Rebind-only preserves the estimator's typed input");
  if (measured[1] === "6") u.fail("This precision regression needs the actual non-rounded canvas measurement, not nominal six");
  u.equal(document.querySelector('[data-testid="qs-binding-row-QS-WALL-A"]')?.getAttribute("data-binding-status"), "stale-measurement", "Rounded quantity remains stale after rebind-only");
  if (document.querySelector('[data-testid="qs-cost-base-total"]')) u.fail("Rounded quantity incorrectly regained pricing");
  return { typed: "6", measured: measured[1], staleGuardExact: true };
});
evaluate(async () => {
  const { useStudio } = await import("/src/studio/store.ts");
  window.__SC10_PROOF__.beforeMeasuredCopyRuns = JSON.stringify(useStudio.getState().job.runs);
  return "Recorded read-only geometry before the explicit measured-copy action";
});
ui(u => {
  const row = u.control("Measured entity 1").closest(".industry-fields");
  const button = [...row.querySelectorAll("button")].find(element => element.textContent.trim() === "Use measured quantity and rebind");
  if (!button || button.matches(":disabled")) u.fail("Explicit measured-quantity copy action is unavailable");
  button.click();
  return "Estimator explicitly copied the live measured quantity and rebound it";
});
waitUI(() => document.querySelector('[data-testid="qs-binding-row-QS-WALL-A"]')?.getAttribute("data-binding-status") === "verified");
waitSaved();
evaluate(async projectId => {
  const { useStudio } = await import("/src/studio/store.ts");
  const { industryDraftKey } = await import("/src/studio/industries/draftStorage.ts");
  const proof = window.__SC10_PROOF__, form = JSON.parse(localStorage.getItem(industryDraftKey(projectId))).drafts["quantity-surveying"].form;
  const row = form.items.find(item => item.key === "item-wall-a");
  if (row.quantity !== proof.exactMeasurement.quantity || row.unit !== proof.exactMeasurement.unit || row.entityBinding.measuredQuantity !== row.quantity)
    throw Error("Explicit measured copy did not persist the exact visible quantity/unit and matching binding");
  if (row.evidence !== "unverified") throw Error("Explicit measured copy promoted evidence");
  if (JSON.stringify(useStudio.getState().job.runs) !== proof.beforeMeasuredCopyRuns) throw Error("Measured copy changed source geometry");
  return { exactPersistedQuantity: row.quantity, unit: row.unit, evidenceUnchanged: true, geometryUnchanged: true };
}, projectId);
screenshot("sc10-exact-measured-copy-desktop-1600x1000", '[data-testid="qs-entity-select-1"]');
totals(10296, 17160);
set("Cost item to price", "item-wall-a");
sourcePin("Material", 2, 2);
ui(u => {
  u.equal(u.minor('[data-testid="qs-cost-base-total"]'), 10296, "Unapplied supplier selection leaves pinned contractor rate intact");
  if (![...document.querySelectorAll(".qs-cost-warning")].some(element => element.textContent.includes("Unapplied rate edits"))) u.fail("Unapplied rate selection has no warning");
  return "Draft supplier edit is not silently applied";
});
click("Save rate revision for QS-WALL-A");
totals(12038, 18902);
saveRevision(3);
evaluate(rememberSaved, 3, projectId, proofKey);
click("Compare cost revisions");
waitUI(() => document.querySelector(".qs-cost-comparison")?.open === true);
set("Later cost revision", "3");
set("Earlier cost revision", "2");
ui(assertDelta, 1716, 1742, 0, 3458, { "QS-WALL-A": "modified", "QS-WALL-B": "unchanged" });
screenshot("sc10-exact-quantity-rate-delta-desktop-1600x1000");
scenario.push(["key", "Escape"]);
waitUI(() => !document.querySelector(".qs-cost-comparison")?.open);

// Removal and a genuinely new UI row make all three change categories visible.
click("Remove quantity 2");
waitUI(() => !document.querySelector('[data-testid="qs-binding-row-QS-WALL-B"]'));
click("Add quantity");
set("Item reference 2", "QS-WALL-C");
set("Quantity 2", "4");
set("Unit 2", "m");
set("Assign item 2", "node-wall-b");
set("Measured entity 2", "run-sc10-b");
ui(u => {
  const option = [...u.control("Cost item to price").options].find(element => element.textContent.startsWith("QS-WALL-C ·"));
  if (!option) u.fail("New quantity row not available to cost editor");
  u.set("Cost item to price", option.value);
  return option.value;
});
waitUI(u => u.control("Cost item to price").selectedOptions[0]?.textContent.startsWith("QS-WALL-C ·"));
sourcePin("Material", 1, 2);
set("Labour treatment", "pinned");
sourcePin("Labour", 1, 3);
set("Labour basis or exclusion reason", "Separate installation labour per measured metre; material wastage does not multiply labour.");
set("Material wastage %", "10");
set("Net cost markup %", "20");
ui(u => { const option = [...u.control("Cost scope").options].find(element => element.textContent === "Alternative partition"); if (!option) u.fail("Existing option was lost"); return u.set("Cost scope", option.value); });
click("Save rate revision for QS-WALL-C");
totals(12038, 18902);
saveRevision(4);
evaluate(rememberSaved, 4, projectId, proofKey);
click("Compare cost revisions");
waitUI(() => document.querySelector(".qs-cost-comparison")?.open === true);
set("Later cost revision", "4");
set("Earlier cost revision", "2");
ui(assertDelta, 1716, 1742, 0, 3458, { "QS-WALL-A": "modified", "QS-WALL-B": "removed", "QS-WALL-C": "new" });
ui(assertLayout, true);
screenshot("sc10-new-removed-modified-desktop-1600x1000");
scenario.push(["set", "viewport", "1024", "768"]);
ui(assertLayout, true);
screenshot("sc10-new-removed-modified-tablet-1024x768");
scenario.push(["key", "Escape"]);
waitUI(() => !document.querySelector(".qs-cost-comparison")?.open);
ui(assertLayout, false);
screenshot("sc10-accepted-base-totals-tablet-1024x768", ".qs-cost-totals");
screenshot("sc10-recorded-history-tablet-1024x768", '[data-testid="qs-cost-history"]');
waitSaved();
evaluate(rememberSaved, 4, projectId, proofKey);

// Real page navigation reloads persisted project, source binary and QS choices.
scenario.push(["open", "http://127.0.0.1:8080/"], ["wait", "--fn", "document.querySelector('[data-hydration-status]')?.getAttribute('data-hydration-status') === 'ready'"]);
evaluate(async (projectId, proofKey) => {
  const { useStudio } = await import("/src/studio/store.ts");
  const { industryDraftKey } = await import("/src/studio/industries/draftStorage.ts");
  const { priceBookKey, parsePriceBookLibrary } = await import("/src/studio/pricing/priceBooks.ts");
  const proof = JSON.parse(sessionStorage.getItem(proofKey)), state = useStudio.getState();
  if (state.job.id !== projectId || state.assetReadiness.document.state !== "ready" || state.activePlanBinary?.sha256 !== proof.sourceSha256)
    throw Error("Normal reload failed to restore the project and exact source binary");
  const pricing = JSON.parse(localStorage.getItem(industryDraftKey(projectId))).drafts["quantity-surveying"].form.pricing;
  if (JSON.stringify(pricing) !== proof.pricing) throw Error("Reload changed project-scoped pricing bytes");
  const library = parsePriceBookLibrary(localStorage.getItem(priceBookKey(projectId)), projectId);
  if (!proof.supplierHashes.every(entry => library.books[0].revisions[entry.revision - 1].source.sha256 === entry.sha256)) throw Error("Supplier provenance changed on reload");
  return { projectId, sourceSha256: proof.sourceSha256, recordedRevisions: pricing.snapshots.length, supplierRevisions: library.books[0].revisions.length, pricingByteExact: true, hydratedWithoutReseeding: true };
}, projectId, proofKey);
scenario.push(["find", "role", "button", "click", "--name", "Estimate", "--exact"], ["wait", "--fn", "!!document.querySelector('.industry-workbench')"]);
openWorksheet();
totals(12038, 18902);
waitUI(() => document.querySelector('[data-testid="qs-cost-history"]')?.textContent.startsWith("4 recorded cost revisions"));
ui(assertLayout, false);
screenshot("sc10-reloaded-cost-plan-tablet-1024x768", ".qs-cost-totals");
scenario.push(["set", "viewport", "1600", "1000"]);
click("Compare cost revisions");
waitUI(() => document.querySelector(".qs-cost-comparison")?.open === true);
set("Later cost revision", "4");
set("Earlier cost revision", "2");
ui(assertDelta, 1716, 1742, 0, 3458, { "QS-WALL-A": "modified", "QS-WALL-B": "removed", "QS-WALL-C": "new" });
ui(assertLayout, true);
screenshot("sc10-reloaded-immutable-comparison-desktop-1600x1000");
scenario.push(["key", "Escape"], ["errors"]);

mkdirSync(captures, { recursive: true });
const output = directory + "/sc10-qs-rate-delta.scenario.json";
writeFileSync(output, JSON.stringify(scenario, null, 2), "utf8");
console.log("Scenario written to " + output + " (" + scenario.length + " operations). Execution pending DANS1.");
