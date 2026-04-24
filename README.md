# PrivacyLens

**See what AI sees before AI sees it.**

A privacy-first chat interface that intercepts user content, detects PII locally using on-device AI, and gates sending until the user reviews and approves what's being shared.

Built for the Kiro Spark Challenge hackathon (Ethics frame, Inclusion Guardrail).

## Quick Start

```bash
npm install
npm run build
ANTHROPIC_API_KEY=your-key-here npm run server
# Open http://localhost:3001
```

For development:
```bash
# Terminal 1: API server
ANTHROPIC_API_KEY=your-key-here npm run server

# Terminal 2: Vite dev server
npm run dev
# Open http://localhost:5173
```

## How It Works

1. User types a message or uploads a file (PDF, image, text)
2. Regex scanner runs instantly on every keystroke, detecting SSNs, emails, phones, credit cards, API keys, dates
3. On submit, the AI model (openai/privacy-filter via Transformers.js) runs a deep semantic scan for names, addresses, and other PII
4. If PII is detected, the **Ethics Logic Gate** fires:
   - Send button is disabled (turns red)
   - Review panel slides in showing each PII entity highlighted with severity badges
   - User can redact individual items, auto-redact all, or override with explicit confirmation
5. Only approved/redacted content is sent to Claude
6. A local privacy audit log tracks how much PII has been protected (never stores actual PII)

## Ethics Logic Gate

This is a **hard gate** in the code — not a suggestion, not a warning:
- ANY detected PII blocks the send pipeline
- User must explicitly review and choose: redact or override
- Override requires a second confirmation ("I understand the risk")
- All decisions are logged locally for accountability

## Architecture

```
User Input → Regex Scanner (instant) → AI Model (on submit) → Entity Merge
    → Ethics Logic Gate (hard block) → Review Panel → Redact/Approve → Claude API
```

### Detection Pipeline
- **Pass 1 (Regex)**: Instant pattern matching for structured PII (SSN, email, phone, credit card, dates, API keys, AWS keys, GitHub tokens)
- **Pass 2 (AI Model)**: `openai/privacy-filter` via Transformers.js — 1.5B param MoE model running in-browser with WebGPU/WASM, detects names, addresses, and semantic PII
- **Merge**: Overlapping detections are deduplicated, higher confidence wins

### PII Categories & Severity
| Severity | Categories |
|----------|-----------|
| High | SSN, credit card, account numbers, secrets/API keys |
| Medium | Names, addresses |
| Low | Emails, phones, dates, URLs |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| Animation | Framer Motion |
| PII Detection | openai/privacy-filter via @huggingface/transformers + regex |
| PDF Parsing | pdfjs-dist |
| Image OCR | Tesseract.js |
| Chat Backend | Claude API via @anthropic-ai/sdk |
| API Server | Express |

## File Structure

```
src/
├── lib/
│   ├── regex-scanner.ts      # Instant PII regex patterns (SSN, email, phone, etc.)
│   ├── pii-classifier.ts     # Transformers.js + openai/privacy-filter model
│   ├── redaction-engine.ts    # Replace PII with [NAME], [EMAIL], etc.
│   ├── upload-interceptor.ts  # Two-pass pipeline orchestrator + entity merge
│   ├── ethics-gate.ts         # Hard-block logic
│   ├── pdf-scanner.ts         # PDF text extraction via pdfjs-dist
│   ├── image-scanner.ts       # OCR via Tesseract.js
│   ├── audit-log.ts           # localStorage audit trail (no PII stored)
│   └── chat-api.ts            # Client-side API calls
├── components/
│   ├── ChatPage.tsx           # Main layout + state orchestration
│   ├── MessageList.tsx        # Chat messages with animations
│   ├── MessageInput.tsx       # Text input + file upload + drag-and-drop
│   ├── ReviewPanel.tsx        # PII review with severity badges + redact controls
│   ├── HighlightedText.tsx    # Inline PII highlighting
│   ├── ModelStatus.tsx        # AI model loading indicator
│   └── AuditLogPanel.tsx      # Privacy stats sidebar
├── hooks/
│   ├── useChat.ts             # Chat message state + API calls
│   ├── usePIIDetection.ts     # Detection pipeline state
│   └── useModelLoader.ts      # Model loading lifecycle
├── types.ts                   # Shared types and constants
├── App.tsx
├── main.tsx
└── index.css
server.ts                      # Express proxy for Claude API
```

## Design System

Following taste-skill design principles:
- Warm bone canvas (#F7F6F3), off-black text (#2F3437)
- Single accent color (teal #12A594)
- Geist font family
- Floating glass header bar with backdrop blur
- Spring physics animations (Framer Motion)
- Generous whitespace, hairline borders
- No emojis — severity indicated by colored dots

## Privacy Guarantees

- All PII detection runs **locally in the browser** (regex + on-device AI model)
- No data leaves the device until the user explicitly approves
- The audit log stores only category counts, never actual PII text
- The Claude API proxy only receives approved/redacted content
