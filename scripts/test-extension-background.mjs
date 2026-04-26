import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import vm from "node:vm";

const backgroundPath = resolve(import.meta.dirname, "../public/extension/background.js");
const source = await readFile(backgroundPath, "utf8");

const listeners = {
  runtimeMessage: null,
};
const openedTabs = [];
const contentState = {
  status: "blocked",
  blocked: true,
  entities: [{ id: "ssn", category: "ssn", text: "291-XX-XXXX" }],
  text: "SSN 291-XX-XXXX",
  redactedText: "SSN [SSN]",
  modelState: "regex-ready",
};

const chrome = {
  runtime: {
    onInstalled: { addListener() {} },
    onMessage: {
      addListener(listener) {
        listeners.runtimeMessage = listener;
      },
    },
    sendMessage() {
      return Promise.resolve();
    },
    getURL(path) {
      return `chrome-extension://test/${path}`;
    },
  },
  action: {
    onClicked: { addListener() {} },
    setBadgeText() {
      return Promise.resolve();
    },
    setBadgeBackgroundColor() {
      return Promise.resolve();
    },
  },
  sidePanel: {
    setPanelBehavior() {},
    open({ tabId }) {
      openedTabs.push(tabId);
      if (tabId === 13) return Promise.reject(new Error("user gesture required"));
      return Promise.resolve();
    },
  },
  tabs: {
    onRemoved: { addListener() {} },
    onUpdated: { addListener() {} },
    query() {
      return Promise.resolve([{ id: 42 }]);
    },
    sendMessage(tabId, message, callback) {
      if (message.type === "PRIVACYLENS_GET_CONTENT_STATE") {
        callback?.({ ok: true, state: contentState });
        return;
      }
      callback?.({ ok: true, tabId, message });
    },
  },
};

vm.runInNewContext(source, {
  chrome,
  console,
  setTimeout,
  clearTimeout,
  globalThis: {},
});

assert(typeof listeners.runtimeMessage === "function", "expected background runtime listener");

const recovered = await sendRuntimeMessage({
  type: "PRIVACYLENS_GET_STATE",
  tabId: 42,
});
assert(recovered?.state?.status === "blocked", "expected background to recover state from content script");
assert(recovered?.state?.entities?.length === 1, "expected recovered entity list");

const opened = await sendRuntimeMessage({
  type: "PRIVACYLENS_OPEN_PANEL",
  tabId: 42,
});
assert(opened?.opened === true, "expected successful side panel open response");

const failed = await sendRuntimeMessage({
  type: "PRIVACYLENS_OPEN_PANEL",
  tabId: 13,
});
assert(failed?.opened === false, "expected failed side panel open response");
assert(/user gesture/i.test(failed?.error || ""), "expected open failure reason");

const forwarded = await sendRuntimeMessage({
  type: "PRIVACYLENS_REDACT_AND_ATTACH",
  tabId: 42,
  entityIds: ["ssn"],
});
assert(forwarded?.ok === true, "expected redact-and-attach command to report content-script success");
assert(forwarded?.result?.message?.type === "PRIVACYLENS_REDACT_AND_ATTACH", "expected command delivery result");

console.log("extension background test passed");

function sendRuntimeMessage(message) {
  return new Promise((resolve) => {
    listeners.runtimeMessage(message, { tab: { id: message.tabId } }, resolve);
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
