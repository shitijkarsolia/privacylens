# Models & Detection Engine

Every model PrivacyLens uses, where it runs, and how detection degrades when a
model isn't available. For the tier-selection logic see
[ARCHITECTURE.md](ARCHITECTURE.md#detection-runs-in-tiers-graceful-degradation).

## At a glance

| Job | Model / engine | Runs | Source |
|---|---|---|---|
| **PII detection** | `openai/privacy-filter` (1.5B-param sparse MoE, ~50M active/token) via Transformers.js | Server **CPU** and in-browser **WebGPU** | [`server.ts`](../server.ts), [`src/lib/browser-model.ts`](../src/lib/browser-model.ts), [`src/extension/model-scanner.ts`](../src/extension/model-scanner.ts) |
| **PII detection (fallback)** | Regex — 15+ patterns (SSN, email, phone, credit card, dates, addresses, employee IDs, API keys/secrets) | Always, in-browser, on every keystroke | [`src/lib/regex-scanner.ts`](../src/lib/regex-scanner.ts) |
| **Image OCR** | Tesseract.js (`eng`), self-hosted runtime | In-browser / extension | [`src/lib/image-scanner.ts`](../src/lib/image-scanner.ts), [`src/lib/tesseract-config.ts`](../src/lib/tesseract-config.ts) |
| **PDF text** | `pdfjs-dist` (not a model) | In-browser / extension | [`src/lib/pdf-scanner.ts`](../src/lib/pdf-scanner.ts) |
| **Chat replies** | `claude-sonnet-4-20250514` via the Anthropic SDK | Server → Anthropic API (only if `ANTHROPIC_API_KEY` set) | [`server.ts`](../server.ts) |
| **Chat replies (fallback)** | Local rule-based "demo assistant" (no model) | Anywhere | [`src/lib/demo-assistant.ts`](../src/lib/demo-assistant.ts) |

## The detection model: `openai/privacy-filter`

- **Architecture:** sparse Mixture-of-Experts, ~1.5B total parameters but only
  ~50M active per token — deep semantic detection (contextual names, implied
  references) at speeds practical for the browser.
- **Task:** token classification (`aggregation_strategy: "simple"`), producing
  spans like `private_person`, `private_email`, `private_phone`,
  `private_address`, `private_date`, `private_url`, `account_number`, `secret`.
- **Two runtimes, one post-processor:** the server (CPU, `dtype: "q4"`) and the
  in-browser path (WebGPU, `dtype: "q4"`) both feed
  [`src/lib/model-entities.ts`](../src/lib/model-entities.ts) (`toEntities()` +
  `mergeAdjacentEntities()`) so they emit identical `PIIEntity` records.
- **Where weights come from:** Hugging Face, on first use. The browser caches
  them; the server downloads them at startup. This is the **only** outbound
  request the detector makes, and it's for model weights — never user content.

### Why WebGPU only in the browser
The 1.5B MoE is impractical on plain WASM, so the in-browser path requires
WebGPU. `hasWebGPU()` actually requests a GPU adapter (not just feature
detection) before downloading weights; if there's no adapter, the app uses the
regex tier instead of hanging. See [`src/lib/browser-model.ts`](../src/lib/browser-model.ts).

## Regex tier (always on)

The regex scanner is not just a fallback — it runs **instantly on every
keystroke** for live highlighting, and its results are merged with the model's
on a full scan. Patterns and severities live in
[`src/lib/regex-scanner.ts`](../src/lib/regex-scanner.ts) and
[`src/types.ts`](../src/types.ts) (`SEVERITY_MAP`, `REDACTION_LABELS`).

Severity tiers: **High** (SSN, credit card, account number, employee ID,
secrets) · **Medium** (name, address) · **Low** (email, phone, date, URL).

## Chat model

`/api/chat` uses `claude-sonnet-4-20250514` **only when `ANTHROPIC_API_KEY` is
set**. With no key (or on a static host, or on any error) the chat uses the
local demo assistant, whose replies are labeled "Demo assistant" in the UI. This
keeps the demo fully functional for sharing without credentials.

## Swapping / configuring models

- **Detection model:** change the model id in the three loaders listed above
  (`server.ts`, `browser-model.ts`, `model-scanner.ts`). Keep them in sync; all
  three route output through `model-entities.ts`.
- **Chat model:** change `model:` in the `/api/chat` handler in
  [`server.ts`](../server.ts). See [docs/claude-api](https://docs.anthropic.com)
  for current model ids.
- **OCR language:** `createWorker("eng", …)` in `image-scanner.ts` /
  `file-scanner.ts`; add the language data in
  [`scripts/prepare-local-assets.mjs`](../scripts/prepare-local-assets.mjs).

## Asset sizes (rough)

| Asset | Size |
|---|---|
| Tesseract runtime (wasm + core) | ~6 MB |
| Tesseract `eng` language data | ~10 MB |
| `openai/privacy-filter` weights (q4) | downloaded on demand / cached |
| Extension `.zip` (everything bundled) | ~22 MB |
