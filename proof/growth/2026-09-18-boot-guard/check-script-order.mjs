/**
 * Reads the served document and reports, for each <script>, whether it is a
 * classic inline script (runs at parse time) or a module (deferred).
 */
const res = await fetch('http://localhost:8085/');
const html = await res.text();

const bodyStart = html.indexOf('<body');
const body = html.slice(bodyStart);

const scripts = [];
const re = /<script([^>]*)>/g;
let match;
while ((match = re.exec(body)) !== null) {
  const attrs = match[1];
  const inline = body.slice(match.index + match[0].length, match.index + match[0].length + 200);
  scripts.push({
    index: match.index,
    attrs: attrs.trim(),
    isModule: /\btype="module"/.test(attrs),
    isAsync: /\basync\b/.test(attrs),
    startsWithGuard: /^\s*\(function bootGuard/.test(inline),
  });
}

console.log(JSON.stringify(scripts, null, 2));

const guard = scripts.find((s) => s.startsWithGuard);
const modules = scripts.filter((s) => s.isModule);
console.log(
  JSON.stringify(
    {
      guardFound: Boolean(guard),
      guardIsClassic: guard ? !guard.isModule : null,
      guardOffset: guard ? guard.index : null,
      moduleOffsets: modules.map((m) => m.index),
      // Classic inline scripts run when parsed; module scripts are deferred
      // until after parsing. So the guard executes first regardless of offset.
      guardExecutesBeforeModules: Boolean(guard) && !guard.isModule,
    },
    null,
    2,
  ),
);
