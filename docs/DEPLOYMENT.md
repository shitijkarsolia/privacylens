# Deployment & Distribution

How to host the **web app** and distribute the **Chrome extension**. The web app
is *hosted*; the extension is *installed into the browser* and needs no hosting
to function. Background: [ARCHITECTURE.md](ARCHITECTURE.md#runtime-modes-how-its-deployed).

---

## Build outputs

| Command | Output | Use |
|---|---|---|
| `npm run build` | `dist/` at **root base** (`/`) | local full-stack server **and** the extension package |
| `npm run build:pages` | `dist/` at **subpath base** + `dist/404.html` + `dist/privacylens-extension.zip` | static hosting under a subpath |
| `npm run package:extension` | `privacylens-extension.zip` | a loadable extension zip (from the current `dist/`) |

> **Base path matters.** The extension's `sidepanel.html` references `/assets/…`,
> so the extension zip **must** come from a **root-base** build.
> `build:pages` handles this: it builds the zip from a separate root-base build,
> then builds the site at the subpath. Set the subpath via `PAGES_BASE`
> (default `/privacylens/`); use `/` for root-domain hosts.

---

## 1. Full-stack (own server / VM / container)

Runs all three API routes; detection uses the server CPU model (tier 1), chat
uses Claude when a key is set.

```bash
npm install
npm run build
ANTHROPIC_API_KEY=sk-...   npm run server   # key optional; omit for demo assistant
# Serves app + API on http://localhost:3001  (PORT overrides)
```

Good fits: Render, Railway, Fly.io, a Docker container, or any Node host. The
server loads the 1.5B model into memory once at startup and keeps it resident,
so it needs a **long-running process** (not ephemeral functions) and enough RAM.
Only `ANTHROPIC_API_KEY` is read from the environment.

---

## 2. Static hosting (Vercel / Netlify / S3)

No backend. Detection falls back to the **in-browser WebGPU model** (or regex),
chat uses the **demo assistant**. Everything stays in the browser — verified by
[`scripts/test-static-demo.mjs`](../scripts/test-static-demo.mjs), which asserts
**zero external requests**.

Two requirements for any static host:
1. Build at the right base (root domain → `npm run build`; subpath → `build:pages`).
2. An **SPA fallback** so `/demo` and `/install` resolve to `index.html`
   (`build:pages` writes `dist/404.html`; other hosts use a rewrite — below).

### Vercel
Static frontend works out of the box. Build at root base and add an SPA rewrite:

```jsonc
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/((?!assets/|tesseract/|samples/|.*\\.).*)", "destination": "/index.html" }]
}
```

To get **live Claude chat on Vercel**, add a serverless function (e.g.
`api/chat.ts`) that mirrors the `/api/chat` handler in `server.ts` and reads
`ANTHROPIC_API_KEY` from project env. Do **not** try to run `/api/scan` on
Vercel — the resident 1.5B model doesn't fit the serverless model; rely on the
in-browser detector instead (it's already the static-mode default).

### Netlify
Same idea: `publish = "dist"`, `command = "npm run build"`, and a redirect
`/* /index.html 200`. Live chat via a Netlify Function mirroring `/api/chat`.

---

## 3. The Chrome extension

The extension is **not hosted** — it runs entirely in the browser (no `/api`, no
server). Hosting only ever *serves the download and the install page*.

### Sideload (works today, for testers/demos)
```bash
npm run build            # or: npm run package:extension  →  privacylens-extension.zip
# Chrome → chrome://extensions → enable Developer mode → "Load unpacked" → select ./dist
# (or unzip privacylens-extension.zip and load that folder)
```
Then open ChatGPT / Claude / Gemini / Perplexity / Copilot. Full walkthrough:
[INSTALL_EXTENSION.md](INSTALL_EXTENSION.md). Current capabilities & known
limits: [EXTENSION_STATUS.md](EXTENSION_STATUS.md).

### Chrome Web Store (for real users)
Upload the same `privacylens-extension.zip` to the
[Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
for a public, one-click-install listing. The zip is store-shaped already (valid
MV3 `manifest.json`, icons, all assets bundled); the store path adds review +
listing, not code changes.

| Path | How | For whom |
|---|---|---|
| Sideload | download zip → Load unpacked | you, testers, demos |
| Web Store | upload zip → listing | real users |

---

## Configuration reference

| Variable | Read by | Effect |
|---|---|---|
| `ANTHROPIC_API_KEY` | `server.ts` (and any serverless `/api/chat`) | enables live Claude chat; absent → demo assistant |
| `PORT` | `server.ts` | server port (default `3001`) |
| `PAGES_BASE` | `vite.config.ts` (build time) | base path for static subpath hosting (default `/`) |

No other secrets or services are required; PII detection never needs an API key.
