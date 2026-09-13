import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {generateRenderAi,renderAiStatus,AssistantServiceError,assistantFailure,readAssistantBody,RENDER_AI_LIMITS} from './renderAi.server.ts';
import {renderAiRequestSchema} from '../studio/assistant/renderTool.ts';

export const LOOPLET_SITE_RENDER_SCHEMA='looplet.site-render-service/v1';
export const LOOPLET_SITE_RENDER_RESULT_SCHEMA='looplet.site-render-service-result/v1';
const identity=z.string().trim().min(1).max(100);
const siteSource=z.custom<Record<string,unknown>>(value=>{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const site=value as Record<string,unknown>,terrain=site.terrain as Record<string,unknown>|null;
 if(site.schema!=='looplet.site-visual-source/v1'||site.verticalScale!==1||!Array.isArray(site.center)||site.center.length!==2||!site.center.every(Number.isFinite)||Math.abs(site.center[0])>180||Math.abs(site.center[1])>90||!terrain)return false;
 const elevations=terrain.elevationsM,coordinates=terrain.localCoordinates;
 return Array.isArray(elevations)&&elevations.length>0&&elevations.every(Number.isFinite)&&Array.isArray(coordinates)&&coordinates.length===elevations.length&&coordinates.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite))&&new TextEncoder().encode(JSON.stringify(site)).length<=2*1024*1024;
},'Provide the captured Actual-scale site data (at most 2 MiB).');
export const loopletSiteRenderSchema=z.object({
 schema:z.literal(LOOPLET_SITE_RENDER_SCHEMA),organizationId:identity,planId:identity,
 planRevision:z.string().regex(/^[a-f0-9]{64}$/),source:siteSource,render:renderAiRequestSchema,
}).strict().superRefine((value,ctx)=>{
 if(value.render.projectId!==value.planId)ctx.addIssue({code:'custom',message:'Render project does not match plan.'});
 if(value.render.view.target!=='looplet-site')ctx.addIssue({code:'custom',message:'Only captured Looplet site views are supported.'});
 if(!value.render.view.camera||!value.render.view.sourceSha256)ctx.addIssue({code:'custom',message:'A captured site camera and source hash are required.'});
});
type Environment=Record<string,string|undefined>;
const HEADERS={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const FRESHNESS_MS=5*60*1000,REPLAY_RETENTION_MS=24*60*60*1000,REPLAY_CAP=1024;
// Local guard, NOT a durable distributed ledger. A shared broker quota/idempotency
// store and provider spending cap are required before a multi-instance release.
const attempts=new Map<string,number>();

/** Server-to-server only. The trusted mapping broker verifies its signed-in user
 * and explicit operator allowlist. Local plan IDs are correlation IDs, never
 * evidence of CRM/database ownership or an X-Ray user account. */
export async function handleLoopletSiteRender(request:Request,options:{env?:Environment;fetcher?:typeof fetch;now?:()=>number}={}):Promise<Response>{
 const env=options.env??process.env,now=options.now??Date.now;
 try{
  if(request.method!=='POST')return Response.json({error:'POST required.'},{status:405,headers:{...HEADERS,Allow:'POST'}});
  const secret=env.XRAY_LOOPLET_RENDER_SECRET;
  if(env.XRAY_LOOPLET_RENDER_ENABLED!=='true'||!secret||secret.length<32)throw new AssistantServiceError('The mapping render connection is not configured.',503);
  // Do not make the paid provider a browser-facing CORS endpoint.
  if(request.headers.has('origin')||(request.headers.has('sec-fetch-site')&&request.headers.get('sec-fetch-site')!=='none'))throw new AssistantServiceError('Use the authenticated mapping render connection.',403);
  if(request.headers.get('content-type')?.split(';',1)[0].trim().toLowerCase()!=='application/json')throw new AssistantServiceError('Expected JSON.',415);
  const timestamp=request.headers.get('x-looplet-timestamp')??'',signature=request.headers.get('x-looplet-signature')??'';
  if(!/^\d{13}$/.test(timestamp)||!Number.isSafeInteger(Number(timestamp))||Math.abs(now()-Number(timestamp))>FRESHNESS_MS||!/^[a-f0-9]{64}$/.test(signature))throw new AssistantServiceError('Invalid or expired mapping render signature.',401);
  const declared=request.headers.get('content-length');
  if(declared&&(!/^\d+$/.test(declared)||Number(declared)>RENDER_AI_LIMITS.requestBytes))throw new AssistantServiceError('Render request exceeds its size limit.',413);
  const raw=await readAssistantBody(request.body,RENDER_AI_LIMITS.requestBytes);
  const expected=createHmac('sha256',secret).update(timestamp+'.'+raw).digest();
  if(!timingSafeEqual(expected,Buffer.from(signature,'hex')))throw new AssistantServiceError('Invalid or expired mapping render signature.',401);
  // Reading a slow stream must not extend the signature's validity window.
  if(Math.abs(now()-Number(timestamp))>FRESHNESS_MS)throw new AssistantServiceError('Mapping render signature expired.',401);
  let input;
  try{input=loopletSiteRenderSchema.parse(JSON.parse(raw));}catch{throw new AssistantServiceError('Invalid mapping site render request.');}
  const sourceDigest=createHash('sha256').update(JSON.stringify(input.source)).digest('hex');
  if(sourceDigest!==input.planRevision||input.render.view.sourceSha256!==sourceDigest)throw new AssistantServiceError('Measured site data does not match the captured revision.');
  const status=renderAiStatus(env);
  if(!status.available)throw new AssistantServiceError(status.message,503);
  const time=now();
  for(const [key,expiry] of attempts)if(expiry<=time)attempts.delete(key);
  // Ignore timestamp/body variation when rejecting a replay of the same request.
  const key=createHash('sha256').update(JSON.stringify([input.organizationId,input.planId,input.render.requestId])).digest('hex');
  if(attempts.has(key))throw new AssistantServiceError('This render request was already submitted. Do not retry automatically.',409);
  if(attempts.size>=REPLAY_CAP)throw new AssistantServiceError('The render request ledger is full. Try later.',429);
  attempts.set(key,time+REPLAY_RETENTION_MS);
  const result=await generateRenderAi(JSON.stringify(input.render),{env,fetcher:options.fetcher,signal:request.signal,now:()=>new Date(now())});
  return Response.json({schema:LOOPLET_SITE_RENDER_RESULT_SCHEMA,organizationId:input.organizationId,planId:input.planId,planRevision:input.planRevision,result},{headers:HEADERS});
 }catch(error){const failure=assistantFailure(error);return Response.json({error:failure.error},{status:failure.status,headers:HEADERS});}
}
