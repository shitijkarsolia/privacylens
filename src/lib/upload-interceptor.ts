import type { PIIEntity, PIICategory } from "../types";
import { scanWithRegex } from "./regex-scanner";

// How precisely a category names the data. When spans overlap with similar
// confidence, keep the more specific label: "SSN" beats the model's generic
// "account_number" for the same digits.
const CATEGORY_SPECIFICITY: Partial<Record<PIICategory, number>> = {
  ssn: 3,
  credit_card: 3,
  employee_id: 3,
  secret: 2,
  account_number: 1,
};

function pickLabel(a: PIIEntity, b: PIIEntity): PIIEntity {
  const specificityA = CATEGORY_SPECIFICITY[a.category] ?? 0;
  const specificityB = CATEGORY_SPECIFICITY[b.category] ?? 0;
  if (
    specificityA !== specificityB &&
    Math.abs(a.confidence - b.confidence) < 0.15
  ) {
    return specificityA > specificityB ? a : b;
  }
  return a.confidence >= b.confidence ? a : b;
}

export function mergeEntities(
  a: PIIEntity[],
  b: PIIEntity[]
): PIIEntity[] {
  const all = [...a, ...b].sort((a, b) => a.start - b.start);
  const merged: PIIEntity[] = [];

  for (const entity of all) {
    const last = merged[merged.length - 1];
    if (last && entity.start < last.end) {
      merged[merged.length - 1] = {
        ...pickLabel(last, entity),
        start: Math.min(last.start, entity.start),
        end: Math.max(last.end, entity.end),
      };
    } else {
      merged.push(entity);
    }
  }

  return merged;
}

export async function runDetectionPipeline(
  text: string,
  classifyFn?: (text: string) => Promise<PIIEntity[]>
): Promise<PIIEntity[]> {
  const regexEntities = scanWithRegex(text);

  if (!classifyFn) return regexEntities;

  try {
    const modelEntities = await classifyFn(text);
    return mergeEntities(regexEntities, modelEntities);
  } catch {
    return regexEntities;
  }
}
