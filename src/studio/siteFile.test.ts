import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectSiteFile} from './siteFile.ts';
function glb(extra:Record<string,unknown>={}){const json=JSON.stringify({scene:0,scenes:[{extras:{loopletSite:{schema:'looplet.site/v1',address:'Test',center:[153,-27],coordinateSystem:{unit:'metre',verticalScale:1},terrain:{source:{label:'Test'}}}}}],...extra});const text=new TextEncoder().encode(json.padEnd(Math.ceil(json.length/4)*4,' '));const bytes=new ArrayBuffer(20+text.length),v=new DataView(bytes);v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,bytes.byteLength,true);v.setUint32(12,text.length,true);v.setUint32(16,0x4e4f534a,true);new Uint8Array(bytes,20).set(text);return bytes;}
test('preserves location and attribution',()=>{const site=inspectSiteFile(glb());assert.deepEqual(site.center,[153,-27]);assert.equal(site.terrain.source?.label,'Test');});
test('rejects external resources before loader access',()=>{assert.throws(()=>inspectSiteFile(glb({buffers:[{uri:'https://untrusted.test/model.bin'}]})),/own resources/);});
test('rejects corrupt lengths and excessive geometry',()=>{const bytes=glb();new DataView(bytes).setUint32(8,1,true);assert.throws(()=>inspectSiteFile(bytes),/valid GLB/);assert.throws(()=>inspectSiteFile(glb({accessors:[{count:5000000}]})),/too detailed/);});
