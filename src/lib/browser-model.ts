// In-browser PII model for static deployments (no API server). Loads
// openai/privacy-filter via Transformers.js on WebGPU only - the 1.5B MoE
// is not practical on plain WASM, so without WebGPU callers should fall
// back to the regex scanner.

import type { PIIEntity } from "../types";
import { toEntities } from "./model-entities";

export type BrowserModelProgress = (progressPercent: number) => void;

// Presence of navigator.gpu is not enough (headless/virtualized browsers
// expose the API with no adapter) - require a real adapter before touching
// the network for model weights.
export async function hasWebGPU(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("gpu" in navigator)) return false;
  try {
    const adapter = await (navigator as any).gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}

export async function loadBrowserClassifier(
  onProgress?: BrowserModelProgress
): Promise<(text: string) => Promise<PIIEntity[]>> {
  if (!(await hasWebGPU())) {
    throw new Error("WebGPU is not available in this browser");
  }

  const { pipeline } = await import("@huggingface/transformers");

  const fileProgress = new Map<string, number>();
  const classifier = await pipeline(
    "token-classification",
    "openai/privacy-filter",
    {
      device: "webgpu",
      dtype: "q4",
      progress_callback: (info: any) => {
        if (info?.status === "progress" && info.file) {
          fileProgress.set(info.file, info.progress ?? 0);
          const values = [...fileProgress.values()];
          const total = values.reduce((sum, p) => sum + p, 0) / values.length;
          onProgress?.(Math.min(99, Math.round(total)));
        }
      },
    } as any
  );

  onProgress?.(100);

  return async (text: string): Promise<PIIEntity[]> => {
    const results = await classifier(text, { aggregation_strategy: "simple" } as any);
    return toEntities(results as any[], text);
  };
}
