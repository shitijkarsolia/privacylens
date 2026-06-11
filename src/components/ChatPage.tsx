import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { ReviewPanel, type ReviewIssue } from "./ReviewPanel";
import { ModelStatus } from "./ModelStatus";
import { useChat } from "../hooks/useChat";
import { useModelLoader } from "../hooks/useModelLoader";
import { usePIIDetection } from "../hooks/usePIIDetection";
import { scanPDF } from "../lib/pdf-scanner";
import { scanImage } from "../lib/image-scanner";
import { runDetectionPipeline } from "../lib/upload-interceptor";
import { evaluateGate } from "../lib/ethics-gate";
import {
  redactSelective,
} from "../lib/redaction-engine";
import {
  renderPDFPages,
  getAllPDFTextPositions,
  createObfuscatedCanvas,
  renderImageToCanvas,
  createObfuscatedImageCanvas,
  canvasToDataURL,
  generateRedactedPDFBlob,
} from "../lib/visual-obfuscator";
import type { PIIEntity } from "../types";

type ScanStatus = "idle" | "scanning" | "clean" | "blocked";
type ReviewMode = "message" | "attachment";
type DemoFileKind = "text" | "pdf" | "image";

const MAX_DEMO_FILE_BYTES = 8 * 1024 * 1024;
const MAX_REVIEW_FILES = 5;

export interface FilePreview {
  pages: { beforeSrc: string; afterSrc: string }[];
  name: string;
  kind: DemoFileKind;
  obfuscatedCanvases?: HTMLCanvasElement[];
}

export interface AttachedFile {
  name: string;
  text: string;
  redacted: boolean;
}

interface ScannedFile {
  file: File;
  kind: DemoFileKind;
  text: string;
  entities: PIIEntity[];
}

interface PendingAttachmentRecord {
  name: string;
  text: string;
  entities: PIIEntity[];
  globalEntityIndexes: number[];
}

function fileKind(file: File): DemoFileKind | null {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (file.type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(name)) return "image";
  if (
    file.type.startsWith("text/") ||
    /\.(txt|md|csv|json|log)$/i.test(name)
  ) {
    return "text";
  }
  return null;
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / 1024 / 1024)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} bytes`;
}

function summarizeFiles(files: File[]) {
  if (files.length === 0) return "Attachment";
  if (files.length === 1) return files[0].name;
  return `${files.length} files`;
}

function offsetEntities(entities: PIIEntity[], offset: number): PIIEntity[] {
  return entities.map((entity) => ({
    ...entity,
    start: entity.start + offset,
    end: entity.end + offset,
  }));
}

function buildAttachmentText(files: AttachedFile[]) {
  return files
    .map(
      (file) =>
        `[Attached: ${file.name}${file.redacted ? " (redacted)" : ""}]\n\n${file.text}`
    )
    .join("\n\n---\n\n");
}

async function buildFilePreview(record: ScannedFile): Promise<FilePreview | null> {
  if (record.entities.length === 0) return null;

  if (record.kind === "pdf") {
    const originalCanvases = await renderPDFPages(record.file);
    const allTextPositions = await getAllPDFTextPositions(record.file);
    const obfuscatedCanvases = originalCanvases.map((canvas, index) =>
      createObfuscatedCanvas(
        canvas,
        allTextPositions[index] || [],
        record.entities,
        record.text
      )
    );
    return {
      pages: originalCanvases.map((canvas, index) => ({
        beforeSrc: canvasToDataURL(canvas),
        afterSrc: canvasToDataURL(obfuscatedCanvases[index]),
      })),
      name: record.file.name,
      kind: "pdf",
      obfuscatedCanvases,
    };
  }

  if (record.kind === "image") {
    const originalCanvas = await renderImageToCanvas(record.file);
    const obfuscatedCanvas = createObfuscatedImageCanvas(
      originalCanvas,
      record.text,
      record.entities
    );
    return {
      pages: [
        {
          beforeSrc: canvasToDataURL(originalCanvas),
          afterSrc: canvasToDataURL(obfuscatedCanvas),
        },
      ],
      name: record.file.name,
      kind: "image",
      obfuscatedCanvases: [obfuscatedCanvas],
    };
  }

  return null;
}

const PROTECTED_COUNT_KEY = "privacylens-protected-count";

function readProtectedCount(): number {
  try {
    const raw = Number(localStorage.getItem(PROTECTED_COUNT_KEY) || "0");
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  } catch {
    return 0;
  }
}

export function ChatPage() {
  const { messages, loading, send } = useChat();
  const { status: modelStatus, classifyFn } = useModelLoader();
  const {
    result,
    scanning,
    scanInstant,
    scanFull,
    setResult: setDetectionResult,
    clear,
  } = usePIIDetection(classifyFn);

  const [pendingText, setPendingText] = useState("");
  const [pendingOriginalText, setPendingOriginalText] = useState("");
  const [pendingAttachmentName, setPendingAttachmentName] = useState("Attachment");
  const [reviewMode, setReviewMode] = useState<ReviewMode>("message");
  const [reviewIssues, setReviewIssues] = useState<ReviewIssue[]>([]);
  const [safeFileCount, setSafeFileCount] = useState(0);
  const [showReview, setShowReview] = useState(false);
  const [fileScanning, setFileScanning] = useState(false);
  const [fileName, setFileName] = useState("");
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [filePreview, setFilePreview] = useState<FilePreview | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [pendingAttachmentRecords, setPendingAttachmentRecords] = useState<PendingAttachmentRecord[]>([]);
  const [composerText, setComposerText] = useState("");
  const [protectedCount, setProtectedCount] = useState(readProtectedCount);

  const addProtected = useCallback((count: number) => {
    if (count <= 0) return;
    setProtectedCount((prev) => {
      const next = prev + count;
      try {
        localStorage.setItem(PROTECTED_COUNT_KEY, String(next));
      } catch {
        // Private browsing - keep the in-memory count only.
      }
      return next;
    });
  }, []);

  const resetReview = useCallback(() => {
    setShowReview(false);
    setPendingText("");
    setPendingOriginalText("");
    setPendingAttachmentName("Attachment");
    setReviewIssues([]);
    setSafeFileCount(0);
    setFilePreview(null);
    setPendingAttachmentRecords([]);
    setScanStatus("idle");
  }, []);

  const handleTextChange = useCallback(
    (text: string) => {
      setComposerText(text);
      setPendingText(text);
      setPendingOriginalText(text);
      setReviewMode("message");
      setReviewIssues([]);
      scanInstant(text);
      if (!text.trim()) setScanStatus("idle");
    },
    [scanInstant]
  );

  const handleSubmit = useCallback(
    async (text: string) => {
      const attachmentText = buildAttachmentText(attachedFiles);
      const fullText = [attachmentText, text].filter(Boolean).join("\n\n---\n\n");

      if (!fullText.trim()) return;

      setPendingText(fullText);
      setPendingOriginalText(fullText);
      setReviewMode("message");
      setReviewIssues([]);
      setScanStatus("scanning");

      const detection = await scanFull(fullText);

      if (detection.blocked) {
        setScanStatus("blocked");
        setShowReview(true);
      } else {
        setScanStatus("clean");
        send(fullText);
        setComposerText("");
        setAttachedFiles([]);
        clear();
        setTimeout(() => setScanStatus("idle"), 2000);
      }
    },
    [attachedFiles, scanFull, send, clear]
  );

  const scanSingleFile = useCallback(
    async (file: File, kind: DemoFileKind): Promise<ScannedFile> => {
      if (kind === "pdf") {
        return { file, kind, ...(await scanPDF(file, classifyFn || undefined)) };
      }
      if (kind === "image") {
        return { file, kind, ...(await scanImage(file, classifyFn || undefined)) };
      }

      const text = await file.text();
      const entities = await runDetectionPipeline(text, classifyFn || undefined);
      return { file, kind, text, entities };
    },
    [classifyFn]
  );

  const handleFileUpload = useCallback(
    async (incoming: File | File[]) => {
      const allFiles = Array.isArray(incoming) ? incoming : [incoming];
      if (allFiles.length === 0) return;

      const selectedFiles = allFiles.slice(0, MAX_REVIEW_FILES);
      const issues: ReviewIssue[] = [];
      const supported: Array<{ file: File; kind: DemoFileKind }> = [];

      for (const file of selectedFiles) {
        const kind = fileKind(file);
        if (!kind) {
          issues.push({
            name: file.name,
            status: "unsupported",
            reason: "This file type is not scanned yet.",
          });
          continue;
        }

        if (file.size > MAX_DEMO_FILE_BYTES) {
          issues.push({
            name: file.name,
            status: "unscannable",
            reason: `This file is ${formatBytes(file.size)}. PrivacyLens scans files up to ${formatBytes(MAX_DEMO_FILE_BYTES)}.`,
          });
          continue;
        }

        supported.push({ file, kind });
      }

      for (const file of allFiles.slice(MAX_REVIEW_FILES)) {
        issues.push({
          name: file.name,
          status: "skipped",
          reason: `Only the first ${MAX_REVIEW_FILES} files can be reviewed at once.`,
        });
      }

      setFileScanning(true);
      setFileName(summarizeFiles(selectedFiles));
      setScanStatus("scanning");
      setFilePreview(null);

      try {
        const settled = await Promise.allSettled(
          supported.map(({ file, kind }) => scanSingleFile(file, kind))
        );

        const scanned: ScannedFile[] = [];
        settled.forEach((entry, index) => {
          const file = supported[index].file;
          if (entry.status === "rejected") {
            issues.push({
              name: file.name,
              status: "unscannable",
              reason: entry.reason?.message || "PrivacyLens could not scan this file.",
            });
            return;
          }

          if (!entry.value.text.trim()) {
            issues.push({
              name: file.name,
              status: "unscannable",
              reason: "PrivacyLens could not find readable text in this file.",
            });
            return;
          }

          scanned.push(entry.value);
        });

        const combinedParts: string[] = [];
        const combinedEntities: PIIEntity[] = [];
        const pendingRecords: PendingAttachmentRecord[] = [];
        let cursor = 0;

        for (const record of scanned) {
          const prefix = `[Attached ${record.kind} file: ${record.file.name}]\n`;
          const body = `${prefix}${record.text}`;
          const globalEntityIndexes = record.entities.map(
            (_, entityIndex) => combinedEntities.length + entityIndex
          );
          combinedParts.push(body);
          combinedEntities.push(...offsetEntities(record.entities, cursor + prefix.length));
          pendingRecords.push({
            name: record.file.name,
            text: record.text,
            entities: record.entities,
            globalEntityIndexes,
          });
          cursor += body.length + 2;
        }

        const combinedText = combinedParts.join("\n\n");
        const originalText = selectedFiles
          .map((file) => `[Original file selected: ${file.name}]`)
          .join("\n");
        const detection = evaluateGate(combinedEntities);
        setDetectionResult(detection);

        setPendingText(combinedText);
        setPendingOriginalText(combinedText || originalText);
        setPendingAttachmentName(
          scanned.length === 1 ? scanned[0].file.name : `${scanned.length || selectedFiles.length} files`
        );
        setReviewMode("attachment");
        setReviewIssues(issues);
        setSafeFileCount(scanned.length);
        setPendingAttachmentRecords(pendingRecords);

        const previewSource = scanned.find(
          (record) => record.entities.length > 0 && record.kind !== "text"
        );
        if (previewSource) {
          try {
            setFilePreview(await buildFilePreview(previewSource));
          } catch (error) {
            console.error("File preview failed:", error);
          }
        }

        if (detection.blocked || issues.length > 0) {
          setScanStatus("blocked");
          setShowReview(true);
          return;
        }

        setScanStatus("clean");
        setAttachedFiles(
          scanned.map((record) => ({
            name: record.file.name,
            text: record.text,
            redacted: false,
          }))
        );
        clear();
        setTimeout(() => setScanStatus("idle"), 2000);
      } catch (err: any) {
        console.error("File scan error:", err);
        setDetectionResult(evaluateGate([]));
        setPendingText("");
        setPendingOriginalText(summarizeFiles(selectedFiles));
        setPendingAttachmentName(summarizeFiles(selectedFiles));
        setReviewMode("attachment");
        setReviewIssues([
          {
            name: summarizeFiles(selectedFiles),
            status: "unscannable",
            reason: err?.message || "PrivacyLens could not scan this file.",
          },
        ]);
        setSafeFileCount(0);
        setScanStatus("blocked");
        setShowReview(true);
      } finally {
        setFileScanning(false);
        setFileName("");
      }
    },
    [clear, scanSingleFile, setDetectionResult]
  );

  const handleReviewPrimary = useCallback(
    (reviewedText: string, selectedEntities: Set<number>) => {
      if (reviewMode === "message") {
        addProtected(selectedEntities.size);
        send(
          reviewedText,
          reviewedText !== pendingOriginalText ? pendingOriginalText : undefined
        );
        setComposerText("");
        resetReview();
        clear();
        return;
      }

      if (!safeFileCount) return;

      let redactedTotal = 0;
      setAttachedFiles(
        pendingAttachmentRecords.map((record) => {
          const localSelected = new Set<number>();
          record.globalEntityIndexes.forEach((globalIndex, localIndex) => {
            if (selectedEntities.has(globalIndex)) localSelected.add(localIndex);
          });
          const text = redactSelective(record.text, record.entities, localSelected);
          const redacted = localSelected.size > 0;
          redactedTotal += localSelected.size;
          return {
            name: redacted ? `redacted-${record.name}` : record.name,
            text,
            redacted,
          };
        })
      );
      addProtected(redactedTotal);
      resetReview();
      clear();
    },
    [
      reviewMode,
      send,
      pendingOriginalText,
      resetReview,
      clear,
      safeFileCount,
      pendingAttachmentRecords,
      addProtected,
    ]
  );

  const handleReviewOriginal = useCallback(() => {
    if (reviewMode === "message") {
      send(pendingOriginalText || pendingText);
      setComposerText("");
      resetReview();
      clear();
      return;
    }

    setAttachedFiles(
      pendingAttachmentRecords.length
        ? pendingAttachmentRecords.map((record) => ({
            name: record.name,
            text: record.text,
            redacted: false,
          }))
        : [
            {
              name: pendingAttachmentName,
              text: pendingOriginalText || "[Original files attached without scanning]",
              redacted: false,
            },
          ]
    );
    resetReview();
    clear();
  }, [
    reviewMode,
    send,
    pendingOriginalText,
    pendingText,
    pendingAttachmentName,
    pendingAttachmentRecords,
    resetReview,
    clear,
  ]);

  const handleCancelReview = useCallback(() => {
    resetReview();
    clear();
  }, [resetReview, clear]);

  const handleRemoveAttachment = useCallback((index: number) => {
    setAttachedFiles((files) => files.filter((_, fileIndex) => fileIndex !== index));
  }, []);

  const handleDownloadRedacted = useCallback(async () => {
    if (!filePreview?.obfuscatedCanvases) return;
    try {
      const blob = await generateRedactedPDFBlob(filePreview.obfuscatedCanvases);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `redacted-${filePreview.name.replace(/\.[^.]+$/, "")}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Download failed:", e);
    }
  }, [filePreview]);

  const handleNewChat = useCallback(() => {
    resetReview();
    setAttachedFiles([]);
    clear();
    window.location.reload();
  }, [clear, resetReview]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-center px-4 pt-5 pb-3">
        <div className="flex items-center justify-between w-full max-w-4xl px-6 py-3.5 rounded-full bg-[var(--color-surface)]/80 backdrop-blur-xl border border-[var(--color-border)] shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-[var(--color-text)]">
                PrivacyLens
              </span>
              <p className="text-[11px] text-[var(--color-text-secondary)] font-mono -mt-0.5">
                See what AI sees before AI sees it
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ModelStatus status={modelStatus} />
            {protectedCount > 0 && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] text-xs font-mono font-semibold"
                title="Personal-data items redacted on this device before anything was sent"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                <span className="tabular-nums">{protectedCount} protected</span>
              </div>
            )}
            <button
              onClick={handleNewChat}
              className="w-9 h-9 rounded-xl hover:bg-[var(--color-canvas)] flex items-center justify-center transition-colors text-[var(--color-text-secondary)]"
              title="New chat"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
            {result && result.entities.length > 0 && !showReview && (
              <button
                onClick={() => {
                  setReviewMode("message");
                  setPendingText(pendingText || "");
                  setPendingOriginalText(pendingOriginalText || pendingText || "");
                  setShowReview(true);
                }}
                className="w-9 h-9 rounded-xl hover:bg-[var(--color-canvas)] flex items-center justify-center transition-colors text-[#E54D2E] relative"
                title="Open personal-data review panel"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#E54D2E] text-white text-[9px] font-bold flex items-center justify-center">
                  {result.entities.length}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {(scanStatus === "scanning" || fileScanning) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="bg-[var(--color-surface)] rounded-2xl px-10 py-8 shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-[var(--color-border)] text-center max-w-sm"
            >
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[var(--color-accent)]/10 flex items-center justify-center">
                <div className="w-7 h-7 border-3 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
              </div>
              <h3 className="text-lg font-semibold tracking-tight text-[var(--color-text)] mb-1">
                Scanning for personal data
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {fileName ? `Analyzing ${fileName}...` : "Checking before anything is sent..."}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {scanStatus !== "idle" && scanStatus !== "scanning" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="flex justify-center px-4 pb-2">
              <div
                className={`w-full max-w-4xl px-5 py-3 rounded-2xl flex items-center gap-3 text-sm font-medium transition-colors ${
                  scanStatus === "blocked"
                    ? "bg-[#E54D2E]/10 border border-[#E54D2E]/20 text-[#E54D2E]"
                    : "bg-[#12A594]/10 border border-[#12A594]/20 text-[#12A594]"
                }`}
              >
                {scanStatus === "blocked" && (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <span>
                      Review required - {(result?.entities.length ?? 0) > 0
                        ? `${result?.entities.length} personal-data item${(result?.entities.length ?? 0) !== 1 ? "s" : ""} found`
                        : "at least one file could not be scanned"}
                    </span>
                  </>
                )}
                {scanStatus === "clean" && (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    <span>No personal data detected - safe to send</span>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0">
          <MessageList
            messages={messages}
            loading={loading}
            onSampleFile={handleFileUpload}
            onExampleText={(example) => handleTextChange(example)}
          />
          <MessageInput
            text={composerText}
            onSubmit={handleSubmit}
            onTextChange={handleTextChange}
            onFileUpload={handleFileUpload}
            blocked={result?.blocked ?? false}
            result={result}
            scanning={scanning}
            disabled={loading || showReview}
            fileScanning={fileScanning}
            fileName={fileName}
            modelLoading={
              modelStatus.state === "idle" ||
              modelStatus.state === "loading" ||
              modelStatus.state === "downloading"
            }
            attachedFiles={attachedFiles}
            onRemoveAttachment={handleRemoveAttachment}
          />
        </div>

        {showReview && result && (
          <ReviewPanel
            mode={reviewMode}
            text={pendingText}
            result={result}
            onPrimary={handleReviewPrimary}
            onOriginal={handleReviewOriginal}
            onCancel={handleCancelReview}
            filePreview={filePreview}
            issueFiles={reviewIssues}
            safeFileCount={safeFileCount}
            attachmentName={pendingAttachmentName}
            onDownloadRedacted={filePreview?.obfuscatedCanvases ? handleDownloadRedacted : undefined}
          />
        )}
      </div>
    </div>
  );
}
