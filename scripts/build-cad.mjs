import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const cad = path.join(root, "engine/cad");
const bin = path.join(cad, "bin");
if (process.platform !== "win32")
  throw Error(
    "The local DWG translator currently targets Windows desktop. Web builds do not use it.",
  );
const packages = [
  [
    "acadsharp",
    "3.7.1",
    "net48",
    "ACadSharp.dll",
    "4f9ca3a5dafd1a18af651312522147a3163999818763d168b4d5f59d6ffc1701",
  ],
  [
    "system.memory",
    "4.6.3",
    "net462",
    "System.Memory.dll",
    "26078aeb758c9ae985e8bf851f973026061da6a5eb4837204d0c2d2204c72955",
  ],
  [
    "system.buffers",
    "4.6.1",
    "net462",
    "System.Buffers.dll",
    "b00451e91d016fbec091ad1e361f3a7015e1d91d4047f7e48a74455b2a673d79",
  ],
  [
    "system.numerics.vectors",
    "4.6.1",
    "net462",
    "System.Numerics.Vectors.dll",
    "2bc500a86dcb02f2032d6d877f9e2d6e9e4a79080e57239b4198679d4031f2c7",
  ],
  [
    "system.runtime.compilerservices.unsafe",
    "6.1.2",
    "net462",
    "System.Runtime.CompilerServices.Unsafe.dll",
    "5f6a7f53af3465f92beb6da873ebe0e496206c313313b98badee4355a6b25937",
  ],
];
await mkdir(bin, { recursive: true });
const psQuote = (value) => "'" + value.replaceAll("'", "''") + "'";
for (const [name, version, framework, dll, expected] of packages) {
  const directory = path.join(cad, "packages", `${name}-${version}`);
  await mkdir(directory, { recursive: true });
  const archive = path.join(directory, "package.zip");
  let bytes;
  if (existsSync(archive)) bytes = await readFile(archive);
  else {
    const response = await fetch(
      `https://api.nuget.org/v3-flatcontainer/${name}/${version}/${name}.${version}.nupkg`,
    );
    if (!response.ok) throw Error(`${name}: HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  if (createHash("sha256").update(bytes).digest("hex") !== expected)
    throw Error(`${name}: package checksum mismatch`);
  await writeFile(archive, bytes);
  const extraction = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `Expand-Archive -LiteralPath ${psQuote(archive)} -DestinationPath ${psQuote(directory)} -Force`,
    ],
    { windowsHide: true, encoding: "utf8" },
  );
  if (extraction.status !== 0) throw Error(extraction.stderr);
  await copyFile(path.join(directory, "lib", framework, dll), path.join(bin, dll));
}
const compiler = path.join(
  process.env.SystemRoot || "C:/Windows",
  "Microsoft.NET/Framework64/v4.0.30319/csc.exe",
);
const result = spawnSync(
  compiler,
  [
    "/nologo",
    "/optimize+",
    "/target:exe",
    `/out:${path.join(bin, "XRayCad.exe")}`,
    "/reference:System.Web.Extensions.dll",
    ...packages.map((p) => `/reference:${path.join(bin, p[3])}`),
    path.join(cad, "Converter.cs"),
  ],
  { windowsHide: true, encoding: "utf8" },
);
if (result.status !== 0) throw Error(result.stdout + result.stderr);
await writeFile(
  path.join(bin, "XRayCad.exe.config"),
  '<?xml version="1.0"?><configuration><startup><supportedRuntime version="v4.0" sku=".NETFramework,Version=v4.8" /></startup></configuration>\n',
);
await copyFile(
  path.join(cad, "THIRD-PARTY-NOTICES.txt"),
  path.join(bin, "THIRD-PARTY-NOTICES.txt"),
);
console.log("Built local DWG translator: ACadSharp 3.7.1; verified 5 dependency checksums.");
