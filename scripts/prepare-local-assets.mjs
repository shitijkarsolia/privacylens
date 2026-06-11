#!/usr/bin/env node
// Stages the OCR runtime into public/tesseract/ so image scanning runs
// fully self-hosted (no CDN). Copies worker/core from node_modules and
// fetches the English language data once (cached afterwards).

import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "public/tesseract");
const langDir = resolve(outDir, "lang");
mkdirSync(langDir, { recursive: true });

const copies = [
  ["node_modules/tesseract.js/dist/worker.min.js", "worker.min.js"],
  ["node_modules/tesseract.js-core/tesseract-core-lstm.js", "tesseract-core-lstm.js"],
  ["node_modules/tesseract.js-core/tesseract-core-lstm.wasm", "tesseract-core-lstm.wasm"],
  ["node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js", "tesseract-core-lstm.wasm.js"],
  ["node_modules/tesseract.js-core/tesseract-core-simd-lstm.js", "tesseract-core-simd-lstm.js"],
  ["node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm", "tesseract-core-simd-lstm.wasm"],
  ["node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js"],
];

for (const [from, to] of copies) {
  copyFileSync(resolve(root, from), resolve(outDir, to));
}
console.log(`Staged ${copies.length} tesseract runtime files -> public/tesseract/`);

const langFile = resolve(langDir, "eng.traineddata.gz");
if (existsSync(langFile)) {
  console.log("eng.traineddata.gz already present.");
} else {
  const url = "https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz";
  console.log(`Downloading ${url} ...`);
  const res = await fetch(url);
  if (!res.ok) {
    console.error(
      `Failed to download language data (${res.status}). Image OCR will fail ` +
        "closed until public/tesseract/lang/eng.traineddata.gz exists."
    );
    process.exit(1);
  }
  const data = Buffer.from(await res.arrayBuffer());
  writeFileSync(langFile, data);
  console.log(`Saved eng.traineddata.gz (${(data.length / 1024 / 1024).toFixed(1)} MB)`);
}
