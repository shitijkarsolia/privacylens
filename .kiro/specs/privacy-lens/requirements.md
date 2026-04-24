# Requirements Document

## Introduction

PrivacyLens is a privacy-first chat interface that intercepts all user-submitted content (text messages, images, and PDFs) before transmission to any AI backend. PrivacyLens detects Personally Identifiable Information (PII) locally on the user's device using a two-pass detection system (regex patterns and an on-device AI model), presents detected PII to the user for review, and offers automatic redaction. No sensitive data leaves the browser until the user explicitly approves it. The chat backend communicates with the Claude API to provide AI responses to redacted messages.

## Glossary

- **Chat_UI**: The React-based chat interface where users compose messages, upload files, and view AI responses.
- **Upload_Interceptor**: The processing layer that receives user-submitted content (text, images, PDFs) and routes it to the appropriate scanner before any data is transmitted externally.
- **Text_Scanner**: The component that analyzes plain text input for PII using regex pattern matching.
- **Image_Scanner**: The component that extracts text from uploaded images using Tesseract.js OCR and then scans the extracted text for PII.
- **PDF_Scanner**: The component that extracts text from uploaded PDF documents using pdfjs-dist and then scans the extracted text for PII.
- **PII_Classification_Agent**: The on-device AI model (openai/privacy-filter via Transformers.js with WebGPU) that performs semantic PII detection across 8 categories: private_person, private_email, private_phone, private_address, private_date, private_url, account_number, and secret.
- **Regex_Scanner**: The fast-path PII detection component that uses regular expression patterns to identify structured PII (SSN, email, phone number, date, credit card number) instantly.
- **Ethics_Logic_Gate**: The hard-blocking guardrail that disables message transmission when PII is detected, requires user review and explicit approval, and generates redacted alternatives.
- **Review_Panel**: The UI component that displays detected PII entities highlighted in context with severity badges (🔴 high, 🟡 medium, 🟢 low) and provides redaction controls.
- **Privacy_Audit_Log**: A local-only log stored in the browser that records PII detection events, user redaction decisions, and protection statistics. This log is never transmitted externally.
- **Redaction_Engine**: The component that replaces detected PII entities with category-specific placeholder tokens (e.g., [NAME], [EMAIL], [PHONE]).
- **Chat_Backend**: The server-side integration with the Claude API (Anthropic SDK) that receives approved or redacted messages and returns AI responses.
- **PII**: Personally Identifiable Information — any data that can identify a specific individual, including names, email addresses, phone numbers, physical addresses, dates of birth, URLs, Social Security Numbers, credit card numbers, and account numbers.
- **Two_Pass_Detection**: The detection strategy where the Regex_Scanner provides instant structured PII detection and the PII_Classification_Agent provides deeper semantic PII detection.

## Requirements

### Requirement 1: Text PII Detection via Regex

**User Story:** As a user, I want my typed messages to be instantly scanned for structured PII patterns, so that common sensitive data like SSNs and emails are caught immediately without waiting for the AI model.

#### Acceptance Criteria

1. WHEN a user types or pastes text into the Chat_UI message input, THE Regex_Scanner SHALL scan the text for SSN patterns, email addresses, phone numbers, dates, and credit card numbers.
2. WHEN the Regex_Scanner detects one or more PII matches, THE Regex_Scanner SHALL return a list of detected entities, each containing the matched text, the PII category, and the start and end character positions within the input.
3. THE Regex_Scanner SHALL complete scanning of a text input within 50 milliseconds for inputs up to 10,000 characters.
4. WHEN the Regex_Scanner receives an empty string, THE Regex_Scanner SHALL return an empty list of detected entities.

### Requirement 2: Semantic PII Detection via On-Device AI Model

**User Story:** As a user, I want an AI model running locally in my browser to detect PII that simple patterns cannot catch (such as names and addresses in prose), so that I have comprehensive privacy protection.

#### Acceptance Criteria

1. WHEN the user submits a message or file content for sending, THE PII_Classification_Agent SHALL analyze the text using the openai/privacy-filter model running locally via Transformers.js with WebGPU.
2. THE PII_Classification_Agent SHALL classify detected entities into exactly one of 8 categories: private_person, private_email, private_phone, private_address, private_date, private_url, account_number, or secret.
3. WHEN the PII_Classification_Agent detects an entity, THE PII_Classification_Agent SHALL return the entity text, the category, a confidence score between 0 and 1, and the start and end character positions.
4. WHEN WebGPU is not available in the user's browser, THE PII_Classification_Agent SHALL fall back to regex-only detection mode and THE Chat_UI SHALL display a notice informing the user that only pattern-based PII detection is active.

### Requirement 3: Two-Pass Detection Pipeline

**User Story:** As a user, I want both fast regex scanning and deep AI-based scanning to work together, so that I get instant feedback on obvious PII and thorough detection of subtle PII before anything is sent.

#### Acceptance Criteria

1. WHEN a user types or pastes text, THE Upload_Interceptor SHALL execute the Regex_Scanner immediately to provide instant PII feedback in the Chat_UI.
2. WHEN a user triggers a send action, THE Upload_Interceptor SHALL execute the PII_Classification_Agent on the full message content before allowing transmission.
3. WHEN both the Regex_Scanner and the PII_Classification_Agent detect the same PII entity, THE Upload_Interceptor SHALL merge the results into a single entity entry using the higher confidence score.
4. THE Upload_Interceptor SHALL combine results from both detection passes into a unified list of PII entities before passing them to the Ethics_Logic_Gate.

### Requirement 4: PDF Upload and PII Scanning

**User Story:** As a user, I want to upload PDF documents and have them scanned for PII before any content is sent to the AI, so that I can safely share document content without leaking sensitive information.

#### Acceptance Criteria

1. WHEN a user uploads a PDF file, THE PDF_Scanner SHALL extract all text content from the PDF using pdfjs-dist.
2. WHEN the PDF_Scanner extracts text from a PDF, THE PDF_Scanner SHALL pass the extracted text through the Two_Pass_Detection pipeline (Regex_Scanner followed by PII_Classification_Agent).
3. WHEN the PDF_Scanner detects PII in the extracted text, THE Upload_Interceptor SHALL trigger the Ethics_Logic_Gate with the detected entities before allowing the content to be sent.
4. IF the PDF_Scanner fails to parse an uploaded file, THEN THE Chat_UI SHALL display an error message stating that the file could not be processed and SHALL NOT send any content from that file.

### Requirement 5: Image Upload and PII Scanning via OCR

**User Story:** As a user, I want to upload images and screenshots and have them scanned for PII via OCR, so that sensitive information visible in images is detected before being shared with the AI.

#### Acceptance Criteria

1. WHEN a user uploads an image file (PNG, JPG, JPEG, or WebP), THE Image_Scanner SHALL extract text from the image using Tesseract.js OCR.
2. WHEN the Image_Scanner extracts text from an image, THE Image_Scanner SHALL pass the extracted text through the Two_Pass_Detection pipeline (Regex_Scanner followed by PII_Classification_Agent).
3. WHEN the Image_Scanner detects PII in the extracted text, THE Upload_Interceptor SHALL trigger the Ethics_Logic_Gate with the detected entities before allowing the content to be sent.
4. WHEN Tesseract.js extracts no text from an uploaded image, THE Image_Scanner SHALL report zero PII entities and THE Upload_Interceptor SHALL allow the content to proceed without triggering the Ethics_Logic_Gate for PII review.
5. IF the Image_Scanner fails to process an uploaded image, THEN THE Chat_UI SHALL display an error message stating that the image could not be processed and SHALL NOT send any content from that image.

### Requirement 6: Ethics Logic Gate — Hard Block on Send

**User Story:** As a user, I want the send button to be disabled whenever PII is detected in my message or uploaded content, so that I cannot accidentally transmit sensitive data to the AI backend.

#### Acceptance Criteria

1. WHEN the Upload_Interceptor reports one or more PII entities in the current message or attached files, THE Ethics_Logic_Gate SHALL disable the send button in the Chat_UI.
2. WHILE the Ethics_Logic_Gate is in a blocked state, THE Chat_UI SHALL display the Review_Panel showing all detected PII entities.
3. WHEN the user completes a review action (redact individual items, use auto-redacted version, or explicitly override), THE Ethics_Logic_Gate SHALL re-enable the send button.
4. WHEN no PII entities are detected in the current message and attached files, THE Ethics_Logic_Gate SHALL keep the send button enabled and SHALL NOT display the Review_Panel.

### Requirement 7: PII Review Panel

**User Story:** As a user, I want to see each detected PII entity highlighted in context with a severity indicator, so that I can make informed decisions about what to redact or approve.

#### Acceptance Criteria

1. WHEN the Ethics_Logic_Gate blocks a message, THE Review_Panel SHALL display the full message text with each detected PII entity visually highlighted inline.
2. THE Review_Panel SHALL display a severity badge next to each detected PII entity: 🔴 (high severity) for SSN, credit card, and account_number categories; 🟡 (medium severity) for private_person, private_address, and secret categories; 🟢 (low severity) for private_email, private_phone, private_date, and private_url categories.
3. THE Review_Panel SHALL provide a per-entity redact toggle allowing the user to redact or keep each individual PII entity.
4. THE Review_Panel SHALL provide an "Auto-Redact All" button that selects all detected PII entities for redaction in a single action.
5. THE Review_Panel SHALL provide an "Override — I understand the risk" button that allows the user to send the original unredacted message after explicit confirmation.

### Requirement 8: PII Redaction

**User Story:** As a user, I want detected PII to be replaced with safe placeholder tokens, so that the AI receives useful context without my actual sensitive data.

#### Acceptance Criteria

1. WHEN the user selects one or more PII entities for redaction, THE Redaction_Engine SHALL replace each selected entity in the message text with a category-specific placeholder token (e.g., [NAME], [EMAIL], [PHONE], [ADDRESS], [DATE], [URL], [ACCOUNT_NUMBER], [REDACTED]).
2. THE Redaction_Engine SHALL preserve all non-PII text in the message unchanged after redaction.
3. WHEN the user clicks "Auto-Redact All" in the Review_Panel, THE Redaction_Engine SHALL replace all detected PII entities with their corresponding placeholder tokens.
4. FOR ALL messages processed by the Redaction_Engine, redacting all detected PII entities and then scanning the redacted output with the Regex_Scanner SHALL produce zero PII detections for the redacted entity positions (round-trip property).

### Requirement 9: Chat Backend Integration

**User Story:** As a user, I want to send my approved or redacted messages to an AI and receive helpful responses, so that I can have a productive conversation while keeping my data private.

#### Acceptance Criteria

1. WHEN the user approves a message (either redacted or overridden) through the Ethics_Logic_Gate, THE Chat_Backend SHALL transmit the approved message to the Claude API using the Anthropic SDK.
2. WHEN the Claude API returns a response, THE Chat_UI SHALL display the response in the chat message list.
3. IF the Claude API returns an error, THEN THE Chat_UI SHALL display an error message to the user and SHALL retain the user's approved message for retry.
4. THE Chat_Backend SHALL transmit only the approved message content to the Claude API and SHALL NOT transmit any raw PII detection metadata, redaction history, or audit log data.

### Requirement 10: Local Privacy Audit Log

**User Story:** As a user, I want a local log of all PII detection and redaction events, so that I can review my privacy protection history and understand how PrivacyLens has helped me.

#### Acceptance Criteria

1. WHEN the Ethics_Logic_Gate processes a message containing PII, THE Privacy_Audit_Log SHALL record an entry containing the timestamp, the number of PII entities detected, the categories of detected entities, and the user's chosen action (redact, auto-redact, or override).
2. THE Privacy_Audit_Log SHALL store all entries exclusively in the browser's local storage and SHALL NOT transmit any audit log data to any external service.
3. WHEN the user views the Privacy_Audit_Log, THE Chat_UI SHALL display a summary including the total count of PII entities detected and protected across all sessions.
4. THE Privacy_Audit_Log SHALL NOT store the actual PII text values — only category labels and counts.

### Requirement 11: Chat User Interface

**User Story:** As a user, I want a clean and intuitive chat interface for composing messages, uploading files, and viewing AI responses, so that I can interact with the AI naturally while being protected by PrivacyLens.

#### Acceptance Criteria

1. THE Chat_UI SHALL provide a message input area where the user can type or paste text.
2. THE Chat_UI SHALL provide a file upload control that accepts PDF files (.pdf) and image files (.png, .jpg, .jpeg, .webp).
3. THE Chat_UI SHALL display a scrollable message list showing both user messages and AI responses in chronological order.
4. WHILE the PII_Classification_Agent or a file scanner is processing content, THE Chat_UI SHALL display a loading indicator to inform the user that scanning is in progress.
5. WHEN the application loads, THE Chat_UI SHALL begin pre-loading the PII_Classification_Agent model so that the model is ready when the user first submits content.

### Requirement 12: Model Pre-Loading and Fallback

**User Story:** As a user, I want the AI detection model to start loading as soon as I open the app, so that PII scanning is fast when I need it, and I still get protection even if the model cannot load.

#### Acceptance Criteria

1. WHEN the PrivacyLens application initializes, THE PII_Classification_Agent SHALL begin downloading and loading the openai/privacy-filter model in the background.
2. WHILE the PII_Classification_Agent model is loading, THE Regex_Scanner SHALL serve as the sole PII detection mechanism for all user input.
3. WHEN the PII_Classification_Agent model finishes loading, THE Chat_UI SHALL display an indicator confirming that full AI-powered PII detection is active.
4. IF the PII_Classification_Agent model fails to load, THEN THE Chat_UI SHALL display a notice that only pattern-based detection is available and THE Regex_Scanner SHALL remain the sole PII detection mechanism.
