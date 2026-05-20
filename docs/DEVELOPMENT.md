# Development Guide

Practical information for developing, testing, and debugging PrivacyLens.

## Test & Verification Commands

| Command | Description |
|---------|-------------|
| `npm run test:extension` | Runs the extension fixture test (loads extension in Chromium, verifies content script injection and composer interception) |
| `npm run test:extension:background` | Tests the background service worker (model loading, message handling, state management) |
| `npm run test:extension:files` | Tests the file scanner module (PDF and image PII detection via the extension pipeline) |
| `npm run test:extension:sidepanel` | Tests the side panel UI (review workflow, entity display, redaction controls) |
| `npm run test:demo` | Tests the demo website (landing page loads, file upload works, PII detection triggers) |
| `npm run verify:extension` | Full verification suite that runs all extension checks end-to-end |

All test scripts are located in `scripts/` and use Playwright with Chromium.

## PII Severity Categories

The detection engine classifies PII entities into three severity levels:

| Severity | Entity Types |
|----------|-------------|
| **High** | Account numbers, secrets/API keys, employee IDs, SSNs, credit card numbers |
| **Medium** | Names, addresses |
| **Low** | Emails, phone numbers, dates, URLs |

High-severity entities receive prominent visual highlighting in the review panel and are recommended for redaction by default.

## Sample Files

The `public/samples/` directory contains 6 demo files for testing PII detection across formats:

| File | Format | PII Content |
|------|--------|-------------|
| `business-card.png` | Image | Name, phone number, email, company address |
| `hr-email.txt` | Text | Employee names, employee IDs, salary figures, SSN |
| `invoice-wilson.pdf` | PDF | Name, billing address, account number |
| `medical-intake.txt` | Text | Patient name, date of birth, SSN, phone, address, medical record number |
| `registration-form.png` | Image | Name, address, date of birth, phone number, email |
| `resume-emily-chen.pdf` | PDF | Name, email, phone, address, employment history, education |

## Development Environment

### Vite Dev Server

In development mode (`npm run dev`), the Vite dev server runs on `http://localhost:5173` and proxies all `/api` requests to `localhost:3001` (the Express server). This allows the frontend to call the backend without CORS configuration during development.

### Environment Variables

| Variable | Required For | Description |
|----------|-------------|-------------|
| `ANTHROPIC_API_KEY` | Server | API key for Claude chat functionality. The server won't start without it. |

### Running the Full Stack Locally

```bash
# Terminal 1: Start the API server
ANTHROPIC_API_KEY=your-key npm run server

# Terminal 2: Start the Vite dev server with HMR
npm run dev
```

### Building for Production

```bash
npm run build
```

This runs `tsc -b` (TypeScript type-checking) followed by `vite build` (bundling). The output goes to `dist/`, which serves as both the web app and the Chrome extension package.
