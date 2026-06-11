#!/usr/bin/env node
// Verifies the fully static deployment story (e.g. GitHub Pages):
// dist/ is served with no API backend, and the demo must still work -
// detection via regex (and in-browser model where WebGPU exists), chat via
// the labeled demo assistant, OCR via the self-hosted tesseract runtime.
//
// Also asserts that no request leaves the local origin, which is the
// product's core privacy claim.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import { resolve, extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const OUT = resolve(root, "output/qa");
mkdirSync(OUT, { recursive: true });

// Simulate subpath hosting (GitHub Pages project sites) with
// STATIC_BASE=/privacylens/ after building with the same PAGES_BASE.
const SUBPATH = (process.env.STATIC_BASE || "/").replace(/\/$/, "");

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".wasm": "application/wasm",
  ".gz": "application/gzip",
  ".zip": "application/zip",
};

// GitHub Pages semantics: unknown paths return the 404 page (our SPA
// fallback) with a 404 status code.
const server = createServer(async (req, res) => {
  let urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (SUBPATH) {
    if (!urlPath.startsWith(SUBPATH)) {
      res.writeHead(404, { "content-type": "text/html" });
      res.end("outside site base");
      return;
    }
    urlPath = urlPath.slice(SUBPATH.length) || "/";
  }
  let filePath = normalize(join(dist, urlPath));
  if (!filePath.startsWith(dist)) {
    res.writeHead(403).end();
    return;
  }
  if (urlPath.endsWith("/")) filePath = join(filePath, "index.html");

  try {
    const data = await readFile(filePath);
    res.writeHead(200, { "content-type": MIME[extname(filePath)] || "application/octet-stream" });
    res.end(data);
  } catch {
    const fallback = existsSync(join(dist, "404.html"))
      ? join(dist, "404.html")
      : join(dist, "index.html");
    res.writeHead(404, { "content-type": "text/html" });
    res.end(await readFile(fallback));
  }
});

await new Promise((r) => server.listen(4174, "127.0.0.1", r));
const BASE = `http://127.0.0.1:4174${SUBPATH}`;

let failures = 0;
function check(name, condition, detail = "") {
  if (condition) console.log(`  ok  ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name} ${detail}`);
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// Model weights may legitimately stream from Hugging Face when WebGPU is
// available; anything else leaving the origin is a privacy violation.
const ALLOWED_EXTERNAL = [/(^|\.)huggingface\.co$/, /(^|\.)hf\.co$/, /cdn-lfs/];
const externalRequests = [];
page.on("request", (req) => {
  const url = new URL(req.url());
  if (
    url.hostname !== "127.0.0.1" &&
    url.protocol.startsWith("http") &&
    !ALLOWED_EXTERNAL.some((p) => p.test(url.hostname))
  ) {
    externalRequests.push(req.url());
  }
});
page.on("pageerror", (err) => {
  failures++;
  console.log(`  FAIL pageerror: ${err.message}`);
});

// Landing -> demo via the CTA
await page.goto(BASE, { waitUntil: "networkidle" });
await page.locator("a", { hasText: "Try the live demo" }).click();
await page.waitForURL("**/demo");
await page.waitForTimeout(1500);
check(
  "static demo shows pattern-detection fallback chip",
  (await page.locator("text=Pattern detection active").count()) > 0 ||
    (await page.locator("text=On-device AI detection active").count()) > 0
);

// Text flow: PII typed -> blocked -> redacted send -> demo reply
await page.locator("textarea").fill(
  "Please review my offer letter. I'm Aisha Patel, SSN 291-78-4290, aisha.patel22@gmail.com"
);
await page.locator("textarea").press("Enter");
await page.waitForSelector("text=Review before sending", { timeout: 20000 });
await page.screenshot({ path: `${OUT}/static-01-review.png` });
await page.locator("button", { hasText: "Send redacted message" }).first().click();
await page.waitForSelector("text=Demo assistant", { timeout: 20000 });
await page.screenshot({ path: `${OUT}/static-02-demo-reply.png` });
check("demo assistant reply labeled", true);
check(
  "redacted send shows [SSN]",
  (await page.locator("text=[SSN]").count()) > 0
);

// Image flow: business card sample -> self-hosted OCR -> review
await page.locator("button", { hasText: "New chat" }).count(); // noop guard
await page.locator("button[title='New chat']").click();
await page.waitForTimeout(800);
await page.locator("button", { hasText: "Business Card" }).click();
await page.waitForSelector("text=Review before attaching", { timeout: 120000 });
await page.screenshot({ path: `${OUT}/static-03-image-review.png` });
check("image OCR review opened (self-hosted tesseract)", true);

check(
  "no external network requests",
  externalRequests.length === 0,
  externalRequests.slice(0, 5).join(", ")
);

await browser.close();
server.close();
console.log(failures ? `\n${failures} static check(s) FAILED` : "\nStatic demo checks passed");
process.exit(failures ? 1 : 0);
