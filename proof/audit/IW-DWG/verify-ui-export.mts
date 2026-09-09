import fs from 'node:fs';
import assert from 'node:assert/strict';
import DxfParser from 'dxf-parser';
import { demonstration } from '../../../src/studio/architect/model.ts';
import { exportDxf } from '../../../src/studio/architect/exchange.ts';
// The UI scenario loads the unmodified demonstration, imports, undoes, redoes,
// undoes again, then presses Export DWG. Verify against that authored fixture.
const expected=new DxfParser().parseSync(await exportDxf(demonstration('ui-proof')))!;
const actual=new DxfParser().parseSync(fs.readFileSync('proof/audit/IW-DWG/native-ui-independent.dxf','utf8'))!;
function geometry(doc:any){
 const round=(x:any)=>typeof x==='number'?Math.round(x*1e7)/1e7:x;
 const pt=(p:any)=>[round(p.x??0),round(p.y??0),round(p.z??0)];
 return doc.entities.map((e:any)=>JSON.stringify({type:e.type,layer:e.layer,vertices:e.vertices?.map(pt),closed:!!e.shape,elevation:round(e.elevation??0),center:e.center&&pt(e.center),radius:round(e.radius),start:round(e.startAngle),end:round(e.endAngle),text:e.text,at:e.startPoint&&pt(e.startPoint),height:round(e.textHeight)})).sort();
}
assert.equal(actual.header!.$INSUNITS,4);
assert.deepEqual(geometry(actual),geometry(expected));
const report={pass:true,reader:'LibreDWG 0.14',entities:actual.entities.length,units:actual.header!.$INSUNITS,source:'native-ui-export.dwg',expected:'Unmodified demonstration after import undo/redo/undo',geometryToleranceMm:1e-7};
fs.writeFileSync('proof/audit/IW-DWG/native-ui-independent.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
