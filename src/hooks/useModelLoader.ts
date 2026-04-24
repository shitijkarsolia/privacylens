import { useState, useCallback, useEffect } from "react";
import type { ModelStatus, PIIEntity, PIICategory } from "../types";

export function useModelLoader() {
  const [status, setStatus] = useState<ModelStatus>({ state: "idle" });
  const [classifyFn, setClassifyFn] = useState<
    ((text: string) => Promise<PIIEntity[]>) | null
  >(null);

  const loadModel = useCallback(async () => {
    setStatus({ state: "downloading", progress: 0 });

    try {
      const { pipeline, env } = await import("@huggingface/transformers");

      // Enable browser caching — model persists in Cache API / IndexedDB
      (env as any).cacheDir = undefined;
      env.allowLocalModels = false;

      setStatus({ state: "loading", progress: 50 });

      const classifier = await pipeline(
        "token-classification",
        "openai/privacy-filter",
        {
          dtype: "q4",
          device: "wasm",
          progress_callback: (p: any) => {
            if (p.progress !== undefined && p.progress !== null) {
              setStatus({ state: "downloading", progress: p.progress });
            }
          },
        }
      );

      const fn = async (text: string): Promise<PIIEntity[]> => {
        const results = await classifier(text, {
          aggregation_strategy: "simple",
        });

        const entities: PIIEntity[] = [];
        let searchFrom = 0;

        for (const r of results as any[]) {
          let category: PIICategory = "secret";
          const eg = (r.entity_group || r.entity || "").toLowerCase();
          if (eg.includes("person")) category = "private_person";
          else if (eg.includes("email")) category = "private_email";
          else if (eg.includes("phone")) category = "private_phone";
          else if (eg.includes("address")) category = "private_address";
          else if (eg.includes("date")) category = "private_date";
          else if (eg.includes("url")) category = "private_url";
          else if (eg.includes("account")) category = "account_number";
          else if (eg.includes("secret")) category = "secret";

          const word = (r.word || "").trim();
          if (!word) continue;

          let start = r.start;
          let end = r.end;

          if (start === undefined || start === null) {
            const idx = text.indexOf(word, searchFrom);
            if (idx !== -1) {
              start = idx;
              end = idx + word.length;
              searchFrom = end;
            } else {
              start = 0;
              end = word.length;
            }
          }

          entities.push({
            category,
            text: word,
            start,
            end,
            confidence: r.score ?? 0.5,
            source: "model" as const,
          });
        }

        return entities;
      };

      setClassifyFn(() => fn);
      setStatus({ state: "ready" });
    } catch (err: any) {
      console.error("Model load failed:", err);
      setStatus({
        state: "failed",
        error: err?.message || "Failed to load model",
      });
    }
  }, []);

  useEffect(() => {
    loadModel();
  }, [loadModel]);

  return { status, classifyFn, loadModel };
}
