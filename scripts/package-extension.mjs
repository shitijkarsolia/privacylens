#!/usr/bin/env node
// Packages the built Chrome extension (the dist/ folder) into
// privacylens-extension.zip for easy sharing/sideloading.
//
// Usage: node scripts/package-extension.mjs [outputPath]

import { execFileSync } from "node:child_process";
import { existsSync, rmSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const out = resolve(root, process.argv[2] || "privacylens-extension.zip");

if (!existsSync(resolve(dist, "manifest.json"))) {
  console.error("dist/manifest.json not found - run `npm run build` first.");
  process.exit(1);
}

rmSync(out, { force: true });

// Zip the contents of dist so manifest.json sits at the archive root.
// Exclude web-only payloads the extension never loads (samples, demo zip).
execFileSync(
  "zip",
  ["-qr", out, ".", "-x", "samples/*", "-x", "privacylens-extension.zip"],
  { cwd: dist, stdio: "inherit" }
);

const sizeMB = (statSync(out).size / 1024 / 1024).toFixed(1);
console.log(`Packaged extension -> ${out} (${sizeMB} MB)`);
