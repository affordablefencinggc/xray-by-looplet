import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac,randomUUID} from 'node:crypto';
import {handleLoopletSiteRender} from './loopletSiteRender.server.ts';
const secret='unit-test-service-secret-not-live-0123456789';
const env={XRAY_LOOPLET_RENDER_ENABLED:'true',XRAY_LOOPLET_RENDER_SECRET:secret,XRAY_AI_WEB_ENABLED:'true',GEMINI_API_KEY:'unit-provider-key-not-live'};
const clock=()=>1900000000000;
const PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
const sha=createHash('sha256').update(Buffer.from(PNG,'base64')).digest('hex');
function payload(){const id=randomUUID();const source={schema:'looplet.site-visual-source/v1',center:[153,-27],verticalScale:1,terrain:{elevationsM:[24,25],localCoordinates:[[0,0],[1,1]]}};const revision=createHash('sha256').update(JSON.stringify(source)).digest('hex');return {schema:'looplet.site-render-service/v1',organizationId:'mapping',planId:id,planRevision:revision,source,render:{schema:'xray.render-ai-request/v1',requestId:id,projectId:id,view:{target:'looplet-site',width:1,height:1,frame:1,documentId:null,sourceSha256:revision,sheet:1,renderedDesignRevision:null,camera:{projection:'perspective',position:[1,2,3],target:[0,0,0],zoom:1}},image:{mimeType:'image/png',data:PNG,sha256:sha},brief:{planName:'Unit site'},materials:{roof:'',walls:'',windows:'',landscaping:'',lighting:'',style:'',direction:''}}};}
function signed(input=payload(),timestamp=String(clock()),key=secret,extra:Record<string,string>={}){const raw=JSON.stringify(input);return new Request('https://xray.example/api/looplet-site-render',{method:'POST',headers:{'content-type':'application/json','x-looplet-timestamp':timestamp,'x-looplet-signature':createHmac('sha256',key).update(timestamp+'.'+raw).digest('hex'),...extra},body:raw});}
const never=async()=>{throw Error('Provider must not be called');};
test('disabled or unsigned service cannot reach a paid provider',async()=>{
 assert.equal((await handleLoopletSiteRender(signed(),{env:{},fetcher:never,now:clock})).status,503);
 assert.equal((await handleLoopletSiteRender(new Request('https://xray.example/api/looplet-site-render',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}),{env,fetcher:never,now:clock})).status,401);
 assert.equal((await handleLoopletSiteRender(signed(),{env:{...env,XRAY_LOOPLET_RENDER_SECRET:'short'},fetcher:never,now:clock})).status,503);
});
test('rejects changed body signatures, expired timestamps and browser origins',async()=>{
 assert.equal((await handleLoopletSiteRender(signed(payload(),String(clock()),'wrong-secret'),{env,fetcher:never,now:clock})).status,401);
 assert.equal((await handleLoopletSiteRender(signed(payload(),String(clock()-300001)),{env,fetcher:never,now:clock})).status,401);
 assert.equal((await handleLoopletSiteRender(signed(payload(),String(clock()),secret,{origin:'https://mapping.example'}),{env,fetcher:never,now:clock})).status,403);
});
test('valid signature cannot render unrelated project/view or oversized requests',async()=>{
 const mismatch=payload();mismatch.render.projectId=randomUUID();
 assert.equal((await handleLoopletSiteRender(signed(mismatch),{env,fetcher:never,now:clock})).status,400);
 const wrongView=payload();wrongView.render.view.target='architect';
 assert.equal((await handleLoopletSiteRender(signed(wrongView),{env,fetcher:never,now:clock})).status,400);
 assert.equal((await handleLoopletSiteRender(signed(payload(),String(clock()),secret,{'content-length':String(13*1024*1024)}),{env,fetcher:never,now:clock})).status,413);
 const changedSource=payload();changedSource.source.terrain.elevationsM[0]=99;
 assert.equal((await handleLoopletSiteRender(signed(changedSource),{env,fetcher:never,now:clock})).status,400);
});
test('returns correlated plan/revision result and rejects re-signed duplicates before another provider call',async()=>{
 const input=payload();let calls=0;
 const fetcher:typeof fetch=async()=>{calls++;return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{inlineData:{mimeType:'image/png',data:PNG}}]}}]});};
 const response=await handleLoopletSiteRender(signed(input),{env,fetcher,now:clock});
 assert.equal(response.status,200);const result=await response.json();assert.equal(result.planId,input.planId);assert.equal(result.planRevision,input.planRevision);assert.equal(result.result.sourceImageSha256,sha);assert.equal(result.result.id,input.render.requestId);assert.equal(response.headers.get('access-control-allow-origin'),null);
 assert.equal((await handleLoopletSiteRender(signed(input,String(clock()+1000)),{env,fetcher,now:()=>clock()+1000})).status,409);assert.equal(calls,1);
});
test('provider failure also leaves replay guard consumed to avoid accidental double charging',async()=>{
 const input=payload();let calls=0;const fetcher:typeof fetch=async()=>{calls++;return new Response('',{status:502});};
 assert.equal((await handleLoopletSiteRender(signed(input),{env,fetcher,now:clock})).status,502);
 assert.equal((await handleLoopletSiteRender(signed(input),{env,fetcher,now:clock})).status,409);assert.equal(calls,1);
});
test('simultaneous copies reserve identity before provider completion',async()=>{
 const input=payload();let calls=0,entered:()=>void=()=>{},release:()=>void=()=>{};
 const reached=new Promise<void>(resolve=>{entered=resolve;}),held=new Promise<void>(resolve=>{release=resolve;});
 const fetcher:typeof fetch=async()=>{calls++;entered();await held;return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{inlineData:{mimeType:'image/png',data:PNG}}]}}]});};
 const first=handleLoopletSiteRender(signed(input),{env,fetcher,now:clock});await reached;
 assert.equal((await handleLoopletSiteRender(signed(input),{env,fetcher,now:clock})).status,409);
 release();assert.equal((await first).status,200);assert.equal(calls,1);
});
