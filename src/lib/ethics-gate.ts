import type { PIIEntity, DetectionResult, Severity } from "../types";
import { SEVERITY_MAP } from "../types";

export function evaluateGate(entities: PIIEntity[]): DetectionResult {
  const severityCounts: Record<Severity, number> = {
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const entity of entities) {
    const severity = SEVERITY_MAP[entity.category];
    severityCounts[severity]++;
  }

  return {
    entities,
    blocked: entities.length > 0,
    severityCounts,
  };
}
