// az5: state-aware re-run variants. Assertions are equal or stronger; only session-state preconditions change.
const fs = require("fs"), path = require("path");
const S = path.join(__dirname, "scenarios");
const read = n => JSON.parse(fs.readFileSync(path.join(S, n + ".json"), "utf8"));
const write = (n, s) => fs.writeFileSync(path.join(S, n + ".json"), JSON.stringify(s, null, 1));
// 1. verify: the continue scenario leaves the Backups dialog open; close it first if present.
const verify = read("native-workbench-verify");
verify.unshift(["eval", "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.getAttribute('aria-label')==='Close Project backups'||x.textContent.trim()==='Close Project backups');if(b)b.click();return b?'closed backups dialog':'no dialog'})()"]);
write("native-workbench-verify-r2", verify);
// 2. unlock-a: the design already carries a hip roof from native-wireframe; assert the roof this request created was removed (count back to the pre-request count) and every other original assertion.
const a = read("native-unlock-a-design-edit");
const fillIdx = a.findIndex(c => c[0] === "fill");
a.splice(fillIdx, 0, ["eval", "(()=>{const w=document.querySelector('.architect-workspace');const d=JSON.parse(localStorage.getItem('xray:architect:v1:'+encodeURIComponent(w.dataset.designId)));window.__roofsBefore=d.roofs.length;window.__levelsBefore=d.levels.length;return {roofsBefore:d.roofs.length,levelsBefore:d.levels.length}})()"]);
const assertIdx = a.findIndex(c => c[0] === "eval" && /Roof still present/.test(c[1]));
a[assertIdx][1] = a[assertIdx][1].replace("if(d.roofs.length!==0)throw Error('Roof still present');", "if(d.roofs.length!==window.__roofsBefore)throw Error('Roof created by this request still present: '+d.roofs.length+' vs '+window.__roofsBefore);if(d.levels.length<window.__levelsBefore+1)throw Error('No storey added');");
if (!/__roofsBefore/.test(a[assertIdx][1])) throw Error("patch failed");
write("native-unlock-a-design-edit-r2", a);
// 3. unlock-b: the Redburn plan may already be mounted in 3D in this session; open it only when the primary button is offered.
const b = read("native-unlock-b-takeoff");
b.splice(1, 2, ["eval", "(()=>{const p=document.querySelector('.building-primary');if(p&&!p.disabled){p.click();return 'opened plan'}return 'plan already mounted'})()"]);
write("native-unlock-b-takeoff-r2", b);
console.log("wrote r2 scenarios");
