export type ExtractedFileKind = "text" | "pdf" | "image";
export type AttachmentPreview = {
  type: "text" | "image";
  value: string;
  label: string;
};

export interface ExtractedFileText {
  name: string;
  kind: ExtractedFileKind;
  text: string;
}

export interface RedactionEntity {
  id?: string;
  category: string;
  label?: string;
  text: string;
  start: number;
  end: number;
}

export interface RedactedAttachment {
  originalName: string;
  redactedName: string;
  kind: ExtractedFileKind;
  originalMimeType: string;
  redactedMimeType: string;
  extractedText: string;
  redactedText: string;
  beforePreview: AttachmentPreview;
  afterPreview: AttachmentPreview;
  redactedDataUrl: string;
}

const REDACTION: Record<string, string> = {
  private_person: "[NAME]",
  private_email: "[EMAIL]",
  private_phone: "[PHONE]",
  private_address: "[ADDRESS]",
  private_date: "[DATE]",
  private_url: "[URL]",
  account_number: "[ACCOUNT]",
  secret: "[SECRET]",
  employee_id: "[EMPLOYEE ID]",
  ssn: "[SSN]",
  credit_card: "[CREDIT CARD]",
};

const TEXT_PREVIEW_LIMIT = 5000;

export async function extractFileText(file: File): Promise<ExtractedFileText> {
  if (isTextFile(file)) {
    return {
      name: file.name,
      kind: "text",
      text: await file.text(),
    };
  }

  if (isPDF(file)) {
    return {
      name: file.name,
      kind: "pdf",
      text: await extractPdfText(file),
    };
  }

  if (isImage(file)) {
    return {
      name: file.name,
      kind: "image",
      text: await extractImageText(file),
    };
  }

  throw new Error(`Unsupported file type: ${file.name}`);
}

export async function createRedactedAttachment(
  file: File,
  extractedText: string,
  entities: RedactionEntity[]
): Promise<RedactedAttachment> {
  const kind = getFileKind(file);
  const redactedText = redactText(extractedText, entities);

  if (kind === "pdf") {
    const beforePreview = await renderPdfFirstPagePreview(file).catch(() =>
      renderTextImagePreview("Original PDF text", extractedText)
    );
    const afterPreview = await renderTextImagePreview("Redacted PDF text", redactedText);
    const redactedDataUrl = await createRedactedPdfDataUrl(file.name, redactedText);

    return {
      originalName: file.name,
      redactedName: redactedName(file.name, "pdf"),
      kind,
      originalMimeType: file.type || "application/pdf",
      redactedMimeType: "application/pdf",
      extractedText,
      redactedText,
      beforePreview,
      afterPreview,
      redactedDataUrl,
    };
  }

  if (kind === "image") {
    const beforePreview = {
      type: "image" as const,
      value: await blobToDataUrl(file),
      label: "Original image",
    };
    const afterPreview = await renderTextImagePreview("Redacted OCR text", redactedText);

    return {
      originalName: file.name,
      redactedName: redactedName(file.name, "png"),
      kind,
      originalMimeType: file.type || "image/*",
      redactedMimeType: "image/png",
      extractedText,
      redactedText,
      beforePreview,
      afterPreview,
      redactedDataUrl: afterPreview.value,
    };
  }

  return {
    originalName: file.name,
    redactedName: redactedName(file.name, fileExtension(file.name) || "txt"),
    kind,
    originalMimeType: file.type || "text/plain",
    redactedMimeType: file.type || "text/plain",
    extractedText,
    redactedText,
    beforePreview: {
      type: "text",
      value: trimPreview(extractedText),
      label: "Original text",
    },
    afterPreview: {
      type: "text",
      value: trimPreview(redactedText),
      label: "Redacted text",
    },
    redactedDataUrl: await blobToDataUrl(new Blob([redactedText], { type: file.type || "text/plain" })),
  };
}

export function isSupportedFile(file: File): boolean {
  return isTextFile(file) || isPDF(file) || isImage(file);
}

function isTextFile(file: File) {
  return (
    file.type.startsWith("text/") ||
    /\.(txt|md|csv|json|log)$/i.test(file.name)
  );
}

function isPDF(file: File) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function isImage(file: File) {
  return file.type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(file.name);
}

function getFileKind(file: File): ExtractedFileKind {
  if (isPDF(file)) return "pdf";
  if (isImage(file)) return "image";
  return "text";
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .map((item: any) => ("str" in item ? item.str : ""))
        .filter(Boolean)
        .join(" ")
    );
  }

  return pages.join("\n").trim();
}

async function renderPdfFirstPagePreview(file: File): Promise<AttachmentPreview> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1.25 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  await page.render({ canvasContext: context, viewport }).promise;

  return {
    type: "image",
    value: canvas.toDataURL("image/jpeg", 0.9),
    label: "Original PDF preview",
  };
}

// OCR runtime shipped next to this bundle (dist/tesseract/), so the
// extension and the web build never pull worker code from a CDN.
function tesseractOptions() {
  try {
    const base = new URL("../tesseract/", import.meta.url).toString();
    return {
      workerPath: base + "worker.min.js",
      corePath: base,
      langPath: base + "lang",
    };
  } catch {
    return undefined;
  }
}

async function extractImageText(file: File): Promise<string> {
  const Tesseract = await import("tesseract.js");
  const worker = await Tesseract.createWorker("eng", 1, tesseractOptions());

  try {
    const { data } = await worker.recognize(file);
    return data.text.trim();
  } finally {
    await worker.terminate();
  }
}

function redactText(text: string, entities: RedactionEntity[]) {
  const sorted = [...entities].sort((a, b) => a.start - b.start);
  let redacted = "";
  let cursor = 0;

  for (const entity of sorted) {
    if (entity.start < cursor) continue;
    redacted += text.slice(cursor, entity.start);
    redacted += REDACTION[entity.category] || "[REDACTED]";
    cursor = entity.end;
  }

  return redacted + text.slice(cursor);
}

async function createRedactedPdfDataUrl(originalName: string, redactedText: string) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 54;
  const lineHeight = 15;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const usableWidth = pageWidth - margin * 2;
  const title = `Redacted copy of ${originalName}`;
  const lines = pdf.splitTextToSize(redactedText || "[No readable text extracted]", usableWidth);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text(title, margin, margin);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);

  let y = margin + 28;
  for (const line of lines) {
    if (y > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }
    pdf.text(line, margin, y);
    y += lineHeight;
  }

  return blobToDataUrl(pdf.output("blob"));
}

async function renderTextImagePreview(title: string, text: string): Promise<AttachmentPreview> {
  const canvas = document.createElement("canvas");
  const width = 900;
  const height = 1160;
  const padding = 48;
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#0f172a";
  context.font = "700 28px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  context.fillText(title, padding, padding + 8);
  context.fillStyle = "#0f766e";
  context.fillRect(padding, padding + 24, width - padding * 2, 4);

  context.fillStyle = "#1f2937";
  context.font = "22px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  const lines = wrapCanvasText(context, text || "[No readable text extracted]", width - padding * 2);
  let y = padding + 72;
  for (const line of lines) {
    if (y > height - padding) {
      context.fillStyle = "#697386";
      context.fillText("...", padding, y);
      break;
    }
    context.fillText(line, padding, y);
    y += 31;
  }

  return {
    type: "image",
    value: canvas.toDataURL("image/png"),
    label: title,
  };
}

function wrapCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  const paragraphs = trimPreview(text).split(/\r?\n/);

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (context.measureText(candidate).width <= maxWidth || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }

  return lines;
}

function trimPreview(text: string) {
  return text.length > TEXT_PREVIEW_LIMIT
    ? `${text.slice(0, TEXT_PREVIEW_LIMIT)}\n...`
    : text;
}

function redactedName(name: string, extension: string) {
  const base = name.replace(/\.[^.]+$/, "");
  return `redacted-${base}.${extension.replace(/^\./, "")}`;
}

function fileExtension(name: string) {
  const match = name.match(/\.([^.]+)$/);
  return match?.[1]?.toLowerCase();
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error("Unable to read blob"));
    reader.readAsDataURL(blob);
  });
}

Object.assign(globalThis, {
  privacyLensFileScanner: {
    extractFileText,
    createRedactedAttachment,
    isSupportedFile,
  },
});
