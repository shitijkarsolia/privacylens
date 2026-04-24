# PrivacyLens — Hackathon Plan

## Context

The Kiro Spark Challenge is a 24-hour hackathon (April 24) for ASU students. Teams of 3 build an app using Kiro IDE. The idea: a privacy-first chat interface that intercepts user uploads (text, images, PDFs), detects PII locally using on-device AI, warns the user, and offers a redacted version — so sensitive data never leaves the browser.

This fits the **Ethics frame** with the **Inclusion Guardrail**: the app mitigates a specific privacy risk (leaking PII to cloud AI), and the spec includes an **Ethics Logic Gate** — code that literally blocks the upload pipeline until the user reviews and approves what's being sent.

Reference project: [LocalRedact](https://github.com/mmostagirbhuiyan/localredact) — a browser-based PDF redaction tool using WebLLM + regex. We differentiate by making this a **chat-level interceptor** with an agentic architecture, not a standalone document tool.

---

## The Winning Angle

### Name: **PrivacyLens**
*"See what AI sees before AI sees it."*

### Narrative (hits the Story + Impact signals hard)
Every day, millions of people paste resumes, medical records, financial docs, and screenshots into AI chatbots without thinking. PrivacyLens is the privacy-conscious layer that sits between you and any AI — it scans everything locally, highlights what's sensitive, and lets you choose what to share. **Your data never leaves your device until you say so.**

### Why it wins across all 4 prize signals

| Signal | How we hit it |
|---|---|
| **Build** | Agentic multi-step pipeline (detection → classification → redaction → gating), OpenAI's open-source privacy-filter model running locally via Transformers.js + WebGPU, Kiro spec-driven development |
| **Collaboration** | 2 devs + 1 non-tech: non-tech person drives UX research, writes the Kiro specs, designs the privacy policy templates. Show Kiro used across all 3 roles |
| **Impact** | Real problem — PII leakage to AI services is a documented, growing concern. Clear customer journey: upload → scan → review → redact → send |
| **Story** | "We built the seatbelt for the AI era." Polished demo, clear docs, social posts throughout the day |

---

## Architecture

```
┌─────────────────────────────────────────────┐
│              PrivacyLens Chat UI             │
│  (React + Tailwind + shadcn/ui)             │
├─────────────────────────────────────────────┤
│         Upload Interceptor Layer            │
│  ┌─────────┐  ┌──────────┐  ┌───────────┐  │
│  │  Text   │  │  Image   │  │   PDF     │  │
│  │ Scanner │  │  OCR +   │  │  Parser + │  │
│  │ (regex  │  │ Scanner  │  │  Scanner  │  │
│  │ + NER)  │  │(Tesseract│  │ (pdfjs +  │  │
│  │         │  │  + NER)  │  │   NER)    │  │
│  └────┬────┘  └────┬─────┘  └─────┬─────┘  │
│       └────────────┼───────────────┘        │
│                    ▼                        │
│  ┌─────────────────────────────────────┐    │
│  │     PII Classification Agent        │    │
│  │  (openai/privacy-filter via        │    │
│  │   Transformers.js + WebGPU)        │    │
│  │  8 categories: person, email,      │    │
│  │  phone, address, date, url,        │    │
│  │  account_number, secret            │    │
│  └──────────────┬──────────────────┘    │
│                 ▼                        │
│  ┌─────────────────────────────────────┐    │
│  │     ★ ETHICS LOGIC GATE ★          │    │
│  │  - Blocks pipeline if PII found    │    │
│  │  - Shows risk severity (🔴🟡🟢)    │    │
│  │  - User must explicitly approve    │    │
│  │  - Generates redacted alternative  │    │
│  └──────────────┬──────────────────┘    │
│                 ▼                        │
│  ┌─────────────────────────────────────┐    │
│  │     Send to AI (or send redacted)  │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

### Ethics Logic Gate (the required guardrail)
This is a hard gate in the code — not a suggestion, not a warning. If PII is detected above a confidence threshold:
1. The send button is **disabled**
2. A review panel slides in showing each PII entity highlighted in context
3. User can: (a) redact individual items, (b) use the auto-redacted version, (c) override with explicit "I understand the risk" confirmation
4. A privacy audit log is maintained locally (never sent anywhere)

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | React 18 + TypeScript + Vite | Fast, Kiro-friendly |
| UI | Tailwind CSS + shadcn/ui | Polished look, fast to build |
| PII Detection | `openai/privacy-filter` via Transformers.js | Purpose-built PII model, 1.5B params (50M active via MoE), runs in-browser with WebGPU, Apache 2.0 |
| PII Detection (fast fallback) | Regex patterns | Instant for structured PII while model loads |
| PDF parsing | pdfjs-dist | Proven, same as LocalRedact |
| Image OCR | Tesseract.js | Proven, same as LocalRedact |
| Chat backend | Claude API (via Anthropic SDK) | Real AI responses to redacted messages |
| Hosting | Vercel or Cloudflare Pages | Quick deploy for demo |

### Key technical decision: `openai/privacy-filter` model
OpenAI released an open-source (Apache 2.0) PII detection model purpose-built for this exact use case:
- **Architecture**: 1.5B param sparse MoE (128 experts, top-4 routing) — only 50M params active per token
- **8 PII categories**: `private_person`, `private_email`, `private_phone`, `private_address`, `private_date`, `private_url`, `account_number`, `secret`
- **Runs in-browser** via Transformers.js with WebGPU (`dtype: "q4"` for quantized inference)
- **128K token context window** — can handle large documents in a single pass
- **BIOES span decoding** with Viterbi — produces clean entity boundaries, not just token labels
- **High confidence scores** (>0.999 in examples) — great for the Ethics Logic Gate threshold

```javascript
// Core integration — this is all it takes
import { pipeline } from "@huggingface/transformers";
const classifier = await pipeline(
  "token-classification",
  "openai/privacy-filter",
  { device: "webgpu", dtype: "q4" }
);
const pii = await classifier(userInput, { aggregation_strategy: "simple" });
// Returns: [{ entity_group: 'private_person', score: 0.999, word: 'John Smith' }, ...]
```

**Fallback strategy**: Regex runs instantly on every keystroke for structured PII (SSN patterns, emails, phones). The model runs on submit for deep semantic detection (names, addresses in prose). If WebGPU is unavailable, regex-only mode still catches the most critical patterns.

---

## Differentiation from LocalRedact

| | LocalRedact | PrivacyLens |
|---|---|---|
| Use case | Standalone PDF redaction | Chat-level privacy interceptor |
| Trigger | User uploads a doc to redact | Automatic — scans everything before it leaves |
| File types | PDF, text | Text, images, PDFs, screenshots |
| AI model | Qwen3-4B (2.5GB, WebGPU only) | `openai/privacy-filter` (1.5B MoE, WebGPU) + regex fallback |
| UX | Document review tool | Chat interface with inline privacy warnings |
| Ethics gate | No | Yes — hard block on send |
| Agentic | No | Yes — multi-step detection pipeline |
| Education | No | Yes — explains WHY each item is risky |

---

## Demo Flow (2-minute pitch)

1. Open PrivacyLens — looks like a sleek chat interface
2. Type a message: "Here's my info: John Smith, SSN 123-45-6789, call me at 555-0123"
3. **Instantly** — the Ethics Logic Gate fires. Send button goes red/disabled. A side panel highlights each PII entity with severity badges
4. Click "Auto-Redact" — message transforms to "Here's my info: [NAME], SSN [REDACTED], call me at [REDACTED]"
5. Drag-and-drop a PDF resume — OCR runs, PII detected, same review flow
6. Paste a screenshot of a medical bill — Tesseract extracts text, NER finds patient info, gate fires
7. Show the local privacy audit log — "You've protected 12 pieces of PII today"
8. Send the redacted version to Claude — get a helpful response without ever exposing real data

---

## Implementation Plan (24-hour timeline)

### Hours 0-2: Setup + Specs
- Initialize project with Vite + React + TypeScript + Tailwind + shadcn/ui
- Write Kiro specs for each component (this is critical for the Build signal)
- Set up the repo structure

### Hours 2-6: Core Engine
- Implement regex PII scanner (SSN, email, phone, dates, credit cards)
- Integrate Transformers.js with NER model for name/address/org detection
- Build the two-pass detection pipeline
- Implement the Ethics Logic Gate logic

### Hours 6-10: Chat UI
- Build the chat interface (message list, input area, file upload)
- Build the PII review panel (highlighted entities, severity badges, redact/approve buttons)
- Wire up the interceptor between input and send

### Hours 10-14: File Support
- PDF parsing with pdfjs-dist + PII scanning
- Image OCR with Tesseract.js + PII scanning
- Unified review UI for all file types

### Hours 14-18: Polish + Integration
- Connect to Claude API for actual chat responses
- Privacy audit log (local storage)
- Animations, transitions, loading states
- Edge cases and error handling

### Hours 18-22: Demo Prep
- Deploy to Vercel
- Record demo video
- Write documentation and Kiro usage writeup
- Social media posts (Story signal)

### Hours 22-24: Buffer
- Bug fixes, final polish, submission

---

## Verification / Testing Plan

1. **Text PII detection**: Type messages with SSNs, emails, phones, names, addresses — verify all are caught and highlighted
2. **PDF scanning**: Upload a sample resume PDF — verify PII extraction and review panel
3. **Image OCR**: Upload a screenshot with visible PII — verify Tesseract extracts and NER catches entities
4. **Ethics Logic Gate**: Verify send button is disabled when PII detected, enabled only after review
5. **Redaction**: Verify auto-redact produces clean output with no PII leakage
6. **Chat flow**: Send redacted message to Claude, verify response is useful
7. **Edge cases**: Empty files, non-English text, images with no text, already-clean messages

---

## Risk Mitigation

| Risk | Mitigation |
|---|---|
| Privacy-filter model too slow | Pre-load on app init; regex handles structured PII instantly while model warms up |
| Tesseract OCR inaccurate | Acceptable for demo — focus on clear screenshots/docs |
| 24 hours too tight | Cut image support first if behind; text + PDF is the core |
| WebGPU not available on demo machine | Regex-only fallback mode; test demo machine beforehand; Chrome 113+ should be fine |
