import fs from "node:fs";
const images = JSON.parse(fs.readFileSync("proof-images-catalogue.json", "utf8"));
const dirs = {};
for (const img of images) {
  const parts = img.relPath.split("/");
  const top = parts.slice(0, 3).join("/");
  dirs[top] = (dirs[top] || 0) + 1;
}
console.log(dirs);
