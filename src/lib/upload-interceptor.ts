import type { PIIEntity } from "../types";

export function mergeEntities(
  a: PIIEntity[],
  b: PIIEntity[]
): PIIEntity[] {
  const all = [...a, ...b].sort((a, b) => a.start - b.start);
  const merged: PIIEntity[] = [];

  for (const entity of all) {
    const last = merged[merged.length - 1];
    if (last && entity.start < last.end) {
      if (entity.confidence > last.confidence) {
        merged[merged.length - 1] = {
          ...entity,
          start: Math.min(last.start, entity.start),
          end: Math.max(last.end, entity.end),
        };
      } else {
        merged[merged.length - 1] = {
          ...last,
          start: Math.min(last.start, entity.start),
          end: Math.max(last.end, entity.end),
        };
      }
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
  if (!classifyFn) return [];

  try {
    return await classifyFn(text);
  } catch {
    return [];
  }
}
