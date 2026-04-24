import type { Message } from "../types";

export async function sendChatMessage(
  messages: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Chat API error: ${res.status} — ${err}`);
  }

  const data = await res.json();
  return data.content;
}

export function messagesToAPI(
  messages: Message[]
): { role: "user" | "assistant"; content: string }[] {
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
}
