# Security & Privacy

## Reporting a vulnerability

If you find a security issue, please open a private report via GitHub Security
Advisories (Security → "Report a vulnerability") or open a regular issue for
non-sensitive concerns. Please don't disclose exploitable details publicly until
a fix is available.

## Privacy model

PrivacyLens is designed so that personal data never leaves the browser until the
user explicitly approves it:

- PII detection runs **locally** — an on-device model (WebGPU) and/or an instant
  regex scanner. The optional server `/api/scan` endpoint is for the same model
  on CPU and is never required.
- The send is **hard-blocked** when any personal data is detected; the user
  chooses what to redact, keep, or cancel.
- The static build is tested to make **zero external network requests**
  (`scripts/test-static-demo.mjs`).
- The Chrome extension makes **no server calls** — detection, OCR, and PDF
  parsing all run in the browser.

The only outbound requests the detector can make are to download the open-source
model weights (Hugging Face) the first time the deep model is used — never user
content. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and
[docs/MODELS.md](docs/MODELS.md).

## Sample data is synthetic

All personal information in `public/samples/` and in the test/QA scripts
(names, SSNs, addresses, emails, phone numbers, account/employee IDs) is
**fictional**, created solely to exercise the detector. It does not correspond to
any real person. Do not treat any value in this repository as real credentials
or real PII.

## Secrets

No secrets are committed. The server reads `ANTHROPIC_API_KEY` from the
environment only (and runs without it, using a built-in demo assistant). Never
commit a real key; `.env` is git-ignored.
