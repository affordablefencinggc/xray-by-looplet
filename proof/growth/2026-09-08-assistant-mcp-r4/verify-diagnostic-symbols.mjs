import fs from 'node:fs';import assert from 'node:assert/strict';import{createHash}from'node:crypto';
const base='proof/growth/2026-09-08-assistant-mcp-r4/release-71f5b012342b';
const exe=fs.readFileSync(base+'/artifacts/src-tauri/target/release/xray-by-looplet.exe'),pdb=fs.readFileSync(base+'/diagnostic-symbols/xray_by_looplet.pdb');
const hash=b=>createHash('sha256').update(b).digest('hex');
assert.equal(hash(exe),'38c673ae5591c79ffda0fa283c6dc292118cfd2e6c1823b0f4660170ff474f3c');
assert.equal(hash(pdb),'29fcb6fd1e9624e43ca92e366969e6e6846bc2a773d2e50b62fe7894a2f66ae9');
const pe=exe.readUInt32LE(0x3c);assert.equal(exe.toString('ascii',pe,pe+4),'PE\0\0');const sections=exe.readUInt16LE(pe+6),opt=pe+24,sectionStart=opt+exe.readUInt16LE(pe+20);assert.equal(exe.readUInt16LE(opt),0x20b);
function raw(rva){for(let i=0;i<sections;i++){const p=sectionStart+i*40,va=exe.readUInt32LE(p+12),size=Math.max(exe.readUInt32LE(p+8),exe.readUInt32LE(p+16));if(rva>=va&&rva<va+size)return exe.readUInt32LE(p+20)+(rva-va);}throw Error('Unmapped RVA');}
const debug=raw(exe.readUInt32LE(opt+112+6*8)),debugSize=exe.readUInt32LE(opt+112+6*8+4);let cv;
for(let p=debug;p<debug+debugSize;p+=28){if(exe.readUInt32LE(p+12)===2){const start=exe.readUInt32LE(p+24);if(exe.toString('ascii',start,start+4)==='RSDS'){cv={guid:exe.subarray(start+4,start+20).toString('hex'),age:exe.readUInt32LE(start+20)};break;}}}assert(cv,'Missing EXE CodeView RSDS');
assert(pdb.toString('ascii',0,25).startsWith('Microsoft C/C++ MSF 7.00'));const block=pdb.readUInt32LE(32),dirSize=pdb.readUInt32LE(44),map=pdb.readUInt32LE(52)*block;assert(block>=512&&block<=65536);let chunks=[];for(let i=0;i<Math.ceil(dirSize/block);i++){const start=pdb.readUInt32LE(map+i*4)*block;chunks.push(pdb.subarray(start,start+block));}const dir=Buffer.concat(chunks).subarray(0,dirSize),count=dir.readUInt32LE(0);assert(count>1);let cursor=4+count*4,info;
for(let i=0;i<count;i++){const size=dir.readUInt32LE(4+i*4);if(size===0xffffffff)continue;chunks=[];for(let j=0;j<Math.ceil(size/block);j++){const start=dir.readUInt32LE(cursor)*block;cursor+=4;chunks.push(pdb.subarray(start,start+block));}if(i===1){const stream=Buffer.concat(chunks).subarray(0,size);info={guid:stream.subarray(12,28).toString('hex'),age:stream.readUInt32LE(8)};break;}}
assert.deepEqual(info,cv,'PDB GUID/age does not match executable');
const result={status:'pass',runId:'71f5b012342b',exeSha256:hash(exe),pdbSha256:hash(pdb),pdbBytes:pdb.length,codeView:cv,pdbInfo:info,source:'Existing Dans1 release PDB; no rebuild',remoteHashesMatched:true};fs.writeFileSync(base+'/diagnostic-symbols/identity.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
