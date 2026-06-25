#!/usr/bin/env node
// Prepares dist/ for static hosting (GitHub Pages):
// 1. Copies index.html to 404.html so SPA routes like /demo resolve.
// 2. Drops the extension zip into dist/ so the install page's download
//    button works on the deployed site.
//
// The extension zip must come from a ROOT-base build (its side panel
// references /assets/...), while the Pages site is built with PAGES_BASE.
// Pass the prebuilt zip via --zip <path>; otherwise this packages the
// current dist as-is (only correct for root-base builds).
//
// Usage: node scripts/postbuild-pages.mjs [--zip /path/to/extension.zip]

import { copyFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

if (!existsSync(resolve(dist, "index.html"))) {
  console.error("dist/index.html not found - run `npm run build` first.");
  process.exit(1);
}

copyFileSync(resolve(dist, "index.html"), resolve(dist, "404.html"));
console.log("Created dist/404.html (SPA fallback).");

const zipFlag = process.argv.indexOf("--zip");
const target = resolve(dist, "privacylens-extension.zip");

if (zipFlag !== -1 && process.argv[zipFlag + 1]) {
  copyFileSync(resolve(process.argv[zipFlag + 1]), target);
  console.log(`Copied prebuilt extension zip -> ${target}`);
} else {
  execFileSync(
    process.execPath,
    [resolve(root, "scripts/package-extension.mjs"), target],
    { stdio: "inherit" }
  );
}
