# PrivacyLens

**See what AI sees before AI sees it.**

A privacy-first chat interface that intercepts user content, detects PII locally using an on-device AI model, and gates sending until the user reviews and approves what's being shared. Nothing leaves your browser until you say so.

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

### Text Messages
1. User types a message and hits send
2. The `openai/privacy-filter` AI model (1.5B param MoE, running entirely in-browser via Transformers.js + WASM/WebGPU) scans the text
3. If PII is detected, the **Ethics Logic Gate** fires — send is blocked, review panel opens
4. User reviews each detected entity, chooses to redact or override
5. Only approved/redacted content is sent to Claude

### PDF Files
1. User uploads or drops a PDF
2. `pdfjs-dist` extracts text from the PDF's text layer (no OCR needed)
3. Extracted text is fed through the AI model for PII detection
4. If PII found: the PDF is rendered to canvas, PII regions are blackened, and a **before/after visual comparison slider** is shown in the review panel
5. User reviews and chooses to send redacted text or original

### Images
1. User uploads or drops an image (PNG, JPG, WebP)
2. `Tesseract.js` runs OCR entirely in-browser to extract text from the image
3. Extracted text is fed through the AI model for PII detection
4. If PII found: the image is blurred/obfuscated, and a **before/after visual comparison slider** is shown
5. User reviews and chooses to send redacted text or original

### The AI Model
- **Model**: `openai/privacy-filter` — Apache 2.0 licensed, purpose-built for PII detection
- **Architecture**: 1.5B total parameters, 50M active per token (sparse MoE with 128 experts, top-4 routing)
- **Runs locally**: Via `@huggingface/transformers` in the browser using WASM (or WebGPU where available)
- **Cached**: Model is cached in the browser's Cache API after first download — subsequent visits load instantly
- **8 PII categories**: person, email, phone, address, date, URL, account_number, secret
- **High accuracy**: >99.9% confidence on detected entities, zero false positives on clean text

## Ethics Logic Gate

This is a **hard gate** in the code — not a suggestion, not a warning:
- ANY detected PII blocks the send pipeline
- Send button is disabled until user reviews
- User must explicitly choose: redact individual items, auto-redact all, or override with "I understand the risk" confirmation
- Override requires a second confirmation step
- All decisions are logged locally for accountability (no PII text stored)

## Architecture

```
User Input (text/PDF/image)
    ↓
File Processing (pdfjs-dist / Tesseract.js OCR)
    ↓
AI Model Scan (openai/privacy-filter, in-browser)
    ↓
Ethics Logic Gate (hard block if PII found)
    ↓
Review Panel (highlighted entities, severity badges, before/after slider for files)
    ↓
User Decision (redact / override / cancel)
    ↓
Claude API (only approved content sent)
```

### PII Categories & Severity
| Severity | Categories |
|----------|-----------|
| High | Account numbers, secrets/API keys |
| Medium | Names, addresses |
| Low | Emails, phones, dates, URLs |

## Sample Files

The app includes 6 sample files for demo purposes:
- **Resume PDF** — Contains name, email, phone, address, SSN
- **Invoice PDF** — Contains name, address, credit card, tax ID
- **Business Card** (image) — Contains name, email, phone, address, NPI
- **Registration Form** (image) — Contains name, email, DOB, SSN, address
- **HR Email** (text) — Contains name, SSN, bank details, address, phone, email
- **Medical Intake** (text) — Contains patient name, DOB, SSN, address, insurance info

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| Animation | Framer Motion |
| PII Detection | openai/privacy-filter via @huggingface/transformers (in-browser AI) |
| PDF Parsing | pdfjs-dist |
| Image OCR | Tesseract.js (in-browser) |
| Visual Obfuscation | Canvas API (blacken/blur PII regions) |
| Chat Backend | Claude API via @anthropic-ai/sdk |
| API Server | Express |

## File Structure

```
src/
├── lib/
│   ├── upload-interceptor.ts    # AI-only detection pipeline
│   ├── redaction-engine.ts      # Replace PII with [NAME], [EMAIL], etc.
│   ├── ethics-gate.ts           # Hard-block logic
│   ├── pdf-scanner.ts           # PDF text extraction via pdfjs-dist
│   ├── image-scanner.ts         # OCR via Tesseract.js
│   ├── visual-obfuscator.ts     # Canvas-based PDF/image obfuscation
│   ├── audit-log.ts             # localStorage audit trail (no PII stored)
│   ├── regex-scanner.ts         # Regex patterns (available but disabled)
│   └── chat-api.ts              # Client-side API calls
├── components/
│   ├── ChatPage.tsx             # Main layout + state orchestration
│   ├── MessageList.tsx          # Chat messages + sample file grid
│   ├── MessageInput.tsx         # Text input + file upload + drag-and-drop
│   ├── ReviewPanel.tsx          # PII review + before/after slider for files
│   ├── BeforeAfterSlider.tsx    # Draggable image comparison slider
│   ├── HighlightedText.tsx      # Inline PII highlighting
│   ├── ModelStatus.tsx          # AI model loading indicator
│   └── AuditLogPanel.tsx        # Privacy stats sidebar
├── hooks/
│   ├── useChat.ts               # Chat message state + API calls
│   ├── usePIIDetection.ts       # Detection pipeline state
│   └── useModelLoader.ts        # Model loading + browser caching
├── types.ts                     # Shared types and constants
├── App.tsx
├── main.tsx
└── index.css
public/samples/                  # 6 sample files (2 PDF, 2 image, 2 text)
server.ts                        # Express proxy for Claude API
```

## Design System

Following taste-skill design principles:
- Warm bone canvas (#F7F6F3), off-black text (#2F3437)
- Single accent color (teal #12A594)
- Severity colors: red (high), amber (medium), teal (low)
- Geist font family
- Floating glass header bar with backdrop blur
- Spring physics animations (Framer Motion)
- Prominent scan status bar (scanning/blocked/clean)
- Before/after image slider for file obfuscation
- Generous whitespace, hairline borders

## Privacy Guarantees

- All PII detection runs **locally in the browser** using an on-device AI model
- No data leaves the device until the user explicitly approves
- The AI model is cached in the browser — no re-download needed
- The audit log stores only category counts, never actual PII text
- The Claude API proxy only receives approved/redacted content
- File processing (PDF parsing, OCR) all happens client-side
