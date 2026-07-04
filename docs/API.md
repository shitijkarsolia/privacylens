# API Reference

The Express server ([`server.ts`](../server.ts)) exposes three JSON endpoints
and serves the built `dist/` as static files. **All three are optional** — the
web app degrades gracefully when they're absent (static hosting), and the Chrome
extension never calls them. See
[ARCHITECTURE.md](ARCHITECTURE.md#runtime-modes-how-its-deployed).

Base URL in development: `http://localhost:3001` (Vite proxies `/api` here from
`:5173`). In production the server serves the app and API on the same origin.

---

## `GET /api/model-status`

Reports whether the server-side detection model has finished loading. The web
app polls this every 2s until it resolves, to pick its detection tier.

**Response `200`**
```json
{ "state": "ready" }                       // model loaded — use /api/scan
{ "state": "loading" }                      // still loading at startup
{ "state": "failed", "error": "<message>" } // model unavailable — client uses regex
```

A non-JSON or `404` response (e.g. a static host returning the SPA shell) is the
signal the client uses to switch to in-browser detection.

---

## `POST /api/scan`

Runs the server-side `openai/privacy-filter` model over a string and returns
detected PII entities. Used by detection **tier 1** only.

**Request**
```json
{ "text": "Hi, I'm Aisha Patel, SSN 291-78-4290" }
```

**Response `200`**
```json
{
  "entities": [
    { "category": "private_person", "text": "Aisha Patel", "start": 8,  "end": 19, "confidence": 0.999, "source": "model" },
    { "category": "account_number", "text": "291-78-4290", "start": 25, "end": 36, "confidence": 0.999, "source": "model" }
  ]
}
```

`PIIEntity` fields (see [`src/types.ts`](../src/types.ts)): `category`, `text`,
`start`, `end` (char offsets), `confidence` (0–1), `source` (`"model"` |
`"regex"`). Entities are post-processed by
[`model-entities.ts`](../src/lib/model-entities.ts) (adjacent-fragment merging,
low-confidence filtering). The client further merges these with its own regex
results, where more **specific** labels win (e.g. `ssn` over `account_number`).

**Errors:** `400` `{ "error": "text string required" }` ·
`503` `{ "error": "Model not ready yet" }` ·
`500` `{ "error": "<message>" }`

---

## `POST /api/chat`

Returns an assistant reply. Provider is resolved from environment variables:
Gemini by default, then Claude, then the built-in demo assistant. On the
deployed site this is a Vercel serverless function ([`api/chat.ts`](../api/chat.ts));
locally it is served by [`server.ts`](../server.ts). Both delegate to the same
module ([`src/lib/chat-providers.ts`](../src/lib/chat-providers.ts)).

**Environment variables**

| Variable | Effect |
|---|---|
| `GEMINI_API_KEY` | Enables live Gemini replies (default provider). |
| `GEMINI_MODEL` | Optional. Defaults to `gemini-flash-latest`. |
| `ANTHROPIC_API_KEY` | Enables Claude as the fallback provider. |
| `CLAUDE_MODEL` | Optional. Defaults to `claude-sonnet-4-20250514`. |
| `CHAT_PROVIDER` | Optional. Force `gemini` \| `claude` \| `demo`. |

With no keys set, replies come from the built-in demo assistant. Gemini "flash"
models reason by default; the request disables that (`thinkingBudget: 0`) for
fast, complete demo replies.

**Request**
```json
{ "messages": [ { "role": "user", "content": "Review my redacted offer letter [SSN]" } ] }
```

**Response `200`**
```json
{ "content": "…assistant reply…", "via": "gemini" }   // GEMINI_API_KEY set (default)
{ "content": "…assistant reply…", "via": "claude" }   // ANTHROPIC_API_KEY set
{ "content": "…assistant reply…", "via": "demo" }     // no key → demo assistant
```

The system prompt instructs the model that the user may send redacted
placeholders (`[NAME]`, `[SSN]`, …) and to never ask for the redacted values.
The `via` field lets the UI label demo replies. Any provider failure (missing
key, quota, network, empty response) degrades to the demo assistant.

**Errors:** `400` `{ "error": "messages array required" }` ·
`500` `{ "error": "<message>" }` (the web client treats any failure as a cue to
fall back to the local demo assistant, so the demo never dead-ends).

---

## Client behavior summary

| Condition | Detection | Chat |
|---|---|---|
| Server up, model `ready` | `/api/scan` (tier 1) | `/api/chat` → Gemini/Claude or demo |
| Server up, model `failed` | regex (tier 3) | `/api/chat` |
| No server (static host) | WebGPU model (tier 2) or regex (tier 3) | local demo assistant |

Client logic: [`src/hooks/useModelLoader.ts`](../src/hooks/useModelLoader.ts)
(detection), [`src/lib/chat-api.ts`](../src/lib/chat-api.ts) (chat).
