import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import app from "../.vercel/output/functions/__server.func/index.mjs";

const host = process.env.PREVIEW_HOST ?? "127.0.0.1";
const port = Number(process.env.PREVIEW_PORT ?? 8081);
const staticRoot = resolve(".vercel/output/static");
const mime = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webmanifest": "application/manifest+json",
};

function staticFile(pathname) {
  const relative = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, "");
  const candidate = resolve(join(staticRoot, relative));
  if (candidate !== staticRoot && !candidate.startsWith(`${staticRoot}\\`) && !candidate.startsWith(`${staticRoot}/`)) return null;
  if (!existsSync(candidate) || !statSync(candidate).isFile()) return null;
  return candidate;
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `${host}:${port}`}`);
    const file = staticFile(url.pathname);
    if (file) {
      response.statusCode = 200;
      response.setHeader("content-type", mime[extname(file).toLowerCase()] ?? "application/octet-stream");
      createReadStream(file).pipe(response);
      return;
    }
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (Array.isArray(value)) value.forEach((entry) => headers.append(key, entry));
      else if (value !== undefined) headers.set(key, value);
    }
    const body = request.method === "GET" || request.method === "HEAD" ? undefined : request;
    const result = await app.fetch(new Request(url, { method: request.method, headers, body, duplex: body ? "half" : undefined }), {
      waitUntil() {},
    });
    response.statusCode = result.status;
    result.headers.forEach((value, key) => response.setHeader(key, value));
    if (!result.body || request.method === "HEAD") {
      response.end();
      return;
    }
    for await (const chunk of result.body) response.write(chunk);
    response.end();
  } catch (error) {
    response.statusCode = 500;
    response.setHeader("content-type", "text/plain; charset=utf-8");
    response.end(error instanceof Error ? error.message : "Built preview failed");
  }
});

server.listen(port, host, () => console.log(`[preview] built Vercel output on http://${host}:${port}`));
