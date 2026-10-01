/**
 * Reverse px→rem batch conversion.
 * Formula applied originally: rem = round(px / 16 * 10) / 10
 * Reverse: px = Math.round(rem * 16)
 * Special case: 0rem (or 0px after rounding) → "0" (not "0px") to match typical original formatting.
 */
const fs = require("fs");
const path = require("path");

const SRC_DIR = path.join(process.cwd(), "src");
const EXTENSIONS = [".ts", ".tsx", ".css"];

const remRegex = /(-?\d+(?:\.\d+)?)rem/g;

let filesChanged = 0;
const changedFiles = [];
const unchangedFiles = [];

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // skip node_modules, .next, etc.
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "dist" || entry.name === "build") continue;
      scanDir(fullPath);
    } else if (EXTENSIONS.includes(path.extname(entry.name))) {
      processFile(fullPath);
    }
  }
}

function processFile(filePath) {
  const original = fs.readFileSync(filePath, "utf8");

  let fileHadRem = false;
  const converted = original.replace(remRegex, (match, remValue) => {
    fileHadRem = true;
    const px = Math.round(parseFloat(remValue) * 16);
    if (px === 0) return "0";
    return px + "px";
  });

  if (converted !== original && fileHadRem) {
    fs.writeFileSync(filePath, converted, "utf8");
    filesChanged++;
    changedFiles.push(filePath);
  } else if (fileHadRem) {
    unchangedFiles.push(filePath);
  }
}

scanDir(SRC_DIR);

console.log(`\n=== Reverse rem→px conversion complete ===`);
console.log(`Files modified: ${filesChanged}`);
changedFiles.forEach((f) => console.log(`  MODIFIED: ${f}`));
if (unchangedFiles.length > 0) {
  console.log(`(files with rem that were already px-equivalent or had no changes)`);
  unchangedFiles.forEach((f) => console.log(`  SKIPPED:  ${f}`));
}
