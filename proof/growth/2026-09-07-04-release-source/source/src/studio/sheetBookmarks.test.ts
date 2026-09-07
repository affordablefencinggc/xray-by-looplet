import { describe,it } from "node:test";
import assert from "node:assert/strict";
import {captureSheetBookmark,restoreSheetBookmark,sheetBookmarkSchema} from "./sheetBookmarks.ts";
import {sourceViewport} from "./documentViewport.ts";
describe("source page saved views",()=>{
  it("round trips source centre and zoom when viewport changes aspect and size",()=>{
    const aspect=1.414,zoom=2.5,pan={x:130,y:-84};
    const old=sourceViewport({x:0,y:0,width:aspect,height:1},1000,700,zoom)!;
    const saved=captureSheetBookmark("Drainage junction",zoom,pan,{width:aspect*old.scale,height:old.scale});
    const same=restoreSheetBookmark(saved,{width:1000,height:700});
    assert.ok(Math.abs(same.pan.x-pan.x)<1e-8);assert.ok(Math.abs(same.pan.y-pan.y)<1e-8);
    const mobile=restoreSheetBookmark(saved,{width:366,height:480}),frame=sourceViewport({x:0,y:0,width:aspect,height:1},366,480,mobile.zoom,mobile.pan)!;
    assert.ok(Math.abs((366/2-frame.x)/(aspect*frame.scale)-saved.center.x)<1e-8);
    assert.ok(Math.abs((480/2-frame.y)/frame.scale-saved.center.y)<1e-8);
    assert.equal(mobile.zoom,zoom);
  });
  it("refuses unloaded/nonfinite source geometry, unsupported zoom and invalid saved data",()=>{
    assert.throws(()=>captureSheetBookmark("Detail",1,{x:0,y:0},{width:0,height:100}),/finish rendering/);
    assert.throws(()=>captureSheetBookmark(" ",1,{x:0,y:0},{width:100,height:100}));
    assert.throws(()=>captureSheetBookmark("Detail",21,{x:0,y:0},{width:100,height:100}));
    const saved=captureSheetBookmark("Detail",1,{x:0,y:0},{width:100,height:100});
    assert.throws(()=>restoreSheetBookmark(saved,{width:0,height:0}),/not ready/);
    assert.throws(()=>sheetBookmarkSchema.parse({...saved,center:{x:Infinity,y:0}}));
  });
});
