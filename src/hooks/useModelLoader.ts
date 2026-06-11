import { useState, useCallback, useEffect, useRef } from "react";
import type { ModelStatus, PIIEntity } from "../types";
import { hasWebGPU, loadBrowserClassifier } from "../lib/browser-model";

type ClassifyFn = (text: string) => Promise<PIIEntity[]>;

// Detection strategy, in order:
// 1. API server (/api/scan) when a backend is running.
// 2. In-browser WebGPU model when statically hosted and WebGPU exists.
// 3. Regex-only "fallback" mode - the ethics gate still enforces fully.
export function useModelLoader() {
  const [status, setStatus] = useState<ModelStatus>({ state: "idle" });
  const [classifyFn, setClassifyFn] = useState<ClassifyFn | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval>>();
  const browserLoadRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = undefined;
    }
  }, []);

  const startBrowserModel = useCallback(async () => {
    if (browserLoadRef.current) return;
    browserLoadRef.current = true;
    stopPolling();

    if (!(await hasWebGPU())) {
      setStatus({ state: "fallback", runtime: "browser" });
      return;
    }

    setStatus({ state: "downloading", runtime: "browser", progress: 0 });
    try {
      const fn = await loadBrowserClassifier((progress) => {
        setStatus({ state: "downloading", runtime: "browser", progress });
      });
      setClassifyFn(() => fn);
      setStatus({ state: "ready", runtime: "browser" });
    } catch (err: any) {
      console.warn("In-browser model unavailable, using pattern scan:", err?.message);
      setStatus({ state: "fallback", runtime: "browser" });
    }
  }, [stopPolling]);

  const checkModelStatus = useCallback(async () => {
    let data: { state?: string; error?: string };
    try {
      const res = await fetch("/api/model-status");
      const contentType = res.headers.get("content-type") || "";
      if (!res.ok || !contentType.includes("application/json")) {
        // Static hosting: route does not exist, the host returns HTML/404.
        startBrowserModel();
        return;
      }
      data = await res.json();
    } catch {
      // No backend reachable at all - also static / offline.
      startBrowserModel();
      return;
    }

    if (data.state === "ready") {
      setStatus({ state: "ready", runtime: "server" });

      const fn: ClassifyFn = async (text) => {
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
      stopPolling();
    } else if (data.state === "failed") {
      // Server is up but its model could not load - regex still protects.
      setStatus({ state: "fallback", runtime: "server", error: data.error });
      stopPolling();
    } else {
      setStatus({ state: "loading", runtime: "server" });
    }
  }, [startBrowserModel, stopPolling]);

  useEffect(() => {
    setStatus({ state: "loading" });
    checkModelStatus();
    pollingRef.current = setInterval(checkModelStatus, 2000);
    return stopPolling;
  }, [checkModelStatus, stopPolling]);

  return { status, classifyFn, loadModel: checkModelStatus };
}
