// Vercel serverless function: POST /api/chat
//
// This is the chat backend for the deployed site. It is intentionally
// SELF-CONTAINED with no imports from ../src: Vercel compiles this file to ESM
// and does not reliably bundle cross-directory relative imports, so importing
// ../src/lib/* crashes the function at runtime with ERR_MODULE_NOT_FOUND. The
// provider logic here mirrors src/lib/chat-providers.ts (used by the local
// server.ts); keep the two in sync.
//
// Configure in the Vercel project's Environment Variables (Preview + Production):
//   GEMINI_API_KEY   - enables live Gemini replies (default provider)
//   GEMINI_MODEL     - optional, defaults to gemini-flash-latest
//   ANTHROPIC_API_KEY / CLAUDE_MODEL - optional Claude fallback
//   CHAT_PROVIDER    - optional: force "gemini" | "claude"
//
// With no key set (or on any provider failure) the function returns a 502 and
// the web client falls back to its built-in demo assistant.

interface VercelRequest {
  method?: string;
  body?: unknown;
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
}

type ChatMessage = { role: "user" | "assistant"; content: string };
type ChatVia = "gemini" | "claude";

const SYSTEM_PROMPT =
  "You are a helpful assistant inside PrivacyLens, a tool that redacts personal " +
  "data before it reaches an AI. The user's messages may contain redaction " +
  "placeholders such as [NAME], [EMAIL], [PHONE], [ADDRESS], [SSN], or [SECRET]. " +
  "Answer as helpfully as if the real values were present - the redacted details " +
  "are almost never needed to help. Never ask the user to reveal redacted " +
  "information. Keep replies concise and well structured.";

const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";
const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-20250514";
const MAX_OUTPUT_TOKENS = 1024;

function resolveProvider(): ChatVia | null {
  const forced = process.env.CHAT_PROVIDER?.toLowerCase();
  if (forced === "gemini") return process.env.GEMINI_API_KEY ? "gemini" : null;
  if (forced === "claude") return process.env.ANTHROPIC_API_KEY ? "claude" : null;

  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "claude";
  return null;
}

async function callGemini(messages: ChatMessage[]): Promise<string> {
  const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY as string,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      // Gemini uses "model" for the assistant role.
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      // Flash models "think" by default and can spend the whole token budget
      // on hidden reasoning; disable it for fast, complete replies.
      generationConfig: {
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Gemini API ${response.status}: ${detail.slice(0, 300)}`);
  }

  const data: any = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts)
    ? parts.map((p: any) => p?.text ?? "").join("").trim()
    : "";
  if (!text) throw new Error("Gemini returned an empty response");
  return text;
}

async function callClaude(messages: ChatMessage[]): Promise<string> {
  const model = process.env.CLAUDE_MODEL || DEFAULT_CLAUDE_MODEL;
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY as string,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: SYSTEM_PROMPT,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Claude API ${response.status}: ${detail.slice(0, 300)}`);
  }

  const data: any = await response.json();
  const block = Array.isArray(data?.content)
    ? data.content.find((b: any) => b?.type === "text")
    : null;
  const text = block?.text?.trim() ?? "";
  if (!text) throw new Error("Claude returned an empty response");
  return text;
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  return (
    (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
  );
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = (typeof req.body === "string" ? safeParse(req.body) : req.body) as
    | { messages?: unknown }
    | undefined;
  const messages = body?.messages;

  if (!Array.isArray(messages) || !messages.every(isChatMessage)) {
    res.status(400).json({ error: "messages array required" });
    return;
  }

  const provider = resolveProvider();
  if (!provider) {
    // No key configured - let the client fall back to its demo assistant.
    res.status(502).json({ error: "No chat provider configured" });
    return;
  }

  try {
    const content =
      provider === "gemini"
        ? await callGemini(messages)
        : await callClaude(messages);
    res.status(200).json({ content, via: provider });
  } catch (err: any) {
    console.error(`Chat provider "${provider}" failed:`, err?.message || err);
    // Any provider failure degrades to the client-side demo assistant.
    res.status(502).json({ error: "Chat provider request failed" });
  }
}
