#!/usr/bin/env node
// UI QA sweep: drives the real app (server must be running on :3001)
// through the core flows and captures screenshots for visual review.
//
// Usage: node scripts/qa-ui.mjs [baseUrl]
//   default baseUrl: http://localhost:3001

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.argv[2] || "http://localhost:3001";
const OUT = resolve("output/qa");
mkdirSync(OUT, { recursive: true });

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

let failures = 0;
function check(name, condition, detail = "") {
  if (condition) {
    console.log(`  ok  ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name} ${detail}`);
  }
}

async function shoot(page, name, fullPage = false) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
  console.log(`  shot ${name}.png`);
}

const browser = await chromium.launch();

// ---------- Landing + install, desktop and mobile ----------
for (const [label, viewport] of [["desktop", DESKTOP], ["mobile", MOBILE]]) {
  const page = await browser.newPage({ viewport });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await shoot(page, `landing-${label}`, true);
  check(
    `landing-${label} no horizontal overflow`,
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  );

  await page.goto(`${BASE}/install`, { waitUntil: "networkidle" });
  await shoot(page, `install-${label}`, true);
  check(
    `install-${label} no horizontal overflow`,
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  );
  await page.close();
}

// ---------- Demo chat flow ----------
const page = await browser.newPage({ viewport: DESKTOP });
page.on("pageerror", (err) => {
  failures++;
  console.log(`  FAIL pageerror: ${err.message}`);
});
await page.goto(`${BASE}/demo`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await shoot(page, "demo-01-empty");

// Type a message with PII -> live regex warning
const composer = page.locator("textarea");
await composer.fill(
  "Hi! I'm Aisha Patel, my SSN is 291-78-4290 and you can reach me at (480) 555-0198 or aisha.patel22@gmail.com"
);
await page.waitForTimeout(600);
await shoot(page, "demo-02-typed-pii");
check(
  "live PII warning appears while typing",
  (await page.locator("text=review required before sending").count()) > 0
);

// Submit -> blocked, review panel opens
await composer.press("Enter");
await page.waitForSelector("text=Review before sending", { timeout: 30000 });
await page.waitForTimeout(700);
await shoot(page, "demo-03-review-panel");
check(
  "review panel lists detected items",
  (await page.locator("text=Detected items").count()) > 0
);

// Send redacted
await page.locator("button", { hasText: "Send redacted message" }).first().click();
await page.waitForTimeout(500);
await shoot(page, "demo-04-sent-redacted");
check(
  "redacted note shown on sent message",
  (await page.locator("text=Personal data redacted before sending").count()) > 0
);

// Wait for assistant reply
await page.waitForFunction(
  () => document.body.innerText.match(/Demo assistant|demo assistant/),
  { timeout: 30000 }
).catch(() => {});
await page.waitForTimeout(600);
await shoot(page, "demo-05-assistant-reply");

check(
  "protected counter visible in header",
  (await page.locator("text=protected").count()) > 0
);

// ---------- File upload flow (PDF with PII) ----------
const page2 = await browser.newPage({ viewport: DESKTOP });
page2.on("pageerror", (err) => {
  failures++;
  console.log(`  FAIL pageerror: ${err.message}`);
});
await page2.goto(`${BASE}/demo`, { waitUntil: "networkidle" });
await page2.waitForTimeout(500);

// Use the sample-file shortcut on the empty state
await page2.locator("button", { hasText: "Resume PDF" }).click();
await page2.waitForSelector("text=Review before attaching", { timeout: 90000 });
await page2.waitForTimeout(1200);
await shoot(page2, "demo-06-file-review");
check(
  "before/after slider present for PDF",
  (await page2.locator("text=Drag to compare").count()) > 0
);

// Attach redacted copy
await page2
  .locator("button", { hasText: /Attach redacted copy/ })
  .first()
  .click();
await page2.waitForTimeout(600);
await shoot(page2, "demo-07-attached-redacted");
check(
  "redacted file chip shown in composer",
  (await page2.locator("text=redacted-resume-emily-chen.pdf").count()) > 0
);

// Ask a question about the attached file and send
await page2.locator("textarea").fill("Can you give me feedback on this resume?");
await page2.locator("textarea").press("Enter");
await page2.waitForFunction(
  () => document.body.innerText.includes("feedback on the resume") ||
        document.body.innerText.includes("Demo assistant"),
  { timeout: 60000 }
).catch(() => {});
await page2.waitForTimeout(600);
await shoot(page2, "demo-08-file-chat-reply");

// ---------- Mobile demo ----------
const page3 = await browser.newPage({ viewport: MOBILE });
await page3.goto(`${BASE}/demo`, { waitUntil: "networkidle" });
await page3.waitForTimeout(600);
await shoot(page3, "demo-09-mobile-empty");
await page3.locator("textarea").fill("My SSN is 291-78-4290");
await page3.locator("textarea").press("Enter");
await page3.waitForSelector("text=Review before sending", { timeout: 30000 });
await page3.waitForTimeout(600);
await shoot(page3, "demo-10-mobile-review");
check(
  "mobile demo no horizontal overflow",
  await page3.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
);

await browser.close();
console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
