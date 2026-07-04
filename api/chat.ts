// Vercel serverless function: POST /api/chat
//
// This is the chat backend for the deployed site. It mirrors the local Express
// route in server.ts by delegating to the shared provider module, so Gemini
// (default), Claude, and the demo fallback behave identically in both places.
//
// Configure in the Vercel project's Environment Variables:
//   GEMINI_API_KEY   - enables live Gemini replies (default provider)
//   GEMINI_MODEL     - optional, defaults to gemini-flash-latest
//   ANTHROPIC_API_KEY / CLAUDE_MODEL - optional Claude fallback
//   CHAT_PROVIDER    - optional: force "gemini" | "claude" | "demo"
//
// With no keys set, replies come from the built-in demo assistant.

import { generateChatReply, type ChatMessage } from "../src/lib/chat-providers";

interface VercelRequest {
  method?: string;
  body?: unknown;
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  return (
    (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
  );
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

  try {
    const reply = await generateChatReply(messages);
    res.status(200).json(reply);
  } catch (err: any) {
    console.error("Chat handler error:", err?.message || err);
    res.status(500).json({ error: "Internal server error" });
  }
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
