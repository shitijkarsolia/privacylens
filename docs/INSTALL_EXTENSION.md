# Install PrivacyLens Extension

PrivacyLens builds a Chrome MV3 extension into `dist`.

## Steps

1. Build the app and extension assets.

   ```bash
   npm run build
   ```

   To run the same verification loop used during development:

   ```bash
   npm run verify:extension
   ```

2. Open Chrome extensions.

   ```text
   chrome://extensions
   ```

3. Enable **Developer mode**.

4. Click **Load unpacked** and select:

   ```text
   ./dist
   ```

5. Open a supported AI chat:

   - `https://chatgpt.com`
   - `https://chat.openai.com`
   - `https://claude.ai`
   - `https://gemini.google.com`
   - `https://www.perplexity.ai`
   - `https://copilot.microsoft.com`

6. Confirm it is working by pasting sample personal data or uploading a sample file. For example:

   ```text
   Aisha Patel, SSN 291-XX-XXXX
   ```

## Expected Behavior

- PII detected while typing updates the toolbar badge and side panel state.
- Sending a risky message is blocked.
- Rows marked **Redact** are replaced; rows marked **Keep** are approved for that one send.
- The primary action sends after applying the selected redactions.
- The risky override is labeled by outcome, for example **Attach originals unchanged** for files or **Send without redaction** for messages.
- Text, PDF, and image files are extracted/scanned when pasted, dropped, or selected through file inputs.
- Risky file-input attachments are held back before ChatGPT receives the original file.
- The side panel opens for review, shows a before/after preview slider, and offers **Attach redacted copy**.
- If Chrome does not allow the side panel to open automatically, PrivacyLens shows a small in-page review banner with an **Open review** button.
- **Attach redacted copy** adds a sanitized copy back into ChatGPT as the attachment. Text files stay text, PDFs become redacted PDFs, and images become sanitized PNG previews from OCR text.
- Multiple scanned attachments are handled together: risky files are redacted, clean scanned files remain attached, and unsupported files are omitted from the safe action.
- Unsupported, unreadable, or over-8 MB files pause the upload and require a deliberate original-file override.

## Known Limits

- ChatGPT is the primary tested target.
- Contenteditable composers support in-composer CSS highlights. Textarea-based surfaces use the badge and side panel review flow.
- `openai/privacy-filter` is bundled for MV3 loading, but live model download/inference still needs an unpacked-extension smoke test on the target machine. Regex protection remains active if the model is unavailable.
- Browser side panel opening is requested automatically when scanning/blocking starts. Chrome may still require the user to allow or focus the extension side panel depending on the browser build.
