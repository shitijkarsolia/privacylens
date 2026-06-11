// Self-hosted OCR runtime paths (staged by scripts/prepare-local-assets.mjs).
// Keeping worker, core, and language data on our own origin means image
// scanning involves no third-party CDN - consistent with the privacy story.

import { assetUrl } from "./routes";

export function localTesseractOptions() {
  const base = new URL(assetUrl("tesseract/"), window.location.href).toString();
  return {
    workerPath: base + "worker.min.js",
    corePath: base,
    langPath: base + "lang",
  };
}
