import fs from "node:fs";
import path from "node:path";

function walk(dir) {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        if (!fullPath.includes("node_modules") && 
            !fullPath.includes(".git") && 
            !fullPath.includes("web-artifacts") && 
            !fullPath.includes(".vercel") &&
            !fullPath.includes("release-")) {
          results = results.concat(walk(fullPath));
        }
      } else if (/\.(png|jpg|webp)$/i.test(file)) {
        results.push({
          relPath: path.relative(process.cwd(), fullPath).replace(/\\/g, "/"),
          name: file,
          size: stat.size,
          mtime: stat.mtime.toISOString().split("T")[0]
        });
      }
    }
  } catch (err) {
    // ignore
  }
  return results;
}

const proofImages = walk("proof");
console.log(`Found ${proofImages.length} images`);
fs.writeFileSync("proof-images-catalogue.json", JSON.stringify(proofImages, null, 2));
console.log("Saved to proof-images-catalogue.json");
