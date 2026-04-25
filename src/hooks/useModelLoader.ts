import { useState, useCallback, useEffect, useRef } from "react";
import type { ModelStatus, PIIEntity } from "../types";

export function useModelLoader() {
  const [status, setStatus] = useState<ModelStatus>({ state: "idle" });
  const [classifyFn, setClassifyFn] = useState<
    ((text: string) => Promise<PIIEntity[]>) | null
  >(null);
  const pollingRef = useRef<ReturnType<typeof setInterval>>();

  const checkModelStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/model-status");
      const data = await res.json();

      if (data.state === "ready") {
        setStatus({ state: "ready" });

        const fn = async (text: string): Promise<PIIEntity[]> => {
          const res = await fetch("/api/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
          });

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Scan failed");
          }

          const data = await res.json();
          return data.entities || [];
        };

        setClassifyFn(() => fn);

        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = undefined;
        }
      } else if (data.state === "failed") {
        setStatus({ state: "failed", error: data.error });
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = undefined;
        }
      } else {
        setStatus({ state: "loading" });
      }
    } catch {
      setStatus({ state: "loading" });
    }
  }, []);

  useEffect(() => {
    setStatus({ state: "loading" });
    checkModelStatus();
    pollingRef.current = setInterval(checkModelStatus, 2000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [checkModelStatus]);

  return { status, classifyFn, loadModel: checkModelStatus };
}
