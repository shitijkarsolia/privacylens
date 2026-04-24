import type { AuditEntry, PIICategory } from "../types";

const STORAGE_KEY = "privacylens_audit_log";

export function getAuditLog(): AuditEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addAuditEntry(entry: AuditEntry): void {
  const log = getAuditLog();
  log.push(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
}

export function createAuditEntry(
  action: AuditEntry["action"],
  categories: PIICategory[]
): AuditEntry {
  const categoryCounts: Partial<Record<PIICategory, number>> = {};
  for (const cat of categories) {
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  }

  return {
    timestamp: Date.now(),
    action,
    categoryCounts,
    totalEntities: categories.length,
  };
}

export function getAuditSummary(): {
  totalProtected: number;
  totalSessions: number;
  byCategory: Partial<Record<PIICategory, number>>;
} {
  const log = getAuditLog();
  let totalProtected = 0;
  const byCategory: Partial<Record<PIICategory, number>> = {};

  for (const entry of log) {
    totalProtected += entry.totalEntities;
    for (const [cat, count] of Object.entries(entry.categoryCounts)) {
      const key = cat as PIICategory;
      byCategory[key] = (byCategory[key] || 0) + (count || 0);
    }
  }

  return { totalProtected, totalSessions: log.length, byCategory };
}
