# Implementation Plan: PrivacyLens

## Overview

Implement PrivacyLens as a React 18 + TypeScript + Vite application with Tailwind CSS and shadcn/ui. The implementation follows the pipeline architecture: core data models and interfaces first, then detection layer (RegexScanner, PIIClassificationAgent), merge and interceptor logic, Ethics Logic Gate and Redaction Engine, Chat Backend, Privacy Audit Log, and finally the React UI components wired together. Each task builds incrementally on the previous, with property-based tests (fast-check) and unit tests (Vitest) validating correctness at each stage.

## Tasks

- [ ] 1. Set up project structure and core data models
  - [ ] 1.1 Initialize Vite + React 18 + TypeScript project with Tailwind CSS and shadcn/ui
    - Run `npm create vite@latest` with React + TypeScript template
    - Install dependencies: `tailwindcss`, `@shadcn/ui`, `vitest`, `fast-check`, `@testing-library/react`
    - Configure Vitest in `vite.config.ts`
    - _Requirements: 11.1_

  - [ ] 1.2 Define core TypeScript interfaces and types
    - Create `src/types/index.ts` with `PIIEntity`, `PIICategory`, `ChatMessage`, `FileAttachment`, `AuditEntry`, `AuditSummary`, `GateState`, `GateStatus`, `ModelStatus`, `ScanResult`, `AppState`
    - Define the `PLACEHOLDER_MAP` constant mapping each `PIICategory` to its placeholder token
    - Define the severity mapping function (`getSeverity(category: PIICategory): "high" | "medium" | "low"`)
    - _Requirements: 7.2, 8.1_

  - [ ]* 1.3 Write property test for severity category mapping
    - **Property 5: Severity category mapping**
    - Enumerate all 8 `PIICategory` values via `fc.constantFrom(...)` and verify the mapping returns the correct severity for each
    - **Validates: Requirements 7.2**

- [ ] 2. Implement RegexScanner
  - [ ] 2.1 Implement RegexScanner module
    - Create `src/scanner/regexScanner.ts` implementing the `RegexScanner` interface
    - Implement regex patterns for SSN (`\d{3}-\d{2}-\d{4}`), email, US phone numbers, dates (MM/DD/YYYY, YYYY-MM-DD), and credit card numbers with Luhn validation
    - Return `PIIEntity[]` with `source: "regex"`, `confidence: 1.0`, and correct `start`/`end` positions
    - Handle empty string input by returning an empty array
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 2.2 Write property test for regex scanner detection correctness
    - **Property 1: Regex scanner detection correctness**
    - Generate random text strings with embedded PII patterns (SSN, email, phone, date, credit card) at random positions
    - Verify each returned entity's `text` equals the substring at `[start, end)`, has a valid category, and confidence of 1.0
    - Verify every embedded pattern has a corresponding entity in the output
    - **Validates: Requirements 1.1, 1.2**

  - [ ]* 2.3 Write unit tests for RegexScanner
    - Test empty string returns empty list
    - Test single SSN detection, single email, single phone number
    - Test multiple mixed patterns in one string
    - Test partial matches are not detected (e.g., "123-45" is not an SSN)
    - Test credit card Luhn validation (valid vs invalid numbers)
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 3. Implement RedactionEngine
  - [ ] 3.1 Implement RedactionEngine module
    - Create `src/redaction/redactionEngine.ts` implementing the `RedactionEngine` interface
    - Sort entities by start position in reverse order and replace from end to start to preserve character positions
    - Map each entity's category to its placeholder token via `PLACEHOLDER_MAP`
    - Preserve all non-PII text unchanged
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ]* 3.2 Write property test for redaction correctness
    - **Property 6: Redaction correctness**
    - Generate random text with non-overlapping `[start, end)` entity spans and random categories
    - Verify each entity's text is replaced by its category-specific placeholder and all characters outside entity spans are preserved
    - **Validates: Requirements 8.1, 8.2, 8.3**

  - [ ]* 3.3 Write property test for redaction round-trip
    - **Property 7: Redaction round-trip — no PII survives redaction**
    - Generate text with embedded PII patterns, scan with RegexScanner, redact all entities, re-scan with RegexScanner
    - Verify re-scan produces zero PII detections at previously-detected positions
    - Verify placeholder tokens are not detected as PII
    - **Validates: Requirements 8.4**

  - [ ]* 3.4 Write unit tests for RedactionEngine
    - Test single entity redaction
    - Test multiple adjacent entities
    - Test entity at start and end of string
    - Test placeholder token correctness per category
    - Test auto-redact-all scenario (all entities redacted)
    - _Requirements: 8.1, 8.2, 8.3_

- [ ] 4. Implement entity merge logic and UploadInterceptor
  - [ ] 4.1 Implement entity merge function
    - Create `src/scanner/mergeEntities.ts` with `mergeEntities(regexEntities: PIIEntity[], aiEntities: PIIEntity[]): PIIEntity[]`
    - Deduplicate overlapping spans: when two entities overlap, keep the one with the higher confidence score
    - When entities share the same span, merge into a single entity with the higher confidence
    - _Requirements: 3.3, 3.4_

  - [ ]* 4.2 Write property test for entity merge deduplication
    - **Property 2: Entity merge deduplication**
    - Generate two entity lists with controlled overlapping spans and random confidence scores
    - Verify no two output entities overlap, and for each overlapping pair the higher-confidence entity is retained
    - Verify total unique text regions in output equals unique text regions across both inputs
    - **Validates: Requirements 3.3, 3.4**

  - [ ] 4.3 Implement UploadInterceptor
    - Create `src/interceptor/uploadInterceptor.ts` implementing the `UploadInterceptor` interface
    - `scanText(text)`: runs RegexScanner only, returns entities instantly
    - `scanOnSubmit(text)`: runs both RegexScanner and PIIClassificationAgent, merges results
    - `scanPDF(file)`: delegates to PDFScanner for text extraction, then runs two-pass pipeline
    - `scanImage(file)`: delegates to ImageScanner for OCR, then runs two-pass pipeline
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 5. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement EthicsLogicGate
  - [ ] 6.1 Implement EthicsLogicGate module
    - Create `src/gate/ethicsLogicGate.ts` implementing the `EthicsLogicGate` interface
    - `evaluate(text, entities)`: returns `"blocked"` with entities when list is non-empty, `"open"` when empty
    - `approveRedacted(redactedText)`: transitions gate to `"open"` with redacted text
    - `overrideWithOriginal()`: transitions gate to `"open"` with original text
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 6.2 Write property test for ethics gate blocking invariant
    - **Property 3: Ethics gate blocking invariant**
    - Generate random entity lists (empty and non-empty) and verify gate returns `"blocked"` iff entities are non-empty, `"open"` iff empty
    - **Validates: Requirements 6.1, 6.4**

  - [ ]* 6.3 Write property test for ethics gate unblocking on review action
    - **Property 4: Ethics gate unblocking on review action**
    - Generate blocked gate states with non-empty entity lists and random review actions (`"redact"`, `"auto-redact"`, `"override"`)
    - Verify each action transitions the gate to `"open"` status
    - **Validates: Requirements 6.3**

  - [ ]* 6.4 Write unit tests for EthicsLogicGate
    - Test state transitions: open → blocked → open
    - Test override flow
    - Test redact flow
    - Test auto-redact flow
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 7. Implement PIIClassificationAgent
  - [ ] 7.1 Implement PIIClassificationAgent module
    - Create `src/scanner/piiClassificationAgent.ts` implementing the `PIIClassificationAgent` interface
    - `initialize()`: loads `openai/privacy-filter` model via `pipeline("token-classification", "openai/privacy-filter", { device: "webgpu", dtype: "q4" })`
    - `classify(text)`: runs inference, maps model output to `PIIEntity[]` with categories, confidence scores, and character positions
    - Handle WebGPU unavailability: set `status` to `"failed"`, enable regex-only fallback
    - Handle model download failure and inference errors with 30s timeout
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 12.1, 12.4_

  - [ ]* 7.2 Write unit tests for PIIClassificationAgent
    - Test mock model output parsing and category validation
    - Test fallback mode activation when WebGPU is unavailable
    - Test model timeout handling (30s abort)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 8. Implement file scanners (PDF and Image)
  - [ ] 8.1 Implement PDFScanner module
    - Create `src/scanner/pdfScanner.ts` implementing the `PDFScanner` interface
    - Use `pdfjs.getDocument()` to load PDF, iterate pages via `page.getTextContent()`, concatenate text items
    - Return empty string for empty PDFs
    - Throw/catch errors for unparseable files
    - _Requirements: 4.1, 4.4_

  - [ ] 8.2 Implement ImageScanner module
    - Create `src/scanner/imageScanner.ts` implementing the `ImageScanner` interface
    - Accept PNG, JPG, JPEG, WebP files
    - Use `Tesseract.recognize()` with English language worker
    - Return empty string when no text is found in image
    - Throw/catch errors for unprocessable images
    - _Requirements: 5.1, 5.4, 5.5_

- [ ] 9. Implement PrivacyAuditLog
  - [ ] 9.1 Implement PrivacyAuditLog module
    - Create `src/audit/privacyAuditLog.ts` implementing the `PrivacyAuditLog` interface
    - `log(entry)`: stores entry in localStorage, handles quota errors gracefully
    - `getSummary()`: computes `totalEntitiesDetected` (sum of all `entityCount`), `totalEntitiesProtected` (sum of `entityCount` for `"redact"` and `"auto-redact"` actions)
    - `getEntries()`: returns all entries, handles corrupt JSON by resetting to empty array
    - Store only category labels and counts — never actual PII text values
    - Detect localStorage unavailability on init
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ]* 9.2 Write property test for audit log integrity
    - **Property 8: Audit log integrity — no PII text leaks into log**
    - Generate PII events with random entity texts, categories, and counts
    - Verify the audit entry contains timestamp, entityCount, categories, and action but does NOT contain any original entity text values
    - Serialize entry to JSON and search for original texts — verify zero matches
    - **Validates: Requirements 10.1, 10.4**

  - [ ]* 9.3 Write property test for audit summary aggregation
    - **Property 9: Audit summary aggregation**
    - Generate sequences of audit entries with varying entity counts and actions
    - Verify `totalEntitiesDetected` equals sum of all `entityCount` values
    - Verify `totalEntitiesProtected` equals sum of `entityCount` for `"redact"` and `"auto-redact"` entries only
    - **Validates: Requirements 10.3**

  - [ ]* 9.4 Write unit tests for PrivacyAuditLog
    - Test entry creation and retrieval
    - Test summary computation
    - Test localStorage read/write
    - Test corrupt data recovery (JSON parse error → reset)
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [ ] 10. Implement ChatBackend
  - [ ] 10.1 Implement ChatBackend module
    - Create `src/chat/chatBackend.ts` implementing the `ChatBackend` interface
    - Use `@anthropic-ai/sdk` with `client.messages.create()` to send messages to Claude API
    - Transmit only approved message content — no PII metadata, redaction history, or audit data
    - Handle API errors (4xx/5xx), network failures, and missing/invalid API key
    - Retain user's message for retry on error
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 11. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Implement React UI components
  - [ ] 12.1 Implement ChatPage layout and MessageList
    - Create `src/components/ChatPage.tsx` as the main page component
    - Create `src/components/MessageList.tsx` with scrollable chat history, `UserMessage` and `AssistantMessage` bubbles
    - Display messages in chronological order
    - _Requirements: 11.3_

  - [ ] 12.2 Implement MessageInput with file upload and send button
    - Create `src/components/MessageInput.tsx` with TextArea, FileUploadButton, and SendButton
    - File upload accepts `.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`
    - SendButton disabled when gate is blocked
    - Wire `scanText()` on input change for instant regex feedback
    - Wire `scanOnSubmit()` on send action for full two-pass pipeline
    - _Requirements: 11.1, 11.2, 6.1_

  - [ ] 12.3 Implement ReviewPanel
    - Create `src/components/ReviewPanel.tsx` that slides in when PII is detected
    - Display `HighlightedText` with inline PII highlights
    - Display `EntityList` with per-entity redact toggles and severity badges (🔴🟡🟢)
    - Implement "Auto-Redact All" button
    - Implement "Override — I understand the risk" button with explicit confirmation
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ] 12.4 Implement ModelStatusIndicator and LoadingOverlay
    - Create `src/components/ModelStatusIndicator.tsx` showing AI model loading/ready/fallback states
    - Create `src/components/LoadingOverlay.tsx` shown during file scanning and AI inference
    - Trigger model pre-loading on app initialization
    - Display notice when in regex-only fallback mode
    - _Requirements: 11.4, 11.5, 12.2, 12.3, 12.4_

  - [ ] 12.5 Implement AuditLogPanel
    - Create `src/components/AuditLogPanel.tsx` displaying privacy protection history
    - Show `AuditSummary` with total entities detected and protected
    - List entries chronologically
    - _Requirements: 10.3_

- [ ] 13. Wire everything together and integration
  - [ ] 13.1 Wire the full pipeline in ChatPage
    - Connect MessageInput → UploadInterceptor → EthicsLogicGate → ReviewPanel → RedactionEngine → ChatBackend → MessageList
    - Manage `AppState` with React state/context
    - Wire PrivacyAuditLog to log events on each gate evaluation
    - Handle file upload flows (PDF → PDFScanner → pipeline, Image → ImageScanner → pipeline)
    - Display error toasts for file processing failures and API errors
    - _Requirements: 3.1, 3.2, 4.2, 4.3, 4.4, 5.2, 5.3, 5.5, 9.1, 9.3_

  - [ ]* 13.2 Write integration tests for end-to-end flows
    - Test two-pass pipeline: text with PII → regex scan → AI scan (mocked) → merge → gate blocks → redact → gate opens → send
    - Test PDF flow: upload → extract → scan → review → redact → send
    - Test image flow: upload → OCR → scan → review → redact → send
    - Test chat flow: send approved message → Claude API (mocked) → response displayed
    - Test fallback mode: WebGPU unavailable → regex-only → UI notice
    - _Requirements: 3.1, 3.2, 4.2, 5.2, 9.1, 12.4_

  - [ ]* 13.3 Write component tests for React UI
    - Test ReviewPanel: renders highlighted entities, severity badges, toggle controls, auto-redact, override confirmation
    - Test MessageInput: file upload accepts correct types, send button disabled when gate blocked, loading indicator during scan
    - Test AuditLogPanel: displays summary stats, lists entries chronologically
    - Test ModelStatusIndicator: shows loading/ready/fallback states
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 11.2, 11.4_

- [ ] 14. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (Properties 1–9)
- Unit tests validate specific examples and edge cases
- The PIIClassificationAgent (task 7) uses mocked model outputs in tests since the actual model requires WebGPU
- All detection and redaction logic is pure/stateless where possible, making it straightforward to test
