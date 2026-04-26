const tabStates = new Map();
let modelScannerPromise = null;
const STATE_TTL_MS = 10 * 60 * 1000;

function emptyState() {
  return {
    status: "idle",
    blocked: false,
    entities: [],
    text: "",
    redactedText: "",
    modelState: "regex-ready",
    updatedAt: Date.now(),
  };
}

async function resolveTabId(explicitTabId, sender) {
  if (explicitTabId) return explicitTabId;
  if (sender?.tab?.id) return sender.tab.id;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab?.id;
  } catch {
    return undefined;
  }
}

async function updateBadge(tabId, state) {
  if (!tabId || !chrome?.action) return;

  const count = state?.entities?.length || 0;
  await chrome.action.setBadgeText({
    tabId,
    text: count > 0 ? String(count) : "",
  });
  await chrome.action.setBadgeBackgroundColor({
    tabId,
    color: state?.blocked ? "#E54D2E" : "#12A594",
  });
}

function publishState(tabId, state) {
  chrome.runtime
    .sendMessage({ type: "PRIVACYLENS_PANEL_STATE", tabId, state })
    .catch(() => undefined);
}

function clearTabState(tabId) {
  tabStates.delete(tabId);
  updateBadge(tabId, emptyState());
}

function pruneExpiredStates() {
  const now = Date.now();
  for (const [tabId, state] of tabStates.entries()) {
    if (now - (state.updatedAt || 0) > STATE_TTL_MS) {
      clearTabState(tabId);
    }
  }
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, message, (response) => resolve(response));
    } catch {
      resolve(undefined);
    }
  });
}

function saveState(tabId, nextState) {
  const state = { ...emptyState(), ...nextState, updatedAt: Date.now() };
  tabStates.set(tabId, state);
  updateBadge(tabId, state);
  publishState(tabId, state);
  return state;
}

async function getModelScanner() {
  if (!modelScannerPromise) {
    modelScannerPromise = import(chrome.runtime.getURL("extension/model-scanner.js"));
  }

  return modelScannerPromise;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true });
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch {
    // Some Chrome builds open the default side panel automatically.
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  clearTabState(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading" || changeInfo.url) {
    clearTabState(tabId);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    pruneExpiredStates();
    const tabId = await resolveTabId(message.tabId, sender);

    if (message.type === "PRIVACYLENS_STATE_UPDATE") {
      if (!tabId) return sendResponse({ ok: false });
      const state = saveState(tabId, message.state);
      return sendResponse({ ok: true, tabId, state });
    }

    if (message.type === "PRIVACYLENS_GET_STATE") {
      let state = tabId ? tabStates.get(tabId) : undefined;
      if (!state && tabId) {
        const recovered = await sendTabMessage(tabId, { type: "PRIVACYLENS_GET_CONTENT_STATE" });
        if (recovered?.state) {
          state = saveState(tabId, recovered.state);
        }
      }

      return sendResponse({
        ok: true,
        tabId,
        state: state || emptyState(),
      });
    }

    if (message.type === "PRIVACYLENS_OPEN_PANEL") {
      let opened = false;
      let error;
      if (tabId) {
        try {
          await chrome.sidePanel?.open?.({ tabId });
          opened = true;
        } catch (caught) {
          error = caught?.message || "Chrome did not open the side panel";
        }
      }
      return sendResponse({ ok: true, tabId, opened, error });
    }

    if (message.type === "PRIVACYLENS_SCAN_TEXT") {
      try {
        const scanner = await getModelScanner();
        const scanWithPrivacyFilter =
          scanner.scanWithPrivacyFilter ||
          globalThis.privacyLensModelScanner?.scanWithPrivacyFilter;
        if (!scanWithPrivacyFilter) throw new Error("model scanner export missing");
        const entities = await scanWithPrivacyFilter(message.text || "");
        return sendResponse({
          ok: true,
          entities,
          modelState: "model-ready",
        });
      } catch (error) {
        return sendResponse({
          ok: true,
          entities: [],
          modelState: `model-unavailable: ${error?.message || "unknown error"}`,
        });
      }
    }

    if (message.type === "PRIVACYLENS_APPLY_REDACTION") {
      if (!tabId) return sendResponse({ ok: false });
      const result = await sendTabMessage(tabId, {
        type: "PRIVACYLENS_APPLY_REDACTION",
        entityIds: message.entityIds || [],
      });
      return sendResponse({ ok: Boolean(result?.ok), tabId, result });
    }

    if (message.type === "PRIVACYLENS_REDACT_AND_SEND") {
      if (!tabId) return sendResponse({ ok: false });
      const result = await sendTabMessage(tabId, {
        type: "PRIVACYLENS_REDACT_AND_SEND",
        entityIds: message.entityIds || [],
      });
      return sendResponse({ ok: Boolean(result?.ok), tabId, result });
    }

    if (message.type === "PRIVACYLENS_REDACT_AND_ATTACH") {
      if (!tabId) return sendResponse({ ok: false });
      const result = await sendTabMessage(tabId, {
        type: "PRIVACYLENS_REDACT_AND_ATTACH",
        entityIds: message.entityIds || [],
      });
      return sendResponse({ ok: Boolean(result?.ok), tabId, result });
    }

    if (message.type === "PRIVACYLENS_CANCEL_BLOCK") {
      if (!tabId) return sendResponse({ ok: false });
      const result = await sendTabMessage(tabId, { type: "PRIVACYLENS_CANCEL_BLOCK" });
      if (result?.ok) saveState(tabId, emptyState());
      return sendResponse({ ok: Boolean(result?.ok), tabId, result });
    }

    if (message.type === "PRIVACYLENS_SEND_ORIGINAL") {
      if (!tabId) return sendResponse({ ok: false });
      const result = await sendTabMessage(tabId, { type: "PRIVACYLENS_SEND_ORIGINAL" });
      return sendResponse({ ok: Boolean(result?.ok), tabId, result });
    }

    return sendResponse({ ok: false });
  })();

  return true;
});
