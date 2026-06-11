import type { Message } from "../types";
import { generateDemoReply } from "./demo-assistant";

export interface ChatReply {
  content: string;
  via: "claude" | "demo";
}

type APIMessage = { role: "user" | "assistant"; content: string };

// Once the backend proves unreachable (static hosting), skip straight to
// the local demo assistant instead of waiting on a doomed fetch each send.
let backendUnreachable = false;

function demoReply(messages: APIMessage[]): ChatReply {
  return { content: generateDemoReply(messages), via: "demo" };
}

export async function sendChatMessage(messages: APIMessage[]): Promise<ChatReply> {
  if (backendUnreachable) return demoReply(messages);

  let res: Response;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
  } catch {
    backendUnreachable = true;
    return demoReply(messages);
  }

  const contentType = res.headers.get("content-type") || "";
  if (res.status === 404 || !contentType.includes("application/json")) {
    // Static host served its SPA fallback - there is no chat API here.
    backendUnreachable = true;
    return demoReply(messages);
  }

  if (!res.ok) {
    // Real backend errored (missing key, quota, network). Keep the demo
    // usable instead of surfacing a dead end; the reply is labeled.
    console.warn(`Chat API error ${res.status}; using demo assistant.`);
    return demoReply(messages);
  }

  const data = await res.json();
  return { content: data.content, via: data.via === "demo" ? "demo" : "claude" };
}

export function messagesToAPI(messages: Message[]): APIMessage[] {
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
}
