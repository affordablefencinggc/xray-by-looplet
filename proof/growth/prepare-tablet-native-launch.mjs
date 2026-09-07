import fs from 'node:fs';
// Derive a separate, hash-verified launcher; re-use only our prior isolated QA
// profile so desktop persistence across this executable update can be checked.
const old=JSON.parse(fs.readFileSync('proof/growth/native-launch.json','utf8'));
if(!old.profile.includes('growth-native-')||!old.exe.includes('proof\\growth\\'))throw Error('Not an owned QA profile');
let source=fs.readFileSync('proof/growth/launch-native.mjs','utf8');
source=source.replace('proof/growth/2026-09-07-release/','proof/growth/2026-09-07-tablet-release/');
source=source.replace("path.resolve('.temp',`growth-native-${Date.now()}`)",JSON.stringify(old.profile));
source=source.replaceAll('9262','9263').replace('proof/growth/native-launch.json','proof/growth/tablet-native-launch.json');
fs.writeFileSync('proof/growth/launch-tablet-native.mjs',source);
console.log(JSON.stringify({priorPid:old.pid,qaProfile:old.profile,priorExe:old.exe}));
