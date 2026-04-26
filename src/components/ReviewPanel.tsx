import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { DetectionResult } from "../types";
import { SEVERITY_MAP, REDACTION_LABELS } from "../types";
import { HighlightedText } from "./HighlightedText";
import { BeforeAfterSlider } from "./BeforeAfterSlider";
import { redactSelective } from "../lib/redaction-engine";
import type { FilePreview } from "./ChatPage";

const SEVERITY_PILL: Record<string, string> = {
  high: "bg-[#E54D2E]/10 text-[#E54D2E] border-[#E54D2E]/20",
  medium: "bg-[#F5A623]/10 text-[#9A6700] border-[#F5A623]/20",
  low: "bg-[#12A594]/10 text-[#12A594] border-[#12A594]/20",
};

const SEVERITY_DOT: Record<string, string> = {
  high: "bg-[#E54D2E]",
  medium: "bg-[#F5A623]",
  low: "bg-[#12A594]",
};

export interface ReviewIssue {
  name: string;
  status: "unsupported" | "unscannable" | "skipped";
  reason: string;
}

interface Props {
  mode: "message" | "attachment";
  text: string;
  result: DetectionResult;
  onPrimary: (reviewedText: string, selectedEntities: Set<number>) => void;
  onOriginal: () => void;
  onCancel: () => void;
  filePreview?: FilePreview | null;
  issueFiles?: ReviewIssue[];
  safeFileCount?: number;
  attachmentName?: string;
  onDownloadRedacted?: () => void;
}

function plural(count: number, singular: string, pluralWord = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralWord}`;
}

function categoryLabel(category: string) {
  return category.replace("private_", "").replace(/_/g, " ");
}

function maskReviewValue(text: string, category: string) {
  if (category === "private_email") {
    const [name, domain] = text.split("@");
    if (!domain) return text;
    return `${name.slice(0, 2)}${name.length > 2 ? "..." : ""}@${domain}`;
  }

  if (["ssn", "credit_card", "account_number", "employee_id", "secret"].includes(category)) {
    return text.replace(/[A-Za-z0-9](?=.{4})/g, "X");
  }

  if (text.length > 18) return `${text.slice(0, 14)}...`;
  return text;
}

export function ReviewPanel({
  mode,
  text,
  result,
  onPrimary,
  onOriginal,
  onCancel,
  filePreview,
  issueFiles = [],
  safeFileCount = 0,
  attachmentName,
  onDownloadRedacted,
}: Props) {
  const [selectedEntities, setSelectedEntities] = useState<Set<number>>(
    () => new Set(result.entities.map((_, index) => index))
  );
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);
  const [showKeepConfirm, setShowKeepConfirm] = useState(false);

  const selectedCount = selectedEntities.size;
  const keptCount = Math.max(0, result.entities.length - selectedCount);
  const hasIssues = issueFiles.length > 0;
  const hasEntities = result.entities.length > 0;
  const canUseSafeAction = mode === "message" ? hasEntities : safeFileCount > 0;

  const previewText = useMemo(
    () => redactSelective(text, result.entities, selectedEntities),
    [text, result.entities, selectedEntities]
  );

  const toggleEntity = (index: number) => {
    setSelectedEntities((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      setShowKeepConfirm(false);
      return next;
    });
  };

  const redactAll = () => {
    setSelectedEntities(new Set(result.entities.map((_, index) => index)));
    setShowKeepConfirm(false);
  };

  const keepAll = () => {
    setSelectedEntities(new Set());
    setShowKeepConfirm(false);
  };

  const primaryLabel = () => {
    if (mode === "attachment") {
      if (!safeFileCount) return "No scanned file to attach";
      if (hasIssues) {
        return `Attach ${plural(safeFileCount, "safe file")} and leave out ${plural(issueFiles.length, "unscanned file")}`;
      }
      if (!hasEntities) return `Attach ${plural(safeFileCount, "safe file")}`;
      if (selectedCount === 0) return "Attach with all items visible";
      if (keptCount > 0) return `Attach redacted copy with ${keptCount} visible`;
      return "Attach redacted copy";
    }

    if (selectedCount === 0) return `Send with all ${plural(keptCount, "item")} visible`;
    if (keptCount > 0) return `Send redacted message with ${keptCount} visible`;
    return "Send redacted message";
  };

  const handlePrimary = () => {
    if (!canUseSafeAction) return;
    if (keptCount > 0 && !showKeepConfirm) {
      setShowKeepConfirm(true);
      return;
    }
    onPrimary(previewText, selectedEntities);
  };

  const overrideLabel =
    mode === "attachment" ? "Attach originals unchanged" : "Send without redaction";
  const reviewNoun = mode === "attachment" ? "attachment" : "message";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 20 }}
        animate={{ x: 0 }}
        exit={{ x: 20 }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
        className="fixed right-0 top-0 bottom-0 z-40 border-l border-[var(--color-border)] bg-[var(--color-surface)] w-full md:w-[560px] flex flex-col h-full overflow-hidden shadow-[-8px_0_30px_rgba(0,0,0,0.08)]"
      >
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#E54D2E]/10 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E54D2E" strokeWidth="2">
                <path d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text)]">
                Review before {mode === "attachment" ? "attaching" : "sending"}
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {hasEntities
                  ? `${plural(result.entities.length, "personal-data item")} found`
                  : "No detected items, but review is still needed"}
                {attachmentName && mode === "attachment" ? ` in ${attachmentName}` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="h-8 rounded-lg px-2 flex items-center gap-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-canvas)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/30"
            title="Cancel pending review"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
            <span className="text-xs font-semibold">Cancel</span>
          </button>
        </div>

        {(hasEntities || hasIssues) && (
          <div className="px-5 py-3 flex flex-wrap gap-2 border-b border-[var(--color-border)]">
            {(["high", "medium", "low"] as const).map(
              (severity) =>
                result.severityCounts[severity] > 0 && (
                  <span
                    key={severity}
                    className={`text-xs font-mono px-2.5 py-1 rounded-full border ${SEVERITY_PILL[severity]}`}
                  >
                    {result.severityCounts[severity]} {severity}
                  </span>
                )
            )}
            {hasIssues && (
              <span className="text-xs font-mono px-2.5 py-1 rounded-full border bg-[#E54D2E]/10 text-[#E54D2E] border-[#E54D2E]/20">
                {plural(issueFiles.length, "file")} paused
              </span>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {filePreview && filePreview.pages.length > 0 && (
            <div className="px-5 py-4 border-b border-[var(--color-border)]">
              <BeforeAfterSlider
                pages={filePreview.pages}
                label={`Safe copy vs original - ${filePreview.name}`}
                onDownloadRedacted={onDownloadRedacted}
              />
              <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                Drag to compare. PDF and image safe copies may change formatting because they are rebuilt from extracted text or visual redaction.
              </p>
            </div>
          )}

          {hasIssues && (
            <div className="px-5 py-4 border-b border-[var(--color-border)]">
              <p className="text-xs font-mono text-[var(--color-text-secondary)] mb-2 uppercase tracking-wider">
                Files needing review
              </p>
              <div className="space-y-2">
                {issueFiles.map((issue) => (
                  <div
                    key={`${issue.name}-${issue.status}`}
                    className="rounded-xl border border-[#E54D2E]/15 bg-[#E54D2E]/5 px-3 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                        {issue.name}
                      </p>
                      <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#E54D2E]">
                        {issue.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                      {issue.reason}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {text.trim() && (
            <div className="px-5 py-4 border-b border-[var(--color-border)]">
              <p className="text-xs font-mono text-[var(--color-text-secondary)] mb-2 uppercase tracking-wider">
                {mode === "attachment" ? "Extracted text" : "Message text"}
              </p>
              <div className="text-sm leading-relaxed text-[var(--color-text)] bg-[var(--color-canvas)] rounded-xl p-4 border border-[var(--color-border)] max-h-48 overflow-y-auto scrollbar-thin">
                <HighlightedText text={text} entities={result.entities} />
              </div>
            </div>
          )}

          {hasEntities && (
            <div className="px-5 py-4 border-b border-[var(--color-border)]">
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-xs font-mono text-[var(--color-text-secondary)] uppercase tracking-wider">
                  Detected items
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={redactAll}
                    className="text-xs font-semibold text-[var(--color-accent)] hover:underline"
                  >
                    Redact all
                  </button>
                  <button
                    onClick={keepAll}
                    className="text-xs font-semibold text-[var(--color-text-secondary)] hover:underline"
                  >
                    Keep all
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {result.entities.map((entity, index) => {
                  const severity = SEVERITY_MAP[entity.category];
                  const isSelected = selectedEntities.has(index);
                  return (
                    <button
                      key={`${entity.start}-${entity.end}-${index}`}
                      onClick={() => toggleEntity(index)}
                      className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/30 active:scale-[0.99] ${
                        isSelected
                          ? "border-[var(--color-accent)]/20 bg-[var(--color-accent)]/5"
                          : "border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-canvas)]"
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${SEVERITY_DOT[severity]}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text)] truncate">
                          {maskReviewValue(entity.text, entity.category)}
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)] font-mono">
                          {categoryLabel(entity.category)} - {Math.round(entity.confidence * 100)}% - {entity.source}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isSelected
                            ? "bg-[#E8F8F4] text-[var(--color-accent)]"
                            : "bg-[var(--color-canvas)] text-[var(--color-text-secondary)]"
                        }`}
                      >
                        {isSelected ? "Redact" : "Keep"}
                      </span>
                      <span className="text-xs font-mono text-[var(--color-text-secondary)]">
                        {REDACTION_LABELS[entity.category]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {text.trim() && (
            <div className="px-5 py-4">
              <p className="text-xs font-mono text-[var(--color-text-secondary)] mb-2 uppercase tracking-wider">
                Safe copy preview
              </p>
              <div className="text-sm leading-relaxed text-[var(--color-text)] bg-[var(--color-canvas)] rounded-xl p-4 border border-[var(--color-border)] font-mono max-h-32 overflow-y-auto scrollbar-thin">
                {previewText}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-[var(--color-border)] space-y-2">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-[var(--color-accent)]/8 px-3 py-2">
              <p className="text-lg font-bold tabular-nums text-[var(--color-accent)]">{selectedCount}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent)]">redact</p>
            </div>
            <div className="rounded-xl bg-[var(--color-canvas)] px-3 py-2">
              <p className="text-lg font-bold tabular-nums text-[var(--color-text-secondary)]">{keptCount}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">keep visible</p>
            </div>
          </div>

          <button
            onClick={handlePrimary}
            disabled={!canUseSafeAction}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[var(--color-accent)] text-white text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {mode === "attachment" ? (
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              ) : (
                <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
              )}
            </svg>
            <span className="leading-snug">{primaryLabel()}</span>
          </button>

          {showKeepConfirm && keptCount > 0 && (
            <div className="rounded-xl border border-[#F5A623]/25 bg-[#FFF8E8] p-3">
              <p className="text-xs leading-relaxed text-[#8A5200]">
                {plural(keptCount, "detected item")} will remain visible in this {reviewNoun}.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => onPrimary(previewText, selectedEntities)}
                  className="flex-1 rounded-lg bg-[var(--color-accent)] px-3 py-2 text-xs font-bold text-white"
                >
                  {mode === "attachment" ? "Attach with kept items" : "Send with kept items"}
                </button>
                <button
                  onClick={() => setShowKeepConfirm(false)}
                  className="flex-1 rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-bold text-[var(--color-text-secondary)]"
                >
                  Review again
                </button>
              </div>
            </div>
          )}

          <button
            onClick={() => setShowOverrideConfirm(true)}
            className="w-full px-5 py-2.5 rounded-full border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-canvas)] transition-colors"
          >
            {overrideLabel}
          </button>

          {showOverrideConfirm && (
            <div className="bg-[#E54D2E]/5 border border-[#E54D2E]/20 rounded-xl p-3">
              <p className="text-xs text-[#E54D2E] mb-2 font-medium">
                {mode === "attachment"
                  ? "This attaches the original file content without redaction or scanner clearance."
                  : "This sends every detected item without redaction."}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={onOriginal}
                  className="flex-1 px-3 py-2 rounded-lg bg-[#E54D2E] text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  {overrideLabel}
                </button>
                <button
                  onClick={() => setShowOverrideConfirm(false)}
                  className="flex-1 px-3 py-2 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-canvas)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {hasIssues && !safeFileCount && (
            <button
              onClick={onCancel}
              className="w-full px-5 py-2.5 rounded-full border border-[var(--color-border)] text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-canvas)] transition-colors"
            >
              Remove paused files
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
