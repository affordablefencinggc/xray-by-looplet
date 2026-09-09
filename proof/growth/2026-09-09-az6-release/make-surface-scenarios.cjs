// az6: adapt the assistant-surface journeys (SC-14/15/16) to the candidate preview (8096) and to the native app (CDP 9281).
// Native has no `open`/viewport control and cannot render; the journeys never depend on rendering, so they run unchanged
// apart from the entry steps and the screenshot folder.
const fs = require("fs"), path = require("path");
const surface = path.resolve(__dirname, "../2026-09-09-assistant-surface/scenarios");
const S = path.join(__dirname, "scenarios");
const shots = "screenshots/growth/2026-09-09-az6-release";
const rewriteShots = step => (step[0] === "screenshot" ? [step[0], step[1].replace("screenshots/growth/2026-09-09-assistant-surface", shots)] : step);
for (const name of ["surface-desktop", "surface-tablet"]) {
  const steps = JSON.parse(fs.readFileSync(path.join(surface, name + ".json"), "utf8"));
  const prod = steps.map(rewriteShots).map(step => (step[0] === "open" ? ["open", "http://127.0.0.1:8096/", "--timeout", "120000"] : step));
  fs.writeFileSync(path.join(S, "prod-" + name + ".json"), JSON.stringify(prod, null, 1));
}
{
  const steps = JSON.parse(fs.readFileSync(path.join(surface, "surface-desktop.json"), "utf8"));
  const native = steps
    .filter(step => !(step[0] === "open" || (step[0] === "set" && step[1] === "viewport")))
    .map(rewriteShots)
    .map(step => (step[0] === "screenshot" ? [step[0], step[1].replace("/desktop-", "/native-")] : step));
  // The native app starts wherever the previous scenario left it: reload first so the journey begins on a known page.
  native.unshift(["reload"], ["wait", "--fn", "document.querySelector('[data-hydration-status]')?.getAttribute('data-hydration-status')==='ready'", "--timeout", "120000"]);
  fs.writeFileSync(path.join(S, "native-surface.json"), JSON.stringify(native, null, 1));
}
console.log("az6 surface scenarios written");
