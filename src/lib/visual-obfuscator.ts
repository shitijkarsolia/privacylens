import type { PIIEntity } from "../types";

interface TextPosition {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function renderPDFToCanvas(file: File): Promise<HTMLCanvasElement> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);

  const scale = 2;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport }).promise;

  return canvas;
}

export async function getPDFTextPositions(file: File): Promise<TextPosition[]> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);

  const scale = 2;
  const viewport = page.getViewport({ scale });
  const textContent = await page.getTextContent();

  const positions: TextPosition[] = [];

  for (const item of textContent.items) {
    if (!("str" in item) || !item.str.trim()) continue;
    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
    positions.push({
      text: item.str,
      x: tx[4],
      y: tx[5] - item.height * scale,
      width: item.width * scale,
      height: item.height * scale,
    });
  }

  return positions;
}

export function createObfuscatedCanvas(
  originalCanvas: HTMLCanvasElement,
  textPositions: TextPosition[],
  entities: PIIEntity[],
  fullText: string
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = originalCanvas.width;
  canvas.height = originalCanvas.height;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(originalCanvas, 0, 0);

  for (const entity of entities) {
    const entityText = entity.text.trim();
    if (!entityText) continue;

    for (const pos of textPositions) {
      const posText = pos.text.trim();
      if (!posText) continue;

      if (posText.includes(entityText) || entityText.includes(posText)) {
        const overlap = getOverlapRatio(posText, entityText);
        if (overlap > 0.3) {
          ctx.fillStyle = "#111111";
          ctx.fillRect(
            pos.x - 2,
            pos.y - 2,
            pos.width + 4,
            pos.height + 6
          );
        }
      }
    }
  }

  return canvas;
}

function getOverlapRatio(a: string, b: string): number {
  const shorter = a.length < b.length ? a : b;
  const longer = a.length >= b.length ? a : b;
  if (longer.includes(shorter)) return 1;

  const words = shorter.split(/\s+/);
  let matched = 0;
  for (const w of words) {
    if (w.length > 1 && longer.includes(w)) matched++;
  }
  return words.length > 0 ? matched / words.length : 0;
}

export function canvasToDataURL(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/png");
}

export async function renderImageToCanvas(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const maxDim = 1200;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        const ratio = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(img.src);
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function createObfuscatedImageCanvas(
  originalCanvas: HTMLCanvasElement,
  ocrText: string,
  entities: PIIEntity[]
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = originalCanvas.width;
  canvas.height = originalCanvas.height;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(originalCanvas, 0, 0);

  if (entities.length === 0) return canvas;

  // For images, we apply a general blur overlay with redaction notice
  // since we don't have precise text positions from OCR
  const totalChars = ocrText.length;
  const piiChars = entities.reduce((sum, e) => sum + e.text.length, 0);
  const piiRatio = Math.min(piiChars / Math.max(totalChars, 1), 1);

  if (piiRatio > 0.3) {
    // Heavy PII — blur most of the image
    ctx.filter = "blur(12px)";
    ctx.drawImage(originalCanvas, 0, 0);
    ctx.filter = "none";
  }

  // Draw redaction overlay banner
  ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
  const bannerH = 40;
  ctx.fillRect(0, canvas.height - bannerH, canvas.width, bannerH);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 14px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(
    `${entities.length} PII item${entities.length !== 1 ? "s" : ""} redacted`,
    canvas.width / 2,
    canvas.height - bannerH / 2 + 5
  );

  return canvas;
}
