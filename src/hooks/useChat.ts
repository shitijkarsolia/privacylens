import { useState, useCallback } from "react";
import type { Message } from "../types";
import { sendChatMessage, messagesToAPI } from "../lib/chat-api";

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const send = useCallback(
    async (content: string, originalContent?: string) => {
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        originalContent,
        redacted: originalContent !== undefined && originalContent !== content,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        const allMessages = [...messages, userMsg];
        const apiMessages = messagesToAPI(allMessages);
        const reply = await sendChatMessage(apiMessages);

        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: reply.content,
          via: reply.via,
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err: any) {
        const errorMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Sorry, I couldn't process that request. ${err?.message || "Please try again."}`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setLoading(false);
      }
    },
    [messages]
  );

  return { messages, loading, send };
}
