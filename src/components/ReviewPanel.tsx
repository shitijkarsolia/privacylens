import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { PIIEntity, DetectionResult } from "../types";
import { SEVERITY_MAP, REDACTION_LABELS } from "../types";
import { HighlightedText } from "./HighlightedText";
import { BeforeAfterSlider } from "./BeforeAfterSlider";
import { redactText, redactSelective } from "../lib/redaction-engine";
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

const SEVERITY_CHECK: Record<string, string> = {
  high: "border-[#E54D2E] bg-[#E54D2E]",
  medium: "border-[#F5A623] bg-[#F5A623]",
  low: "border-[#12A594] bg-[#12A594]",
};

interface Props {
  text: string;
  result: DetectionResult;
  onAttachRedacted: (redactedText: string) => void;
  onAttachOriginal: () => void;
  onCancel: () => void;
  filePreview?: FilePreview | null;
  onDownloadRedacted?: () => void;
}

export function ReviewPanel({
  text,
  result,
  onAttachRedacted,
  onAttachOriginal,
  onCancel,
  filePreview,
  onDownloadRedacted,
}: Props) {
  const [selectedEntities, setSelectedEntities] = useState<Set<number>>(
    () => new Set(result.entities.map((_, i) => i))
  );
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);

  const toggleEntity = (index: number) => {
    setSelectedEntities((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const selectAll = () =>
    setSelectedEntities(new Set(result.entities.map((_, i) => i)));

  const handleAutoRedact = () => {
    const redacted = redactSelective(text, result.entities, selectedEntities);
    onAttachRedacted(redacted);
  };

  const previewText =
    selectedEntities.size > 0
      ? redactSelective(text, result.entities, selectedEntities)
      : text;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
        className="fixed right-0 top-0 bottom-0 z-40 border-l border-[var(--color-border)] bg-[var(--color-surface)] w-full md:w-[560px] flex flex-col h-full overflow-hidden shadow-[-8px_0_30px_rgba(0,0,0,0.08)]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#E54D2E]/10 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E54D2E" strokeWidth="2">
                <path d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text)]">
                PII Detected
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {result.entities.length} item{result.entities.length !== 1 ? "s" : ""} found
                {filePreview ? ` in ${filePreview.name}` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-lg hover:bg-[var(--color-canvas)] flex items-center justify-center transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Severity summary */}
        <div className="px-5 py-3 flex gap-2 border-b border-[var(--color-border)]">
          {(["high", "medium", "low"] as const).map(
            (sev) =>
              result.severityCounts[sev] > 0 && (
                <span
                  key={sev}
                  className={`text-xs font-mono px-2.5 py-1 rounded-full border ${SEVERITY_PILL[sev]}`}
                >
                  {result.severityCounts[sev]} {sev}
                </span>
              )
          )}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {/* Before/After visual comparison for files */}
          {filePreview && filePreview.pages.length > 0 && (
            <div className="px-5 py-4 border-b border-[var(--color-border)]">
              <BeforeAfterSlider
                pages={filePreview.pages}
                label={`Original vs Redacted — ${filePreview.name}`}
                onDownloadRedacted={onDownloadRedacted}
              />
            </div>
          )}

          {/* Original text with highlights */}
          <div className="px-5 py-4 border-b border-[var(--color-border)]">
            <p className="text-xs font-mono text-[var(--color-text-secondary)] mb-2 uppercase tracking-wider">
              {filePreview ? "Extracted text" : "Original text"}
            </p>
            <div className="text-sm leading-relaxed text-[var(--color-text)] bg-[var(--color-canvas)] rounded-xl p-4 border border-[var(--color-border)] max-h-48 overflow-y-auto scrollbar-thin">
              <HighlightedText text={text} entities={result.entities} />
            </div>
          </div>

          {/* Entity list */}
          <div className="px-5 py-4 border-b border-[var(--color-border)]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-mono text-[var(--color-text-secondary)] uppercase tracking-wider">
                Detected items
              </p>
              <button
                onClick={selectAll}
                className="text-xs text-[var(--color-accent)] hover:underline"
              >
                Select all
              </button>
            </div>
            <div className="space-y-2">
              {result.entities.map((entity, i) => {
                const severity = SEVERITY_MAP[entity.category];
                const isSelected = selectedEntities.has(i);
                return (
                  <button
                    key={i}
                    onClick={() => toggleEntity(i)}
                    className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                      isSelected
                        ? `${SEVERITY_PILL[severity]}`
                        : "border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-canvas)]"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                        isSelected
                          ? `${SEVERITY_CHECK[severity]}`
                          : "border-[var(--color-border)]"
                      }`}
                    >
                      {isSelected && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      )}
                    </div>
                    <span className={`w-2 h-2 rounded-full ${SEVERITY_DOT[severity]}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text)] truncate">
                        {entity.text}
                      </p>
                      <p className="text-xs text-[var(--color-text-secondary)] font-mono">
                        {entity.category.replace("private_", "")} · {Math.round(entity.confidence * 100)}% · {entity.source}
                      </p>
                    </div>
                    <span className="text-xs font-mono text-[var(--color-text-secondary)]">
                      {REDACTION_LABELS[entity.category]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Redacted text preview */}
          {selectedEntities.size > 0 && (
            <div className="px-5 py-4">
              <p className="text-xs font-mono text-[var(--color-text-secondary)] mb-2 uppercase tracking-wider">
                Redacted preview
              </p>
              <div className="text-sm leading-relaxed text-[var(--color-text)] bg-[var(--color-canvas)] rounded-xl p-4 border border-[var(--color-border)] font-mono max-h-32 overflow-y-auto scrollbar-thin">
                {previewText}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-[var(--color-border)] space-y-2">
          <button
            onClick={handleAutoRedact}
            disabled={selectedEntities.size === 0}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[var(--color-accent)] text-white text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
            Attach Redacted ({selectedEntities.size} item{selectedEntities.size !== 1 ? "s" : ""} removed)
          </button>

          {!showOverrideConfirm ? (
            <button
              onClick={() => setShowOverrideConfirm(true)}
              className="w-full px-5 py-2.5 rounded-full border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-canvas)] transition-colors"
            >
              Attach original anyway
            </button>
          ) : (
            <div className="bg-[#E54D2E]/5 border border-[#E54D2E]/20 rounded-xl p-3">
              <p className="text-xs text-[#E54D2E] mb-2 font-medium">
                This will attach the document with personal information included. Are you sure?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={onAttachOriginal}
                  className="flex-1 px-3 py-2 rounded-lg bg-[#E54D2E] text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  I understand the risk
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
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
