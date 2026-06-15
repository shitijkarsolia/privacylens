#!/usr/bin/env node
// Records the demo flows as video clips for the HyperFrames composition.
// Requires the API server on :3001 (npm run server) and a fresh build in
// dist/ (the extension scenes serve dist/ statically).
//
// Outputs: demo-video/clips/*.webm + timings.json (event offsets in ms
// from the start of each recording, for caption/overlay sync).

import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join, extname, normalize } from "node:path";

const root = resolve(import.meta.dirname, "..");
const BASE = process.env.DEMO_BASE || "http://localhost:3001";
const CLIPS = resolve(root, "demo-video/clips");
await mkdir(CLIPS, { recursive: true });

const timings = {};

// ---------- helpers ----------

const CURSOR_INIT = `
  (() => {
    if (window.top !== window) return;
    const attach = () => {
      if (document.getElementById("__pl_cursor")) return;
      const c = document.createElement("div");
      c.id = "__pl_cursor";
      c.style.cssText =
        "position:fixed;top:-60px;left:-60px;width:22px;height:22px;border-radius:50%;" +
        "background:rgba(31,35,40,0.78);border:2.5px solid #fff;" +
        "box-shadow:0 1px 8px rgba(0,0,0,0.45);z-index:2147483647;pointer-events:none;" +
        "transform:translate(-50%,-50%);transition:width .12s,height .12s,background .12s";
      document.documentElement.appendChild(c);
      addEventListener("mousemove", (e) => {
        c.style.left = e.clientX + "px";
        c.style.top = e.clientY + "px";
      }, true);
      addEventListener("mousedown", () => {
        c.style.width = "16px"; c.style.height = "16px"; c.style.background = "#079B8E";
      }, true);
      addEventListener("mouseup", () => {
        c.style.width = "22px"; c.style.height = "22px"; c.style.background = "rgba(31,35,40,0.78)";
      }, true);
    };
    if (document.readyState === "loading") {
      addEventListener("DOMContentLoaded", attach);
    } else {
      attach();
    }
  })();
`;

async function glideTo(page, locator, { fx = 0.5, fy = 0.5, steps = 30 } = {}) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("glideTo: element not visible");
  const x = box.x + box.width * fx;
  const y = box.y + box.height * fy;
  await page.mouse.move(x, y, { steps });
  return { x, y };
}

async function humanClick(page, locator, opts = {}) {
  await glideTo(page, locator, opts);
  await page.waitForTimeout(opts.pause ?? 280);
  await page.mouse.down();
  await page.waitForTimeout(90);
  await page.mouse.up();
}

function makeScene(browser, name, viewport) {
  let t0;
  const marks = {};
  return {
    async open(extraInit) {
      const ctx = await browser.newContext({
        viewport,
        recordVideo: { dir: CLIPS, size: viewport },
        deviceScaleFactor: 1,
      });
      await ctx.addInitScript(CURSOR_INIT);
      if (extraInit) await ctx.addInitScript(extraInit.script, extraInit.arg);
      const page = await ctx.newPage();
      t0 = Date.now();
      this.ctx = ctx;
      this.page = page;
      return page;
    },
    mark(label) {
      marks[label] = Date.now() - t0;
      console.log(`  [${name}] ${label} @ ${marks[label]}ms`);
    },
    async close() {
      const video = this.page.video();
      await this.ctx.close();
      await video.saveAs(join(CLIPS, `${name}.webm`));
      timings[name] = marks;
      console.log(`  saved ${name}.webm`);
    },
  };
}

// Static dist server for the extension panel scene.
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml",
  ".wasm": "application/wasm", ".gz": "application/gzip",
};
const dist = resolve(root, "dist");
const distServer = createServer(async (req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const filePath = normalize(join(dist, urlPath === "/" ? "index.html" : urlPath));
  if (!filePath.startsWith(dist)) return res.writeHead(403).end();
  try {
    res.writeHead(200, { "content-type": MIME[extname(filePath)] || "application/octet-stream" });
    res.end(await readFile(filePath));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => distServer.listen(4181, "127.0.0.1", r));

const browser = await chromium.launch({
  args: ["--hide-scrollbars", "--force-color-profile=srgb"],
});

const FHD = { width: 1920, height: 1080 };

const PII_MESSAGE =
  "Hi! I'm Aisha Patel, my SSN is 291-78-4290 and you can reach me at (480) 555-0198 or aisha.patel22@gmail.com";
const AGREEMENT =
  "This agreement is between Aisha Patel (aisha.patel22@gmail.com) of 1520 S Mill Ave Apt 3B, Tempe AZ 85281. My SSN is 291-XX-XXXX and my employee ID is EMP-20418.";

// ---------- Scene 1: landing -> demo ----------
console.log("Scene 01: landing");
{
  const scene = makeScene(browser, "01-landing", FHD);
  const page = await scene.open();
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.mouse.move(640, 420);
  scene.mark("loaded");
  await page.waitForTimeout(1600);
  const cta = page.locator("a", { hasText: "Try the live demo" });
  await glideTo(page, cta, { steps: 36 });
  scene.mark("cta-hover");
  await page.waitForTimeout(700);
  await humanClick(page, cta, { pause: 120 });
  await page.waitForSelector("text=See what AI sees", { timeout: 15000 });
  scene.mark("demo-open");
  await page.waitForTimeout(2300);
  await scene.close();
}

// ---------- Scene 2: text flow ----------
console.log("Scene 02: text flow");
{
  const scene = makeScene(browser, "02-text-flow", FHD);
  const page = await scene.open();
  await page.goto(`${BASE}/demo`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=AI detection active", { timeout: 60000 }).catch(() => {});
  await page.mouse.move(960, 500);
  await page.waitForTimeout(900);

  const composer = page.locator("textarea");
  await humanClick(page, composer);
  scene.mark("typing-start");
  await page.keyboard.type(PII_MESSAGE, { delay: 30 });
  scene.mark("typing-done");
  await page.waitForTimeout(1300);
  await page.keyboard.press("Enter");
  await page.waitForSelector("text=Review before sending", { timeout: 30000 });
  scene.mark("blocked");
  await page.waitForTimeout(900);

  // Glance over the detected rows
  const rows = page.locator("button:has-text('Redact')").filter({ has: page.locator("span") });
  const rowButtons = page.locator("div.space-y-2 > button");
  const count = Math.min(await rowButtons.count(), 4);
  for (let i = 0; i < count; i++) {
    await glideTo(page, rowButtons.nth(i), { steps: 18 });
    await page.waitForTimeout(420);
  }
  void rows;

  const sendRedacted = page.locator("button", { hasText: "Send redacted message" }).first();
  await humanClick(page, sendRedacted, { pause: 420 });
  scene.mark("redacted-sent");
  await page.waitForSelector("text=Demo assistant", { timeout: 30000 }).catch(() => {});
  scene.mark("reply");
  await page.waitForTimeout(2600);
  await scene.close();
}

// ---------- Scene 3: file flow ----------
console.log("Scene 03: file flow");
{
  const scene = makeScene(browser, "03-file-flow", FHD);
  const page = await scene.open();
  await page.goto(`${BASE}/demo`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=AI detection active", { timeout: 60000 }).catch(() => {});
  await page.mouse.move(960, 430);
  await page.waitForTimeout(900);

  const sample = page.locator("button", { hasText: "Resume PDF" });
  await humanClick(page, sample, { pause: 420 });
  scene.mark("scan-start");
  await page.waitForSelector("text=Review before attaching", { timeout: 120000 });
  scene.mark("review-open");
  await page.waitForTimeout(1300);

  // Drag the before/after slider: right (reveal original) then left (safe copy)
  const sliderBox = await page
    .locator("div[style*='col-resize']")
    .first()
    .boundingBox();
  if (sliderBox) {
    const midY = sliderBox.y + sliderBox.height / 2;
    const xAt = (f) => sliderBox.x + sliderBox.width * f;
    await page.mouse.move(xAt(0.5), midY, { steps: 24 });
    await page.waitForTimeout(250);
    await page.mouse.down();
    scene.mark("slider-drag");
    await page.mouse.move(xAt(0.88), midY, { steps: 46 });
    await page.waitForTimeout(420);
    await page.mouse.move(xAt(0.14), midY, { steps: 60 });
    await page.waitForTimeout(420);
    await page.mouse.move(xAt(0.55), midY, { steps: 36 });
    await page.mouse.up();
  }
  await page.waitForTimeout(500);

  const attach = page.locator("button", { hasText: /Attach redacted copy/ }).first();
  await humanClick(page, attach, { pause: 420 });
  scene.mark("attached");
  await page.waitForTimeout(900);

  const composer = page.locator("textarea");
  await humanClick(page, composer);
  await page.keyboard.type("Can you give me feedback on this resume?", { delay: 30 });
  await page.waitForTimeout(500);
  await page.keyboard.press("Enter");
  scene.mark("question-sent");
  await page.waitForFunction(
    () => document.body.innerText.includes("feedback on the resume"),
    { timeout: 60000 }
  ).catch(() => {});
  scene.mark("reply");
  await page.waitForTimeout(2800);
  await scene.close();
}

// ---------- Scene 4: extension blocking on an AI chat page ----------
console.log("Scene 04: extension page");
let capturedState = null;
{
  const scene = makeScene(browser, "04-extension-page", FHD);
  const page = await scene.open();
  const fixture = resolve(root, "tests/fixtures/demo-ai-chat.html");
  await page.goto(`file://${fixture}`);
  await page.evaluate(() => { window.__privacyLensOpenPanelShouldFail = true; });
  await page.addScriptTag({
    content: await readFile(resolve(root, "public/extension/content-script.js"), "utf8"),
  });
  await page.mouse.move(900, 500);
  await page.waitForTimeout(1100);

  const composer = page.locator("#prompt-textarea");
  await humanClick(page, composer);
  scene.mark("typing-start");
  await page.keyboard.type(AGREEMENT, { delay: 24 });
  // Passive scan-on-type flags the message and surfaces the in-page banner.
  await page.waitForFunction(() => window.__privacyLensState?.blocked === true, {
    timeout: 30000,
  });
  scene.mark("banner");
  await page.waitForTimeout(900);

  const send = page.locator("button[aria-label='Send message']");
  await humanClick(page, send, { pause: 300 });
  await page.waitForFunction(() => window.__privacyLensState?.blocked === true);
  scene.mark("blocked");

  capturedState = await page.evaluate(() => window.__privacyLensState);

  // Hold while the side-panel overlay plays in the composition.
  await page.waitForTimeout(5600);

  // Panel's "redact and send" lands here: apply redaction in the composer.
  const ids = capturedState.entities.map((e) => e.id);
  await page.evaluate((entityIds) => {
    window.__privacyLensRuntimeListener?.(
      { type: "PRIVACYLENS_APPLY_REDACTION", entityIds },
      {},
      () => undefined
    );
  }, ids);
  scene.mark("redacted");
  await page.waitForTimeout(1400);

  await humanClick(page, send, { pause: 250 });
  scene.mark("sent");
  await page.waitForTimeout(2400);
  await scene.close();
}

// ---------- Scene 5: extension side panel (real UI, captured state) ----------
console.log("Scene 05: extension panel");
{
  // Reuse the state the live content script produced in Scene 4; fall back to
  // an equivalent fixture if capture failed so the scene always renders.
  const panelState = capturedState?.entities?.length
    ? { ...capturedState, status: "blocked", blocked: true, host: "nimbus.ai" }
    : {
        status: "blocked",
        blocked: true,
        host: "nimbus.ai",
        modelState: "regex-ready",
        updatedAt: Date.now(),
        text: AGREEMENT,
        redactedText:
          "This agreement is between [NAME] ([EMAIL]) of [ADDRESS]. My SSN is [SSN] and my employee ID is [EMPLOYEE ID].",
        entities: [
          { id: "name", category: "private_person", label: "Full Name", text: "Aisha Patel", start: 25, end: 36, confidence: 0.92, source: "regex", severity: "medium" },
          { id: "email", category: "private_email", label: "Email", text: "aisha.patel22@gmail.com", start: 38, end: 61, confidence: 0.95, source: "regex", severity: "low" },
          { id: "addr", category: "private_address", label: "Home Address", text: "1520 S Mill Ave Apt 3B, Tempe AZ 85281", start: 66, end: 104, confidence: 0.88, source: "regex", severity: "medium" },
          { id: "ssn", category: "ssn", label: "SSN", text: "291-XX-XXXX", start: 116, end: 127, confidence: 0.99, source: "regex", severity: "high" },
          { id: "emp", category: "employee_id", label: "Employee ID", text: "EMP-20418", start: 148, end: 157, confidence: 0.93, source: "regex", severity: "high" },
        ],
      };

  const PANEL = { width: 420, height: 880 };
  const scene = makeScene(browser, "05-extension-panel", PANEL);
  const page = await scene.open({
    script: (panelState) => {
      window.chrome = {
        runtime: {
          sendMessage(message, callback) {
            if (message.type === "PRIVACYLENS_GET_STATE") {
              callback?.({ ok: true, tabId: 1, state: panelState });
              return;
            }
            callback?.({ ok: true });
          },
          onMessage: { addListener() {}, removeListener() {} },
        },
      };
    },
    arg: panelState,
  });
  await page.goto("http://127.0.0.1:4181/sidepanel.html");
  await page.waitForSelector("text=Send blocked", { timeout: 15000 }).catch(() => {});
  scene.mark("loaded");
  await page.waitForTimeout(1100);

  const rows = page.locator("main button, body button");
  void rows;
  // Hover the first few entity rows
  const entityRows = page.locator("[class*='rounded'][class*='border']").filter({
    hasText: /Full Name|SSN|Email|Address|Employee/i,
  });
  const n = Math.min(await entityRows.count(), 3);
  for (let i = 0; i < n; i++) {
    await glideTo(page, entityRows.nth(i), { steps: 16 });
    await page.waitForTimeout(480);
  }

  const primary = page.locator("button", { hasText: /Redact selected|Send redacted/i }).first();
  if (await primary.count()) {
    await humanClick(page, primary, { pause: 420 });
    scene.mark("redact-click");
  }
  await page.waitForTimeout(1600);
  await scene.close();
}

await browser.close();
distServer.close();

await writeFile(join(CLIPS, "timings.json"), JSON.stringify(timings, null, 2));
console.log("\nAll clips recorded:");
console.log(JSON.stringify(timings, null, 2));
