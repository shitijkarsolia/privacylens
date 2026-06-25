# PrivacyLens Architecture

PrivacyLens is a **local-first** PII detection and redaction layer that stops
personal information from leaking into AI chat services. It detects personal
data in text, PDFs, and images, then **hard-blocks** the send until the user
reviews and redacts. It ships in two forms that share one detection engine:

- a **web app** — a landing page, an interactive chat **demo** (`/demo`), and an
  **install** page (`/install`); and
- a **Chrome extension (MV3)** that intercepts input on ChatGPT, Claude, Gemini,
  Perplexity, and Copilot.

> New here? Read this file for the design, then:
> [MODELS.md](MODELS.md) (what AI runs where) ·
> [API.md](API.md) (server endpoints) ·
> [DEPLOYMENT.md](DEPLOYMENT.md) (hosting + extension distribution) ·
> [DEVELOPMENT.md](DEVELOPMENT.md) (scripts, repo map, testing).

---

## System overview

```mermaid
graph TD
  subgraph Browser["User's browser"]
    subgraph WebApp["Web app (React)  —  /, /demo, /install"]
      UI[Chat UI + Review Panel]
      Hooks[Hooks: useModelLoader / usePIIDetection / useChat]
    end
    subgraph Extension["Chrome extension (MV3)"]
      CS[Content script]
      BG[Background service worker]
      SP[Side panel]
    end
    subgraph Local["In-browser detection"]
      BrowserModel["openai/privacy-filter<br/>(WebGPU, Transformers.js)"]
      Regex["Regex scanner<br/>(instant, always on)"]
      OCR["Tesseract.js OCR<br/>(self-hosted)"]
      PDFp["pdfjs-dist"]
    end
  end

  subgraph Server["Express server (optional)"]
    Scan["/api/scan"]
    Status["/api/model-status"]
    Chat["/api/chat"]
    ServerModel["openai/privacy-filter<br/>(CPU, Transformers.js)"]
  end

  Claude["Claude API (Anthropic)"]

  Hooks -->|"tier 1 (if server up)"| Scan
  Hooks -->|"tier 2 (static + WebGPU)"| BrowserModel
  Hooks -->|"tier 3 (always)"| Regex
  Scan --> ServerModel
  UI --> Chat
  Chat -->|"key set"| Claude
  Chat -.->|"no key → demo assistant"| UI
  CS --> Regex
  BG --> BrowserModel
  CS --> BG
  SP --> BG
```

The web app and the extension never send content anywhere until the user
approves it. The Express server is **optional** — see *Runtime modes* below.

---

## Detection runs in tiers (graceful degradation)

The web app resolves which detector to use at load time and **degrades
gracefully** so the app is always usable. Source:
[`src/hooks/useModelLoader.ts`](../src/hooks/useModelLoader.ts).

```mermaid
flowchart TD
  Start[App loads] --> Poll["GET /api/model-status"]
  Poll -->|"JSON: ready"| T1["Tier 1 — Server model<br/>POST /api/scan (CPU)"]
  Poll -->|"JSON: failed"| T3a["Tier 3 — Regex only<br/>(server up, model unavailable)"]
  Poll -->|"404 / non-JSON / unreachable<br/>(static hosting)"| WebGPU{WebGPU available?}
  WebGPU -->|Yes| T2["Tier 2 — In-browser model<br/>openai/privacy-filter on WebGPU"]
  WebGPU -->|No| T3b["Tier 3 — Regex only"]
```

| Tier | Detector | When it's chosen | Status chip |
|---|---|---|---|
| 1 | **Server model** — `openai/privacy-filter` on CPU via `/api/scan` | `/api/model-status` returns `ready` | "AI detection active" |
| 2 | **In-browser model** — `openai/privacy-filter` on WebGPU | No backend (static host) **and** WebGPU present | "On-device AI detection active" |
| 3 | **Regex only** — 15+ pattern scanner | No backend & no WebGPU, or the model failed to load | "Pattern detection active" |

The **regex scanner always runs** (instant, on every keystroke) regardless of
tier; tiers 1–2 add a deep semantic pass that is merged on top. The ethics gate
enforces identically in every tier, so privacy protection never silently
weakens — at worst it falls back to instant pattern matching.

---

## Runtime modes (how it's deployed)

| Mode | What's running | Detection | Chat |
|---|---|---|---|
| **Full stack** | `npm run server` serving `dist/` + the 3 API routes | Tier 1 (server CPU model) | Claude if `ANTHROPIC_API_KEY` set, else demo assistant |
| **Static** (Pages / Vercel / Netlify) | `dist/` only, no backend | Tier 2 (WebGPU) or Tier 3 (regex) | Demo assistant (or add a serverless `/api/chat` for Claude) |
| **Extension** | MV3 extension installed in the browser | In-browser model + regex (no server) | N/A — guards the host site's own chat |

Both the detector tier and the chat backend **fall back automatically** — the
same build runs in all three modes. See [DEPLOYMENT.md](DEPLOYMENT.md).

---

## PII detection pipeline

```mermaid
flowchart TD
  Input[User text / file upload] --> TypeDetect{Content type?}
  TypeDetect -->|Text| DirectText[Direct text]
  TypeDetect -->|PDF| PDFExtract["Text extraction (pdfjs-dist)"]
  TypeDetect -->|Image| OCRx["OCR (Tesseract.js, self-hosted)"]
  TypeDetect -->|Unsupported / oversized| Block[BLOCKED — fail closed]

  PDFExtract --> Text[Extracted text]
  OCRx --> Text
  DirectText --> Text

  Text --> Dual
  subgraph Dual["Dual detection"]
    R["Regex scanner (instant)"]
    M["Model scanner (deep, token classification)"]
  end
  Dual --> Merge["Merge + overlap resolution<br/>(specific labels & confidence win)"]
  Merge --> Gate{Ethics gate}
  Gate -->|"any entity"| Blocked[HARD BLOCK]
  Gate -->|"none"| Clean[Cleared to send]
  Blocked --> Review[Review panel]
  Review --> Decision{Per-item choice}
  Decision -->|Redact| Red["Replace with [NAME], [SSN]…"]
  Decision -->|Keep| Keep[Keep visible]
  Red --> Out[Approved content sent]
  Keep --> Out
```

**Entity merging** ([`src/lib/upload-interceptor.ts`](../src/lib/upload-interceptor.ts))
resolves overlaps by *specificity then confidence* — e.g. the regex `ssn` label
wins over the model's generic `account_number` for the same digits.

Key files: [`regex-scanner.ts`](../src/lib/regex-scanner.ts),
[`upload-interceptor.ts`](../src/lib/upload-interceptor.ts),
[`ethics-gate.ts`](../src/lib/ethics-gate.ts),
[`model-entities.ts`](../src/lib/model-entities.ts) (shared model→entity mapping
used by both the server and the in-browser model).

---

## Chat with graceful fallback

The demo's chat ([`src/lib/chat-api.ts`](../src/lib/chat-api.ts)) calls
`/api/chat` and falls back to a **local demo assistant**
([`src/lib/demo-assistant.ts`](../src/lib/demo-assistant.ts)) whenever the
backend is missing, keyless, or errors. Demo replies are **clearly labeled** in
the UI and acknowledge how many items the user redacted, so the full
detect → block → redact → send loop is explorable with no key and no server.

---

## Chrome extension architecture

```mermaid
graph TD
  subgraph Sites["AI chat sites (host_permissions)"]
    S1[ChatGPT] & S2[Claude] & S3[Gemini] & S4[Perplexity] & S5[Copilot]
  end
  subgraph CSb["Content script (content-script.js)"]
    Intercept[Intercept Enter / send / file inputs]
    Highlight[CSS Highlight API on composers]
    Adapters[Per-site DOM adapters]
    RegexCS[Built-in regex scanner]
  end
  subgraph BGb["Background service worker (background.js)"]
    State[Per-tab state + 10-min TTL cleanup]
    ModelLoad[Model via model-scanner.js]
    Badge[Toolbar badge counts]
  end
  subgraph SPb["Side panel (sidepanel.html)"]
    ReviewUI[Review UI]
    Slider[Before/after slider]
    Controls[Redact / Keep / Cancel]
  end
  Sites --> CSb
  CSb <-->|chrome.runtime messaging| BGb
  SPb <-->|chrome.runtime messaging| BGb
```

The extension is **100% local** — it makes no `/api` or server calls. File
scanning (PDF/OCR) and the model both run inside the extension; the OCR runtime
is bundled at `dist/tesseract/`. Detail and status:
[EXTENSION_STATUS.md](EXTENSION_STATUS.md), install:
[INSTALL_EXTENSION.md](INSTALL_EXTENSION.md).

---

## Key design decisions

- **Hard gate, not a warning.** Any detected entity blocks the send
  ([`ethics-gate.ts`](../src/lib/ethics-gate.ts) — `blocked = entities.length > 0`).
  The user must redact, keep, or cancel; the block is not dismissible.
- **Local-first & provable.** No content leaves the browser until approval. The
  static demo is tested to make **zero external network requests**
  ([`scripts/test-static-demo.mjs`](../scripts/test-static-demo.mjs)).
- **Self-hosted assets.** Fonts and the Tesseract OCR runtime are vendored, so
  even asset loads don't hit third-party CDNs.
- **Fail-closed files.** Unsupported / oversized / unreadable files are blocked,
  not passed through.
- **Sparse-MoE model.** `openai/privacy-filter` is 1.5B params but ~50M active
  per token (MoE), giving deep semantic detection at in-browser speeds. See
  [MODELS.md](MODELS.md).
- **One build, three modes.** Detector tier and chat backend both degrade
  gracefully, so the same artifact runs full-stack, static, or as an extension.
