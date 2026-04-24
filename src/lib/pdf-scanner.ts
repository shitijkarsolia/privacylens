import type { PIIEntity } from "../types";
import { runDetectionPipeline } from "./upload-interceptor";

export async function scanPDF(
  file: File,
  classifyFn?: (text: string) => Promise<PIIEntity[]>
): Promise<{ text: string; entities: PIIEntity[] }> {
  const pdfjsLib = await import("pdfjs-dist");

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ");
    fullText += pageText + "\n";
  }

  fullText = fullText.trim();

  if (!fullText) {
    return { text: "", entities: [] };
  }

  const entities = await runDetectionPipeline(fullText, classifyFn);
  return { text: fullText, entities };
}
