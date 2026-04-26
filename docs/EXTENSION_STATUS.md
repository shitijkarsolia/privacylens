# PrivacyLens Extension Status

Last updated: 2026-04-26

## Progress

| Area | Status | Notes |
| --- | --- | --- |
| Landing page | Done | Root page matches the screenshot-style product direction. Existing chat demo is at `/demo`. |
| Demo website privacy gate | Done | `/demo` now mirrors the extension review model: real-time regex warning, send-blocking review, Redact/Keep choices, redacted-message send, multi-file scanning, unsupported/oversized fail-closed review, per-file safe attachment chips, and typed-text scanning even after files are attached. |
| Chrome MV3 shell | Done | Manifest, background service worker, content script, and side panel are emitted into `dist`. |
| ChatGPT send blocking | Done | Content script intercepts Enter, send button clicks, and submit events. |
| Regex PII scanner | Done | Detects name-pattern sample, email, phone, address, SSN, masked SSN, employee ID, credit card, and secrets. |
| Side panel review UI | Done | Shows risk rows with explicit Redact/Keep states, clearer send/attach actions, cancel, and a full keep override. |
| Multi-site adapters | Done | Added host permissions and selector adapters for ChatGPT, Claude, Gemini, Perplexity, and Copilot. |
| Composer highlighting | Done | Contenteditable composers use the CSS Highlight API; textarea sites fall back to panel/badge review. |
| Local audit feature | Removed | Extension no longer requests `storage`, no longer writes audit events, no longer shows audit counters, and the unused demo audit source was removed. |
| Extension icons/packaging | Done | Added 16/32/48/128 PNG icons and manifest icon metadata. |
| Extension file scanning | Done | Text, PDF, and image files pasted, dropped, or selected through file inputs are extracted/scanned and blocked when risky. PDF extraction, image OCR, redacted artifact generation, and preview data are bundled in `extension/file-scanner.js`. |
| ChatGPT attachment blocking | Done | File input changes are intercepted before ChatGPT receives the original file. Risky files keep the main send blocked until review is resolved. |
| Redact and attach | Done | The side panel can attach sanitized redacted files back into the original ChatGPT file input. Text files stay text, PDFs become sanitized redacted PDFs, and images become sanitized PNG previews from OCR text. |
| Multiple attachments | Done | Mixed uploads preserve clean scanned files, redact every risky scanned file selected for redaction, and attach the resulting set together. |
| Unsupported/unreadable attachments | Done | Unsupported or unreadable files fail closed: upload is paused, the panel names the file, and the safe action omits it unless the user explicitly attaches originals. |
| Attachment size guard | Done | Files over 8 MB fail closed as unscannable before extraction/OCR, preventing long scans and accidental passthrough. |
| Clean-send bypass guard | Done | The temporary clean-send allowance is tied to the exact composer text, so newly typed risky text inside the allowance window is scanned again. |
| Early file-input guard | Done | File inputs are intercepted on both `input` and `change` so page handlers do not see the original risky files before PrivacyLens clears the input. |
| File preview slider | Done | Side panel shows a before/after slider for blocked attachments. PDFs render the original first page and a redacted text preview; text files show before/after text. |
| Taste Skill UI/UX Ralph loops | Done | 10 UI/UX loops are tracked in `docs/UX_RALPH_LOOP.md`; full verification passed after the latest loop changes. |
| Automatic review opening | Done | When risky text or files are blocked, the extension requests the Chrome side panel automatically. If Chrome refuses the side-panel open request, an in-page review banner appears with an Open review action. |
| Service-worker state recovery | Done | The side panel can recover the current blocked/scanning state from the content script if the MV3 background worker restarted and lost its in-memory state. |
| Background state cleanup | Done | Background state is cleared on tab removal/navigation and pruned after a 10 minute TTL. |
| Model-unavailable fail-closed path | Done | Extension text sends block for review when the model scan fails and regex found no entities, rather than silently sending in degraded mode. |
| Permission hardening | Done | Removed the unused `scripting` permission from the MV3 manifest. |
| Agent improvement loop | Done | QA, UI/UX, and privacy review agents were run after demo parity work; high-impact fixes implemented include demo bypass blocking, per-file demo attachment chips, masked demo review rows, consistent file verbs, model-unavailable review, background state TTL/navigation cleanup, docs drift fixes, and expanded browser tests. |
| Install/onboarding page | Done | Added `/install` route and `docs/INSTALL_EXTENSION.md`. |
| Repeatable verification loop | Done | `npm run verify:extension` runs syntax checks, production build, extension fixture tests, background-worker tests, file redaction tests, side-panel UI tests, and demo website browser tests. |
| Local model in extension | Runtime-limited | Added a bundled `extension/model-scanner.js` module that loads `openai/privacy-filter` with Transformers.js from the MV3 service worker using the supported CPU path. Build passes, but direct Node smoke test of the browser bundle fails while resolving remote model files. Regex enforcement remains active if the model is unavailable. |
| Real ChatGPT E2E | Blocked by automation challenge | User confirmed ChatGPT can be tested without login, but Playwright in this environment is held on ChatGPT's "Just a moment..." challenge before the composer loads. Local ChatGPT-shaped fixture covers the extension behavior. |
| Local extension fixture E2E | Done | `npm run test:extension` injects the real content script into a local composer fixture and verifies blocking, highlighting, partial keep/send, attachment interception, and redacted reattach. |

## Verification Log

- `npm run build`: passing.
- `node --check public/extension/content-script.js`: passing.
- `node --check public/extension/background.js`: passing.
- `npm run verify:extension`: passing.
- `/install` route TypeScript/build verification: passing.
- `npm run test:extension`: passing.
- `npm run test:extension:background`: passing; verifies state recovery from the content script and side-panel open failure reporting.
- `npm run test:demo`: passing; Chromium drives `/demo` with mocked APIs and verifies redacted text send, Keep behavior, mixed per-file attach, typed-text blocking after attachments, unsupported-only blocking, oversized-file blocking, and screenshot capture at `output/playwright/demo-review.png`.
- Background command delivery fixture: passing; redact-and-attach actions now report content-script delivery results.
- Text file extension scan fixture: passing inside `npm run test:extension`.
- Redacted text attachment reattach fixture: passing inside `npm run test:extension`.
- Multiple text attachment fixture: passing; redacted risky files plus the clean original are attached together.
- Unsupported file fixture: passing; unsupported file is blocked and not attached automatically.
- Oversized file fixture: passing; files over 8 MB fail closed before the page receives them.
- Automatic side-panel fallback fixture: passing; when side-panel open reports failure, an in-page review banner appears.
- File input event fixture: passing; the page receives no original file during either `input` or `change` before PrivacyLens review.
- Clean-send bypass fixture: passing; changed risky text inside the clean-send allowance is blocked.
- `npm run test:extension:files`: passing for sample PDF text extraction, sample image OCR, redacted PDF generation, redacted PDF original-text absence, redacted image generation, and preview data against production `dist`.
- Side panel attachment-preview render check: passing; screenshot captured at `output/playwright/sidepanel-attachment.png`.
- Side panel unsupported-file render check: passing.
- Unauthenticated ChatGPT Playwright check: blocked by ChatGPT "Just a moment..." challenge before composer selectors loaded.
- Partial-redaction send fixture: passing; unselected Keep items are approved for the one send instead of blocking again.
- Side panel local route snapshot: passing after Redact/Keep button copy update.
- Bundled model hook: `npm run build` emits `dist/extension/model-scanner.js`, `transformers.web`, and ONNX WASM assets. Direct Node execution of the browser bundle fails at remote model file resolution; extension falls back to regex protection.
- Playwright `/install` desktop snapshot: passing.
- Playwright `/install` mobile viewport check: `scrollWidth === innerWidth`.
- Local regex sample test: detects the screenshot PII sample.
- Playwright visual pass: landing page desktop and mobile responsive checks completed.

## Remaining Architecture Risks

- The extension still sends raw review text/entity values through background state for the side panel. State is now cleared on navigation/removal and pruned after a 10 minute TTL, but the stronger architecture is to keep raw text only in the content script and send masked review spans to the panel.
- Demo browser tests mock `/api/model-status`, `/api/scan`, and `/api/chat` for deterministic UI coverage. A real backend/model smoke test is still needed for production confidence.
- Real ChatGPT automation is still blocked in this environment by the ChatGPT challenge page before the composer loads.
