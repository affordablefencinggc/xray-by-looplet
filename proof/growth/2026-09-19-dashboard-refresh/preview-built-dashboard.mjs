import { createServer } from "node:http";
import { hostname } from "node:os";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

if (hostname().split(".")[0].toLowerCase() !== "dans1") throw Error("Static dashboard serving is restricted to DANS1");
const root = resolve(process.argv[2]);
const port = Number(process.argv[3]);
if (!Number.isInteger(port) || port !== 8090) throw Error("Expected the isolated dashboard port 8090");
const types = { ".html": "text/html; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".md": "text/plain; charset=utf-8", ".json": "application/json; charset=utf-8" };
createServer(async (request, response) => {
  try {
    if (request.method !== "GET" && request.method !== "HEAD") { response.writeHead(405).end(); return; }
    const relative = decodeURIComponent(new URL(request.url, `http://127.0.0.1:${port}`).pathname).replace(/^\/+/, "") || "XRAY-STATUS-AND-PROOF-DASHBOARD.html";
    if (relative === "favicon.ico") { response.writeHead(204).end(); return; }
    const path = resolve(root, relative);
    if (!path.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    const info = await stat(path);
    if (!info.isFile()) { response.writeHead(404).end(); return; }
    const bytes = await readFile(path);
    response.writeHead(200, { "Content-Type": types[extname(path).toLowerCase()] ?? "application/octet-stream", "Content-Length": bytes.length, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    response.end(request.method === "HEAD" ? undefined : bytes);
  } catch { response.writeHead(404).end("Not found in this explicit dashboard snapshot"); }
}).listen(port, "127.0.0.1", () => console.log(JSON.stringify({ host: hostname(), root, port, pid: process.pid, kind: "static-dashboard-only" })));
