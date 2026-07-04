// Server-side chat backend shared by the local Express server (server.ts) and
// the Vercel serverless function (api/chat.ts), so there is a single code path.
//
// Provider precedence: Gemini (default) -> Claude -> built-in demo assistant.
// Selection is by which API key is present; set CHAT_PROVIDER to force one.
// Nothing here ever sees un-redacted data the user didn't approve - the client
// only sends what cleared the ethics gate.

import { generateDemoReply } from "./demo-assistant";

export type ChatVia = "gemini" | "claude" | "demo";

export interface ChatReply {
  content: string;
  via: ChatVia;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT =
  "You are a helpful assistant inside PrivacyLens, a tool that redacts personal " +
  "data before it reaches an AI. The user's messages may contain redaction " +
  "placeholders such as [NAME], [EMAIL], [PHONE], [ADDRESS], [SSN], or [SECRET]. " +
  "Answer as helpfully as if the real values were present - the redacted details " +
  "are almost never needed to help. Never ask the user to reveal redacted " +
  "information. Keep replies concise and well structured.";

// gemini-flash-latest is a stable alias that tracks the current flash model.
// Flash models "think" by default and can spend the whole token budget on
// hidden reasoning; we disable that for fast, complete demo replies.
const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";
const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-20250514";
const MAX_OUTPUT_TOKENS = 1024;

function resolveProvider(): ChatVia | null {
  const forced = process.env.CHAT_PROVIDER?.toLowerCase();
  if (forced === "gemini") return process.env.GEMINI_API_KEY ? "gemini" : null;
  if (forced === "claude") return process.env.ANTHROPIC_API_KEY ? "claude" : null;
  if (forced === "demo") return "demo";

  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "claude";
  return null;
}

/** Which backend replies would come from, for logging/status. */
export function activeChatProvider(): ChatVia {
  return resolveProvider() ?? "demo";
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

/**
 * Produce a chat reply from the configured provider. Any provider failure
 * (missing key, quota, network, empty response) degrades to the built-in demo
 * assistant so the flow stays usable; the returned `via` labels the source.
 */
export async function generateChatReply(messages: ChatMessage[]): Promise<ChatReply> {
  const provider = resolveProvider();

  try {
    if (provider === "gemini") return { content: await callGemini(messages), via: "gemini" };
    if (provider === "claude") return { content: await callClaude(messages), via: "claude" };
  } catch (err: any) {
    console.error(`Chat provider "${provider}" failed:`, err?.message || err);
  }

  return { content: generateDemoReply(messages), via: "demo" };
}
