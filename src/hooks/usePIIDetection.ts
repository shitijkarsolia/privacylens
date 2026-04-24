import { useState, useCallback } from "react";
import type { PIIEntity, DetectionResult } from "../types";
import { runDetectionPipeline } from "../lib/upload-interceptor";
import { evaluateGate } from "../lib/ethics-gate";

export function usePIIDetection(
  classifyFn: ((text: string) => Promise<PIIEntity[]>) | null
) {
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [scanning, setScanning] = useState(false);

  const scanInstant = useCallback((_text: string) => {
    // AI-model only — no instant regex scanning
    // Full scan happens on submit
  }, []);

  const scanFull = useCallback(
    async (text: string): Promise<DetectionResult> => {
      if (!text.trim()) {
        const empty = evaluateGate([]);
        setResult(empty);
        return empty;
      }

      setScanning(true);
      try {
        const entities = await runDetectionPipeline(
          text,
          classifyFn || undefined
        );
        const gateResult = evaluateGate(entities);
        setResult(gateResult);
        return gateResult;
      } finally {
        setScanning(false);
      }
    },
    [classifyFn]
  );

  const clear = useCallback(() => {
    setResult(null);
  }, []);

  return { result, scanning, scanInstant, scanFull, clear };
}
