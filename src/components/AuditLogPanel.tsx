import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { getAuditSummary } from "../lib/audit-log";
import type { PIICategory } from "../types";

const CATEGORY_LABELS: Record<PIICategory, string> = {
  private_person: "Names",
  private_email: "Emails",
  private_phone: "Phone numbers",
  private_address: "Addresses",
  private_date: "Dates",
  private_url: "URLs",
  account_number: "Account numbers",
  secret: "Secrets/keys",
  ssn: "SSNs",
  credit_card: "Credit cards",
};

interface Props {
  onClose: () => void;
}

export function AuditLogPanel({ onClose }: Props) {
  const [summary, setSummary] = useState(() => getAuditSummary());

  useEffect(() => {
    const interval = setInterval(() => setSummary(getAuditSummary()), 2000);
    return () => clearInterval(interval);
  }, []);

  const handleClear = () => {
    localStorage.removeItem("privacylens_audit_log");
    setSummary(getAuditSummary());
  };

  const categoryEntries = Object.entries(summary.byCategory).filter(
    ([, count]) => count && count > 0
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      className="fixed right-0 top-0 bottom-0 z-40 border-l border-[var(--color-border)] bg-[var(--color-surface)] w-full md:w-[320px] flex flex-col h-full shadow-[-8px_0_30px_rgba(0,0,0,0.08)]"
    >
      <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">
          Privacy Audit Log
        </h3>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg hover:bg-[var(--color-canvas)] flex items-center justify-center transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">
        <div className="text-center mb-6">
          <div className="text-4xl font-bold tracking-tight text-[var(--color-accent)] tabular-nums">
            {summary.totalProtected}
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            PII items protected
          </p>
        </div>

        {categoryEntries.length > 0 ? (
          <div className="space-y-2">
            {categoryEntries.map(([cat, count]) => (
              <div
                key={cat}
                className="flex items-center justify-between px-3 py-2 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-border)]"
              >
                <span className="text-sm text-[var(--color-text)]">
                  {CATEGORY_LABELS[cat as PIICategory] || cat}
                </span>
                <span className="text-sm font-mono font-medium text-[var(--color-accent)] tabular-nums">
                  {count}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-text-secondary)] text-center">
            No PII detected yet. Start chatting to see your privacy stats.
          </p>
        )}

        {categoryEntries.length > 0 && (
          <button
            onClick={handleClear}
            className="mt-4 w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-canvas)] transition-colors"
          >
            Clear log
          </button>
        )}

        <div className="mt-6 text-center">
          <p className="text-[11px] font-mono text-[var(--color-text-secondary)]/60">
            All data stored locally. Never transmitted.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
