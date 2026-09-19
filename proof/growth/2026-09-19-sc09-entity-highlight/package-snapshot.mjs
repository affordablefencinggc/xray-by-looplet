import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

// Packaging only; never runs the product on the orchestration host.
const root = process.cwd();
const runId = process.argv[2];
if (!/^[a-f0-9]{12}$/.test(runId ?? '')) throw Error('Expected an isolated 12-hex staging run ID');
const stage = path.resolve(root, '.temp', `dans1-sc09-${runId}`, 'stage');
if (!fs.existsSync(path.join(stage, 'package.json'))) throw Error('Extract the clean HEAD archive before packaging');
const overlay = [
  'package.json',
  'src/studio/Studio.tsx', 'src/styles.css',
  'src/lib/boot-guard.ts', 'src/lib/boot-guard.test.ts', 'src/routes/__root.tsx',
  'src/studio/pricing/PriceBookPanel.tsx',
  'scripts/fast-cdp.mjs', 'scripts/run-fast-cdp.ps1',
  'src/studio/industries/IndustryDraftHost.tsx', 'src/studio/industries/IndustryDraftWorkbench.tsx',
  'src/studio/industries/draftPanel.ts',
  ...['QSItemBindingLedger.tsx', 'QuantityDraftPanel.tsx', 'QuantityReportView.test.ts',
    'QsMeasuredGeometryPreview.tsx', 'QuantityReportView.tsx', 'qsEntityHighlight.ts', 'qsEntityHighlight.test.ts',
    'qsItemBinding.ts', 'qsItemBinding.test.ts', 'quantityForm.ts', 'quantityForm.test.ts',
    'qsMeasuredGeometry.ts', 'qsMeasuredGeometry.test.ts',
    'QsMeasuredGeometryScope.tsx', 'qsMeasuredGeometryContext.ts',
    'qsRateBook.ts', 'report.ts',
    'QSWorksheet.tsx', 'QSWorksheet.focus.test.ts',
  ].map(name => `src/studio/industries/quantity-surveying/${name}`),
];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
for (const file of overlay) {
  if (!fs.existsSync(path.join(root, file))) throw Error(`Overlay missing: ${file}`);
  fs.copyFileSync(path.join(root, file), path.join(stage, file));
}
const transfer = path.join(stage, '.temp', 'dans1-transfer');
fs.mkdirSync(transfer, { recursive: true });
const files = ['package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'vite.config.spa.ts', 'index.html', '.grok/app-env.json', '.agents/mcp_config.json', '.cursor/mcp.json', 'src-tauri/src/assistant_ai.rs', 'src-tauri/resources/ai-materials-result.schema.json', 'proof/audit/IW-AI-MATERIALS/fixture-result.json'];
files.push('eslint.config.mjs', '.prettierrc', 'proof/growth/2026-09-19-sc10-qs-rate-delta/preflight/state-boundary.test.ts');
for (const name of fs.readdirSync(stage)) if (name.endsWith('.md') && fs.statSync(path.join(stage, name)).isFile()) files.push(name);
function walk(relative) {
  for (const entry of fs.readdirSync(path.join(stage, relative), { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw Error(`Symbolic link in snapshot: ${relative}/${entry.name}`);
    if (/^(?:\.env(?:\..*)?|node_modules|target|\.git|\.temp|\.cache|__pycache__)$/.test(entry.name)) continue;
    const file = `${relative}/${entry.name}`;
    if (entry.isDirectory()) walk(file); else if (entry.isFile()) files.push(file);
  }
}
for (const dir of ['src', 'scripts', 'server', 'migrations', 'contracts', 'public', 'planning', 'engine/fixtures/bom-contract', '.grok/skills/og']) walk(dir);
const entries = [...new Set(files)].sort().map(file => ({ path: file, sha256: sha(fs.readFileSync(path.join(stage, file))) }));
const listPath = path.join(transfer, 'files.txt');
fs.writeFileSync(listPath, entries.map(entry => entry.path).join('\n') + '\n');
const sourceTar = path.join(transfer, 'source.tar');
const packed = spawnSync('tar', ['-cf', sourceTar, '-C', stage, '-T', listPath], { stdio: 'inherit', windowsHide: true });
if (packed.status !== 0) throw Error('Source archive failed');
for (const entry of entries) if (sha(fs.readFileSync(path.join(stage, entry.path))) !== entry.sha256) throw Error(`Source changed while packaging: ${entry.path}`);
for (const file of overlay) if (sha(fs.readFileSync(path.join(root, file))) !== sha(fs.readFileSync(path.join(stage, file)))) throw Error(`Working source changed while packaging: ${file}`);
const sourceHash = sha(fs.readFileSync(sourceTar));
fs.writeFileSync(path.join(transfer, 'source-manifest.json'), JSON.stringify({ createdAt: new Date().toISOString(), archiveSha256: sourceHash, entries }, null, 2));
const prior = path.join(root, '.temp/dans1-sc09-13e4d1800863/stage/.temp/dans1-transfer');
for (const name of ['node-runtime.tar', 'native-source.tar', 'native-manifest.json']) fs.copyFileSync(path.join(prior, name), path.join(transfer, name));
const receipt = {
  runId, stage, transfer, overlay, sourceFiles: entries.length, sourceSha256: sourceHash,
  runtimeSha256: sha(fs.readFileSync(path.join(transfer, 'node-runtime.tar'))),
  nativeSha256: sha(fs.readFileSync(path.join(transfer, 'native-source.tar'))),
};
fs.writeFileSync(path.join(stage, '..', 'stage.json'), JSON.stringify(receipt, null, 2));
console.log(JSON.stringify(receipt));
