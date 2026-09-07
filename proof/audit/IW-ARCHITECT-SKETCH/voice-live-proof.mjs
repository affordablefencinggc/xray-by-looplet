import fs from 'node:fs';import assert from 'node:assert/strict';
const env={};for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const m=line.match(/^([A-Z_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim();}
const url=env.XRAY_VOICE_EDGE_URL;const base={method:'POST',headers:{'Content-Type':'application/json','x-xray-voice-key':env.XRAY_VOICE_EDGE_TOKEN}};
const denied=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'speak',text:'Unauthorized test'})});assert.equal(denied.status,401);
const speech=await fetch(url,{...base,body:JSON.stringify({action:'speak',text:'Please inspect the walls and windows in this drawing.'})});assert.equal(speech.status,200);const audio=await speech.json();assert.ok(audio.audioBase64);fs.writeFileSync('proof/audit/IW-ARCHITECT-SKETCH/voice-sample.mp3',Buffer.from(audio.audioBase64,'base64'));
const listen=await fetch(url,{...base,body:JSON.stringify({action:'transcribe',audioBase64:audio.audioBase64,mimeType:audio.mimeType})});assert.equal(listen.status,200);const transcript=(await listen.json()).transcript;assert.match(transcript,/walls and windows/i);
const report={ok:true,unauthenticatedStatus:denied.status,speechStatus:speech.status,audioBytes:Buffer.from(audio.audioBase64,'base64').length,transcriptionStatus:listen.status,transcript,provider:'Deepgram',edgeFunction:'live-assistant-voice',project:'aulmqnykpfqnmvjpfyaz'};
fs.writeFileSync('proof/audit/IW-ARCHITECT-SKETCH/voice-live-proof.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
const local=await fetch('http://127.0.0.1:8080/api/voice');console.log('Local voice status',await local.text());
