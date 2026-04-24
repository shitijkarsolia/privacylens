import type { PIIEntity } from "../types";
import { runDetectionPipeline } from "./upload-interceptor";

export async function scanImage(
  file: File,
  classifyFn?: (text: string) => Promise<PIIEntity[]>
): Promise<{ text: string; entities: PIIEntity[] }> {
  const Tesseract = await import("tesseract.js");

  const worker = await Tesseract.createWorker("eng");
  const { data } = await worker.recognize(file);
  await worker.terminate();

  const text = data.text.trim();

  if (!text) {
    return { text: "", entities: [] };
  }

  const entities = await runDetectionPipeline(text, classifyFn);
  return { text, entities };
}
