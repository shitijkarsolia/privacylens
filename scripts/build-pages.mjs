#!/usr/bin/env node
// One-command local build of the shareable static site (GitHub Pages style):
//   • Root-base build  -> the Chrome extension zip (its sidepanel references
//     /assets/..., so it MUST come from a root-base build).
//   • Subpath build    -> the Pages site (PAGES_BASE, default /privacylens/).
//   • Adds 404.html (SPA fallback) + drops the extension zip into dist/.
//
// Usage: node scripts/build-pages.mjs [basePath]
//   basePath default: /privacylens/   (use "/" for root-domain hosting)

import { execFileSync } from "node:child_process";
import { copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const base = process.argv[2] || "/privacylens/";
const zipTmp = "/tmp/privacylens-extension.zip";
const run = (cmd, args, env) =>
  execFileSync(cmd, args, { cwd: root, stdio: "inherit", env: { ...process.env, ...env } });

console.log("1/3  Root-base build + extension package...");
run("npm", ["run", "build"], { PAGES_BASE: "/" });
run("node", ["scripts/package-extension.mjs", zipTmp]);

console.log(`2/3  Pages build (base ${base})...`);
run("npm", ["run", "build"], { PAGES_BASE: base });

console.log("3/3  Static hosting prep (404 + extension zip)...");
run("node", ["scripts/postbuild-pages.mjs", "--zip", zipTmp]);
copyFileSync(zipTmp, resolve(root, "dist/privacylens-extension.zip"));

console.log(`\nDone. Serve ./dist at base "${base}".`);
console.log("  • Site routes:   /  /demo  /install");
console.log("  • Extension zip: /privacylens-extension.zip (root-base, loads as unpacked extension)");
