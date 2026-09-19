/** Generates an isolated, auditable extension of the canonical raw-CDP runner.
 * Run only on DANS1. The canonical source is read, never modified. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { hostname } from 'node:os';
import { resolve, dirname } from 'node:path';
if (hostname().split('.')[0].toLowerCase() !== 'dans1') throw Error('DANS1 only');
const sourcePath = resolve(process.argv[2] || 'scripts/fast-cdp.mjs');
const targetPath = resolve(process.argv[3]);
if (targetPath === sourcePath) throw Error('Canonical runner must remain unchanged');
const original = await readFile(sourcePath, 'utf8');
const digest = value => createHash('sha256').update(value).digest('hex');
let source = original.replaceAll('\r\n', '\n');
const replaceOne = (anchor, replacement) => {
  if (source.split(anchor).length !== 2) throw Error('Runner extension anchor mismatch: ' + anchor);
  source = source.replace(anchor, replacement);
};
replaceOne('    this.contexts = new Map();', '    this.contexts = new Map();\n    this.downloads = new Map();\n    this.downloadWaiters = new Set();\n    this.armedDownload = null;');
replaceOne('  receiveEvent(message) {', `  receiveEvent(message) {
    if (message.method === "Browser.downloadWillBegin" || message.method === "Browser.downloadProgress") {
      const p = message.params ?? {}, armed = this.armedDownload;
      if (message.method === "Browser.downloadWillBegin" && armed) {
        if (armed.guid) armed.error = "More than one download began for a single armed action";
        else { armed.guid = p.guid; armed.url = p.url; armed.suggestedFilename = p.suggestedFilename; }
      }
      if (message.method === "Browser.downloadProgress" && armed?.guid === p.guid) {
        armed.state = p.state; armed.receivedBytes = p.receivedBytes; armed.totalBytes = p.totalBytes;
        if (p.state === "canceled") armed.error = "Browser canceled the requested download";
      }
      for (const notify of this.downloadWaiters) notify();
      return;
    }`);
const extension = String.raw`
    if (opcode === "download-arm") {
      const alias = args[1], expectedName = args[2];
      if (args.length !== 3 || !/^[a-z][a-z0-9-]*$/.test(alias) || !/^[a-zA-Z0-9_.-]+$/.test(expectedName))
        throw new InfrastructureFailure("download-arm needs a safe alias and exact expected filename");
      if (this.armedDownload || this.downloads.has(alias)) throw new InfrastructureFailure("Download alias already used or another download remains armed");
      const directory = join(this.output, "downloads", alias);
      await mkdir(directory, { recursive: true });
      this.armedDownload = { alias, expectedName, directory, context: context.name };
      await this.socket.call("Browser.setDownloadBehavior", { behavior: "allowAndName", downloadPath: directory, eventsEnabled: true, browserContextId: context.browserContextId });
      return { alias, expectedName, directory: relative(this.output, directory).replaceAll("\\", "/"), transport: "Browser download events and disk readback; no blob interception" };
    }
    if (opcode === "download-wait") {
      const alias = args[1], entry = this.armedDownload;
      if (args.length !== 2 || !entry || entry.alias !== alias || entry.context !== context.name) throw new InfrastructureFailure("No matching armed download");
      await new Promise((resolveDownload, rejectDownload) => {
        let timer;
        const clean = () => { clearTimeout(timer); this.downloadWaiters.delete(check); };
        const check = () => {
          if (entry.error) { clean(); rejectDownload(new ProductFailure(entry.error)); }
          else if (entry.state === "completed") { clean(); resolveDownload(); }
        };
        timer = setTimeout(() => { clean(); rejectDownload(new ProductFailure("Browser download completion deadline for " + alias)); }, 30000);
        this.downloadWaiters.add(check); check();
      });
      if (entry.suggestedFilename !== entry.expectedName) throw new ProductFailure("Unexpected download name: " + entry.suggestedFilename);
      if (!/^[a-zA-Z0-9-]+$/.test(entry.guid)) throw new InfrastructureFailure("Unsafe browser download GUID");
      const downloadedPath = join(entry.directory, entry.guid), bytes = await readFile(downloadedPath);
      if (!bytes.length || bytes.length > 32 * 1024 * 1024 || bytes.length !== entry.receivedBytes) throw new ProductFailure("Downloaded byte count does not reconcile with completion event");
      const path = join(entry.directory, entry.expectedName);
      await writeNew(path, bytes);
      const receipt = { alias, context: context.name, file: relative(this.output, path).replaceAll("\\", "/"), browserFile: relative(this.output, downloadedPath).replaceAll("\\", "/"), bytes: bytes.length, sha256: sha256(bytes), suggestedFilename: entry.suggestedFilename, guid: entry.guid, state: entry.state };
      this.downloads.set(alias, { ...receipt, path }); this.armedDownload = null;
      await this.socket.call("Browser.setDownloadBehavior", { behavior: "deny", browserContextId: context.browserContextId });
      await this.socket.evaluate("window.__SC11_DISK_DOWNLOADS__ ??= {}; window.__SC11_DISK_DOWNLOADS__[" + JSON.stringify(alias) + "] = " + JSON.stringify(receipt), context.sessionId);
      return receipt;
    }
    if (opcode === "set-file") {
      const selector = args[1], alias = args[2], file = this.downloads.get(alias);
      if (args.length !== 3 || typeof selector !== "string" || !file) throw new InfrastructureFailure("set-file requires a downloaded or explicitly tampered receipt alias");
      const bytes = await readFile(file.path);
      if (sha256(bytes) !== file.sha256) throw new InfrastructureFailure("File changed after disk receipt");
      const { root } = await this.socket.call("DOM.getDocument", {}, context.sessionId);
      const { nodeIds } = await this.socket.call("DOM.querySelectorAll", { nodeId: root.nodeId, selector }, context.sessionId);
      if (nodeIds.length !== 1) throw new ProductFailure("File input selector must identify exactly one element");
      const valid = await this.socket.evaluate("(()=>{const el=document.querySelector(" + JSON.stringify(selector) + ");return el instanceof HTMLInputElement && el.type==='file' && !el.matches(':disabled')})()", context.sessionId);
      if (!valid) throw new ProductFailure("File input is unavailable");
      await this.socket.call("DOM.setFileInputFiles", { nodeId: nodeIds[0], files: [file.path] }, context.sessionId);
      return { file: file.file, sha256: file.sha256, bytes: file.bytes, method: "DOM.setFileInputFiles actual disk path" };
    }
    if (opcode === "tamper-zip") {
      const original = this.downloads.get(args[1]), alias = args[2];
      if (args.length !== 3 || !original || !/^[a-z][a-z0-9-]*$/.test(alias) || this.downloads.has(alias)) throw new InfrastructureFailure("Invalid tamper-zip aliases");
      const { unzipSync, zipSync } = await import("fflate");
      const bytes = await readFile(original.path);
      if (sha256(bytes) !== original.sha256) throw new InfrastructureFailure("Original ZIP changed before tampering");
      const entries = unzipSync(bytes);
      if (!entries["cost-plan.pdf"]?.length) throw new ProductFailure("Downloaded package has no PDF");
      entries["cost-plan.pdf"][Math.floor(entries["cost-plan.pdf"].length / 2)] ^= 1;
      const tampered = zipSync(entries), path = join(this.output, "downloads", alias + ".zip");
      await writeNew(path, tampered);
      const receipt = { alias, file: relative(this.output, path).replaceAll("\\", "/"), bytes: tampered.length, sha256: sha256(tampered), originalSha256: original.sha256, tamperedEntry: "cost-plan.pdf", mutation: "One byte XOR 1; original manifest and source ZIP preserved" };
      this.downloads.set(alias, { ...receipt, path }); return receipt;
    }
    if (opcode === "inspect-downloads") {
      const { unzipSync } = await import("fflate");
      const zip = this.downloads.get(args[1]), pdf = this.downloads.get(args[2]), csv = this.downloads.get(args[3]);
      if (args.length !== 4 || !zip || !pdf || !csv) throw new InfrastructureFailure("inspect-downloads requires ZIP, PDF and CSV aliases");
      const files = unzipSync(await readFile(zip.path)), manifest = JSON.parse(new TextDecoder().decode(files["manifest.json"]));
      const entries = manifest.entries.map(entry => {
        const value = files[entry.name];
        if (!value || value.length !== entry.sizeBytes || sha256(value) !== entry.sha256) throw new ProductFailure("Disk ZIP manifest mismatch: " + entry.name);
        return { name: entry.name, bytes: value.length, sha256: sha256(value) };
      });
      if (sha256(files["cost-plan.pdf"]) !== pdf.sha256 || sha256(await readFile(pdf.path)) !== pdf.sha256) throw new ProductFailure("Separate downloaded PDF differs from ZIP PDF");
      if (sha256(files["schedule.csv"]) !== csv.sha256 || sha256(await readFile(csv.path)) !== csv.sha256) throw new ProductFailure("Separate downloaded CSV differs from ZIP CSV");
      const worksheet = JSON.parse(new TextDecoder().decode(files["worksheet.json"]));
      const delivery = JSON.parse(new TextDecoder().decode(files["delivery.json"]));
      const transmittal = JSON.parse(new TextDecoder().decode(files["transmittal.json"]));
      const receipt = { host: hostname(), diskReadback: true, zipSha256: zip.sha256, pdfSha256: pdf.sha256, csvSha256: csv.sha256, entries, manifest, delivery, transmittal, worksheetItems: worksheet.items.length, worksheetNodes: worksheet.nodes.length, snapshots: worksheet.pricing.snapshots.length, pdfFile: pdf.file, csvFile: csv.file, zipFile: zip.file };
      await writeNew(join(this.output, "download-inspection.json"), JSON.stringify(receipt, null, 2));
      return receipt;
    }
`;
replaceOne('    if (opcode === "navigate") {', extension + '\n    if (opcode === "navigate") {');
replaceOne('    screenshots: campaign?.screenshots ?? [],', '    screenshots: campaign?.screenshots ?? [],\n    downloads: [...(campaign?.downloads.values() ?? [])].map(({path, ...receipt}) => receipt),');
await mkdir(dirname(targetPath), { recursive: true });
await writeFile(targetPath, source, { flag: 'wx' });
await writeFile(targetPath + '.extension.json', JSON.stringify({ sourcePath, targetPath, host: hostname(), canonicalSha256: digest(original), generatedSha256: digest(source), extension: 'SC11 scoped real browser downloads, disk SHA-256, file selection and preserved-negative ZIP mutation', canonicalUnchanged: digest(await readFile(sourcePath)) === digest(original) }, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ sourcePath, targetPath, canonicalSha256: digest(original), generatedSha256: digest(source) }));
