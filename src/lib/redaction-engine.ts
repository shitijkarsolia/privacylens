import type { PIIEntity } from "../types";
import { REDACTION_LABELS } from "../types";

export function redactText(text: string, entities: PIIEntity[]): string {
  if (entities.length === 0) return text;

  const sorted = [...entities].sort((a, b) => a.start - b.start);
  const merged = mergeOverlapping(sorted);

  let result = "";
  let cursor = 0;

  for (const entity of merged) {
    result += text.slice(cursor, entity.start);
    result += REDACTION_LABELS[entity.category] || "[REDACTED]";
    cursor = entity.end;
  }

  result += text.slice(cursor);
  return result;
}

export function redactSelective(
  text: string,
  entities: PIIEntity[],
  entitiesToRedact: Set<number>
): string {
  if (entitiesToRedact.size === 0) return text;

  const toRedact = entities
    .filter((_, i) => entitiesToRedact.has(i))
    .sort((a, b) => a.start - b.start);

  return redactText(text, toRedact);
}

function mergeOverlapping(sorted: PIIEntity[]): PIIEntity[] {
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
