import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const previewUrl = "http://127.0.0.1:4174";

const server = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", "4174"], {
  cwd: root,
  stdio: "ignore",
});

try {
  await waitForPreview();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 420, height: 860 } });

  try {
    await page.addInitScript((panelState) => {
      window.chrome = {
        runtime: {
          sendMessage(message, callback) {
            if (message.type === "PRIVACYLENS_GET_STATE") {
              callback?.({ ok: true, tabId: 1, state: panelState });
              return;
            }
            callback?.({ ok: true });
          },
          onMessage: {
            addListener() {},
            removeListener() {},
          },
        },
      };
    }, blockedAttachmentState());

    await page.goto(`${previewUrl}/sidepanel.html`);
    await page.getByText("Attach redacted copy").waitFor({ timeout: 10000 });

    const slider = page.locator("input[aria-label='Before and after preview split']");
    await slider.evaluate((input) => {
      input.value = "75";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    assert(await page.getByText("2 personal-data items found - Upload paused").isVisible(), "expected blocked upload copy");
    assert(await page.getByText("Redacted PDF text").isVisible(), "expected redacted preview label");
    assert(await page.getByText("Drag to compare").isVisible(), "expected draggable preview affordance");
    assert(await page.getByText("Safe copy", { exact: true }).isVisible(), "expected safe copy slider label");
    assert(await page.getByText("Attach originals unchanged").isVisible(), "expected explicit original attachment override action");
    assert(await page.getByText("Files in review").isVisible(), "expected file review list");
    assert(!(await page.getByText(/local audit/i).isVisible().catch(() => false)), "expected no local audit UI");

    await mkdir(resolve(root, "output/playwright"), { recursive: true });
    await page.screenshot({
      path: resolve(root, "output/playwright/sidepanel-attachment.png"),
      fullPage: true,
    });

    const issuePage = await browser.newPage({ viewport: { width: 420, height: 760 } });
    await issuePage.addInitScript((panelState) => {
      window.chrome = {
        runtime: {
          sendMessage(message, callback) {
            if (message.type === "PRIVACYLENS_GET_STATE") {
              callback?.({ ok: true, tabId: 1, state: panelState });
              return;
            }
            callback?.({ ok: true });
          },
          onMessage: {
            addListener() {},
            removeListener() {},
          },
        },
      };
    }, unsupportedAttachmentState());
    await issuePage.goto(`${previewUrl}/sidepanel.html`);
    await issuePage.getByText("1 file needs review - Upload paused").waitFor({ timeout: 10000 });
    assert(await issuePage.getByText("No scanned file to attach").isVisible(), "expected disabled safe action for unsupported-only file");
    assert(await issuePage.getByText("Supported files under 8 MB: PDF, TXT, CSV, JSON, PNG, JPG, and WebP.").isVisible(), "expected supported file guidance");
    assert(await issuePage.getByText("Remove paused files").isVisible(), "expected reset action for unsupported file");
    assert(await issuePage.getByText("Attach originals unchanged").isVisible(), "expected original override for unsupported file");
    await issuePage.close();

    const mixedPage = await browser.newPage({ viewport: { width: 420, height: 760 } });
    await mixedPage.addInitScript((panelState) => {
      window.chrome = {
        runtime: {
          sendMessage(message, callback) {
            if (message.type === "PRIVACYLENS_GET_STATE") {
              callback?.({ ok: true, tabId: 1, state: panelState });
              return;
            }
            callback?.({ ok: true });
          },
          onMessage: {
            addListener() {},
            removeListener() {},
          },
        },
      };
    }, mixedAttachmentState());
    await mixedPage.goto(`${previewUrl}/sidepanel.html`);
    await mixedPage.getByText("1 file needs review - Upload paused").waitFor({ timeout: 10000 });
    assert(await mixedPage.getByText("Attach 2 safe files and leave out 1 unscanned file").isVisible(), "expected mixed upload safe/omitted count copy");
    await mixedPage.close();

    console.log("extension side panel test passed");
  } finally {
    await browser.close();
  }
} finally {
  server.kill("SIGTERM");
}

function blockedAttachmentState() {
  const previewSvg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1160"><rect width="900" height="1160" fill="white"/><text x="60" y="90" font-size="44" fill="#111827">Aisha Patel</text><text x="60" y="150" font-size="32" fill="#111827">291-XX-XXXX</text></svg>`
  );
  const afterSvg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1160"><rect width="900" height="1160" fill="#F2FBF9"/><text x="60" y="90" font-size="44" fill="#067F75">[NAME]</text><text x="60" y="150" font-size="32" fill="#067F75">[SSN]</text></svg>`
  );

  return {
    status: "blocked",
    blocked: true,
    host: "chatgpt.com",
    modelState: "regex-ready",
    updatedAt: Date.now(),
    text: "Aisha Patel 291-XX-XXXX",
    redactedText: "[NAME] [SSN]",
    entities: [
      {
        id: "name",
        category: "private_person",
        label: "Full Name",
        text: "Aisha Patel",
        start: 0,
        end: 12,
        confidence: 0.9,
        source: "regex",
        severity: "medium",
      },
      {
        id: "ssn",
        category: "ssn",
        label: "SSN",
        text: "291-XX-XXXX",
        start: 13,
        end: 24,
        confidence: 0.99,
        source: "regex",
        severity: "high",
      },
    ],
    attachment: {
      status: "blocked",
      originalName: "contract.pdf",
      redactedName: "redacted-contract.pdf",
      kind: "pdf",
      beforePreview: {
        type: "image",
        value: `data:image/svg+xml,${previewSvg}`,
        label: "Original PDF preview",
      },
      afterPreview: {
        type: "image",
        value: `data:image/svg+xml,${afterSvg}`,
        label: "Redacted PDF text",
      },
      detectedCount: 2,
      files: [
        {
          name: "contract.pdf",
          kind: "pdf",
          status: "redactable",
          detectedCount: 2,
          redactedName: "redacted-contract.pdf",
        },
      ],
    },
  };
}

function unsupportedAttachmentState() {
  return {
    status: "blocked",
    blocked: true,
    host: "chatgpt.com",
    modelState: "upload-unsupported",
    updatedAt: Date.now(),
    text: "",
    redactedText: "",
    entities: [],
    attachment: {
      status: "blocked",
      originalName: "private-notes.docx",
      files: [
        {
          name: "private-notes.docx",
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          status: "unsupported",
          reason: "This file type is not scanned yet.",
        },
      ],
      issueFiles: [
        {
          name: "private-notes.docx",
          status: "unsupported",
          reason: "This file type is not scanned yet.",
        },
      ],
      redactionBlockedByIssues: true,
    },
  };
}

function mixedAttachmentState() {
  return {
    ...unsupportedAttachmentState(),
    entities: [
      {
        id: "ssn",
        category: "ssn",
        label: "SSN",
        text: "291-XX-XXXX",
        start: 0,
        end: 11,
        confidence: 0.99,
        source: "regex",
        severity: "high",
      },
    ],
    attachment: {
      status: "blocked",
      originalName: "3 files",
      files: [
        {
          name: "contract.txt",
          kind: "text",
          status: "redactable",
          detectedCount: 1,
          redactedName: "redacted-contract.txt",
        },
        {
          name: "notes.txt",
          kind: "text",
          status: "clean",
          detectedCount: 0,
        },
        {
          name: "private-notes.docx",
          status: "unsupported",
          reason: "This file type is not scanned yet.",
        },
      ],
      issueFiles: [
        {
          name: "private-notes.docx",
          status: "unsupported",
          reason: "This file type is not scanned yet.",
        },
      ],
      redactionBlockedByIssues: true,
    },
  };
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
  throw new Error("Vite preview did not start on port 4174");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
