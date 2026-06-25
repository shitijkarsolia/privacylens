// Shared post-processing for openai/privacy-filter output. Used by the
// Express server (CPU inference) and the in-browser WebGPU path so both
// produce identical PIIEntity records.

import type { PIIEntity, PIICategory } from "../types";

interface RawModelResult {
  entity_group?: string;
  entity?: string;
  word?: string;
  score?: number;
  start?: number | null;
  end?: number | null;
}

export function mapModelCategory(label: string): PIICategory {
  const eg = label.toLowerCase();
  if (eg.includes("person")) return "private_person";
  if (eg.includes("email")) return "private_email";
  if (eg.includes("phone")) return "private_phone";
  if (eg.includes("address")) return "private_address";
  if (eg.includes("date")) return "private_date";
  if (eg.includes("url")) return "private_url";
  if (eg.includes("account")) return "account_number";
  return "secret";
}

export function toEntities(results: RawModelResult[], text: string): PIIEntity[] {
  const raw = results.map((r) => {
    const category = mapModelCategory(r.entity_group || r.entity || "");
    const word = (r.word || "").trim();

    let start = r.start;
    let end = r.end;
    if (start === undefined || start === null) {
      const idx = text.indexOf(word);
      if (idx !== -1) {
        start = idx;
        end = idx + word.length;
      } else {
        start = 0;
        end = word.length;
      }
    }

    return {
      category,
      text: word,
      start: start as number,
      end: (end ?? (start as number) + word.length) as number,
      confidence: r.score ?? 0.5,
      source: "model" as const,
    };
  });

  return mergeAdjacentEntities(raw, text);
}

// Merge adjacent entities that are fragments of the same PII
export function mergeAdjacentEntities(
  entities: PIIEntity[],
  text: string
): PIIEntity[] {
  if (entities.length <= 1) {
    return entities.filter((e) => e.confidence > 0.4 || e.text.length > 3);
  }

  const sorted = [...entities].sort((a, b) => a.start - b.start);
  const merged: PIIEntity[] = [];

  for (const entity of sorted) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push({ ...entity });
      continue;
    }

    // Merge if adjacent (gap <= 3 chars of whitespace/punctuation) and compatible category
    const gap = entity.start - last.end;
    const gapText = gap > 0 ? text.slice(last.end, entity.start) : "";
    const isAdjacent = gap <= 3 && /^[\s\-\/.,]*$/.test(gapText);
    const isCompatible =
      last.category === entity.category ||
      (["account_number", "private_phone", "secret"].includes(last.category) &&
        ["account_number", "private_phone", "secret"].includes(entity.category));

    if (isAdjacent && isCompatible) {
      const newEnd = Math.max(last.end, entity.end);
      last.end = newEnd;
      last.text = text.slice(last.start, newEnd).trim();
      last.confidence = Math.max(last.confidence, entity.confidence);
    } else {
      merged.push({ ...entity });
    }
  }

  // Filter out very low confidence fragments
  return merged.filter((e) => e.confidence > 0.4 || e.text.length > 3);
}
