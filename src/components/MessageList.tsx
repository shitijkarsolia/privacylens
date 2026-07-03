import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Message } from "../types";
import { assetUrl } from "../lib/routes";

const SAMPLE_FILES = [
  { name: "resume-emily-chen.pdf", label: "Resume PDF", type: "pdf" },
  { name: "invoice-wilson.pdf", label: "Invoice PDF", type: "pdf" },
  { name: "business-card.png", label: "Business Card", type: "image" },
  { name: "registration-form.png", label: "Registration Form", type: "image" },
  { name: "hr-email.txt", label: "HR Email", type: "text" },
  { name: "medical-intake.txt", label: "Medical Intake", type: "text" },
];

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Scans locally",
    text: "Every keystroke and file is checked on your device.",
  },
  {
    step: "2",
    title: "Blocks the send",
    text: "Detected personal data hard-stops the message.",
  },
  {
    step: "3",
    title: "You decide",
    text: "Redact, keep, or discard — nothing leaves until you approve.",
  },
];

interface Props {
  messages: Message[];
  loading: boolean;
  onSampleFile?: (files: File[]) => void;
  onExampleText?: (text: string) => void;
}

function RedactedMessageNote({ message }: { message: Message }) {
  const [showOriginal, setShowOriginal] = useState(false);

  return (
    <div className="mt-2 text-xs opacity-70">
      <div className="flex items-center gap-2">
        <p className="flex items-center gap-1.5 font-mono">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Personal data redacted before sending
        </p>
        {message.originalContent && (
          <button
            onClick={() => setShowOriginal((v) => !v)}
            className="font-mono underline decoration-dotted underline-offset-2 hover:opacity-80"
          >
            {showOriginal ? "hide original" : "show original"}
          </button>
        )}
      </div>
      {showOriginal && message.originalContent && (
        <div className="mt-2 rounded-lg bg-black/15 px-3 py-2">
          <p className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
            {message.originalContent}
          </p>
          <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wider opacity-80">
            Only visible here — never sent
          </p>
        </div>
      )}
    </div>
  );
}

export function MessageList({ messages, loading, onSampleFile, onExampleText }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSampleClick = async (sample: (typeof SAMPLE_FILES)[0]) => {
    if (!onSampleFile) return;
    try {
      const res = await fetch(assetUrl(`samples/${sample.name}`));
      const blob = await res.blob();
      const file = new File([blob], sample.name, { type: blob.type });
      onSampleFile([file]);
    } catch (err) {
      console.error("Failed to load sample:", err);
    }
  };

  if (messages.length === 0 && !loading) {
    return (
      <div className="flex-1 overflow-y-auto scrollbar-thin flex px-6 py-6">
        <div className="m-auto text-center max-w-xl">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-accent)]/10 flex items-center justify-center mx-auto mb-5">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--color-accent)]">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-[var(--color-text)] mb-2">
            See what AI sees before AI sees it
          </h2>
          <p className="text-sm leading-relaxed text-[var(--color-text-secondary)] max-w-[48ch] mx-auto mb-6">
            This is a real AI chat with a privacy gate in front of it. Type a message or
            upload files — anything sensitive is caught before it leaves your browser.
          </p>

          {/* How it works */}
          <div className="mb-7 grid grid-cols-3 gap-2 max-sm:grid-cols-1">
            {HOW_IT_WORKS.map((item) => (
              <div
                key={item.step}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-[10px] font-bold text-white">
                    {item.step}
                  </span>
                  <p className="text-xs font-bold text-[var(--color-text)]">{item.title}</p>
                </div>
                <p className="mt-1.5 text-[11px] leading-4 text-[var(--color-text-secondary)]">
                  {item.text}
                </p>
              </div>
            ))}
          </div>

          {/* Text examples */}
          <div className="mb-6">
            <p className="text-[11px] font-mono text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
              Try typing
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {[
                "My name is John Smith, SSN 123-45-6789",
                "Email me at sarah@company.com",
                "I live at 742 Evergreen Terrace, Springfield",
              ].map((example) => (
                <button
                  key={example}
                  onClick={() => onExampleText?.(example)}
                  className="text-xs font-mono px-3 py-1.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] transition hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-accent)]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/25"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          {/* Sample files */}
          <div>
            <p className="text-[11px] font-mono text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
              Or scan a sample file with planted personal data
            </p>
            <div className="grid grid-cols-3 gap-2 max-w-md mx-auto">
              {SAMPLE_FILES.map((sample) => (
                <button
                  key={sample.name}
                  onClick={() => handleSampleClick(sample)}
                  className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-accent)]/5 transition-all text-center group"
                >
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-canvas)] flex items-center justify-center group-hover:bg-[var(--color-accent)]/10 transition-colors">
                    {sample.type === "pdf" && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#E54D2E]">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <path d="M14 2v6h6" />
                      </svg>
                    )}
                    {sample.type === "image" && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#12A594]">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="m21 15-5-5L5 21" />
                      </svg>
                    )}
                    {sample.type === "text" && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#F5A623]">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                      </svg>
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-[var(--color-text)] leading-tight">
                    {sample.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 scrollbar-thin">
      <div className="max-w-3xl mx-auto space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
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
                {msg.redacted && <RedactedMessageNote message={msg} />}
                {msg.role === "assistant" && msg.via === "demo" && (
                  <p className="mt-2 text-[10px] uppercase tracking-wider font-mono text-[var(--color-text-secondary)]/70">
                    Demo assistant - add an API key for live Claude replies
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
