import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import type { DetectionResult, PIIEntity, Severity } from "../types";
import { SEVERITY_MAP } from "../types";
import type { AttachedFile } from "./ChatPage";

interface Props {
  text: string;
  onSubmit: (text: string) => void;
  onTextChange: (text: string) => void;
  onFileUpload: (files: File[]) => void;
  blocked: boolean;
  result: DetectionResult | null;
  scanning: boolean;
  disabled: boolean;
  fileScanning?: boolean;
  fileName?: string;
  modelLoading?: boolean;
  attachedFiles?: AttachedFile[];
  onRemoveAttachment?: (index: number) => void;
}

const SEVERITY_CHIP: Record<Severity, string> = {
  high: "bg-[#E54D2E]/10 text-[#C13215] border-[#E54D2E]/25",
  medium: "bg-[#F5A623]/10 text-[#9A6700] border-[#F5A623]/30",
  low: "bg-[#12A594]/10 text-[#0E8578] border-[#12A594]/25",
};

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

function categoryLabel(category: string) {
  return category.replace("private_", "").replace(/_/g, " ");
}

/** Entities whose offsets still match the current composer text. */
function matchingEntities(text: string, entities: PIIEntity[]): PIIEntity[] {
  return entities.filter(
    (entity) =>
      entity.end <= text.length && text.slice(entity.start, entity.end) === entity.text
  );
}

function ComposerHighlights({ text, entities }: { text: string; entities: PIIEntity[] }) {
  const segments = useMemo(() => {
    const valid = matchingEntities(text, entities).sort((a, b) => a.start - b.start);
    const parts: { text: string; severity: Severity | null }[] = [];
    let cursor = 0;
    for (const entity of valid) {
      if (entity.start < cursor) continue;
      if (entity.start > cursor) parts.push({ text: text.slice(cursor, entity.start), severity: null });
      parts.push({ text: text.slice(entity.start, entity.end), severity: SEVERITY_MAP[entity.category] });
      cursor = entity.end;
    }
    if (cursor < text.length) parts.push({ text: text.slice(cursor), severity: null });
    return parts;
  }, [text, entities]);

  return (
    <>
      {segments.map((seg, i) =>
        seg.severity ? (
          <mark key={i} className={`sev-${seg.severity}`}>
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
      {/* Trailing newline keeps the mirror height in sync with the textarea */}
      {"\n"}
    </>
  );
}

export function MessageInput({
  text,
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
  attachedFiles = [],
  onRemoveAttachment,
}: Props) {
  const [dragOver, setDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (value: string) => {
      onTextChange(value);
    },
    [onTextChange]
  );

  const handleSubmit = useCallback(() => {
    if ((!text.trim() && attachedFiles.length === 0) || disabled) return;
    onSubmit(text);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, disabled, onSubmit, attachedFiles.length]);

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

  const syncMirrorScroll = useCallback(() => {
    if (mirrorRef.current && textareaRef.current) {
      mirrorRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  useEffect(syncMirrorScroll, [text, syncMirrorScroll]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files || []);
      if (files.length) onFileUpload(files);
    },
    [onFileUpload]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length) onFileUpload(files);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [onFileUpload]
  );

  const liveEntities = useMemo(
    () => (result ? matchingEntities(text, result.entities) : []),
    [result, text]
  );

  const categoryChips = useMemo(() => {
    const byCategory = new Map<string, { severity: Severity; count: number }>();
    for (const entity of liveEntities) {
      const existing = byCategory.get(entity.category);
      if (existing) existing.count += 1;
      else byCategory.set(entity.category, { severity: SEVERITY_MAP[entity.category], count: 1 });
    }
    return [...byCategory.entries()]
      .map(([category, info]) => ({ category, ...info }))
      .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  }, [liveEntities]);

  const entityCount = liveEntities.length;
  // Hidden while the review panel is open (disabled) so its status banner is
  // the single source of truth for what was detected.
  const showWarning = entityCount > 0 && text.trim().length > 0 && !disabled;
  const canSend = Boolean(text.trim() || attachedFiles.length > 0) && !disabled && !scanning;

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
            AI privacy model warming up - regex protection is already active
          </div>
        )}

        {showWarning && (
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs px-3 py-2 rounded-xl bg-[#E54D2E]/5 border border-[#E54D2E]/15">
            <span className="flex items-center gap-1.5 font-mono font-semibold text-[#E54D2E]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M12 8v4m0 4h.01" />
              </svg>
              {entityCount} detected — send is paused
            </span>
            <span className="flex flex-wrap items-center gap-1.5">
              {categoryChips.map((chip) => (
                <span
                  key={chip.category}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono ${SEVERITY_CHIP[chip.severity]}`}
                >
                  {categoryLabel(chip.category)}
                  {chip.count > 1 ? ` ×${chip.count}` : ""}
                </span>
              ))}
            </span>
            <button
              onClick={handleSubmit}
              disabled={!canSend}
              className="ml-auto shrink-0 inline-flex items-center gap-1.5 rounded-full bg-[#E54D2E] px-3 py-1.5 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Review &amp; redact
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
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
            Drop files to scan for personal data
          </div>
        )}

        {/* Attached file chip */}
        {attachedFiles.length > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {attachedFiles.map((attachedFile, index) => (
              <div
                key={`${attachedFile.name}-${index}`}
                className={`inline-flex min-w-0 items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium ${
                  attachedFile.redacted
                    ? "bg-[var(--color-accent)]/5 border-[var(--color-accent)]/20 text-[var(--color-accent)]"
                    : "bg-[var(--color-canvas)] border-[var(--color-border)] text-[var(--color-text)]"
                }`}
              >
                <svg className="shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" />
                </svg>
                <span className="max-w-[180px] truncate">{attachedFile.name}</span>
                {attachedFile.redacted && (
                  <span className="shrink-0 px-1.5 py-0.5 rounded bg-[var(--color-accent)]/10 text-[10px] uppercase tracking-wider">
                    redacted
                  </span>
                )}
                <button
                  onClick={() => onRemoveAttachment?.(index)}
                  className="w-4 h-4 shrink-0 rounded-full hover:bg-black/10 flex items-center justify-center transition-colors"
                  aria-label={`Remove ${attachedFile.name}`}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.csv,.json,.log"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || fileScanning}
            className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-canvas)] transition-colors disabled:opacity-40"
            title="Upload files (PDF, image, text)"
            aria-label="Upload files"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>

          <div
            className={`flex-1 relative rounded-2xl border bg-[var(--color-canvas)] transition-all focus-within:ring-2 ${
              showWarning
                ? "border-[#E54D2E]/40 focus-within:ring-[#E54D2E]/15 focus-within:border-[#E54D2E]/50"
                : "border-[var(--color-border)] focus-within:ring-[var(--color-accent)]/20 focus-within:border-[var(--color-accent)]/40"
            }`}
          >
            <div
              ref={mirrorRef}
              aria-hidden="true"
              className="composer-mirror px-4 py-3 text-[15px] leading-relaxed"
            >
              <ComposerHighlights text={text} entities={result?.entities ?? []} />
            </div>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => handleChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onScroll={syncMirrorScroll}
              placeholder={attachedFiles.length ? "Ask about the attached files..." : "Type a message or drop files..."}
              rows={1}
              className="relative block w-full resize-none rounded-2xl bg-transparent px-4 py-3 text-[15px] leading-relaxed text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)]/50 focus:outline-none"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!canSend}
            aria-label="Send message"
            title={blocked && text.trim() ? "Personal data detected — opens the review panel" : "Send message"}
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
            ) : blocked && text.trim() ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M12 8v4m0 4h.01" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            )}
          </button>
        </div>

        <p className="mt-2 text-[11px] text-[var(--color-text-secondary)]/60 text-center font-mono">
          Personal-data detection runs locally first. Nothing leaves until you approve.
        </p>
      </div>
    </div>
  );
}
