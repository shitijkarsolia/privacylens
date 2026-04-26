import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const previewUrl = "http://127.0.0.1:4173";
const pdfPath = resolve(root, "public/samples/resume-emily-chen.pdf");
const imagePath = resolve(root, "public/samples/business-card.png");

const server = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", "4173"], {
  cwd: root,
  stdio: "ignore",
});

try {
  await waitForPreview();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(previewUrl);
    await page.addScriptTag({
      type: "module",
      url: `${previewUrl}/extension/file-scanner.js`,
    });
    await page.waitForFunction(() => Boolean(globalThis.privacyLensFileScanner));

    const pdfText = await extractInPage(page, pdfPath, "resume-emily-chen.pdf", "application/pdf");
    assert(/emily|chen|email|phone|ssn/i.test(pdfText), "expected readable PII-like text from PDF");
    const pdfAttachment = await redactInPage(page, pdfPath, "resume-emily-chen.pdf", "application/pdf", pdfText);
    assert(pdfAttachment.redactedName === "redacted-resume-emily-chen.pdf", "expected redacted PDF filename");
    assert(pdfAttachment.redactedMimeType === "application/pdf", "expected redacted PDF MIME type");
    assert(pdfAttachment.redactedDataUrl.startsWith("data:application/pdf"), "expected redacted PDF data URL");
    assert(pdfAttachment.beforePreview?.type === "image", "expected PDF before preview image");
    assert(pdfAttachment.afterPreview?.type === "image", "expected PDF after preview image");
    const redactedPdfText = await extractDataUrlInPage(
      page,
      pdfAttachment.redactedDataUrl,
      pdfAttachment.redactedName,
      pdfAttachment.redactedMimeType
    );
    assert(redactedPdfText.includes("[NAME]"), "expected redacted PDF text to include replacement label");
    assert(
      !redactedPdfText.includes(pdfText.slice(0, 24)),
      "expected redacted PDF text to remove original entity text"
    );

    const imageText = await extractInPage(page, imagePath, "business-card.png", "image/png");
    assert(imageText.length > 0, "expected OCR text from image");
    const imageAttachment = await redactInPage(page, imagePath, "business-card.png", "image/png", imageText);
    assert(imageAttachment.redactedName === "redacted-business-card.png", "expected redacted image filename");
    assert(imageAttachment.redactedMimeType === "image/png", "expected redacted image MIME type");
    assert(imageAttachment.redactedDataUrl.startsWith("data:image/png"), "expected redacted image data URL");

    console.log("extension file scanner test passed");
  } finally {
    await browser.close();
  }
} finally {
  server.kill("SIGTERM");
}

async function extractInPage(page, filePath, name, type) {
  const bytes = await readFile(filePath);
  const base64 = bytes.toString("base64");

  return page.evaluate(
    async ({ base64: encoded, name: fileName, type: mimeType }) => {
      const binary = atob(encoded);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      const file = new File([bytes], fileName, { type: mimeType });
      const result = await globalThis.privacyLensFileScanner.extractFileText(file);
      return result.text;
    },
    { base64, name, type }
  );
}

async function redactInPage(page, filePath, name, type, extractedText) {
  const bytes = await readFile(filePath);
  const base64 = bytes.toString("base64");
  const text = extractedText.slice(0, 24);

  return page.evaluate(
    async ({ base64: encoded, name: fileName, type: mimeType, text: entityText }) => {
      const binary = atob(encoded);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      const file = new File([bytes], fileName, { type: mimeType });
      const extracted = await globalThis.privacyLensFileScanner.extractFileText(file);
      const start = extracted.text.indexOf(entityText);
      const entity = {
        id: "fixture-entity",
        category: "private_person",
        label: "Name",
        text: entityText,
        start: Math.max(0, start),
        end: Math.max(0, start) + entityText.length,
      };
      return globalThis.privacyLensFileScanner.createRedactedAttachment(file, extracted.text, [entity]);
    },
    { base64, name, type, text }
  );
}

async function extractDataUrlInPage(page, dataUrl, name, type) {
  return page.evaluate(
    async ({ dataUrl: encoded, name: fileName, type: mimeType }) => {
      const response = await fetch(encoded);
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: mimeType });
      const result = await globalThis.privacyLensFileScanner.extractFileText(file);
      return result.text;
    },
    { dataUrl, name, type }
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
  throw new Error("Vite preview did not start on port 4173");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
