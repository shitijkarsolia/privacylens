import type { PIIEntity } from "../types";
import { runDetectionPipeline } from "./upload-interceptor";
import { localTesseractOptions } from "./tesseract-config";

export async function scanImage(
  file: File,
  classifyFn?: (text: string) => Promise<PIIEntity[]>
): Promise<{ text: string; entities: PIIEntity[] }> {
  const Tesseract = await import("tesseract.js");

  const worker = await Tesseract.createWorker("eng", 1, localTesseractOptions());
  const { data } = await worker.recognize(file);
  await worker.terminate();

  const text = data.text.trim();

  if (!text) {
    return { text: "", entities: [] };
  }

  const entities = await runDetectionPipeline(text, classifyFn);
  return { text, entities };
}
