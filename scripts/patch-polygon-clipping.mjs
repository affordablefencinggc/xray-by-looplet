import fs from "node:fs";

function patchFile(path) {
  if (!fs.existsSync(path)) return;
  let content = fs.readFileSync(path, "utf8");
  if (content.includes("Tree.prototype.toString = function")) {
    content = content.replace(
      /Tree\.prototype\.toString\s*=\s*function\s*\(([^)]*)\)\s*\{([\s\S]*?)\n\s*\};/,
      `Object.defineProperty(Tree.prototype, "toString", {
        value: function ($1) {$2
        },
        writable: true,
        configurable: true
      });`
    );
    fs.writeFileSync(path, content, "utf8");
    console.log("Patched:", path);
  } else {
    console.log("Already patched or safe:", path);
  }
}

patchFile("node_modules/polygon-clipping/dist/polygon-clipping.umd.js");
patchFile("node_modules/.vite/deps/polygon-clipping.js");
