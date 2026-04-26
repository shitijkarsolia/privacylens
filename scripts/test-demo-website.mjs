import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const root = resolve(import.meta.dirname, "..");
const previewUrl = "http://127.0.0.1:4176";
const tmpDir = resolve(tmpdir(), "privacylens-demo-fixture");
const riskyFilePath = resolve(tmpDir, "employee-private.txt");
const cleanFilePath = resolve(tmpDir, "release-notes.txt");
const unsupportedFilePath = resolve(tmpDir, "private-notes.docx");
const oversizedFilePath = resolve(tmpDir, "oversized-private.txt");

const server = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", "4176"], {
  cwd: root,
  stdio: "ignore",
});

try {
  await mkdir(tmpDir, { recursive: true });
  await writeFile(riskyFilePath, "Employee file for Aisha Patel. SSN 291-XX-XXXX. Email aisha.patel22@gmail.com.");
  await writeFile(cleanFilePath, "Public release notes. This document has no personal identifiers.");
  await writeFile(unsupportedFilePath, "Unsupported private notes.");
  await writeFile(oversizedFilePath, Buffer.concat([
    Buffer.from("Oversized private file with SSN 291-XX-XXXX. "),
    Buffer.alloc(8 * 1024 * 1024 + 1, "a"),
  ]));

  await waitForPreview();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const apiState = { chatCalls: 0 };

  try {
    await mockApi(page, apiState);
    await page.goto(`${previewUrl}/demo`);

    await page.locator("textarea").fill("Aisha Patel can be reached at aisha.patel22@gmail.com. SSN 291-XX-XXXX.");
    await page.getByLabel("Send message").click();
    await page.getByText("Review before sending").waitFor({ timeout: 10000 });
    await page.getByRole("button").filter({ hasText: "ai...@gmail.com" }).click();
    await page.getByRole("button", { name: "Send redacted message with 1 visible" }).click();
    await page.getByRole("button", { name: "Send with kept items" }).click();
    await page.getByText("Mock assistant response").waitFor({ timeout: 10000 });
    assert(apiState.chatCalls === 1, "expected one chat call after reviewed text send");

    const messageText = await page.locator("body").innerText();
    assert(messageText.includes("[SSN]"), "expected redacted SSN in sent message");
    assert(messageText.includes("aisha.patel22@gmail.com"), "expected kept email to remain visible");
    assert(!messageText.includes("291-XX-XXXX"), "expected original SSN to be absent after redacted send");

    await page.goto(`${previewUrl}/demo`);
    await page.locator("input[type='file']").setInputFiles([riskyFilePath, cleanFilePath, unsupportedFilePath]);
    await page.getByText("Review before attaching").waitFor({ timeout: 10000 });
    await page.getByText("Attach 2 safe files and leave out 1 unscanned file").click();
    await page.getByText("redacted-employee-private.txt").waitFor({ timeout: 10000 });
    await page.getByText("release-notes.txt").waitFor({ timeout: 10000 });
    const chatCallsBeforeBypassAttempt = apiState.chatCalls;
    await page.locator("textarea").fill("Additional typed SSN 123-45-6789");
    await page.getByLabel("Send message").click();
    await page.getByText("Review before sending").waitFor({ timeout: 10000 });
    assert(apiState.chatCalls === chatCallsBeforeBypassAttempt, "expected risky typed text with attachments to be blocked before chat call");
    await page.getByText("Cancel").first().click();
    await page.locator("textarea").fill("");
    await page.getByLabel("Send message").click();
    await page.getByText("Mock assistant response").waitFor({ timeout: 10000 });

    const fileMessageText = await page.locator("body").innerText();
    assert(fileMessageText.includes("[SSN]"), "expected redacted file content to include SSN label");
    assert(fileMessageText.includes("Public release notes"), "expected clean scanned file text to be preserved");
    assert(!fileMessageText.includes("291-XX-XXXX"), "expected original file SSN to be absent");
    assert(!fileMessageText.includes("private-notes.docx"), "expected unsupported file to be left out of safe attach");

    await page.goto(`${previewUrl}/demo`);
    await page.locator("input[type='file']").setInputFiles(unsupportedFilePath);
    await page.getByText("Review before attaching").waitFor({ timeout: 10000 });
    assert(await page.getByText("No scanned file to attach").isVisible(), "expected unsupported-only safe action to be disabled");
    assert(await page.getByText("Remove paused files").isVisible(), "expected unsupported reset action");

    await page.goto(`${previewUrl}/demo`);
    await page.locator("input[type='file']").setInputFiles(oversizedFilePath);
    await page.getByText("Review before attaching").waitFor({ timeout: 10000 });
    assert(await page.getByText(/up to 8 MB/).isVisible(), "expected oversized file size limit copy");

    await mkdir(resolve(root, "output/playwright"), { recursive: true });
    await page.waitForTimeout(400);
    await page.screenshot({
      path: resolve(root, "output/playwright/demo-review.png"),
      fullPage: true,
    });

    console.log("demo website browser test passed");
  } finally {
    await browser.close();
  }
} finally {
  server.kill("SIGTERM");
}

async function mockApi(page, state) {
  await page.route("**/api/model-status", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ state: "failed", error: "mocked in browser test" }),
    })
  );
  await page.route("**/api/scan", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ entities: [] }),
    })
  );
  await page.route("**/api/chat", (route) =>
    {
      state.chatCalls += 1;
      return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ content: "Mock assistant response" }),
      });
    }
  );
}

async function waitForPreview() {
  const started = Date.now();
  while (Date.now() - started < 15000) {
    try {
      const response = await fetch(previewUrl);
      if (response.ok) return;
    } catch {
      // Retry until Vite preview is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("Vite preview did not start on port 4176");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
