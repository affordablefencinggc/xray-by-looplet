import fs from 'node:fs';
const log=fs.readFileSync('proof/growth/runner/2026-09-09T14-11-12-065Z-gemini-capability-debate.log','utf8');
const transcript=JSON.parse(log.slice(log.indexOf('"')));
fs.writeFileSync('proof/growth/gemini-capability-debate/transcript.txt',transcript);
console.log(transcript.slice(transcript.lastIndexOf('\nAssistant\n')));
