# PrivacyLens UI/UX Ralph Loop

Last updated: 2026-04-26

Taste Skill source reviewed: https://github.com/Leonxlnx/taste-skill

## Loop Status

| Loop | Focus | Status | Verification |
| --- | --- | --- | --- |
| 1 | Replace ambiguous override copy | Done | Side-panel test asserts `Attach originals unchanged` for files and `Send without redaction` for messages. |
| 2 | Unsupported-file paused state | Done | Side-panel test asserts supported-file guidance and `Remove paused files`. |
| 3 | Mixed attachment decision copy | Done | Side-panel test asserts safe-file and unscanned-file counts in the primary action. |
| 4 | Preview slider affordance | Done | Side-panel test asserts `Drag to compare` and `Safe copy`; screenshot captured. |
| 5 | Truthful PDF/image preview copy | Done | Side panel explains safe copies are rebuilt from extracted text. |
| 6 | Scanning and review-opening states | Done | Scanning state uses a spinner and site-neutral copy. |
| 7 | In-page fallback clarity | Done | Fixture asserts the fallback says the send/upload is paused. |
| 8 | Interaction polish | Done | Side-panel controls now include visible focus rings and pressed feedback. |
| 9 | Early file-input interception | Done | Fixture asserts original files are blocked on both `input` and `change` before page handlers receive them. |
| 10 | Full regression pass | Done | `npm run verify:extension` passed after the latest UI and guard updates. |

## Remaining UX Watch Items

- Real ChatGPT visual E2E is still blocked in this environment by the ChatGPT challenge page before the composer loads.
- The preview slider compares exact positions in the original and safe-copy preview. For documents where all text sits on the left edge, the user may need to drag the handle to reveal the original text.

## Demo Website Loop

| Loop | Focus | Status | Verification |
| --- | --- | --- | --- |
| D1 | Text-message review sends redacted text instead of creating a fake attachment | Done | `npm run test:demo` verifies `[SSN]` is sent and the original SSN is absent. |
| D2 | Keep/unselect behavior for demo messages | Done | `npm run test:demo` keeps email visible while redacting SSN. |
| D3 | Multi-file demo uploads | Done | `npm run test:demo` uploads risky, clean, and unsupported files together. |
| D4 | Unsupported and oversized file states | Done | `npm run test:demo` verifies `No scanned file to attach`, `Remove paused files`, and the 8 MB limit copy. |
| D5 | Demo review drawer visual pass | Done | Screenshot captured at `output/playwright/demo-review.png` after the drawer contrast fix. |
| D6 | Typed text cannot bypass scanning after files are attached | Done | `npm run test:demo` verifies a new SSN typed beside attached files opens review and does not call chat. |
| D7 | Demo safe multi-file attach preserves file chips | Done | `npm run test:demo` verifies risky and clean scanned files attach as separate chips. |
