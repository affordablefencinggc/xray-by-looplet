import test from 'node:test';import assert from 'node:assert/strict';
import {parseVoiceRequest,executeVoice,readVoiceBody} from './voiceCore.ts';
import {voiceStatus} from './voice.server.ts';
test('voice validation bounds audio and text and rejects URLs and unsupported audio',()=>{
 for(const v of [{action:'speak',text:'x'.repeat(3001)},{action:'transcribe',audioBase64:'https://example.com',mimeType:'audio/webm'},{action:'transcribe',audioBase64:'AAAA',mimeType:'text/html'}])assert.throws(()=>parseVoiceRequest(JSON.stringify(v)));
 assert.throws(()=>parseVoiceRequest('x'.repeat(3*1024*1024+1)));
 assert.deepEqual(parseVoiceRequest('{"action":"speak","text":" hello "}'),{action:'speak',text:'hello'});
});
test('voice status never includes private credentials and defaults to disabled web use',()=>{
 const status=voiceStatus({DEEPGRAM_API_KEY:'private-test-secret'});assert.equal(status.configured,true);assert.equal(status.available,false);assert.ok(!JSON.stringify(status).includes('private-test-secret'));
});
test('Deepgram responses are sanitized and binary data is bounded',async()=>{
 await assert.rejects(executeVoice({action:'speak',text:'hello'},'private-test-secret',async()=>new Response('private-test-secret',{status:403})),e=>e instanceof Error&&!e.message.includes('private-test-secret')&&e.message.includes('403'));
 await assert.rejects(readVoiceBody(new Response('abc'),2),/limit/);
 const result=await executeVoice({action:'transcribe',audioBase64:'AAAA',mimeType:'audio/webm'},'test',async(url,options)=>{assert.match(String(url),/^https:\/\/api.deepgram.com\/v1\/listen/);assert.ok(options?.body instanceof Uint8Array);return Response.json({results:{channels:[{alternatives:[{transcript:'Walls and windows'}]}]}});});assert.equal(result.transcript,'Walls and windows');
});
