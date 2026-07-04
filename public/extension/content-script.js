(() => {
  if (window.__privacyLensLoaded) return;
  window.__privacyLensLoaded = true;

  const SEVERITY = {
    account_number: "high",
    secret: "high",
    employee_id: "high",
    ssn: "high",
    credit_card: "high",
    private_person: "medium",
    private_address: "medium",
    private_email: "low",
    private_phone: "low",
    private_date: "low",
    private_url: "low",
  };

  const LABELS = {
    private_person: "Full Name",
    private_email: "Email Address",
    private_phone: "Phone Number",
    private_address: "Home Address",
    private_date: "Date",
    private_url: "URL",
    account_number: "Account Number",
    secret: "Secret",
    employee_id: "Employee ID",
    ssn: "SSN",
    credit_card: "Credit Card",
  };

  const REDACTION = {
    private_person: "[NAME]",
    private_email: "[EMAIL]",
    private_phone: "[PHONE]",
    private_address: "[ADDRESS]",
    private_date: "[DATE]",
    private_url: "[URL]",
    account_number: "[ACCOUNT]",
    secret: "[SECRET]",
    employee_id: "[EMPLOYEE ID]",
    ssn: "[SSN]",
    credit_card: "[CREDIT CARD]",
  };

  const MAX_REVIEW_FILE_BYTES = 8 * 1024 * 1024;

  const PATTERNS = [
    [/\b\d{3}-\d{2}-\d{4}\b/g, "ssn", 0.99],
    [/\b\d{3}[-\s]?X{2}[-\s]?X{4}\b/gi, "ssn", 0.96],
    [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "private_email", 0.95],
    [/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "private_phone", 0.9],
    [/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, "credit_card", 0.95],
    [/\b(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])\/(?:19|20)\d{2}\b/g, "private_date", 0.85],
    [/\b(?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\b/g, "private_date", 0.85],
    [/\bEMP-\d{3,8}\b/gi, "employee_id", 0.92],
    [/\b(?:employee\s+id|emp(?:loyee)?\s*#?)\s*(?:is|:)?\s*([A-Z]{2,5}-?\d{3,8})\b/gi, "employee_id", 0.93],
    [/\b(?:sk|pk|api[_-]?key|token|secret|password|passwd|pwd)[-_]?[a-zA-Z0-9_]{16,}\b/gi, "secret", 0.9],
    [/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}\b/g, "secret", 0.95],
    [/\bAKIA[0-9A-Z]{16}\b/g, "secret", 0.95],
    [/\b\d{1,6}\s+[A-Z][A-Za-z0-9.'-]*(?:\s+[A-Z][A-Za-z0-9.'-]*){0,4}\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Way|Court|Ct|Circle|Cir|Terrace|Ter|Place|Pl)\b(?:\s+(?:Apt|Unit|Suite|Ste|#)\s*[A-Za-z0-9-]+)?(?:,?\s+[A-Z][A-Za-z.'-]+(?:\s+[A-Z][a-z.'-]+){0,2})?(?:\s+[A-Z]{2}\s+\d{5}(?:-\d{4})?)?/g, "private_address", 0.88],
    [/\b(?:between|by|for|from|name is|i am|i'm)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/g, "private_person", 0.72],
  ];

  const SITE_ADAPTERS = [
    {
      id: "chatgpt",
      label: "ChatGPT",
      hostPattern: /(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/,
      composerSelectors: [
        "#prompt-textarea",
        "[data-testid='composer-text-input']",
        "textarea[placeholder]",
        "div[contenteditable='true'][data-placeholder]",
        "div[contenteditable='true']",
      ],
      sendSelectors: [
        "button[data-testid='send-button']",
        "button[aria-label='Send prompt']",
        "button[aria-label='Send message']",
        "form button[type='submit']",
      ],
    },
    {
      id: "claude",
      label: "Claude",
      hostPattern: /(^|\.)claude\.ai$/,
      composerSelectors: [
        "div[contenteditable='true'][enterkeyhint]",
        "div.ProseMirror[contenteditable='true']",
        "textarea[placeholder]",
        "div[contenteditable='true']",
      ],
      sendSelectors: [
        "button[aria-label*='Send']",
        "button[data-testid*='send']",
        "form button[type='submit']",
      ],
    },
    {
      id: "gemini",
      label: "Gemini",
      hostPattern: /(^|\.)gemini\.google\.com$/,
      composerSelectors: [
        "rich-textarea div[contenteditable='true']",
        "div[contenteditable='true'][aria-label]",
        "textarea[placeholder]",
        "div[contenteditable='true']",
      ],
      sendSelectors: [
        "button[aria-label*='Send']",
        "button[aria-label*='Submit']",
        "button[type='submit']",
      ],
    },
    {
      id: "perplexity",
      label: "Perplexity",
      hostPattern: /(^|\.)perplexity\.ai$/,
      composerSelectors: [
        "textarea[placeholder]",
        "div[contenteditable='true']",
        "form textarea",
      ],
      sendSelectors: [
        "button[aria-label*='Submit']",
        "button[aria-label*='Send']",
        "form button[type='submit']",
      ],
    },
    {
      id: "copilot",
      label: "Copilot",
      hostPattern: /(^|\.)copilot\.microsoft\.com$/,
      composerSelectors: [
        "textarea[placeholder]",
        "div[contenteditable='true'][aria-label]",
        "div[contenteditable='true']",
      ],
      sendSelectors: [
        "button[aria-label*='Submit']",
        "button[aria-label*='Send']",
        "button[type='submit']",
      ],
    },
  ];

  const GENERIC_ADAPTER = {
    id: "generic",
    label: "AI chat",
    composerSelectors: [
      "#prompt-textarea",
      "[data-testid='composer-text-input']",
      "textarea[placeholder]",
      "form textarea",
      "div[contenteditable='true'][data-placeholder]",
      "div[contenteditable='true']",
    ],
    sendSelectors: [
      "button[data-testid='send-button']",
      "button[aria-label='Send prompt']",
      "button[aria-label='Send message']",
      "button[aria-label*='Send']",
      "button[aria-label*='Submit']",
      "form button[type='submit']",
    ],
  };

  const HIGHLIGHT_NAME = "privacylens-pii-highlight";

  let lastState = makeState();
  let activeScan = null;
  let typingTimer = null;
  let allowSendUntil = 0;
  let allowSendText = "";
  let panelOpenedForSignature = "";
  let pendingAttachmentReview = null;
  let panelFallback = null;
  const syntheticAttachmentInputs = new WeakSet();

  function makeState(overrides = {}) {
    return {
      status: "idle",
      blocked: false,
      entities: [],
      text: "",
      redactedText: "",
      modelState: "regex-ready",
      host: location.hostname,
      adapter: getAdapter().label,
      updatedAt: Date.now(),
      ...overrides,
    };
  }

  function getAdapter() {
    return SITE_ADAPTERS.find((adapter) => adapter.hostPattern.test(location.hostname)) || GENERIC_ADAPTER;
  }

  function installHighlightStyles() {
    if (document.getElementById("privacylens-highlight-style")) return;
    if (!document.documentElement) {
      document.addEventListener("DOMContentLoaded", installHighlightStyles, { once: true });
      return;
    }
    const style = document.createElement("style");
    style.id = "privacylens-highlight-style";
    style.textContent = `
      ::highlight(${HIGHLIGHT_NAME}) {
        background: rgba(229, 77, 46, 0.18);
        color: inherit;
        text-decoration: underline;
        text-decoration-color: rgba(229, 77, 46, 0.6);
        text-decoration-thickness: 2px;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function clearHighlights() {
    if ("highlights" in CSS) {
      CSS.highlights.delete(HIGHLIGHT_NAME);
    }
  }

  function visible(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function getComposer() {
    const active = document.activeElement;
    if (active?.matches?.("textarea, [contenteditable='true']")) return active;

    const selectors = getAdapter().composerSelectors;

    for (const selector of selectors) {
      const matches = Array.from(document.querySelectorAll(selector)).filter(visible);
      if (matches.length) return matches[matches.length - 1];
    }

    return null;
  }

  function getComposerText() {
    const composer = getComposer();
    if (!composer) return "";
    if ("value" in composer) return composer.value || "";
    return composer.innerText || composer.textContent || "";
  }

  function setComposerText(text) {
    const composer = getComposer();
    if (!composer) return false;
    composer.focus();

    if ("value" in composer) {
      composer.value = text;
      composer.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
      composer.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(composer);
    selection?.removeAllRanges();
    selection?.addRange(range);

    const inserted = document.execCommand?.("insertText", false, text);
    if (!inserted) composer.textContent = text;
    composer.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    return true;
  }

  function findSendButton() {
    const selectors = getAdapter().sendSelectors;

    for (const selector of selectors) {
      const button = document.querySelector(selector);
      if (button && visible(button)) return button;
    }

    return Array.from(document.querySelectorAll("button"))
      .filter(visible)
      .find((button) => /send/i.test(button.getAttribute("aria-label") || button.textContent || ""));
  }

  function isSendButton(button) {
    if (!button || button.tagName !== "BUTTON") return false;
    const text = `${button.getAttribute("aria-label") || ""} ${button.getAttribute("data-testid") || ""} ${button.textContent || ""}`;
    return /send|submit/i.test(text);
  }

  function textNodeRanges(root, entities) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let offset = 0;

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const length = node.textContent?.length || 0;
      nodes.push({ node, start: offset, end: offset + length });
      offset += length;
    }

    const ranges = [];
    for (const entity of entities) {
      const startNode = nodes.find((node) => entity.start >= node.start && entity.start <= node.end);
      const endNode = nodes.find((node) => entity.end >= node.start && entity.end <= node.end);
      if (!startNode || !endNode) continue;

      const range = document.createRange();
      range.setStart(startNode.node, Math.max(0, entity.start - startNode.start));
      range.setEnd(endNode.node, Math.max(0, entity.end - endNode.start));
      ranges.push(range);
    }

    return ranges;
  }

  function highlightComposer(entities) {
    const composer = getComposer();
    if (!composer || !("highlights" in CSS) || !window.Highlight) {
      clearHighlights();
      return;
    }

    if (composer.matches?.("textarea")) {
      clearHighlights();
      composer.dataset.privacylensDetected = entities.length ? String(entities.length) : "";
      return;
    }

    const ranges = textNodeRanges(composer, entities);
    if (!ranges.length) {
      clearHighlights();
      return;
    }

    CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(...ranges));
  }

  function entityId(entity) {
    return `${entity.category}:${entity.start}:${entity.end}:${entity.text}`;
  }

  function scanWithRegex(text) {
    const raw = [];

    for (const [pattern, category, confidence] of PATTERNS) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;

      while ((match = regex.exec(text)) !== null) {
        const matchedText = match[1] || match[0];
        const start = match.index + match[0].indexOf(matchedText);
        raw.push({
          id: "",
          category,
          label: LABELS[category],
          text: matchedText,
          start,
          end: start + matchedText.length,
          confidence,
          source: "regex",
          severity: SEVERITY[category],
        });
      }
    }

    return mergeEntities(raw).map((entity) => ({ ...entity, id: entityId(entity) }));
  }

  function mergeEntities(entities) {
    const sorted = [...entities].sort((a, b) => a.start - b.start || b.confidence - a.confidence);
    const merged = [];

    for (const entity of sorted) {
      const last = merged[merged.length - 1];
      if (last && entity.start < last.end) {
        if (entity.confidence > last.confidence) {
          merged[merged.length - 1] = entity;
        }
      } else {
        merged.push(entity);
      }
    }

    return merged;
  }

  function redactText(text, entities) {
    const sorted = [...entities].sort((a, b) => a.start - b.start);
    let redacted = "";
    let cursor = 0;

    for (const entity of sorted) {
      if (entity.start < cursor) continue;
      redacted += text.slice(cursor, entity.start);
      redacted += REDACTION[entity.category] || "[REDACTED]";
      cursor = entity.end;
    }

    return redacted + text.slice(cursor);
  }

  function sendRuntimeMessage(message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (response) => resolve(response));
      } catch {
        resolve(undefined);
      }
    });
  }

  function ensurePanelFallback() {
    if (panelFallback) return panelFallback;
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", ensurePanelFallback, { once: true });
      return null;
    }

    panelFallback = document.createElement("div");
    panelFallback.id = "privacylens-panel-fallback";
    panelFallback.setAttribute("role", "alert");
    panelFallback.style.cssText = [
      "position:fixed",
      "right:18px",
      "bottom:18px",
      "z-index:2147483647",
      "width:min(360px,calc(100vw - 36px))",
      "box-sizing:border-box",
      "border:1px solid rgba(229,77,46,.22)",
      "border-radius:12px",
      "background:#fff",
      "box-shadow:0 18px 48px rgba(15,23,42,.18)",
      "color:#111827",
      "font:13px/1.45 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif",
      "padding:14px",
      "display:none",
    ].join(";");
    panelFallback.innerHTML = `
      <div style="display:flex;gap:10px;align-items:flex-start">
        <div style="display:flex;height:28px;width:28px;align-items:center;justify-content:center;border-radius:999px;background:rgba(229,77,46,.08);color:#E54D2E;font-weight:800">!</div>
        <div style="min-width:0;flex:1">
          <div style="font-weight:800">PrivacyLens paused this send or upload</div>
          <div style="margin-top:2px;color:#5F6B7A">Chrome did not open the review panel automatically. Open PrivacyLens to choose what gets redacted, kept, or left out.</div>
          <div style="margin-top:10px;display:flex;gap:8px">
            <button type="button" data-privacylens-open-panel style="border:0;border-radius:8px;background:#079B8E;color:#fff;padding:8px 10px;font-weight:800;cursor:pointer">Open review</button>
            <button type="button" data-privacylens-dismiss style="border:1px solid #E8E5DF;border-radius:8px;background:#fff;color:#697386;padding:8px 10px;font-weight:700;cursor:pointer">Keep paused</button>
          </div>
        </div>
      </div>
    `;
    panelFallback.querySelector("[data-privacylens-open-panel]")?.addEventListener("click", async () => {
      const response = await sendRuntimeMessage({ type: "PRIVACYLENS_OPEN_PANEL", userGesture: true });
      if (response?.opened) hidePanelFallback();
    });
    panelFallback.querySelector("[data-privacylens-dismiss]")?.addEventListener("click", hidePanelFallback);
    document.body.appendChild(panelFallback);
    return panelFallback;
  }

  function showPanelFallback() {
    const element = ensurePanelFallback();
    if (element) element.style.display = "block";
  }

  function hidePanelFallback() {
    if (panelFallback) panelFallback.style.display = "none";
  }

  function allowImmediateSend(text = getComposerText()) {
    allowSendText = text || "";
    allowSendUntil = Date.now() + 2000;
  }

  async function scanText(text) {
    const regexEntities = scanWithRegex(text);
    const modelResponse = await sendRuntimeMessage({
      type: "PRIVACYLENS_SCAN_TEXT",
      text,
    });

    const modelEntities = Array.isArray(modelResponse?.entities) ? modelResponse.entities : [];
    const entities = mergeEntities([...regexEntities, ...modelEntities]).map((entity) => ({
      ...entity,
      id: entity.id || entityId(entity),
      label: entity.label || LABELS[entity.category] || entity.category,
      severity: entity.severity || SEVERITY[entity.category] || "low",
    }));

    return {
      entities,
      modelState: modelResponse?.modelState || "regex-ready",
    };
  }

  function isTextFile(file) {
    return (
      file.type.startsWith("text/") ||
      /\.(txt|md|csv|json|log)$/i.test(file.name)
    );
  }

  function isPDFFile(file) {
    return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  }

  function isImageFile(file) {
    return file.type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(file.name);
  }

  function isSupportedFile(file) {
    return isTextFile(file) || isPDFFile(file) || isImageFile(file);
  }

  async function loadFileScanner() {
    if (!chrome?.runtime?.getURL) return null;
    try {
      const scanner = await import(chrome.runtime.getURL("extension/file-scanner.js"));
      return scanner.privacyLensFileScanner || globalThis.privacyLensFileScanner || scanner;
    } catch {
      return null;
    }
  }

  async function extractFileText(file) {
    if (isTextFile(file)) {
      return {
        name: file.name,
        kind: "text",
        text: await file.text(),
      };
    }

    const scanner = await loadFileScanner();
    if (!scanner?.extractFileText) {
      throw new Error("PDF/image scanner unavailable");
    }

    return scanner.extractFileText(file);
  }

  async function createRedactedAttachment(file, extractedText, entities) {
    const scanner = await loadFileScanner();
    if (scanner?.createRedactedAttachment) {
      return scanner.createRedactedAttachment(file, extractedText, entities);
    }

    const redactedText = redactText(extractedText, entities);
    return {
      originalName: file.name,
      redactedName: `redacted-${file.name}`,
      kind: "text",
      originalMimeType: file.type || "text/plain",
      redactedMimeType: "text/plain",
      extractedText,
      redactedText,
      beforePreview: {
        type: "text",
        value: extractedText,
        label: "Original text",
      },
      afterPreview: {
        type: "text",
        value: redactedText,
        label: "Redacted text",
      },
      redactedDataUrl: await blobToDataUrl(new Blob([redactedText], { type: "text/plain" })),
    };
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error || new Error("Unable to read blob"));
      reader.readAsDataURL(blob);
    });
  }

  function dataUrlToFile(dataUrl, name, type) {
    const [header, encoded = ""] = dataUrl.split(",");
    const mimeType = type || header.match(/^data:([^;]+)/)?.[1] || "application/octet-stream";
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new File([bytes], name, { type: mimeType });
  }

  function filesMatch(fileList, files) {
    if (!fileList || fileList.length !== files.length) return false;
    return files.every((file, index) => {
      const assigned = fileList[index];
      return assigned &&
        assigned.name === file.name &&
        assigned.size === file.size &&
        assigned.type === file.type;
    });
  }

  function setInputFiles(input, files) {
    if (typeof DataTransfer === "undefined") return false;
    const targetInput = input?.isConnected ? input : document.querySelector("input[type='file']");
    if (!targetInput) return false;

    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(file);
    targetInput.files = transfer.files;
    if (!filesMatch(targetInput.files, files)) return false;
    syntheticAttachmentInputs.add(targetInput);
    targetInput.dispatchEvent(new Event("input", { bubbles: true }));
    targetInput.dispatchEvent(new Event("change", { bubbles: true }));
    return filesMatch(targetInput.files, files);
  }

  function attachmentPartContext(parts, entities) {
    let cursor = 0;
    const contexts = parts.map((part) => {
      const prefix = `[Attached ${part.kind} file: ${part.name}]\n`;
      const textStart = cursor + prefix.length;
      const textEnd = textStart + part.text.length;
      cursor = textEnd + 2;
      return {
        ...part,
        prefix,
        textStart,
        textEnd,
      };
    });

    const items = contexts
      .map((part) => ({
        part,
        entities: entities
          .filter((entity) => entity.start >= part.textStart && entity.end <= part.textEnd)
          .map((entity) => ({
            ...entity,
            start: entity.start - part.textStart,
            end: entity.end - part.textStart,
          })),
      }));
    const primary = items.find((item) => item.entities.length > 0);

    return { contexts, items, primary };
  }

  function attachmentSummaryName(files) {
    if (files.length === 0) return "Attachment";
    if (files.length === 1) return files[0].name;
    return `${files.length} files`;
  }

  function unsupportedIssue(file) {
    return {
      name: file.name,
      type: file.type || "unknown",
      status: "unsupported",
      reason: "This file type is not scanned yet.",
    };
  }

  function formatBytes(bytes) {
    if (bytes >= 1024 * 1024) return `${Math.round(bytes / 1024 / 1024)} MB`;
    if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${bytes} bytes`;
  }

  function oversizedIssue(file) {
    return {
      name: file.name,
      type: file.type || "unknown",
      status: "unscannable",
      reason: `This file is ${formatBytes(file.size)}. PrivacyLens scans files up to ${formatBytes(MAX_REVIEW_FILE_BYTES)}.`,
    };
  }

  function unscannableIssue(file, reason = "PrivacyLens could not read text from this file.") {
    return {
      name: file.name,
      type: file.type || "unknown",
      status: "unscannable",
      reason,
    };
  }

  function attachmentFileRows(scannedFiles, issueFiles) {
    return [
      ...scannedFiles.map((record) => {
        const detectedCount = record.item?.entities?.length || 0;
        return {
          name: record.file.name,
          kind: record.part?.kind || "file",
          status: detectedCount > 0 ? "redactable" : "clean",
          detectedCount,
          redactedName: record.attachment?.redactedName,
        };
      }),
      ...issueFiles,
    ];
  }

  function originalSelectedFile(file, filesToRestore) {
    return filesToRestore.find((candidate) =>
      candidate.name === file.name &&
      candidate.size === file.size &&
      candidate.type === file.type
    ) || file;
  }

  async function scanAttachedFiles(files, { insertIfClean = false, source = "file", input = null, originalFiles = null } = {}) {
    const filesToRestore = originalFiles ? Array.from(originalFiles) : Array.from(files);
    const selectedFiles = filesToRestore.slice(0, 5);
    if (selectedFiles.length === 0) return false;
    const unsupportedFiles = selectedFiles.filter((file) => !isSupportedFile(file));
    const oversizedFiles = selectedFiles.filter((file) => isSupportedFile(file) && file.size > MAX_REVIEW_FILE_BYTES);
    const supportedFiles = selectedFiles.filter((file) => isSupportedFile(file) && file.size <= MAX_REVIEW_FILE_BYTES);
    const issueFiles = [
      ...unsupportedFiles.map(unsupportedIssue),
      ...oversizedFiles.map(oversizedIssue),
    ];
    const skippedFiles = filesToRestore.slice(5).map((file) => ({
      name: file.name,
      type: file.type || "unknown",
      status: "skipped",
      reason: "Only the first 5 files can be reviewed at once.",
    }));
    issueFiles.push(...skippedFiles);

    await updateState(makeState({
      status: "scanning",
      text: "",
      modelState: `${source}-scan`,
      attachment: {
        status: "scanning",
        originalName: attachmentSummaryName(selectedFiles),
        files: [
          ...supportedFiles.map((file) => ({ name: file.name, status: "scanning" })),
          ...issueFiles,
        ],
      },
    }));
    await openPanel();

    if (supportedFiles.length === 0) {
      pendingAttachmentReview = {
        input,
        filesToRestore,
        scannedFiles: [],
        issueFiles,
        redactionBlockedByIssues: true,
      };
      await updateState(makeState({
        status: "blocked",
        blocked: true,
        entities: [],
        text: "",
        redactedText: "",
        modelState: `${source}-unsupported`,
        attachment: {
          status: "blocked",
          originalName: attachmentSummaryName(selectedFiles),
          files: issueFiles,
          issueFiles,
          redactionBlockedByIssues: true,
        },
      }));
      await openPanel();
      return true;
    }

    const settledParts = await Promise.allSettled(
      supportedFiles.map(async (file) => ({
        file,
        ...(await extractFileText(file)),
      }))
    );
    const parts = [];
    const emptyTextFiles = [];

    settledParts.forEach((result, index) => {
      const file = supportedFiles[index];
      if (result.status === "rejected") {
        issueFiles.push(unscannableIssue(file, result.reason?.message || "PrivacyLens could not scan this file."));
        return;
      }

      if (!result.value.text.trim()) {
        if (result.value.kind === "text") {
          emptyTextFiles.push(result.value);
        } else {
          issueFiles.push(unscannableIssue(file, "No readable text was found, so this file cannot be cleared automatically."));
        }
        return;
      }

      parts.push(result.value);
    });

    if (parts.length === 0) {
      if (issueFiles.length > 0) {
        pendingAttachmentReview = {
          input,
          filesToRestore,
          scannedFiles: emptyTextFiles.map((part) => ({ file: part.file, part, item: null, attachment: null })),
          issueFiles,
          redactionBlockedByIssues: true,
        };
        await updateState(makeState({
          status: "blocked",
          blocked: true,
          entities: [],
          text: "",
          redactedText: "",
          modelState: `${source}-unscannable`,
          attachment: {
            status: "blocked",
            originalName: attachmentSummaryName(selectedFiles),
            files: attachmentFileRows(pendingAttachmentReview.scannedFiles, issueFiles),
            issueFiles,
            redactionBlockedByIssues: true,
          },
        }));
        await openPanel();
        return true;
      }

      await updateState(makeState({
        status: "clean",
        text: "",
        modelState: `${source}-scan-empty`,
      }));
      if (input) setInputFiles(input, filesToRestore);
      return true;
    }

    const combinedText = parts
      .map((part) => `[Attached ${part.kind} file: ${part.name}]\n${part.text}`)
      .join("\n\n");
    const { entities, modelState } = await scanText(combinedText);
    const { items, primary } = attachmentPartContext(parts, entities);
    const scannedFiles = supportedFiles.map((file) => {
      const part = [...parts, ...emptyTextFiles].find((item) => item.file === file) || null;
      const item = part ? items.find((candidate) => candidate.part.file === file) || null : null;
      return { file, part, item, attachment: null };
    });

    if (entities.length > 0 || issueFiles.length > 0) {
      await updateState(makeState({
        status: "blocked",
        blocked: true,
        entities,
        text: combinedText,
        redactedText: redactText(combinedText, entities),
        modelState,
        attachment: {
          status: "preparing",
          originalName: attachmentSummaryName(selectedFiles),
          files: attachmentFileRows(scannedFiles, issueFiles),
          issueFiles,
          redactionBlockedByIssues: issueFiles.length > 0,
        },
      }));

      let previewAttachment = null;
      for (const record of scannedFiles) {
        if (!record.item?.entities?.length || !record.part) continue;
        record.attachment = await createRedactedAttachment(
          record.file,
          record.part.text,
          record.item.entities
        );
        previewAttachment ||= record.attachment;
      }

      pendingAttachmentReview = {
        input,
        filesToRestore,
        scannedFiles,
        issueFiles,
        redactionBlockedByIssues: issueFiles.length > 0,
      };

      await updateState(makeState({
        status: "blocked",
        blocked: true,
        entities,
        text: combinedText,
        redactedText: redactText(combinedText, entities),
        modelState,
        attachment: {
          ...(previewAttachment || {}),
          status: "blocked",
          originalName: attachmentSummaryName(selectedFiles),
          redactedName: previewAttachment?.redactedName,
          detectedCount: primary?.entities?.length || 0,
          files: attachmentFileRows(scannedFiles, issueFiles),
          issueFiles,
          redactionBlockedByIssues: issueFiles.length > 0,
        },
      }));

      await openPanel();
      return true;
    }

    if (insertIfClean) {
      setComposerText([getComposerText(), combinedText].filter(Boolean).join("\n\n"));
    }

    if (input) setInputFiles(input, filesToRestore);

    await updateState(makeState({
      status: "clean",
      text: combinedText,
      modelState,
    }));
    return true;
  }

  async function updateState(nextState) {
    lastState = makeState(nextState);
    if (lastState.status === "scanning" || lastState.blocked) {
      allowSendUntil = 0;
      allowSendText = "";
      clearTimeout(typingTimer);
    }
    highlightComposer(lastState.entities || []);
    if (!lastState.entities?.length) panelOpenedForSignature = "";
    if (!lastState.blocked && lastState.status !== "scanning") hidePanelFallback();
    await sendRuntimeMessage({
      type: "PRIVACYLENS_STATE_UPDATE",
      state: lastState,
    });
  }

  async function openPanel() {
    const response = await sendRuntimeMessage({ type: "PRIVACYLENS_OPEN_PANEL" });
    if ((!response || response.opened === false) && (lastState.blocked || lastState.status === "scanning")) {
      showPanelFallback();
    }
    return response;
  }

  async function openPanelForEntities(entities) {
    if (!entities?.length) return;
    const signature = entities.map((entity) => entity.id).join("|");
    if (signature === panelOpenedForSignature) return;
    panelOpenedForSignature = signature;
    await openPanel();
  }

  function captureSendEvent(event, button) {
    if (Date.now() < allowSendUntil) {
      if (getComposerText() === allowSendText) return;
      allowSendUntil = 0;
      allowSendText = "";
    }

    if (lastState.status === "scanning" || lastState.blocked) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      openPanel();
      return;
    }

    const text = getComposerText();
    if (!text.trim()) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    openPanel();
    handleSendAttempt(button || findSendButton());
  }

  async function handleSendAttempt(button) {
    if (activeScan) return activeScan;

    const text = getComposerText();
    activeScan = (async () => {
      await updateState(makeState({ status: "scanning", text, modelState: "scanning" }));
      const { entities, modelState } = await scanText(text);
      const modelUnavailable = modelState?.includes?.("model-unavailable");

      if (entities.length === 0 && !modelUnavailable) {
        await updateState(makeState({ status: "clean", text, modelState }));
        allowImmediateSend(text);
        setTimeout(() => {
          (button || findSendButton())?.click();
        }, 40);
        return;
      }

      const redactedText = redactText(text, entities);
      await updateState(makeState({
        status: "blocked",
        blocked: true,
        entities,
        text,
        redactedText: entities.length ? redactedText : text,
        modelState,
      }));
      await openPanelForEntities(entities);
    })().finally(() => {
      activeScan = null;
    });

    return activeScan;
  }

  function scheduleTypingScan() {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(async () => {
      if (lastState.attachment && (lastState.blocked || lastState.status === "scanning")) {
        return;
      }

      const text = getComposerText();
      if (!text.trim()) {
        clearHighlights();
        await updateState(makeState());
        return;
      }

      const entities = scanWithRegex(text);
      await updateState(makeState({
        status: entities.length ? "detected" : "idle",
        blocked: entities.length > 0,
        entities,
        text,
        redactedText: entities.length ? redactText(text, entities) : "",
        modelState: "regex-ready",
      }));
      await openPanelForEntities(entities);
    }, 180);
  }

  function handleFileInputEvent(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== "file" || !input.files?.length) return false;

    if (syntheticAttachmentInputs.has(input)) {
      if (event.type === "change") syntheticAttachmentInputs.delete(input);
      return true;
    }

    const originalFiles = Array.from(input.files);

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    input.value = "";

    openPanel();
    scanAttachedFiles(originalFiles, {
      insertIfClean: false,
      source: "upload",
      input,
      originalFiles,
    });
    return true;
  }

  document.addEventListener("input", (event) => {
    if (handleFileInputEvent(event)) return;

    const composer = getComposer();
    if (composer && (event.target === composer || composer.contains?.(event.target))) {
      scheduleTypingScan();
    }
  }, true);

  document.addEventListener("paste", (event) => {
    const files = event.clipboardData?.files;
    if (!files?.length) return;

    event.preventDefault();
    event.stopPropagation();
    openPanel();
    scanAttachedFiles(Array.from(files), { insertIfClean: true, source: "paste" });
  }, true);

  document.addEventListener("drop", (event) => {
    const files = event.dataTransfer?.files;
    if (!files?.length) return;

    event.preventDefault();
    event.stopPropagation();
    openPanel();
    scanAttachedFiles(Array.from(files), { insertIfClean: true, source: "drop" });
  }, true);

  document.addEventListener("change", (event) => {
    handleFileInputEvent(event);
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey || event.isComposing) {
      return;
    }

    const composer = getComposer();
    if (composer && (event.target === composer || composer.contains?.(event.target))) {
      captureSendEvent(event, findSendButton());
    }
  }, true);

  document.addEventListener("click", (event) => {
    const button = event.target?.closest?.("button");
    if (isSendButton(button)) captureSendEvent(event, button);
  }, true);

  document.addEventListener("submit", (event) => {
    const composer = getComposer();
    if (composer && event.target?.contains?.(composer)) {
      captureSendEvent(event, findSendButton());
    }
  }, true);

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "PRIVACYLENS_GET_CONTENT_STATE") {
      sendResponse({ ok: true, state: lastState });
      return true;
    }

    if (message.type === "PRIVACYLENS_APPLY_REDACTION") {
      const selected = new Set(message.entityIds || []);
      const text = getComposerText() || lastState.text;
      const entities = (lastState.entities || []).filter((entity) => selected.has(entity.id));
      const redacted = redactText(text, entities);
      const applied = setComposerText(redacted);
      updateState(makeState({
        status: "redacted",
        blocked: false,
        entities: [],
        text: redacted,
        redactedText: redacted,
        modelState: lastState.modelState,
      }));
      sendResponse({ ok: applied });
      return true;
    }

    if (message.type === "PRIVACYLENS_REDACT_AND_SEND") {
      const selected = new Set(message.entityIds || []);
      const text = getComposerText() || lastState.text;
      const allEntities = lastState.entities || [];
      const redactedEntities = allEntities.filter((entity) => selected.has(entity.id));
      const approvedEntities = allEntities.filter((entity) => !selected.has(entity.id));
      const outgoingText = redactText(text, redactedEntities);
      const applied = setComposerText(outgoingText);

      clearHighlights();
      updateState(makeState({
        status: "clean",
        blocked: false,
        entities: [],
        text: outgoingText,
        redactedText: outgoingText,
        modelState: lastState.modelState,
      }));

      if (applied) {
        allowImmediateSend();
        setTimeout(() => findSendButton()?.click(), 80);
      }

      sendResponse({
        ok: applied,
        redactedCount: redactedEntities.length,
        approvedCount: approvedEntities.length,
      });
      return true;
    }

    if (message.type === "PRIVACYLENS_REDACT_AND_ATTACH") {
      (async () => {
        const selected = new Set(message.entityIds || []);
        const allEntities = lastState.entities || [];
        const redactedEntities = allEntities.filter((entity) => selected.has(entity.id));
        const review = pendingAttachmentReview;

        if (!review?.scannedFiles?.length) {
          const fallbackText = redactText(lastState.text || getComposerText(), redactedEntities);
          const applied = setComposerText(fallbackText);
          await updateState(makeState({
            status: applied ? "redacted" : "blocked",
            blocked: !applied,
            entities: applied ? [] : allEntities,
            text: fallbackText,
            redactedText: fallbackText,
            modelState: lastState.modelState,
          }));
          sendResponse({ ok: applied, attached: false, fallback: "composer" });
          return;
        }

        const filesToAttach = [];
        const fallbackTexts = [];
        let previewAttachment = null;

        for (const record of review.scannedFiles) {
          if (!record.part) {
            filesToAttach.push(originalSelectedFile(record.file, review.filesToRestore || []));
            continue;
          }

          const localEntities = record.item?.entities || [];
          const selectedLocalEntities = localEntities.filter((entity) => selected.has(entity.id));

          if (selectedLocalEntities.length > 0) {
            const attachment =
              selectedLocalEntities.length === localEntities.length && record.attachment
                ? record.attachment
                : await createRedactedAttachment(record.file, record.part.text, selectedLocalEntities);
            previewAttachment ||= attachment;
            filesToAttach.push(dataUrlToFile(
              attachment.redactedDataUrl,
              attachment.redactedName,
              attachment.redactedMimeType
            ));
            fallbackTexts.push(`[Redacted attachment: ${attachment.redactedName}]\n${attachment.redactedText}`);
          } else {
            filesToAttach.push(originalSelectedFile(record.file, review.filesToRestore || []));
            fallbackTexts.push(`[Attachment kept visible: ${record.file.name}]\n${record.part.text}`);
          }
        }

        const attached = review.input && filesToAttach.length > 0
          ? setInputFiles(review.input, filesToAttach)
          : false;

        if (!attached) {
          const insertedText = fallbackTexts.join("\n\n");
          const applied = Boolean(insertedText) && setComposerText([getComposerText(), insertedText].filter(Boolean).join("\n\n"));
          await updateState(makeState({
            status: applied ? "redacted" : "blocked",
            blocked: !applied,
            entities: applied ? [] : allEntities,
            text: insertedText,
            redactedText: insertedText,
            modelState: lastState.modelState,
            attachment: {
              ...(previewAttachment || lastState.attachment || {}),
              status: applied ? "inserted" : "blocked",
              files: attachmentFileRows(review.scannedFiles, review.issueFiles || []),
            },
          }));
          sendResponse({ ok: applied, attached: false, fallback: "composer" });
          return;
        }

        pendingAttachmentReview = null;
        clearHighlights();
        await updateState(makeState({
          status: "redacted",
          blocked: false,
          entities: [],
          text: "",
          redactedText: "",
          modelState: lastState.modelState,
          attachment: {
            ...(previewAttachment || lastState.attachment || {}),
            status: "attached",
            files: attachmentFileRows(review.scannedFiles, review.issueFiles || []),
            attachedCount: filesToAttach.length,
            omittedCount: review.issueFiles?.length || 0,
          },
        }));
        sendResponse({
          ok: true,
          attached: true,
          names: filesToAttach.map((file) => file.name),
          omittedCount: review.issueFiles?.length || 0,
        });
      })().catch(async (error) => {
        await updateState(makeState({
          ...lastState,
          status: "blocked",
          blocked: true,
          modelState: `attach-error: ${error?.message || "unknown error"}`,
        }));
        sendResponse({ ok: false, error: error?.message || "Unable to redact attachment" });
      });
      return true;
    }

    if (message.type === "PRIVACYLENS_CANCEL_BLOCK") {
      clearHighlights();
      pendingAttachmentReview = null;
      updateState(makeState());
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === "PRIVACYLENS_SEND_ORIGINAL") {
      if (pendingAttachmentReview?.input && pendingAttachmentReview.filesToRestore?.length) {
        setInputFiles(pendingAttachmentReview.input, pendingAttachmentReview.filesToRestore);
        pendingAttachmentReview = null;
      }
      updateState(makeState());
      allowImmediateSend();
      setTimeout(() => findSendButton()?.click(), 40);
      sendResponse({ ok: true });
      return true;
    }

    return false;
  });

  installHighlightStyles();
  updateState(makeState());
})();
