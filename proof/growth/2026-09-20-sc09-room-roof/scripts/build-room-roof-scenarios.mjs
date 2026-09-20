/**
 * Packaging only. Product/browser execution belongs on DANS1 through the
 * reviewed raw fast-CDP runner. Both variants exercise the same public UI; the
 * production variant is additionally rejected if any dev-module/store access
 * enters its operations.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const scenarioDirectory = resolve(here, "../scenarios");
const projectId = "job-sc09-room-roof";
const projectStorageKey = "xray:fencing-job:v2";
const industryStorageKey = `xray.industry-drafts.v1:${projectId}`;
const planDatabase = "xray-plan-content-v1";
const planStore = "documents";
const roomId = "area-sc09-room-a";
const roofId = "area-sc09-roof-a";
const roomItem = "QS-ROOM-A";
const roofItem = "QS-ROOF-A";
const expectedRoom = 12;
const expectedRoof = 12 / Math.cos(Math.PI / 6);
const at = "2026-09-20T00:00:00.000Z";
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
<rect width="600" height="400" fill="#f4f1e8"/>
<path d="M80 100H240V220H80Z" fill="none" stroke="#334155" stroke-width="3"/>
<text x="80" y="88" font-family="sans-serif" font-size="14">ROOM A closed polygon</text>
<path d="M340 100H500V220H340Z" fill="none" stroke="#7c3aed" stroke-width="3"/>
<text x="340" y="88" font-family="sans-serif" font-size="14">ROOF A closed polygon</text>
<path d="M100 340H500" stroke="#b45309" stroke-width="4"/>
<path d="M100 330V350M500 330V350" stroke="#b45309" stroke-width="3"/>
<text x="255" y="332" font-family="sans-serif" font-size="14">10.000 m reference</text>
<text x="330" y="250" font-family="sans-serif" font-size="14">Roof pitch 30 deg; rise direction 90 deg clockwise from page up</text>
</svg>`;
const sourceBytes = Buffer.from(svg, "utf8");
const sourceSha256 = createHash("sha256").update(sourceBytes).digest("hex");
const source = {
  documentId: "doc-sc09-room-roof", name: "SC09 room and roof measured source.svg", kind: "svg",
  mimeType: "image/svg+xml", sizeBytes: sourceBytes.byteLength, sha256: sourceSha256,
  bytesBase64: sourceBytes.toString("base64"),
};
const document = { id: source.documentId, name: source.name, kind: "svg", importedAt: at, pageCount: 1, sha256: sourceSha256, source: "web" };
const calibrationPoints = [{ x: 100, y: 340 }, { x: 500, y: 340 }];
const candidate = {
  id: "cal-sc09-room-roof-10m", source: "manual", metresPerUnit: 0.025, confidence: 1,
  inputDistance: { value: 10, unit: "m" }, knownDistanceM: 10, points: calibrationPoints,
  provenance: { method: "two-point", evidence: "Explicit 10.000 m reference on the controlled source sheet", documentId: source.documentId },
};
const calibration = {
  sheet: 0, coordinateSpace: "source-page-v1", metresPerUnit: 0.025, source: "manual", confidence: 1, locked: true,
  knownDistanceM: 10, points: calibrationPoints, transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  inputDistance: candidate.inputDistance, candidates: [candidate], selectedCandidateId: candidate.id, conflict: null,
};
const area = (id, label, points) => ({
  id, kind: "area", label, value: 0, unit: "m²", sheet: 0, points,
  documentId: source.documentId, sourceSha256, coordinateSpace: "source-page-v1",
});
const job = {
  schemaVersion: 2, id: projectId, revision: 1, name: "SC09 room and roof source proof", trade: "general", status: "draft",
  createdAt: at, updatedAt: at, site: { address: "", estimator: "", inspectionDate: "", notes: "" },
  documents: [document], activeDocumentId: source.documentId, calibrations: [calibration], runs: [], gates: [], photos: [], bom: [],
  quoteDraft: null, revisionHistory: [], activeSheet: 0,
  annotations: [
    area(roomId, "Room A outline", [{ x: 80, y: 100 }, { x: 240, y: 100 }, { x: 240, y: 220 }, { x: 80, y: 220 }]),
    area(roofId, "Roof A outline", [{ x: 340, y: 100 }, { x: 500, y: 100 }, { x: 500, y: 220 }, { x: 340, y: 220 }]),
  ],
};
const library = {
  format: "xray.industry-drafts/1", projectId, revision: 1,
  drafts: { "quantity-surveying": { revision: 1, form: {
    hierarchyId: "SC09 room and roof", hierarchyRevision: "Controlled source Rev A", calculated: false, binding: null,
    nodes: [
      { key: "node-room", code: "ROOM", label: "Room areas", parentKey: "" },
      { key: "node-roof", code: "ROOF", label: "Roof planes", parentKey: "" },
    ],
    items: [
      { key: "item-room", reference: roomItem, quantity: String(expectedRoom), unit: "m²", evidence: "unverified", nodeKey: "node-room" },
      { key: "item-roof", reference: roofItem, quantity: String(expectedRoof), unit: "m²", evidence: "unverified", nodeKey: "node-roof" },
    ],
  } } },
};
const fixture = {
  format: "xray.sc09-room-roof-browser-fixture/v1", projectStorageKey, industryStorageKey, planDatabase, planStore,
  job, library, sourceBounds: { x: 0, y: 0, width: 600, height: 400 }, source,
  expected: { roomId, roofId, roomItem, roofItem, room: expectedRoom, roof: expectedRoof, pitch: 30, azimuth: 90 },
};

const expression = (fn, ...args) => `(${fn.toString()})(${args.map(value => JSON.stringify(value)).join(",")})`;

async function seedFixture(fixture) {
  if (!location.pathname.endsWith("/industry-coverage/index.html") || document.querySelector("[data-hydration-status]") || document.querySelector('script[type="module"]'))
    throw Error("Fixture seed is restricted to the static pre-mount page");
  if (localStorage.getItem(fixture.projectStorageKey) !== null || localStorage.getItem(fixture.industryStorageKey) !== null)
    throw Error("Fresh proof profile required; existing product data will not be overwritten");
  const bytes = Uint8Array.from(atob(fixture.source.bytesBase64), character => character.charCodeAt(0));
  const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(byte => byte.toString(16).padStart(2, "0")).join("");
  if (digest !== fixture.source.sha256 || bytes.byteLength !== fixture.source.sizeBytes) throw Error("Controlled SVG bytes failed identity verification");
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open(fixture.planDatabase, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(fixture.planStore, { keyPath: "documentId" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(Error("Plan fixture database is blocked"));
  });
  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(fixture.planStore, "readwrite");
      const { bytesBase64, ...metadata } = fixture.source;
      void bytesBase64;
      transaction.objectStore(fixture.planStore).add({ ...metadata, bytes: bytes.buffer });
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? Error("Plan fixture transaction aborted"));
    });
  } finally { database.close(); }
  localStorage.setItem(fixture.projectStorageKey, JSON.stringify(fixture.job));
  localStorage.setItem(fixture.industryStorageKey, JSON.stringify(fixture.library));
  sessionStorage.setItem("sc09-room-roof-observer", JSON.stringify({ sourceSha256: digest, expected: fixture.expected }));
  return { seededBeforeProductMount: true, sourceSha256: digest, svgBytes: bytes.byteLength, areasUnclassified: 2, rowsUnbound: 2 };
}

function helpers() {
  const fail = message => { throw Error(message); };
  const control = name => {
    const direct = [...document.querySelectorAll("input,select,textarea")].find(element => element.getAttribute("aria-label") === name);
    const labelled = [...document.querySelectorAll("label")].find(element => element.textContent.trim().startsWith(name));
    const element = direct || labelled?.querySelector("input,select,textarea");
    if (!element) fail("Missing control: " + name);
    return element;
  };
  const set = (name, value) => {
    const element = control(name);
    if (element.matches(":disabled")) fail("Disabled control: " + name);
    if (element.tagName === "SELECT" && ![...element.options].some(option => option.value === value && !option.disabled)) fail("Unavailable option " + value + " in " + name);
    const prototype = element.tagName === "SELECT" ? HTMLSelectElement.prototype : element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value").set.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const button = name => {
    const element = [...document.querySelectorAll("button")].find(entry => (entry.getAttribute("aria-label") || entry.textContent.trim()) === name);
    if (!element) fail("Missing button: " + name);
    if (element.matches(":disabled")) fail("Disabled button: " + name);
    return element;
  };
  const click = name => button(name).click();
  const clickIn = (selector, name) => {
    const root = document.querySelector(selector);
    const element = [...(root?.querySelectorAll("button") ?? [])].find(entry => (entry.getAttribute("aria-label") || entry.textContent.trim()) === name);
    if (!element || element.matches(":disabled")) fail("Missing or disabled " + name + " in " + selector);
    element.click();
  };
  const clickQuantity = (index, name) => {
    const root = control(`Item reference ${index}`).closest(".industry-fields");
    const element = [...(root?.querySelectorAll("button") ?? [])].find(entry => (entry.getAttribute("aria-label") || entry.textContent.trim()) === name);
    if (!element || element.matches(":disabled")) fail("Missing or disabled " + name + " in quantity row " + index);
    element.click();
  };
  const choose = (selector, value) => {
    const element = document.querySelector(selector);
    if (!(element instanceof HTMLSelectElement) || element.matches(":disabled")) fail("Missing or disabled select: " + selector);
    if (![...element.options].some(option => option.value === value && !option.disabled)) fail("Unavailable entity " + value);
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(element, value);
    element.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const row = id => document.querySelector(`[data-testid="qs-binding-row-${id}"]`);
  const saved = () => document.querySelector('[data-draft-industry="quantity-surveying"]')?.getAttribute("data-draft-save") === "saved";
  return { fail, control, set, button, click, clickIn, clickQuantity, choose, row, saved };
}
const uiExpression = (fn, ...args) => `(${fn.toString()})((${helpers.toString()})(),${args.map(value => JSON.stringify(value)).join(",")})`;

function buildScenario(kind) {
  const operations = [];
  const evaluate = (fn, ...args) => operations.push(["eval", expression(fn, ...args)]);
  const ui = (fn, ...args) => operations.push(["eval", uiExpression(fn, ...args)]);
  const wait = (fn, ...args) => operations.push(["wait", "--fn", expression(fn, ...args)]);
  const waitUi = (fn, ...args) => operations.push(["wait", "--fn", uiExpression(fn, ...args)]);
  const set = (name, value) => { ui((u, n, v) => u.set(n, v), name, value); waitUi((u, n, v) => u.control(n).value === v, name, value); };
  const click = name => ui((u, n) => u.click(n), name);
  const capture = name => operations.push(["screenshot", `captures/${kind}-${name}.png`]);
  const waitAreaPreview = highlightedId => {
    wait((id) => {
      const canvas = document.querySelector('[data-qs-highlight-surface="model-3d"]');
      if (!(canvas instanceof HTMLCanvasElement) || canvas.getAttribute("data-highlighted-entity") !== id
        || canvas.dataset.areaMeshCount !== "2" || canvas.dataset.roomMeshCount !== "1" || canvas.dataset.roofMeshCount !== "1"
        || canvas.dataset.invalidAreaCount !== "0" || canvas.dataset.unknownRoofCount !== "0") return false;
      try {
        const states = JSON.parse(canvas.dataset.areaStates || "[]");
        const room = states.find(state => state.entityId === "area-sc09-room-a"), roof = states.find(state => state.entityId === "area-sc09-roof-a");
        return room?.status === "room-polygon-preview" && room.triangles > 0 && room.previewHeightSpan === 0
          && roof?.status === "declared-slope-preview" && roof.triangles > 0 && roof.pitchDegrees === 30 && roof.azimuthDegrees === 90 && roof.previewHeightSpan > 0;
      } catch { return false; }
    }, highlightedId);
    evaluate((id) => {
      const canvas = document.querySelector('[data-qs-highlight-surface="model-3d"]');
      return { highlightedEntity: id, meshCount: Number(canvas.dataset.meshCount), areaMeshCount: Number(canvas.dataset.areaMeshCount),
        roomMeshCount: Number(canvas.dataset.roomMeshCount), roofMeshCount: Number(canvas.dataset.roofMeshCount), areaStates: JSON.parse(canvas.dataset.areaStates) };
    }, highlightedId);
  };
  const openEstimate = () => {
    operations.push(["find", "role", "button", "click", "--name", "Estimate", "--exact"]);
    wait(() => Boolean(document.querySelector(".industry-workbench")));
    evaluate(() => {
      const workbench = document.querySelector(".industry-workbench");
      const picker = document.querySelector(".industry-picker select");
      if (!workbench || !(picker instanceof HTMLSelectElement)) throw Error("Quantity-surveying workbench is unavailable");
      workbench.open = true;
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(picker, "quantity-surveying");
      picker.dispatchEvent(new Event("change", { bubbles: true }));
    });
    wait(() => Boolean(document.querySelector('[data-testid="qs-item-binding-ledger"]')));
  };

  operations.push(["expect-cancelled-fetch", "{{ORIGIN}}/api/pricing-research", 8, "PricingResearchPanel aborts its provider-status request when its pane unmounts; no failed asset or search is exempted."]);
  operations.push(["set", "viewport", "1600", "1000"], ["open", "{{ORIGIN}}/industry-coverage/index.html"]);
  wait(() => location.pathname.endsWith("/industry-coverage/index.html") && document.readyState === "complete" && !document.querySelector('script[type="module"]'));
  evaluate(seedFixture, fixture);
  operations.push(["open", "{{ORIGIN}}/"]);
  wait(() => document.querySelector("[data-hydration-status]")?.getAttribute("data-hydration-status") === "ready");
  evaluate(f => {
    const job = JSON.parse(localStorage.getItem(f.projectStorageKey) || "null");
    if (job?.id !== f.job.id || job.annotations.length !== 2 || job.annotations.some(area => area.measurement)) throw Error("Product did not hydrate the exact two unclassified areas");
    if (document.querySelector("[data-boot-failure]")) throw Error("Product boot failed");
    return { hydratedFromPersistence: true, projectId: job.id, sourceSha256: job.documents[0].sha256 };
  }, fixture);
  operations.push(["find", "role", "button", "click", "--name", "Takeoff", "--exact"]);
  wait(() => Boolean(document.querySelector('[data-testid="source-area-editor"]')));

  set("Source area", roomId);
  set("Area name", "Room A measured area");
  set("Measurement family", "room-area");
  click("Apply area basis");
  wait((id, expected) => {
    const result = document.querySelector(`[data-testid="source-area-result"][data-entity-id="${id}"]`);
    return result?.getAttribute("data-family") === "room-area" && Math.abs(Number(result.getAttribute("data-measured-quantity")) - expected) < 1e-12;
  }, roomId, expectedRoom);

  set("Source area", roofId);
  set("Area name", "Roof A true surface");
  set("Measurement family", "roof-plane");
  set("Roof pitch degrees", "30");
  set("Roof rise direction degrees", "90");
  set("Roof slope source reference", "Controlled source note: Roof pitch 30 deg; rise direction 90 deg clockwise from page up");
  ui((u, text) => {
    const label = [...document.querySelectorAll("label")].find(entry => entry.textContent.trim() === text);
    const checkbox = label?.querySelector('input[type="checkbox"]');
    if (!(checkbox instanceof HTMLInputElement) || checkbox.matches(":disabled")) u.fail("Roof source-review checkbox unavailable");
    if (!checkbox.checked) checkbox.click();
  }, "I checked the pitch and rise direction against this source sheet.");
  click("Apply area basis");
  wait((id, expected) => {
    const result = document.querySelector(`[data-testid="source-area-result"][data-entity-id="${id}"]`);
    return result?.getAttribute("data-family") === "roof-plane" && Math.abs(Number(result.getAttribute("data-measured-quantity")) - expected) < 1e-12;
  }, roofId, expectedRoof);
  evaluate((key, roomId, roofId, expectedRoom, expectedRoof) => {
    const job = JSON.parse(localStorage.getItem(key) || "null");
    const room = job.annotations.find(area => area.id === roomId), roof = job.annotations.find(area => area.id === roofId);
    if (room?.measurement?.entityType !== "room-area" || room.measurement.revision !== 1 || room.measurement.roofSlope !== null) throw Error("Room classification did not persist exactly");
    if (roof?.measurement?.entityType !== "roof-plane" || roof.measurement.revision !== 1 || roof.measurement.roofSlope?.pitchDegrees !== 30 || roof.measurement.roofSlope?.azimuthDegrees !== 90) throw Error("Roof slope provenance did not persist exactly");
    if (Math.abs(room.value - expectedRoom) > 1e-12 || Math.abs(roof.value - expectedRoof) > 1e-12) throw Error("Persisted measured values differ from independent expected geometry");
  }, projectStorageKey, roomId, roofId, expectedRoom, expectedRoof);
  evaluate(() => document.querySelector('[data-testid="source-area-editor"]')?.scrollIntoView({ block: "center" }));
  capture("classified-room-roof-desktop-1600x1000");

  openEstimate();
  waitUi(u => Boolean(document.querySelector('[data-testid="qs-entity-select-1"]')) && u.saved());
  ui((u, selector, entity) => u.choose(selector, entity), '[data-testid="qs-entity-select-1"]', roomId);
  waitUi((u, id) => u.row(id)?.getAttribute("data-binding-status") === "verified", roomItem);
  ui((u, selector, entity) => u.choose(selector, entity), '[data-testid="qs-entity-select-2"]', roofId);
  waitUi((u, id) => u.row(id)?.getAttribute("data-binding-status") === "verified", roofItem);
  waitUi(u => u.saved());
  ui((u, room, roof) => {
    for (const id of [room, roof]) {
      if (u.row(id)?.getAttribute("data-binding-status") !== "verified") u.fail(id + " is not current");
      if (!document.querySelector(`[data-testid="qs-binding-pricing-${id}"]`)?.textContent.includes("Permitted")) u.fail(id + " pricing is not permitted");
    }
    if (document.querySelector('[data-testid="qs-binding-withheld-notice"]')) u.fail("A current binding is incorrectly withheld");
    document.querySelector('[data-testid="qs-item-binding-ledger"]')?.scrollIntoView({ block: "center" });
  }, roomItem, roofItem);
  capture("two-current-area-bindings-desktop-1600x1000");

  operations.push(["set", "viewport", "1024", "768"]);
  for (const [item, label] of [[roomItem, "room"], [roofItem, "roof"]]) {
    evaluate((id) => {
      for (const detail of document.querySelectorAll('[data-testid^="qs-binding-provenance-"]')) detail.open = detail.getAttribute("data-testid") === `qs-binding-provenance-${id}`;
      const detail = document.querySelector(`[data-testid="qs-binding-provenance-${id}"]`);
      const hashes = [...detail.querySelectorAll("code[data-qs-binding-hash]")].map(code => code.textContent.trim());
      if (!detail?.open || hashes.length !== 2 || hashes.some(hash => !/^[a-f0-9]{64}$/.test(hash))) throw Error(id + " expanded provenance did not expose both full SHA-256 identities");
      detail.scrollIntoView({ block: "start" });
      return { item: id, geometrySha256: hashes[0], sourceSha256: hashes[1] };
    }, item);
    capture(`${label}-binding-provenance-tablet-1024x768`);
  }
  operations.push(["set", "viewport", "1600", "1000"]);

  ui((u, id) => u.clickIn(`[data-testid="qs-binding-row-${id}"]`, "Show in plan + 3D"), roomItem);
  wait((id) => document.querySelector('[data-testid="qs-evidence-plan"]')?.getAttribute("data-highlighted-entity") === id
    && document.querySelector('[data-qs-highlight-surface="model-3d"]')?.getAttribute("data-highlighted-entity") === id, roomId);
  waitAreaPreview(roomId);
  evaluate(() => document.querySelector('[data-testid="qs-evidence-preview"]')?.scrollIntoView({ block: "center" }));
  capture("room-highlight-plan-3d-desktop-1600x1000");
  click("Edit highlighted source area");
  wait((id) => document.querySelector('[data-testid="source-area-result"]')?.getAttribute("data-entity-id") === id, roomId);
  wait(() => [...document.querySelectorAll("button")].some(button => button.textContent.trim() === "Move area vertices" && !button.matches(":disabled")));
  click("Move area vertices");
  wait(() => [...document.querySelectorAll("button")].some(button => button.textContent.trim() === "Move area vertices" && button.getAttribute("aria-pressed") === "true"));
  evaluate((key, id, bounds) => {
    const job = JSON.parse(localStorage.getItem(key) || "null"), before = job.annotations.find(area => area.id === id);
    const untouched = job.annotations.find(area => area.id !== id);
    const canvas = document.querySelector('.measure-document-preview canvas[aria-label="Plan drawing canvas"]');
    const page = document.querySelector(".measure-document-preview .document-source-page");
    if (!(canvas instanceof HTMLCanvasElement) || !page || !before?.measurement || !untouched) throw Error("Selected room canvas geometry is unavailable");
    if (canvas.getAttribute("data-highlighted-entity") !== id) throw Error("Actual plan canvas did not retain the selected room identity");
    const pageRect = page.getBoundingClientRect(), canvasRect = canvas.getBoundingClientRect();
    const client = point => ({ x: pageRect.left + (point.x - bounds.x) / bounds.width * pageRect.width, y: pageRect.top + (point.y - bounds.y) / bounds.height * pageRect.height });
    const from = client(before.points[0]), to = client({ x: before.points[0].x - 20, y: before.points[0].y });
    for (const point of [from, to]) if (point.x < canvasRect.left || point.x > canvasRect.right || point.y < canvasRect.top || point.y > canvasRect.bottom || point.x < 0 || point.y < 0 || point.x > innerWidth || point.y > innerHeight) throw Error("Native room drag coordinates are outside the visible canvas");
    window.__SC09_ROOM_ROOF__ = { drag: { from, to, before: structuredClone(before), untouched: structuredClone(untouched) } };
    return { from, to, revision: before.measurement.revision, coordinateAuthority: "rendered source rectangle + source-page-v1 fixture bounds" };
  }, projectStorageKey, roomId, fixture.sourceBounds);
  operations.push(["drag", "--from", "window.__SC09_ROOM_ROOF__.drag.from", "--to", "window.__SC09_ROOM_ROOF__.drag.to", "--steps", "8", "--button", "left"]);
  wait((key, id) => {
    const after = JSON.parse(localStorage.getItem(key) || "null")?.annotations?.find(area => area.id === id);
    const before = window.__SC09_ROOM_ROOF__?.drag?.before;
    return Boolean(after && before && after.measurement.revision === before.measurement.revision + 1 && JSON.stringify(after.points) !== JSON.stringify(before.points));
  }, projectStorageKey, roomId);
  evaluate((key, roomId, roofId) => {
    const job = JSON.parse(localStorage.getItem(key) || "null"), state = window.__SC09_ROOM_ROOF__;
    const room = job.annotations.find(area => area.id === roomId), roof = job.annotations.find(area => area.id === roofId);
    if (room.measurement.revision !== state.drag.before.measurement.revision + 1 || JSON.stringify(room.points) === JSON.stringify(state.drag.before.points)) throw Error("Native pointer drag did not persist exactly one room geometry revision");
    if (JSON.stringify(roof) !== JSON.stringify(state.drag.untouched)) throw Error("Editing the room also changed the roof");
    const observation = JSON.parse(sessionStorage.getItem("sc09-room-roof-observer"));
    observation.editedRoom = { revision: room.measurement.revision, points: room.points, value: room.value };
    sessionStorage.setItem("sc09-room-roof-observer", JSON.stringify(observation));
    return observation.editedRoom;
  }, projectStorageKey, roomId, roofId);
  evaluate(() => document.querySelector('[data-testid="source-area-editor"]')?.scrollIntoView({ block: "center" }));
  capture("native-room-vertex-edit-desktop-1600x1000");

  openEstimate();
  waitUi((u, room, roof) => u.row(room)?.getAttribute("data-binding-status") === "stale-measurement" && u.row(roof)?.getAttribute("data-binding-status") === "verified", roomItem, roofItem);
  ui((u, room, roof) => {
    if (!document.querySelector(`[data-testid="qs-binding-pricing-${room}"]`)?.textContent.includes("Withheld")) u.fail("Edited room pricing is not withheld");
    if (!document.querySelector(`[data-testid="qs-binding-pricing-${roof}"]`)?.textContent.includes("Permitted")) u.fail("Untouched roof pricing is not permitted");
    if (!document.querySelector('[data-testid="qs-binding-withheld-notice"]')?.textContent.includes("Pricing withheld on 1 item")) u.fail("Selective one-item withholding is not disclosed");
    document.querySelector(`[data-testid="qs-binding-row-${room}"]`)?.scrollIntoView({ block: "center" });
  }, roomItem, roofItem);
  capture("selective-room-stale-desktop-1600x1000");
  operations.push(["set", "viewport", "1024", "768"]);
  evaluate(() => document.querySelector('[data-testid="qs-item-binding-ledger"]')?.scrollIntoView({ block: "center" }));
  capture("selective-room-stale-tablet-1024x768");

  ui(u => u.clickQuantity(1, "Use measured quantity and rebind"));
  waitUi((u, room, roof) => u.row(room)?.getAttribute("data-binding-status") === "verified" && u.row(roof)?.getAttribute("data-binding-status") === "verified" && u.saved(), roomItem, roofItem);
  ui((u, room, roof) => {
    if (document.querySelector('[data-testid="qs-binding-withheld-notice"]')) u.fail("Withholding remained after explicit measured-quantity review and rebind");
    for (const id of [room, roof]) if (!document.querySelector(`[data-testid="qs-binding-pricing-${id}"]`)?.textContent.includes("Permitted")) u.fail(id + " pricing remained withheld");
    document.querySelector('[data-testid="qs-item-binding-ledger"]')?.scrollIntoView({ block: "center" });
  }, roomItem, roofItem);
  capture("explicit-room-rebind-tablet-1024x768");

  operations.push(["set", "viewport", "1600", "1000"]);
  ui((u, id) => u.clickIn(`[data-testid="qs-binding-row-${id}"]`, "Show in plan + 3D"), roofItem);
  wait((id) => document.querySelector('[data-testid="qs-evidence-plan"]')?.getAttribute("data-highlighted-entity") === id
    && document.querySelector('[data-qs-highlight-surface="model-3d"]')?.getAttribute("data-highlighted-entity") === id, roofId);
  waitAreaPreview(roofId);
  evaluate(() => document.querySelector('[data-testid="qs-evidence-preview"]')?.scrollIntoView({ block: "center" }));
  capture("roof-highlight-plan-3d-desktop-1600x1000");
  click("Edit highlighted source area");
  wait((id) => document.querySelector('[data-testid="source-area-result"]')?.getAttribute("data-entity-id") === id, roofId);
  wait(() => [...document.querySelectorAll("button")].some(button => button.textContent.trim() === "Move area vertices" && !button.matches(":disabled")));
  click("Move area vertices");
  wait(() => [...document.querySelectorAll("button")].some(button => button.textContent.trim() === "Move area vertices" && button.getAttribute("aria-pressed") === "true"));
  evaluate((key, id, bounds) => {
    const job = JSON.parse(localStorage.getItem(key) || "null"), before = job.annotations.find(area => area.id === id);
    const room = job.annotations.find(area => area.id !== id);
    const canvas = document.querySelector('.measure-document-preview canvas[aria-label="Plan drawing canvas"]');
    const page = document.querySelector(".measure-document-preview .document-source-page");
    if (!(canvas instanceof HTMLCanvasElement) || !page || !before?.measurement || !room) throw Error("Selected roof canvas geometry is unavailable");
    if (canvas.getAttribute("data-highlighted-entity") !== id) throw Error("Actual plan canvas did not retain the selected roof identity");
    const pageRect = page.getBoundingClientRect(), canvasRect = canvas.getBoundingClientRect();
    const client = point => ({ x: pageRect.left + (point.x - bounds.x) / bounds.width * pageRect.width, y: pageRect.top + (point.y - bounds.y) / bounds.height * pageRect.height });
    const from = client(before.points[0]), to = client({ x: before.points[0].x - 20, y: before.points[0].y });
    for (const point of [from, to]) if (point.x < canvasRect.left || point.x > canvasRect.right || point.y < canvasRect.top || point.y > canvasRect.bottom || point.x < 0 || point.y < 0 || point.x > innerWidth || point.y > innerHeight) throw Error("Native roof drag coordinates are outside the visible canvas");
    window.__SC09_ROOM_ROOF__.roofDrag = { from, to, before: structuredClone(before), room: structuredClone(room) };
    return { from, to, revision: before.measurement.revision, coordinateAuthority: "rendered source rectangle + source-page-v1 fixture bounds" };
  }, projectStorageKey, roofId, fixture.sourceBounds);
  operations.push(["drag", "--from", "window.__SC09_ROOM_ROOF__.roofDrag.from", "--to", "window.__SC09_ROOM_ROOF__.roofDrag.to", "--steps", "8", "--button", "left"]);
  wait((key, id) => {
    const after = JSON.parse(localStorage.getItem(key) || "null")?.annotations?.find(area => area.id === id);
    const before = window.__SC09_ROOM_ROOF__?.roofDrag?.before;
    return Boolean(after && before && after.measurement.revision === before.measurement.revision + 1 && JSON.stringify(after.points) !== JSON.stringify(before.points));
  }, projectStorageKey, roofId);
  evaluate((key, roomId, roofId) => {
    const job = JSON.parse(localStorage.getItem(key) || "null"), state = window.__SC09_ROOM_ROOF__;
    const room = job.annotations.find(area => area.id === roomId), roof = job.annotations.find(area => area.id === roofId);
    if (roof.measurement.revision !== state.roofDrag.before.measurement.revision + 1 || JSON.stringify(roof.points) === JSON.stringify(state.roofDrag.before.points)) throw Error("Native pointer drag did not persist exactly one roof geometry revision");
    if (JSON.stringify(room) !== JSON.stringify(state.roofDrag.room)) throw Error("Editing the roof also changed the room");
    if (roof.measurement.roofSlope?.pitchDegrees !== 30 || roof.measurement.roofSlope?.azimuthDegrees !== 90) throw Error("Roof vertex edit lost reviewed slope operands");
    const observation = JSON.parse(sessionStorage.getItem("sc09-room-roof-observer"));
    observation.editedRoof = { revision: roof.measurement.revision, points: roof.points, value: roof.value };
    sessionStorage.setItem("sc09-room-roof-observer", JSON.stringify(observation));
    return observation.editedRoof;
  }, projectStorageKey, roomId, roofId);
  evaluate(() => document.querySelector('[data-testid="source-area-editor"]')?.scrollIntoView({ block: "center" }));
  capture("native-roof-vertex-edit-desktop-1600x1000");

  openEstimate();
  waitUi((u, room, roof) => u.row(room)?.getAttribute("data-binding-status") === "verified" && u.row(roof)?.getAttribute("data-binding-status") === "stale-measurement", roomItem, roofItem);
  ui((u, room, roof) => {
    if (!document.querySelector(`[data-testid="qs-binding-pricing-${room}"]`)?.textContent.includes("Permitted")) u.fail("Untouched room pricing is not permitted");
    if (!document.querySelector(`[data-testid="qs-binding-pricing-${roof}"]`)?.textContent.includes("Withheld")) u.fail("Edited roof pricing is not withheld");
    if (!document.querySelector('[data-testid="qs-binding-withheld-notice"]')?.textContent.includes("Pricing withheld on 1 item")) u.fail("Selective roof-only withholding is not disclosed");
    document.querySelector(`[data-testid="qs-binding-row-${roof}"]`)?.scrollIntoView({ block: "center" });
  }, roomItem, roofItem);
  capture("selective-roof-stale-desktop-1600x1000");
  operations.push(["set", "viewport", "1024", "768"]);
  evaluate(() => document.querySelector('[data-testid="qs-item-binding-ledger"]')?.scrollIntoView({ block: "center" }));
  capture("selective-roof-stale-tablet-1024x768");
  ui(u => u.clickQuantity(2, "Use measured quantity and rebind"));
  waitUi((u, room, roof) => u.row(room)?.getAttribute("data-binding-status") === "verified" && u.row(roof)?.getAttribute("data-binding-status") === "verified" && u.saved(), roomItem, roofItem);
  ui((u, room, roof) => {
    if (document.querySelector('[data-testid="qs-binding-withheld-notice"]')) u.fail("Withholding remained after explicit roof measured-quantity review and rebind");
    for (const id of [room, roof]) if (!document.querySelector(`[data-testid="qs-binding-pricing-${id}"]`)?.textContent.includes("Permitted")) u.fail(id + " pricing remained withheld");
    document.querySelector('[data-testid="qs-item-binding-ledger"]')?.scrollIntoView({ block: "center" });
  }, roomItem, roofItem);
  capture("explicit-roof-rebind-tablet-1024x768");

  operations.push(["open", "{{ORIGIN}}/"]);
  wait(() => document.querySelector("[data-hydration-status]")?.getAttribute("data-hydration-status") === "ready");
  evaluate((key, industryKey, expected) => {
    const job = JSON.parse(localStorage.getItem(key) || "null"), envelope = JSON.parse(localStorage.getItem(industryKey) || "null");
    const observer = JSON.parse(sessionStorage.getItem("sc09-room-roof-observer") || "null");
    const room = job?.annotations?.find(area => area.id === expected.roomId), roof = job?.annotations?.find(area => area.id === expected.roofId);
    const items = envelope?.drafts?.["quantity-surveying"]?.form?.items;
    if (job?.id !== "job-sc09-room-roof" || job.documents[0].sha256 !== observer?.sourceSha256) throw Error("Reload changed project/source identity");
    if (room?.measurement?.revision !== observer?.editedRoom?.revision || JSON.stringify(room.points) !== JSON.stringify(observer.editedRoom.points)) throw Error("Reload lost edited room geometry/revision");
    if (roof?.measurement?.revision !== observer?.editedRoof?.revision || JSON.stringify(roof.points) !== JSON.stringify(observer.editedRoof.points)) throw Error("Reload lost edited roof geometry/revision");
    if (roof?.measurement?.roofSlope?.pitchDegrees !== expected.pitch || roof.measurement.roofSlope.azimuthDegrees !== expected.azimuth || !roof.measurement.roofSlope.source.reference.includes("Controlled source note")) throw Error("Reload lost explicit roof slope provenance");
    if (!items?.every(item => item.entityBinding?.entityId)) throw Error("Reload lost one or more explicit item bindings");
    return { normalReload: true, roomRevision: room.measurement.revision, roofSlope: roof.measurement.roofSlope, bindings: items.map(item => [item.reference, item.entityBinding.entityId]) };
  }, projectStorageKey, industryStorageKey, fixture.expected);
  openEstimate();
  waitUi((u, room, roof) => u.row(room)?.getAttribute("data-binding-status") === "verified" && u.row(roof)?.getAttribute("data-binding-status") === "verified", roomItem, roofItem);
  evaluate(() => document.querySelector('[data-testid="qs-item-binding-ledger"]')?.scrollIntoView({ block: "center" }));
  capture("reloaded-current-bindings-tablet-1024x768");
  operations.push(["set", "viewport", "1600", "1000"]);
  ui((u, id) => u.clickIn(`[data-testid="qs-binding-row-${id}"]`, "Show in plan + 3D"), roofItem);
  wait((id) => document.querySelector('[data-testid="qs-evidence-plan"]')?.getAttribute("data-highlighted-entity") === id
    && document.querySelector('[data-qs-highlight-surface="model-3d"]')?.getAttribute("data-highlighted-entity") === id, roofId);
  waitAreaPreview(roofId);
  evaluate(() => document.querySelector('[data-testid="qs-evidence-preview"]')?.scrollIntoView({ block: "center" }));
  capture("reloaded-roof-highlight-desktop-1600x1000");
  operations.push(["errors"]);
  return operations;
}

mkdirSync(scenarioDirectory, { recursive: true });
for (const kind of ["dev", "production"]) {
  const operations = buildScenario(kind);
  if (kind === "production") {
    for (const operation of operations) for (const value of operation) {
      if (typeof value === "string" && /(?:\/src\/|\bimport\s*\(|\buseStudio\b)/.test(value)) throw Error("Production scenario contains dev-module/store access");
    }
  }
  const output = resolve(scenarioDirectory, `sc09-room-roof.${kind}.json`);
  writeFileSync(output, JSON.stringify(operations, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
  const bytes = Buffer.from(JSON.stringify(operations, null, 2) + "\n");
  console.log(JSON.stringify({ kind, output, operations: operations.length, screenshots: operations.filter(operation => operation[0] === "screenshot").length,
    scenarioSha256: createHash("sha256").update(bytes).digest("hex"), sourceSvgSha256: sourceSha256, productionDevReferences: kind === "production" ? 0 : null }));
}
