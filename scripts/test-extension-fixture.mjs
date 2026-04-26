import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const root = resolve(import.meta.dirname, "..");
const fixturePath = resolve(root, "tests/fixtures/extension-composer.html");
const contentScriptPath = resolve(root, "public/extension/content-script.js");
const tmpDir = resolve(tmpdir(), "privacylens-extension-fixture");
const textFilePath = resolve(tmpDir, "pii-upload.txt");
const secondTextFilePath = resolve(tmpDir, "pii-second.txt");
const cleanTextFilePath = resolve(tmpDir, "clean-upload.txt");
const unsupportedFilePath = resolve(tmpDir, "private-notes.docx");
const oversizedFilePath = resolve(tmpDir, "oversized-private.txt");

const sample =
  "This agreement is between Aisha Patel (aisha.patel22@gmail.com) of 1520 S Mill Ave Apt 3B, Tempe AZ 85281. My SSN is 291-XX-XXXX and my employee ID is EMP-20418.";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await mkdir(tmpDir, { recursive: true });
  await writeFile(textFilePath, "Employee file for Aisha Patel, SSN 291-XX-XXXX, email aisha.patel22@gmail.com.");
  await writeFile(secondTextFilePath, "Backup contact name is Marcus Reed, phone (480) 555-0198, employee ID EMP-20418.");
  await writeFile(cleanTextFilePath, "Public release notes with no private identifiers.");
  await writeFile(unsupportedFilePath, "This unsupported file may contain private notes.");
  await writeFile(oversizedFilePath, Buffer.concat([
    Buffer.from("Oversized private file with SSN 291-XX-XXXX. "),
    Buffer.alloc(8 * 1024 * 1024 + 1, "a"),
  ]));

  await page.goto(`file://${fixturePath}`);
  await page.addScriptTag({ content: await readFile(contentScriptPath, "utf8") });

  await page.locator("#prompt-textarea").fill(sample);
  await page.locator("button[aria-label='Send message']").click();

  await page.waitForFunction(() => window.__privacyLensState?.status === "blocked");

  const blockedState = await page.evaluate(() => window.__privacyLensState);
  assert(blockedState.entities.length >= 5, `expected at least 5 entities, got ${blockedState.entities.length}`);
  assert(blockedState.blocked === true, "expected blocked state");

  const submittedBefore = await page.evaluate(() => window.__submitCount);
  assert(submittedBefore === 0, `expected blocked submit count 0, got ${submittedBefore}`);

  const openedPanel = await page.evaluate(() => window.__openPanelCount > 0);
  assert(openedPanel, "expected side panel open request after risky send");

  const hasHighlight = await page.evaluate(() => Boolean(CSS.highlights?.has("privacylens-pii-highlight")));
  assert(hasHighlight, "expected CSS Highlight API highlight to be registered");

  const ids = await page.evaluate(() => window.__privacyLensState.entities.map((entity) => entity.id));
  await page.evaluate((entityIds) => {
    window.__privacyLensRuntimeListener?.(
      { type: "PRIVACYLENS_APPLY_REDACTION", entityIds },
      {},
      () => undefined
    );
  }, ids);

  await page.waitForFunction(() => document.querySelector("#prompt-textarea")?.innerText.includes("[SSN]"));
  const redactedText = await page.locator("#prompt-textarea").innerText();
  assert(redactedText.includes("[NAME]"), "expected name redaction");
  assert(redactedText.includes("[EMAIL]"), "expected email redaction");
  assert(redactedText.includes("[ADDRESS]"), "expected address redaction");
  assert(redactedText.includes("[SSN]"), "expected SSN redaction");
  assert(redactedText.includes("[EMPLOYEE ID]"), "expected employee ID redaction");

  await page.evaluate((message) => {
    document.querySelector("#prompt-textarea").textContent = message;
    window.__privacyLensState = null;
  }, sample);
  await page.locator("button[aria-label='Send message']").click();
  await page.waitForFunction(() => window.__privacyLensState?.status === "blocked");

  const partialIds = await page.evaluate(() =>
    window.__privacyLensState.entities
      .filter((entity) => entity.category !== "private_email")
      .map((entity) => entity.id)
  );
  await page.evaluate((entityIds) => {
    window.__privacyLensRuntimeListener?.(
      { type: "PRIVACYLENS_REDACT_AND_SEND", entityIds },
      {},
      () => undefined
    );
  }, partialIds);

  await page.waitForFunction(() => window.__submitCount === 1);
  const partialRedactedText = await page.locator("#prompt-textarea").innerText();
  assert(partialRedactedText.includes("aisha.patel22@gmail.com"), "expected kept email to remain");
  assert(partialRedactedText.includes("[SSN]"), "expected selected SSN to be redacted");

  await page.evaluate(() => {
    document.querySelector("#prompt-textarea").textContent = "This is a clean launch note.";
    window.__privacyLensState = null;
  });
  const cleanSubmitBaseline = await page.evaluate(() => window.__submitCount);
  await page.locator("button[aria-label='Send message']").click();
  await page.waitForFunction(
    (previousCount) => window.__submitCount === previousCount + 1,
    cleanSubmitBaseline
  );
  await page.evaluate(() => {
    document.querySelector("#prompt-textarea").textContent = "SSN 291-XX-XXXX";
  });
  await page.locator("button[aria-label='Send message']").click();
  await page.waitForFunction(() => window.__privacyLensState?.status === "blocked");
  const bypassSubmitCount = await page.evaluate(() => window.__submitCount);
  assert(
    bypassSubmitCount === cleanSubmitBaseline + 1,
    "expected changed risky text inside clean-send window to be blocked"
  );

  await page.evaluate(() => {
    document.querySelector("#prompt-textarea").textContent = "";
    window.__privacyLensState = null;
    window.__attachedFiles = [];
    window.__inputAttachedFiles = [];
  });
  await page.locator("#file-input").setInputFiles(textFilePath);
  await page.waitForFunction(() => window.__privacyLensState?.status === "blocked");
  const uploadState = await page.evaluate(() => window.__privacyLensState);
  assert(uploadState.text.includes("pii-upload.txt"), "expected text file name in scan context");
  assert(uploadState.entities.some((entity) => entity.category === "ssn"), "expected uploaded text SSN detection");
  assert(uploadState.attachment?.beforePreview, "expected attachment before preview");
  assert(uploadState.attachment?.afterPreview, "expected attachment after preview");
  const attachedBeforeRedaction = await page.evaluate(() => window.__attachedFiles.length);
  assert(attachedBeforeRedaction === 0, "expected original attachment change to be blocked before page receives it");
  const inputAttachedBeforeRedaction = await page.evaluate(() => window.__inputAttachedFiles.length);
  assert(inputAttachedBeforeRedaction === 0, "expected original attachment input event to be blocked before page receives it");

  const submittedBeforeBlockedAttachmentSend = await page.evaluate(() => window.__submitCount);
  await page.locator("button[aria-label='Send message']").click();
  await page.waitForTimeout(100);
  const submittedWithBlockedAttachment = await page.evaluate(() => window.__submitCount);
  assert(
    submittedWithBlockedAttachment === submittedBeforeBlockedAttachmentSend,
    "expected send button to remain blocked for risky attachment"
  );

  const uploadIds = await page.evaluate(() => window.__privacyLensState.entities.map((entity) => entity.id));
  await page.evaluate((entityIds) => {
    window.__privacyLensRuntimeListener?.(
      { type: "PRIVACYLENS_REDACT_AND_ATTACH", entityIds },
      {},
      () => undefined
    );
  }, uploadIds);

  await page.waitForFunction(() => window.__attachedFiles[0]?.name?.startsWith("redacted-"));
  const attachedAfterRedaction = await page.evaluate(() => window.__attachedFiles[0]);
  const inputAttachedAfterRedaction = await page.evaluate(() => window.__inputAttachedFiles[0]);
  assert(attachedAfterRedaction.name === "redacted-pii-upload.txt", `expected redacted attachment name, got ${attachedAfterRedaction.name}`);
  assert(inputAttachedAfterRedaction.name === "redacted-pii-upload.txt", `expected redacted input attachment name, got ${inputAttachedAfterRedaction.name}`);
  assert(attachedAfterRedaction.type === "text/plain", `expected text/plain redacted attachment, got ${attachedAfterRedaction.type}`);
  assert(!attachedAfterRedaction.text.includes("291-XX-XXXX"), "expected redacted text attachment to remove SSN");
  assert(attachedAfterRedaction.text.includes("[SSN]"), "expected redacted text attachment to include SSN label");

  await page.locator("button[aria-label='Send message']").click();
  await page.waitForFunction(
    (previousCount) => window.__submitCount === previousCount + 1,
    submittedBeforeBlockedAttachmentSend
  );

  await page.evaluate(() => {
    document.querySelector("#prompt-textarea").textContent = "";
    window.__privacyLensState = null;
    window.__attachedFiles = [];
  });
  await page.locator("#file-input").setInputFiles([textFilePath, secondTextFilePath, cleanTextFilePath]);
  await page.waitForFunction(() => window.__privacyLensState?.status === "blocked");
  const multiState = await page.evaluate(() => window.__privacyLensState);
  assert(multiState.attachment?.files?.length === 3, "expected all three selected text files in attachment review");
  assert(
    multiState.attachment.files.filter((file) => file.status === "redactable").length === 2,
    "expected two risky files in attachment review"
  );
  assert(
    multiState.attachment.files.some((file) => file.name === "clean-upload.txt" && file.status === "clean"),
    "expected clean file to remain visible in review"
  );
  const multiIds = await page.evaluate(() => window.__privacyLensState.entities.map((entity) => entity.id));
  await page.evaluate((entityIds) => {
    window.__privacyLensRuntimeListener?.(
      { type: "PRIVACYLENS_REDACT_AND_ATTACH", entityIds },
      {},
      () => undefined
    );
  }, multiIds);
  await page.waitForFunction(() => window.__attachedFiles.length === 3);
  const multiAttached = await page.evaluate(() => window.__attachedFiles);
  const multiNames = multiAttached.map((file) => file.name).sort();
  assert(
    JSON.stringify(multiNames) === JSON.stringify(["clean-upload.txt", "redacted-pii-second.txt", "redacted-pii-upload.txt"]),
    `expected redacted risky files plus clean original, got ${multiNames.join(", ")}`
  );
  for (const file of multiAttached) {
    if (file.name.startsWith("redacted-")) {
      assert(!/291-XX-XXXX|aisha\.patel22@gmail\.com|Marcus Reed|\(480\) 555-0198|EMP-20418/.test(file.text), `expected ${file.name} to remove original PII`);
    }
  }

  await page.evaluate(() => {
    document.querySelector("#prompt-textarea").textContent = "";
    window.__privacyLensState = null;
    window.__attachedFiles = [];
  });
  await page.locator("#file-input").setInputFiles(unsupportedFilePath);
  await page.waitForFunction(() => window.__privacyLensState?.status === "blocked");
  const unsupportedState = await page.evaluate(() => window.__privacyLensState);
  assert(unsupportedState.attachment?.redactionBlockedByIssues === true, "expected unsupported file to fail closed");
  assert(unsupportedState.attachment?.files?.[0]?.status === "unsupported", "expected unsupported file status");
  assert((await page.evaluate(() => window.__attachedFiles.length)) === 0, "expected unsupported original not to attach automatically");

  await page.evaluate(() => {
    window.__privacyLensState = null;
    window.__attachedFiles = [];
    window.__inputAttachedFiles = [];
  });
  await page.locator("#file-input").setInputFiles(oversizedFilePath);
  await page.waitForFunction(() => window.__privacyLensState?.status === "blocked");
  const oversizedState = await page.evaluate(() => window.__privacyLensState);
  assert(oversizedState.attachment?.files?.[0]?.status === "unscannable", "expected oversized file to fail closed as unscannable");
  assert(/up to 8 MB/.test(oversizedState.attachment?.files?.[0]?.reason || ""), "expected oversized reason to mention size limit");
  assert((await page.evaluate(() => window.__inputAttachedFiles.length)) === 0, "expected oversized original input event to be blocked");
  await page.evaluate(() => {
    window.__privacyLensRuntimeListener?.(
      { type: "PRIVACYLENS_CANCEL_BLOCK" },
      {},
      () => undefined
    );
  });
  await page.waitForFunction(() => window.__privacyLensState?.status === "idle");

  await page.evaluate((message) => {
    document.querySelector("#prompt-textarea").textContent = message;
    window.__privacyLensState = null;
    window.__privacyLensOpenPanelShouldFail = true;
  }, sample);
  await page.locator("button[aria-label='Send message']").click();
  await page.waitForFunction(() => window.__privacyLensState?.status === "blocked");
  await page.waitForFunction(() => document.querySelector("#privacylens-panel-fallback")?.style.display === "block");
  assert(
    await page.locator("#privacylens-panel-fallback").getByText("PrivacyLens paused this send or upload").isVisible(),
    "expected in-page fallback when side panel cannot open"
  );

  const recoveredState = await page.evaluate(() => new Promise((resolve) => {
    window.__privacyLensRuntimeListener?.(
      { type: "PRIVACYLENS_GET_CONTENT_STATE" },
      {},
      (response) => resolve(response.state)
    );
  }));
  assert(recoveredState?.status === "blocked", "expected content script to return current blocked state for service-worker recovery");

  console.log("extension fixture test passed");
} finally {
  await browser.close();
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
