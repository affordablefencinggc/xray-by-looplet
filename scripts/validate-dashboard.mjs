import fs from "node:fs";

const html = fs.readFileSync("XRAY-STATUS-AND-PROOF-DASHBOARD.html", "utf8");
console.log("File size:", html.length, "bytes");
console.log("Contains doctype:", html.includes("<!DOCTYPE html>"));
console.log("Contains script tags:", html.includes("<script>") && html.includes("</script>"));
const tabs = ["tab-slices", "tab-gallery", "tab-gaps", "tab-az", "tab-invariants"];
console.log("All tabs present:", tabs.every(t => html.includes(t)));
console.log("Proof images included:", (html.match(/proof-card/g) || []).length);
console.log("Slices included:", (html.match(/slice-card/g) || []).length);
console.log("AZ rows included:", (html.match(/<tr data-state=/g) || []).length);
