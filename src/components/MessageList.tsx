import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Message } from "../types";

interface Props {
  messages: Message[];
  loading: boolean;
}

export function MessageList({ messages, loading }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (messages.length === 0 && !loading) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-accent)]/10 flex items-center justify-center mx-auto mb-6">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--color-accent)]">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-[var(--color-text)] mb-2">
            See what AI sees before AI sees it
          </h2>
          <p className="text-sm leading-relaxed text-[var(--color-text-secondary)] max-w-[45ch] mx-auto">
            Type a message below. PrivacyLens will scan for personal information and let you review before anything is sent.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 justify-center">
            {[
              "My SSN is 123-45-6789",
              "Email me at john@example.com",
              "Call 555-867-5309",
            ].map((example) => (
              <span
                key={example}
                className="text-xs font-mono px-3 py-1.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)]"
              >
                {example}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 scrollbar-thin">
      <div className="max-w-3xl mx-auto space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                ease: [0.16, 1, 0.3, 1],
                delay: i === messages.length - 1 ? 0 : 0,
              }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-5 py-3.5 text-[15px] leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[var(--color-text)] text-white rounded-br-md"
                    : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] rounded-bl-md shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.redacted && (
                  <p className="mt-2 text-xs opacity-60 font-mono">
                    PII redacted before sending
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl rounded-bl-md px-5 py-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-[var(--color-text-secondary)]/40 animate-pulse"
                    style={{ animationDelay: `${i * 200}ms` }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
