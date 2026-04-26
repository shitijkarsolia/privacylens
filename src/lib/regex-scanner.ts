import type { PIIEntity, PIICategory } from "../types";

interface RegexPattern {
  pattern: RegExp;
  category: PIICategory;
  confidence: number;
}

const PATTERNS: RegexPattern[] = [
  {
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    category: "ssn",
    confidence: 0.99,
  },
  {
    pattern: /\b\d{3}[-\s]?X{2}[-\s]?X{4}\b/gi,
    category: "ssn",
    confidence: 0.96,
  },
  {
    pattern: /\b\d{9}\b(?=.*\b(ssn|social)\b)/gi,
    category: "ssn",
    confidence: 0.85,
  },
  {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    category: "private_email",
    confidence: 0.95,
  },
  {
    pattern:
      /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    category: "private_phone",
    confidence: 0.9,
  },
  {
    pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    category: "credit_card",
    confidence: 0.95,
  },
  {
    pattern:
      /\b(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/(19|20)\d{2}\b/g,
    category: "private_date",
    confidence: 0.85,
  },
  {
    pattern:
      /\b(19|20)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/g,
    category: "private_date",
    confidence: 0.85,
  },
  {
    pattern:
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(0?[1-9]|[12]\d|3[01]),?\s+(19|20)\d{2}\b/gi,
    category: "private_date",
    confidence: 0.8,
  },
  {
    pattern:
      /\b[A-HJ-NPR-Z0-9]{17}\b/g,
    category: "account_number",
    confidence: 0.7,
  },
  {
    pattern:
      /\b(sk|pk|api[_-]?key|token|secret|password|passwd|pwd)[-_]?[a-zA-Z0-9_]{16,}\b/gi,
    category: "secret",
    confidence: 0.9,
  },
  {
    pattern:
      /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}\b/g,
    category: "secret",
    confidence: 0.95,
  },
  {
    pattern:
      /\bAKIA[0-9A-Z]{16}\b/g,
    category: "secret",
    confidence: 0.95,
  },
  {
    pattern: /\b(?:employee\s+id|emp(?:loyee)?\s*#?)\s*(?:is|:)?\s*([A-Z]{2,5}-?\d{3,8})\b/gi,
    category: "employee_id",
    confidence: 0.93,
  },
  {
    pattern: /\bEMP-\d{3,8}\b/gi,
    category: "employee_id",
    confidence: 0.92,
  },
  {
    pattern:
      /\b\d{1,6}\s+[A-Z][A-Za-z0-9.'-]*(?:\s+[A-Z][A-Za-z0-9.'-]*){0,4}\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Way|Court|Ct|Circle|Cir|Terrace|Ter|Place|Pl)\b(?:\s+(?:Apt|Unit|Suite|Ste|#)\s*[A-Za-z0-9-]+)?(?:,?\s+[A-Z][A-Za-z.'-]+(?:\s+[A-Z][a-z.'-]+){0,2})?(?:\s+[A-Z]{2}\s+\d{5}(?:-\d{4})?)?/g,
    category: "private_address",
    confidence: 0.88,
  },
  {
    pattern: /\b(?:between|by|for|from|name is|i am|i'm)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/g,
    category: "private_person",
    confidence: 0.72,
  },
];

export function scanWithRegex(text: string): PIIEntity[] {
  const entities: PIIEntity[] = [];

  for (const { pattern, category, confidence } of PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const matchedText = match[1] ?? match[0];
      const start = match.index + match[0].indexOf(matchedText);
      entities.push({
        category,
        text: matchedText,
        start,
        end: start + matchedText.length,
        confidence,
        source: "regex",
      });
    }
  }

  return mergeOverlappingEntities(entities);
}

function mergeOverlappingEntities(entities: PIIEntity[]): PIIEntity[] {
  const sorted = [...entities].sort(
    (a, b) => a.start - b.start || b.confidence - a.confidence
  );
  const merged: PIIEntity[] = [];

  for (const entity of sorted) {
    const last = merged[merged.length - 1];
    if (last && entity.start < last.end) {
      if (entity.confidence > last.confidence) {
        merged[merged.length - 1] = entity;
      }
    } else {
      merged.push(entity);
    }
  }

  return merged;
}
