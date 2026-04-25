import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { ReviewPanel } from "./ReviewPanel";
import { ModelStatus } from "./ModelStatus";
import { AuditLogPanel } from "./AuditLogPanel";
import { useChat } from "../hooks/useChat";
import { useModelLoader } from "../hooks/useModelLoader";
import { usePIIDetection } from "../hooks/usePIIDetection";
import { addAuditEntry, createAuditEntry } from "../lib/audit-log";
import { scanPDF } from "../lib/pdf-scanner";
import { scanImage } from "../lib/image-scanner";
import {
  renderPDFToCanvas,
  getPDFTextPositions,
  createObfuscatedCanvas,
  renderImageToCanvas,
  createObfuscatedImageCanvas,
  canvasToDataURL,
} from "../lib/visual-obfuscator";
import type { PIIEntity } from "../types";

type ScanStatus = "idle" | "scanning" | "clean" | "blocked";

export interface FilePreview {
  beforeSrc: string;
  afterSrc: string;
  name: string;
}

export function ChatPage() {
  const { messages, loading, send } = useChat();
  const { status: modelStatus, classifyFn } = useModelLoader();
  const { result, scanning, scanInstant, scanFull, clear } =
    usePIIDetection(classifyFn);

  const [pendingText, setPendingText] = useState("");
  const [showReview, setShowReview] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [fileScanning, setFileScanning] = useState(false);
  const [fileName, setFileName] = useState("");
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [filePreview, setFilePreview] = useState<FilePreview | null>(null);

  const handleTextChange = useCallback(
    (text: string) => {
      scanInstant(text);
      if (!text.trim()) setScanStatus("idle");
    },
    [scanInstant]
  );

  const handleSubmit = useCallback(
    async (text: string) => {
      setPendingText(text);
      setScanStatus("scanning");
      const detection = await scanFull(text);

      if (detection.blocked) {
        setScanStatus("blocked");
        setShowReview(true);
      } else {
        setScanStatus("clean");
        addAuditEntry(createAuditEntry("clean_send", []));
        send(text);
        clear();
        setTimeout(() => setScanStatus("idle"), 2000);
      }
    },
    [scanFull, send, clear]
  );

  const handleFileUpload = useCallback(
    async (file: File) => {
      setFileScanning(true);
      setFileName(file.name);
      setScanStatus("scanning");
      setFilePreview(null);

      try {
        let scanResult: { text: string; entities: PIIEntity[] };

        const isPDF = file.type === "application/pdf" || file.name.endsWith(".pdf");
        const isImage = file.type.startsWith("image/");
        const isText = file.type.startsWith("text/") || file.name.endsWith(".txt");

        if (isPDF) {
          scanResult = await scanPDF(file);
        } else if (isImage) {
          scanResult = await scanImage(file);
        } else if (isText) {
          const text = await file.text();
          const { runDetectionPipeline } = await import("../lib/upload-interceptor");
          const entities = await runDetectionPipeline(text);
          scanResult = { text, entities };
        } else {
          setFileScanning(false);
          setFileName("");
          setScanStatus("idle");
          return;
        }

        if (!scanResult.text) {
          setFileScanning(false);
          setFileName("");
          setScanStatus("clean");
          send(`[Uploaded ${file.name} — no text content detected]`);
          setTimeout(() => setScanStatus("idle"), 2000);
          return;
        }

        setPendingText(scanResult.text);
        const detection = await scanFull(scanResult.text);

        if (detection.blocked) {
          // Generate visual before/after for PDFs and images
          if (isPDF) {
            try {
              const originalCanvas = await renderPDFToCanvas(file);
              const textPositions = await getPDFTextPositions(file);
              const obfuscatedCanvas = createObfuscatedCanvas(
                originalCanvas, textPositions, detection.entities, scanResult.text
              );
              setFilePreview({
                beforeSrc: canvasToDataURL(originalCanvas),
                afterSrc: canvasToDataURL(obfuscatedCanvas),
                name: file.name,
              });
            } catch (e) {
              console.error("PDF visual obfuscation failed:", e);
            }
          } else if (isImage) {
            try {
              const originalCanvas = await renderImageToCanvas(file);
              const obfuscatedCanvas = createObfuscatedImageCanvas(
                originalCanvas, scanResult.text, detection.entities
              );
              setFilePreview({
                beforeSrc: canvasToDataURL(originalCanvas),
                afterSrc: canvasToDataURL(obfuscatedCanvas),
                name: file.name,
              });
            } catch (e) {
              console.error("Image visual obfuscation failed:", e);
            }
          }

          setScanStatus("blocked");
          setShowReview(true);
        } else {
          setScanStatus("clean");
          addAuditEntry(createAuditEntry("clean_send", []));
          send(`[Content from ${file.name}]\n\n${scanResult.text}`);
          clear();
          setTimeout(() => setScanStatus("idle"), 2000);
        }
      } catch (err: any) {
        console.error("File scan error:", err);
        setScanStatus("idle");
        send(`[Failed to process ${file.name}: ${err?.message || "Unknown error"}]`);
      } finally {
        setFileScanning(false);
        setFileName("");
      }
    },
    [send, clear, scanFull]
  );

  const handleSendRedacted = useCallback(
    (redactedText: string) => {
      const categories = result?.entities.map((e) => e.category) ?? [];
      addAuditEntry(createAuditEntry("redacted", categories));
      send(redactedText, pendingText);
      setShowReview(false);
      setPendingText("");
      setFilePreview(null);
      clear();
      setScanStatus("idle");
    },
    [result, pendingText, send, clear]
  );

  const handleSendOriginal = useCallback(() => {
    const categories = result?.entities.map((e) => e.category) ?? [];
    addAuditEntry(createAuditEntry("approved_override", categories));
    send(pendingText);
    setShowReview(false);
    setPendingText("");
    setFilePreview(null);
    clear();
    setScanStatus("idle");
  }, [result, pendingText, send, clear]);

  const handleCancelReview = useCallback(() => {
    setShowReview(false);
    setPendingText("");
    setFilePreview(null);
    setScanStatus("idle");
  }, []);

  const handleNewChat = useCallback(() => {
    setShowReview(false);
    setPendingText("");
    setFilePreview(null);
    setScanStatus("idle");
    clear();
    // Reset messages by reloading — simplest approach
    window.location.reload();
  }, [clear]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
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
                onClick={() => setShowReview(true)}
                className="w-9 h-9 rounded-xl hover:bg-[var(--color-canvas)] flex items-center justify-center transition-colors text-[#E54D2E] relative"
                title="Open PII review panel"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#E54D2E] text-white text-[9px] font-bold flex items-center justify-center">
                  {result.entities.length}
                </span>
              </button>
            )}
            <button
              onClick={() => setShowAuditLog(!showAuditLog)}
              className="w-9 h-9 rounded-xl hover:bg-[var(--color-canvas)] flex items-center justify-center transition-colors text-[var(--color-text-secondary)]"
              title="Privacy audit log"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Scanning Overlay */}
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
                {fileName ? `Analyzing ${fileName}...` : "Running AI model detection..."}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scan Status Bar */}
      <AnimatePresence>
        {scanStatus !== "idle" && (
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
                  scanStatus === "scanning"
                    ? "bg-[#F5A623]/10 border border-[#F5A623]/20 text-[#9A6700]"
                    : scanStatus === "blocked"
                      ? "bg-[#E54D2E]/10 border border-[#E54D2E]/20 text-[#E54D2E]"
                      : "bg-[#12A594]/10 border border-[#12A594]/20 text-[#12A594]"
                }`}
              >
                {scanStatus === "scanning" && (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0" />
                    <span>Scanning for personal data{modelStatus.state === "ready" ? " with AI model" : ""}...</span>
                  </>
                )}
                {scanStatus === "blocked" && (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <span>
                      PII detected — {result?.entities.length} personal data item{(result?.entities.length ?? 0) !== 1 ? "s" : ""} found. Review required before sending.
                    </span>
                  </>
                )}
                {scanStatus === "clean" && (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    <span>No personal data detected — safe to send</span>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          <MessageList messages={messages} loading={loading} onSampleFile={handleFileUpload} />
          <MessageInput
            onSubmit={handleSubmit}
            onTextChange={handleTextChange}
            onFileUpload={handleFileUpload}
            blocked={result?.blocked ?? false}
            result={result}
            scanning={scanning}
            disabled={loading || showReview}
            fileScanning={fileScanning}
            fileName={fileName}
            modelLoading={modelStatus.state !== "ready" && modelStatus.state !== "failed"}
          />
        </div>

        {/* Review panel */}
        {showReview && result && (
          <ReviewPanel
            text={pendingText}
            result={result}
            onSendRedacted={handleSendRedacted}
            onSendOriginal={handleSendOriginal}
            onCancel={handleCancelReview}
            filePreview={filePreview}
          />
        )}

        {/* Audit log panel */}
        {showAuditLog && (
          <AuditLogPanel onClose={() => setShowAuditLog(false)} />
        )}
      </div>
    </div>
  );
}
