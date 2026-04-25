import { useState, useRef, useCallback, useEffect } from "react";
import type { DetectionResult } from "../types";
import type { AttachedFile } from "./ChatPage";

interface Props {
  onSubmit: (text: string) => void;
  onTextChange: (text: string) => void;
  onFileUpload: (file: File) => void;
  blocked: boolean;
  result: DetectionResult | null;
  scanning: boolean;
  disabled: boolean;
  fileScanning?: boolean;
  fileName?: string;
  modelLoading?: boolean;
  attachedFile?: AttachedFile | null;
  onRemoveAttachment?: () => void;
}

export function MessageInput({
  onSubmit,
  onTextChange,
  onFileUpload,
  blocked,
  result,
  scanning,
  disabled,
  fileScanning,
  fileName,
  modelLoading,
  attachedFile,
  onRemoveAttachment,
}: Props) {
  const [text, setText] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleChange = useCallback(
    (value: string) => {
      setText(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onTextChange(value);
      }, 150);
    },
    [onTextChange]
  );

  const handleSubmit = useCallback(() => {
    if ((!text.trim() && !attachedFile) || disabled) return;
    onSubmit(text);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, disabled, onSubmit, attachedFile]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [text]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) onFileUpload(file);
    },
    [onFileUpload]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileUpload(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [onFileUpload]
  );

  const entityCount = result?.entities.length ?? 0;
  const showWarning = entityCount > 0 && text.trim().length > 0;
  const canSend = (text.trim() || attachedFile) && !disabled && !scanning;

  return (
    <div
      className={`border-t bg-[var(--color-surface)]/80 backdrop-blur-xl transition-colors ${
        dragOver
          ? "border-[var(--color-accent)] bg-[var(--color-accent)]/5"
          : "border-[var(--color-border)]"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div className="max-w-3xl mx-auto px-4 py-3">
        {modelLoading && (
          <div className="mb-2 flex items-center gap-2 text-xs font-mono px-3 py-2 rounded-lg bg-[#F5A623]/5 border border-[#F5A623]/15 text-[#9A6700]">
            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
            AI privacy model loading — send will be available once ready
          </div>
        )}

        {showWarning && (
          <div className="mb-2 flex items-center gap-2 text-xs font-mono px-3 py-2 rounded-lg bg-[#E54D2E]/5 border border-[#E54D2E]/15 text-[#E54D2E]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            {entityCount} personal data item{entityCount !== 1 ? "s" : ""} detected — review required before sending
          </div>
        )}

        {fileScanning && fileName && (
          <div className="mb-2 flex items-center gap-2 text-xs font-mono px-3 py-2.5 rounded-xl bg-[var(--color-accent)]/5 border border-[var(--color-accent)]/15 text-[var(--color-accent)]">
            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
            <span className="font-medium">{fileName}</span>
            <span className="text-[var(--color-text-secondary)]">— scanning for personal data...</span>
          </div>
        )}

        {dragOver && (
          <div className="mb-2 flex items-center justify-center gap-2 text-xs font-mono px-3 py-3 rounded-lg border-2 border-dashed border-[var(--color-accent)] text-[var(--color-accent)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            Drop file to scan for PII
          </div>
        )}

        {/* Attached file chip */}
        {attachedFile && (
          <div className="mb-2 flex items-center gap-2">
            <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium ${
              attachedFile.redacted
                ? "bg-[var(--color-accent)]/5 border-[var(--color-accent)]/20 text-[var(--color-accent)]"
                : "bg-[var(--color-canvas)] border-[var(--color-border)] text-[var(--color-text)]"
            }`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
              <span>{attachedFile.name}</span>
              {attachedFile.redacted && (
                <span className="px-1.5 py-0.5 rounded bg-[var(--color-accent)]/10 text-[10px] uppercase tracking-wider">
                  redacted
                </span>
              )}
              <button
                onClick={onRemoveAttachment}
                className="w-4 h-4 rounded-full hover:bg-black/10 flex items-center justify-center transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.txt"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || fileScanning}
            className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-canvas)] transition-colors disabled:opacity-40"
            title="Upload file (PDF, image, text)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>

          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => handleChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={attachedFile ? `Ask about ${attachedFile.name}...` : "Type a message or drop a file..."}
              rows={1}
              className="w-full resize-none rounded-2xl border border-[var(--color-border)] bg-[var(--color-canvas)] px-4 py-3 text-[15px] leading-relaxed text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20 focus:border-[var(--color-accent)]/40 transition-all"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!canSend}
            className={`flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-95 ${
              blocked && text.trim()
                ? "bg-[#E54D2E] text-white hover:opacity-90"
                : canSend
                  ? "bg-[var(--color-text)] text-white hover:opacity-90"
                  : "bg-[var(--color-border)] text-[var(--color-text-secondary)] cursor-not-allowed"
            }`}
          >
            {scanning ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            )}
          </button>
        </div>

        <p className="mt-2 text-[11px] text-[var(--color-text-secondary)]/60 text-center font-mono">
          All PII detection runs locally on this server. Nothing leaves until you approve.
        </p>
      </div>
    </div>
  );
}
