import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createDefaultJob } from "./domain.ts";
import { changeSheetLifecycle, createSheetLifecycle, exportSheetRegister, parseSheetLifecycle, readJobSheetMetadata, readSheetLifecycle, saveSheetLifecycle, sheetArchiveImpact, sheetLifecycleStorageKey, sheetSourceIdentity, validateJobSheetMetadata, type SheetStorage } from "./sheetLifecycle.ts";
import {captureSheetBookmark} from "./sheetBookmarks.ts";

function fixture() {
  const job = createDefaultJob();
  job.documents = [{ id: "plan-1", name: "Architectural.pdf", kind: "pdf", source: "web", importedAt: "2026-09-07T00:00:00.000Z", sha256: "a".repeat(64), pageCount: 4 }];
  const identity = sheetSourceIdentity(job.id, job.documents[0])!;
  const map = new Map<string, string>();
  const storage: SheetStorage = { getItem: key => map.get(key) ?? null, setItem: (key, value) => { map.set(key, value); } };
  return { job, identity, storage, map };
}
describe("source sheet organisation", () => {
  it("persists custom disciplines and stable grouped order in backup and ordered export without source renumbering",()=>{
    const {job,identity,storage}=fixture();let value=createSheetLifecycle(identity);
    value=saveSheetLifecycle(value,{type:"discipline",pageIndex:0,discipline:"Structural"},storage);
    value=saveSheetLifecycle(value,{type:"discipline",pageIndex:1,discipline:"Architecture"},storage);
    value=saveSheetLifecycle(value,{type:"rename",pageIndex:2,name:"Roof framing",discipline:"Structural"},storage);
    value=saveSheetLifecycle(value,{type:"group"},storage);
    assert.deepEqual(value.pages.map(p=>p.pageIndex),[1,0,2,3]);
    assert.deepEqual(readSheetLifecycle(identity,storage),value);
    assert.deepEqual(validateJobSheetMetadata(readJobSheetMetadata(job,storage),job),[value]);
    const exported=JSON.parse(exportSheetRegister(value,"Plans.pdf"));
    assert.deepEqual(exported.sheets.map((p:{originalPage:number})=>p.originalPage),[2,1,3,4]);
    assert.deepEqual(exported.sheets.map((p:{discipline:string|null})=>p.discipline),["Architecture","Structural","Structural",null]);
    assert.throws(()=>changeSheetLifecycle(value,{type:"discipline",pageIndex:0,discipline:"x".repeat(81)}));
  });
  it("keeps old metadata byte-shape compatible and persists/removes source-page bookmarks without discarding grouping",()=>{
    const {identity,storage}=fixture();const initial=createSheetLifecycle(identity);
    assert.deepEqual(parseSheetLifecycle(JSON.stringify(initial),identity),initial);
    let value=saveSheetLifecycle(initial,{type:"discipline",pageIndex:0,discipline:"Civil"},storage);
    const bookmark=captureSheetBookmark("Junction",2,{x:15,y:22},{width:500,height:400});
    value=saveSheetLifecycle(value,{type:"bookmark",pageIndex:0,bookmark},storage);
    assert.deepEqual(readSheetLifecycle(identity,storage).pages[0].bookmarks,[bookmark]);
    assert.equal(JSON.parse(exportSheetRegister(value,"Plan.pdf")).sheets[0].bookmarks[0].name,"Junction");
    assert.throws(()=>changeSheetLifecycle(value,{type:"bookmark",pageIndex:1,bookmark}),/already exists/);
    value=saveSheetLifecycle(value,{type:"remove-bookmark",pageIndex:0,bookmarkId:bookmark.id},storage);
    assert.equal(value.pages[0].bookmarks,undefined);assert.equal(value.pages[0].discipline,"Civil");
  });
  it("archive review counts only the selected page's evidence, deduplicates linked photos and refuses changed sources", () => {
    const { job, identity } = fixture();
    const input = { ...job, activeDocumentId: identity.documentId,
      calibrations: [{sheet:0},{sheet:1}], runs: [{id:"r1",sheet:0,photoIds:["p1"]},{id:"r2",sheet:1,photoIds:["p2"]}],
      gates: [{id:"i1",sheet:0,photoIds:["p1"]}],
      photos: [{id:"p1",runIds:["r1"],gateIds:["i1"]},{id:"p2",runIds:["r2"],gateIds:[]},{id:"p3",runIds:[],gateIds:[]}],
      annotations: [{sheet:0,documentId:identity.documentId},{sheet:1,documentId:identity.documentId},{sheet:0,documentId:"other"}] };
    const before = structuredClone(input);
    assert.deepEqual(sheetArchiveImpact(input, identity, 0), {calibrations:1,traces:1,items:1,annotations:1,linkedPhotos:1,savedViews:0});
    assert.deepEqual(input, before);
    assert.throws(() => sheetArchiveImpact({...input,activeDocumentId:"other"}, identity, 0), /source drawing changed/);
  });
  it("D-04: archive review counts the saved views stored on the reviewed page only and refuses a lifecycle from another source", () => {
    const { job, identity } = fixture();
    const input = { ...job, activeDocumentId: identity.documentId, calibrations: [], runs: [], gates: [], photos: [], annotations: [] };
    let value = createSheetLifecycle(identity);
    const views = [captureSheetBookmark("Junction", 2, {x:15,y:22}, {width:500,height:400}), captureSheetBookmark("Stair", 3, {x:0,y:0}, {width:500,height:400}), captureSheetBookmark("Roof", 1, {x:5,y:5}, {width:500,height:400})];
    value = changeSheetLifecycle(value, {type:"bookmark",pageIndex:1,bookmark:views[0]});
    value = changeSheetLifecycle(value, {type:"bookmark",pageIndex:1,bookmark:views[1]});
    value = changeSheetLifecycle(value, {type:"bookmark",pageIndex:0,bookmark:views[2]});
    assert.equal(sheetArchiveImpact(input, identity, 1, value).savedViews, 2);
    assert.equal(sheetArchiveImpact(input, identity, 0, value).savedViews, 1);
    assert.equal(sheetArchiveImpact(input, identity, 2, value).savedViews, 0);
    assert.equal(sheetArchiveImpact(input, identity, 1).savedViews, 0);
    const foreign = createSheetLifecycle({ ...identity, sha256: "b".repeat(64) });
    assert.throws(() => sheetArchiveImpact(input, identity, 1, foreign), /source drawing changed/);
  });
  it("D-02: rename changes only the page label and discipline; page-keyed evidence and saved views are untouched", () => {
    const { job, identity, storage } = fixture();
    const evidence = { ...job, activeDocumentId: identity.documentId,
      calibrations: [{sheet:1}], runs: [{id:"r1",sheet:1,photoIds:["p1"]}], gates: [{id:"i1",sheet:1,photoIds:[]}],
      photos: [{id:"p1",runIds:["r1"],gateIds:[]}], annotations: [{sheet:1,documentId:identity.documentId},{sheet:1,documentId:identity.documentId}] };
    const view = captureSheetBookmark("Entry", 2, {x:15,y:22}, {width:500,height:400});
    const before = saveSheetLifecycle(saveSheetLifecycle(createSheetLifecycle(identity), {type:"bookmark",pageIndex:1,bookmark:view}, storage), {type:"discipline",pageIndex:2,discipline:"Civil"}, storage);
    const evidenceBefore = structuredClone(evidence), impactBefore = sheetArchiveImpact(evidence, identity, 1, before);
    const after = saveSheetLifecycle(before, {type:"rename",pageIndex:1,name:"Ground floor plan",discipline:"Architecture"}, storage);
    assert.deepEqual(after.pages.map(p=>p.pageIndex), before.pages.map(p=>p.pageIndex));
    assert.deepEqual(after.pages[1], { ...before.pages[1], name: "Ground floor plan", discipline: "Architecture" });
    assert.deepEqual(after.pages[1].bookmarks, [view]);
    assert.deepEqual(after.pages.filter((_,i)=>i!==1), before.pages.filter((_,i)=>i!==1));
    assert.deepEqual(after.identity, identity);
    assert.deepEqual(evidence, evidenceBefore);
    assert.deepEqual(sheetArchiveImpact(evidence, identity, 1, after), impactBefore);
    assert.deepEqual(sheetArchiveImpact(evidence, identity, 1, after), {calibrations:1,traces:1,items:1,annotations:2,linkedPhotos:1,savedViews:1});
    assert.equal(readSheetLifecycle(identity, storage).pages[1].name, "Ground floor plan");
    assert.equal(JSON.parse(exportSheetRegister(after, "Plan.pdf")).sheets[1].originalPage, 2);
  });
  it("D-05: a recovered middle page keeps its managed slot, metadata, saved views and page-keyed evidence (scale, annotations, traces, items) after neighbours moved, and the export reflects the same order", () => {
    const { job, identity, storage, map } = fixture();
    const evidence = { ...job, activeDocumentId: identity.documentId,
      calibrations: [{sheet:1},{sheet:0}], runs: [{id:"r1",sheet:1,photoIds:["p1"]}], gates: [{id:"i1",sheet:1,photoIds:[]}],
      photos: [{id:"p1",runIds:["r1"],gateIds:[]}], annotations: [{sheet:1,documentId:identity.documentId},{sheet:1,documentId:identity.documentId},{sheet:0,documentId:identity.documentId}] };
    const evidenceBefore = structuredClone(evidence);
    const view = captureSheetBookmark("Detail", 4, {x:10,y:10}, {width:500,height:400});
    let value = saveSheetLifecycle(createSheetLifecycle(identity), {type:"rename",pageIndex:1,name:"Ground floor plan",discipline:"Architecture"}, storage);
    value = saveSheetLifecycle(value, {type:"bookmark",pageIndex:1,bookmark:view}, storage);
    const impactBefore = sheetArchiveImpact(evidence, identity, 1, value);
    assert.deepEqual(impactBefore, {calibrations:1,traces:1,items:1,annotations:2,linkedPhotos:1,savedViews:1});
    const orderBefore = value.pages.map(p=>p.pageIndex), slotBefore = orderBefore.indexOf(1), storedKeysBefore = [...map.keys()];
    value = saveSheetLifecycle(value, {type:"archive",pageIndex:1}, storage);
    assert.deepEqual(value.pages.map(p=>p.pageIndex), orderBefore, "archive keeps the managed slot");
    assert.deepEqual(evidence, evidenceBefore, "archive leaves the job evidence untouched");
    assert.deepEqual(sheetArchiveImpact(evidence, identity, 1, value), impactBefore, "archived page still owns the same scale, traces, items, annotations, photos and saved view");
    assert.throws(() => changeSheetLifecycle(value, {type:"move",pageIndex:1,direction:1}), /Recover/);
    value = saveSheetLifecycle(value, {type:"move",pageIndex:2,direction:-1}, storage);
    value = saveSheetLifecycle(value, {type:"move",pageIndex:3,direction:-1}, storage);
    assert.deepEqual(value.pages.map(p=>p.pageIndex), [2,1,3,0]);
    assert.equal(value.pages[1].archived, true);
    value = saveSheetLifecycle(value, {type:"recover",pageIndex:1}, storage);
    assert.equal(value.pages.findIndex(p=>p.pageIndex===1), slotBefore);
    assert.deepEqual(value.pages[slotBefore], { pageIndex:1, name:"Ground floor plan", discipline:"Architecture", archived:false, bookmarks:[view] });
    assert.deepEqual(value.pages.map(p=>p.pageIndex), [2,1,3,0]);
    assert.deepEqual(value.pages.filter(p=>!p.archived).map(p=>p.pageIndex), [2,1,3,0]);
    assert.deepEqual(evidence, evidenceBefore, "recover leaves the job evidence untouched");
    assert.deepEqual(sheetArchiveImpact(evidence, identity, 1, value), impactBefore, "recovered page owns the same scale, traces, items, annotations, photos and saved view");
    assert.deepEqual(sheetArchiveImpact(evidence, identity, 0, value), {calibrations:1,traces:0,items:0,annotations:1,linkedPhotos:0,savedViews:0}, "neighbouring page evidence unchanged");
    assert.deepEqual([...map.keys()], storedKeysBefore, "only the lifecycle sidecar key was written; no job record key was touched");
    const persisted = readSheetLifecycle(identity, storage);
    assert.deepEqual(persisted, value);
    const exported = JSON.parse(exportSheetRegister(persisted, "Plan.pdf"));
    assert.deepEqual(exported.sheets.map((s:{originalPage:number})=>s.originalPage), [3,2,4,1]);
    assert.deepEqual(exported.sheets.map((s:{archived:boolean})=>s.archived), [false,false,false,false]);
    assert.equal(exported.sheets[1].name, "Ground floor plan");
    assert.equal(exported.sheets[1].bookmarks[0].name, "Detail");
  });
  it("accepts valid source timestamps with a timezone offset", () => {
    const { job } = fixture();
    job.documents[0].importedAt = "2026-09-07T10:00:00+10:00";
    const identity = sheetSourceIdentity(job.id, job.documents[0]);
    assert.ok(identity);
    const value = createSheetLifecycle(identity);
    assert.deepEqual(parseSheetLifecycle(JSON.stringify(value), identity), value);
  });
  it("renames and reorders without renumbering source pages or changing their source", () => {
    const { identity, storage } = fixture();
    const initial = readSheetLifecycle(identity, storage);
    const renamed = saveSheetLifecycle(initial, { type: "rename", pageIndex: 2, name: "  Structural bracing  " }, storage);
    const moved = saveSheetLifecycle(renamed, { type: "move", pageIndex: 2, direction: -1 }, storage);
    assert.deepEqual(moved.pages.map(p => p.pageIndex), [0, 2, 1, 3]);
    assert.equal(moved.pages[1].name, "Structural bracing");
    assert.deepEqual(moved.identity, identity);
    assert.deepEqual(readSheetLifecycle(identity, storage), moved);
    assert.deepEqual(initial.pages.map(p => p.pageIndex), [0, 1, 2, 3]);
  });
  it("archives and recovers every page without deleting a page; ordering skips archived slots", () => {
    const { identity } = fixture();
    let value = changeSheetLifecycle(createSheetLifecycle(identity), { type: "archive", pageIndex: 1 });
    value = changeSheetLifecycle(value, { type: "move", pageIndex: 2, direction: -1 });
    assert.deepEqual(value.pages.map(p => p.pageIndex), [2, 1, 0, 3]);
    assert.throws(() => changeSheetLifecycle(value, { type: "move", pageIndex: 1, direction: 1 }), /Recover/);
    for (let pageIndex = 0; pageIndex < 4; pageIndex++) value = changeSheetLifecycle(value, { type: "archive", pageIndex });
    assert.equal(value.pages.filter(p => p.archived).length, 4);
    value = changeSheetLifecycle(value, { type: "recover", pageIndex: 1 });
    assert.equal(value.pages.filter(p => !p.archived)[0].pageIndex, 1);
    assert.equal(value.pages.length, 4);
  });
  it("refuses stale edits and preserves the latest saved names", () => {
    const { identity, storage } = fixture();
    const windowA = readSheetLifecycle(identity, storage), windowB = readSheetLifecycle(identity, storage);
    saveSheetLifecycle(windowA, { type: "rename", pageIndex: 0, name: "Site plan" }, storage);
    assert.throws(() => saveSheetLifecycle(windowB, { type: "archive", pageIndex: 1 }, storage), /another window/);
    assert.equal(readSheetLifecycle(identity, storage).pages[0].name, "Site plan");
    assert.equal(readSheetLifecycle(identity, storage).pages[1].archived, false);
  });
  it("keeps organisation separate when source bytes, revision, page count or project change", () => {
    const { identity, storage } = fixture();
    const value = saveSheetLifecycle(createSheetLifecycle(identity), { type: "rename", pageIndex: 0, name: "Old revision" }, storage);
    for (const patch of [{ sha256: "b".repeat(64) }, { importedAt: "2026-09-08T00:00:00.000Z" }, { pageCount: 3 }, { jobId: "other-job" }, { documentId: "other-plan" }]) {
      const other = { ...identity, ...patch };
      assert.notEqual(sheetLifecycleStorageKey(other), sheetLifecycleStorageKey(identity));
      assert.equal(readSheetLifecycle(other, storage).pages[0].name, "Sheet 1");
      assert.throws(() => parseSheetLifecycle(JSON.stringify(value), other), /different source/);
    }
  });
  it("refuses malformed stored metadata and does not overwrite it", () => {
    const { identity, storage, map } = fixture();
    const initial = createSheetLifecycle(identity), key = sheetLifecycleStorageKey(identity);
    const duplicate = structuredClone(initial); duplicate.pages[1].pageIndex = 0;
    for (const raw of ["{broken", JSON.stringify({ ...initial, format: "future" }), JSON.stringify(duplicate), JSON.stringify({ ...initial, pages: initial.pages.slice(1) })]) {
      map.set(key, raw);
      assert.throws(() => saveSheetLifecycle(initial, { type: "archive", pageIndex: 0 }, storage));
      assert.equal(map.get(key), raw);
    }
  });
  it("surfaces storage failures without presenting an unsaved edit as successful", () => {
    const { identity } = fixture();
    const previous = createSheetLifecycle(identity);
    assert.throws(() => saveSheetLifecycle(previous, { type: "rename", pageIndex: 0, name: "Site" }, { getItem: () => null, setItem: () => { throw Error("Quota exceeded"); } }), /Quota exceeded/);
    assert.equal(previous.pages[0].name, "Sheet 1");
    assert.throws(() => readSheetLifecycle(identity, { getItem: () => { throw Error("Storage denied"); } }), /Storage denied/);
    assert.throws(() => changeSheetLifecycle(previous, { type: "rename", pageIndex: 0, name: " " }), /sheet name/);
    assert.throws(() => changeSheetLifecycle(previous, { type: "archive", pageIndex: 4 }), /no longer/);
  });
  it("captures inactive documents and validates portable metadata against every exact source identity", () => {
    const { job, identity, storage } = fixture();
    job.documents.push({ ...job.documents[0], id: "plan-2", sha256: "b".repeat(64), pageCount: 2 });
    const second = sheetSourceIdentity(job.id, job.documents[1])!;
    assert.equal(readJobSheetMetadata(job, storage), null);
    saveSheetLifecycle(createSheetLifecycle(identity), { type: "rename", pageIndex: 0, name: "First" }, storage);
    saveSheetLifecycle(createSheetLifecycle(second), { type: "archive", pageIndex: 1 }, storage);
    const raw = readJobSheetMetadata(job, storage)!;
    assert.equal(validateJobSheetMetadata(raw, job).length, 2);
    assert.deepEqual(validateJobSheetMetadata(null, job), []);
    assert.throws(() => validateJobSheetMetadata(raw, { ...job, id: "other" }), /different source/);
    assert.throws(() => validateJobSheetMetadata(raw, { ...job, documents: [job.documents[0]] }), /unknown/);
    const values = JSON.parse(raw);
    assert.throws(() => validateJobSheetMetadata(JSON.stringify([values[0], values[0]]), job), /duplicate/);
  });
});
