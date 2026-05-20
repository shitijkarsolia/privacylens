# PrivacyLens Architecture

PrivacyLens is a local-first PII detection and redaction system that prevents personal information from leaking into AI chat services. It runs entirely in the browser using a sparse MoE model (openai/privacy-filter via Transformers.js) combined with regex-based pattern matching, and provides both a standalone web demo and a Chrome extension that intercepts input on popular AI chat sites.

## System Overview

```mermaid
graph LR
  subgraph Browser["User's Browser"]
    subgraph WebApp["React Web App (demo at /demo)"]
      UI[Chat UI + Review Panel]
      Hooks[React Hooks]
    end
    subgraph Extension["Chrome Extension (MV3)"]
      CS[Content Script]
      BG[Background Service Worker]
      SP[Side Panel]
    end
    subgraph LocalAI["In-Browser AI"]
      Model["openai/privacy-filter<br/>Sparse MoE via Transformers.js"]
    end
  end

  subgraph Server["Express API Server"]
    Scan["/api/scan"]
    Chat["/api/chat"]
    Status["/api/model-status"]
  end

  Claude["Claude API<br/>(Anthropic)"]

  Hooks --> Model
  BG --> Model
  UI --> Chat
  Chat --> Claude
  Hooks --> Scan
  CS --> BG
  SP --> BG
```

## PII Detection Pipeline

```mermaid
flowchart TD
  Input[User Input / File Upload] --> TypeDetect{Content Type?}

  TypeDetect -->|Plain Text| DirectText[Direct Text]
  TypeDetect -->|PDF| PDFExtract["PDF Text Extraction<br/>(pdfjs-dist)"]
  TypeDetect -->|Image| OCR["OCR Text Extraction<br/>(Tesseract.js)"]
  TypeDetect -->|Unsupported| Block[BLOCKED - Fail Closed]

  PDFExtract --> ExtractedText[Extracted Text]
  OCR --> ExtractedText
  DirectText --> ExtractedText

  ExtractedText --> DualScan

  subgraph DualScan["Dual Detection Pipeline"]
    Regex["Regex Scanner<br/>(instant, 15+ patterns)"]
    AIModel["AI Model Scanner<br/>(deep, token classification)"]
  end

  DualScan --> Merge[Entity Merging<br/>Overlap resolution by confidence]
  Merge --> Gate{Ethics Logic Gate}

  Gate -->|"PII Found (any entity)"| Blocked[HARD BLOCK<br/>Send prevented]
  Gate -->|No PII| Clean[Content cleared to send]

  Blocked --> Review[Review Panel]
  Review --> UserDecision{User Decision}

  UserDecision -->|Redact| Redact["Apply Redaction<br/>[NAME], [EMAIL], etc."]
  UserDecision -->|Keep Original| SendOriginal[Send unmodified]
  UserDecision -->|Cancel| Cancel[Message discarded]

  Redact --> Send[Approved content sent to AI]
  SendOriginal --> Send
```

## Chrome Extension Architecture

```mermaid
graph TD
  subgraph Sites["Supported AI Chat Sites"]
    ChatGPT[ChatGPT]
    ClaudeAI[Claude]
    Gemini[Gemini]
    Perplexity[Perplexity]
    Copilot[Copilot]
  end

  subgraph ContentScript["Content Script (content-script.js)"]
    Intercept[Intercept send + file uploads]
    Highlight[CSS Highlight API for composers]
    Adapters[Site-specific DOM adapters]
    RegexCS[Built-in regex scanner]
  end

  subgraph BackgroundSW["Background Service Worker (background.js)"]
    State[Per-tab state management]
    ModelLoad[Model loading via model-scanner.js]
    TTL[TTL-based state cleanup]
    Badge[Badge count updates]
  end

  subgraph SidePanel["Side Panel (sidepanel.html)"]
    ReviewUI[Review UI]
    Slider[Before/After slider]
    Controls[Redact / Keep / Cancel controls]
  end

  Sites --> ContentScript
  ContentScript -->|"chrome.runtime.sendMessage"| BackgroundSW
  BackgroundSW -->|"chrome.tabs.sendMessage"| ContentScript
  SidePanel -->|"chrome.runtime.sendMessage"| BackgroundSW
  BackgroundSW -->|"publishState broadcast"| SidePanel
```

## Data Flow by Content Type

### Text Messages

Direct text input follows the shortest path through the pipeline:

1. User types in composer (web app input or AI chat site composer)
2. **Instant feedback**: `scanWithRegex()` runs on every keystroke with debouncing, highlighting detected PII in real-time
3. **Deep scan on submit**: `runDetectionPipeline()` runs both regex and AI model classification
4. Entities are merged with overlap resolution (higher confidence wins)
5. Ethics gate evaluates: any entity triggers a hard block

Key files: [`src/lib/regex-scanner.ts`](../src/lib/regex-scanner.ts), [`src/lib/upload-interceptor.ts`](../src/lib/upload-interceptor.ts), [`src/lib/ethics-gate.ts`](../src/lib/ethics-gate.ts)

### PDF Files

1. File intercepted on upload (extension) or selected in web app
2. `pdfjs-dist` extracts text from all pages
3. Extracted text enters the same dual detection pipeline
4. If PII found, a redacted text version is generated for the user to review

Key files: [`src/lib/pdf-scanner.ts`](../src/lib/pdf-scanner.ts), [`src/extension/file-scanner.ts`](../src/extension/file-scanner.ts)

### Images

1. File intercepted on upload (extension) or selected in web app
2. `Tesseract.js` performs OCR to extract visible text
3. Extracted text enters the dual detection pipeline
4. Visual redaction via canvas overlay is available for image content

Key files: [`src/lib/image-scanner.ts`](../src/lib/image-scanner.ts), [`src/lib/visual-obfuscator.ts`](../src/lib/visual-obfuscator.ts), [`src/extension/file-scanner.ts`](../src/extension/file-scanner.ts)

## Key Design Decisions

### Local-First Processing

All PII detection runs entirely in the browser. The AI model (`openai/privacy-filter`) is downloaded once and cached locally. No user content is sent to any server until the user explicitly approves it. The Express server's `/api/scan` endpoint exists as an optional fallback but the primary path is fully client-side.

### Hard Gate, Not Soft Warning

The ethics gate in [`src/lib/ethics-gate.ts`](../src/lib/ethics-gate.ts) implements a hard block: if *any* PII entity is detected (`entities.length > 0`), the message is blocked from being sent. This is not a dismissible warning. The user must explicitly choose to redact, keep, or cancel before content can proceed.

### Sparse MoE Model

The `openai/privacy-filter` model has 1.5B total parameters but uses a Sparse Mixture-of-Experts architecture where only ~50M parameters are active per token. This provides deep semantic PII detection (catching context-dependent names, implied references) while remaining fast enough for in-browser inference via Transformers.js with ONNX/WASM backend.

### Fail-Closed for Unsupported Files

Files that cannot be scanned (unsupported format, too large, or unreadable) are blocked by default rather than passed through. The content script explicitly categorizes these as "unsupported" or "unscannable" and prevents upload until the user acknowledges the risk. This prevents data leakage through file types the scanner cannot analyze.

### Dual Pipeline: Regex + AI Model

The detection system runs two complementary scanners:

- **Regex scanner** ([`src/lib/regex-scanner.ts`](../src/lib/regex-scanner.ts)): Provides instant feedback with 15+ patterns covering SSNs, emails, phone numbers, credit cards, API keys, and more. Runs synchronously on every keystroke.
- **AI model scanner** ([`src/extension/model-scanner.ts`](../src/extension/model-scanner.ts)): Provides deep semantic analysis via token classification. Catches PII that regex misses (contextual names, implied personal details). Runs asynchronously on submit.

Results from both are merged in [`src/lib/upload-interceptor.ts`](../src/lib/upload-interceptor.ts) using confidence-weighted overlap resolution, ensuring no entity is missed while avoiding duplicates.
