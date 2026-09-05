import { describe,it } from "node:test";
import assert from "node:assert/strict";
import {sourceViewport,sourceToCanvas,canvasToSource,parseSvgViewBox,svgSourceBounds,snapSourcePoint,pointOnSource} from "./documentViewport.ts";
describe("actual source viewport",()=>{
  it("round trips landscape, portrait, nonzero crop origins, zoom/pan and mobile resize",()=>{
    for(const bounds of [{x:0,y:0,width:12000,height:8000},{x:-200,y:40,width:200,height:600},{x:0,y:0,width:400,height:200}])
      for(const [width,height] of [[1280,700],[374,350],[700,1280]])for(const zoom of [.2,1,1.25,4]){
        const frame=sourceViewport(bounds,width,height,zoom,{x:37,y:-19})!;
        const p={x:bounds.x+bounds.width*.23,y:bounds.y+bounds.height*.64};const q=canvasToSource(sourceToCanvas(p,frame),frame);
        assert.ok(Math.abs(p.x-q.x)<1e-8 && Math.abs(p.y-q.y)<1e-8);
        const a=sourceToCanvas({x:bounds.x,y:bounds.y},frame),b=sourceToCanvas({x:bounds.x+bounds.width,y:bounds.y+bounds.height},frame);
        assert.ok(Math.abs((b.x-a.x)/(b.y-a.y)-bounds.width/bounds.height)<1e-8);
      }
  });
  it("keeps calibrated real landmark length invariant across the camera",()=>{
    const bounds={x:0,y:0,width:12000,height:8000},a={x:200,y:200},b={x:11800,y:200};
    for(const zoom of [.25,1,1.25,5])for(const w of [374,756,1100]){
      const frame=sourceViewport(bounds,w,543,zoom,{x:38,y:22})!;
      const p=canvasToSource(sourceToCanvas(a,frame),frame),q=canvasToSource(sourceToCanvas(b,frame),frame);
      assert.ok(Math.abs(Math.hypot(p.x-q.x,p.y-q.y)*.001-11.6)<1e-9);
    }
  });
  it("rejects invalid, absent and percentage-only source dimensions",()=>{
    assert.equal(parseSvgViewBox('<svg width="100%" height="100%">'),null);
    assert.equal(parseSvgViewBox('<svg viewBox="0 0 0 40">'),null);
    assert.equal(sourceViewport({x:0,y:0,width:Infinity,height:8},390,800),null);
    assert.equal(sourceViewport({x:0,y:0,width:12,height:8},0,800),null);
    assert.equal(sourceViewport({x:0,y:0,width:12,height:8},390,800,Number.MIN_VALUE),null);
    assert.equal(sourceViewport({x:0,y:0,width:12,height:8},390,800,Number.MAX_VALUE),null);
    assert.deepEqual(parseSvgViewBox('<!-- <svg viewBox="0 0 1 1"> --><svg viewBox="10 20 300 400">'),{x:10,y:20,width:300,height:400});
    assert.deepEqual(parseSvgViewBox(`<svg data-note=" viewBox='0 0 1 1'" viewBox="10 20 300 400">`),{x:10,y:20,width:300,height:400});
    assert.equal(parseSvgViewBox('<svg data-width="100" height="200">'),null);
    assert.deepEqual(parseSvgViewBox('<svg width="12000mm" height="8000mm" viewBox="-10 20 12000 8000">'),{x:-10,y:20,width:12000,height:8000});
    assert.deepEqual(parseSvgViewBox('<svg width="1in" height="2in">'),{x:0,y:0,width:96,height:192});
  });
  it("source mode cannot snap to hidden procedural geometry",()=>{
    assert.equal(snapSourcePoint({x:6.1,y:3.4},[],100,true).snapped,false);
    assert.deepEqual(snapSourcePoint({x:202,y:200},[{x:200,y:200}],3,true).point,{x:200,y:200});
    assert.equal(pointOnSource({x:-1,y:20},{x:0,y:0,width:30,height:30}),false);
  });
  it("retains SVG root viewport margins when its aspect differs from viewBox",()=>{
    const box={x:10,y:20,width:100,height:100};
    assert.deepEqual(svgSourceBounds(box,"200","100"),{x:0,y:0,width:200,height:100});
    assert.deepEqual(svgSourceBounds(box,"2in","1in"),{x:0,y:0,width:192,height:96});
    assert.deepEqual(svgSourceBounds(box,"100%","100%"),box);
    assert.deepEqual(svgSourceBounds(box,"200","200"),box);
  });
});
