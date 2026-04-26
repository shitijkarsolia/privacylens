import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertCircle,
  Badge,
  Calendar,
  CircleCheck,
  CreditCard,
  FileWarning,
  Globe2,
  Home,
  Info,
  KeyRound,
  Lightbulb,
  Loader2,
  Lock,
  Mail,
  Paperclip,
  PencilLine,
  Phone,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  User,
  X,
} from "lucide-react";
import "../../index.css";

type Severity = "high" | "medium" | "low";

interface PanelEntity {
  id: string;
  category: string;
  label: string;
  text: string;
  start: number;
  end: number;
  confidence: number;
  source: "regex" | "model";
  severity: Severity;
}

interface AttachmentPreview {
  type: "text" | "image";
  value: string;
  label: string;
}

interface AttachmentFileStatus {
  name: string;
  type?: string;
  kind?: string;
  status: "scanning" | "redactable" | "clean" | "unsupported" | "unscannable" | "skipped";
  detectedCount?: number;
  redactedName?: string;
  reason?: string;
}

interface PanelAttachment {
  status?: "scanning" | "preparing" | "blocked" | "attached" | "inserted";
  originalName?: string;
  redactedName?: string;
  kind?: "text" | "pdf" | "image";
  originalMimeType?: string;
  redactedMimeType?: string;
  extractedText?: string;
  redactedText?: string;
  beforePreview?: AttachmentPreview;
  afterPreview?: AttachmentPreview;
  redactedDataUrl?: string;
  detectedCount?: number;
  files?: AttachmentFileStatus[];
  issueFiles?: AttachmentFileStatus[];
  redactionBlockedByIssues?: boolean;
  attachedCount?: number;
  omittedCount?: number;
}

interface PanelState {
  status: "idle" | "detected" | "scanning" | "blocked" | "clean" | "redacted";
  blocked: boolean;
  entities: PanelEntity[];
  text: string;
  redactedText: string;
  modelState: string;
  host?: string;
  attachment?: PanelAttachment;
  updatedAt: number;
}

declare global {
  interface Window {
    chrome?: any;
  }
}

function extensionApi() {
  return window.chrome;
}

const emptyState: PanelState = {
  status: "idle",
  blocked: false,
  entities: [],
  text: "",
  redactedText: "",
  modelState: "regex-ready",
  updatedAt: Date.now(),
};

const severityStyle: Record<Severity, string> = {
  high: "bg-[#E54D2E]/10 text-[#E54D2E] border-[#E54D2E]/15",
  medium: "bg-[#F5A623]/15 text-[#B65E00] border-[#F5A623]/20",
  low: "bg-[#12A594]/10 text-[#078C7D] border-[#12A594]/15",
};

const ISSUE_STATUSES = ["unsupported", "unscannable", "skipped"];
const SAFE_FILE_STATUSES = ["redactable", "clean"];
const SUPPORTED_FILE_COPY = "Supported files under 8 MB: PDF, TXT, CSV, JSON, PNG, JPG, and WebP.";

function isIssueFile(file: AttachmentFileStatus) {
  return ISSUE_STATUSES.includes(file.status);
}

function isSafeFile(file: AttachmentFileStatus) {
  return SAFE_FILE_STATUSES.includes(file.status);
}

function plural(count: number, singular: string, pluralWord = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralWord}`;
}

const iconByCategory: Record<string, typeof User> = {
  private_person: User,
  private_email: Mail,
  private_phone: Phone,
  private_address: Home,
  private_date: Calendar,
  private_url: Globe2,
  account_number: Badge,
  employee_id: Badge,
  secret: KeyRound,
  ssn: CreditCard,
  credit_card: CreditCard,
};

function sendMessage<T = any>(message: Record<string, unknown>): Promise<T | undefined> {
  return new Promise((resolve) => {
    const api = extensionApi();
    if (!api?.runtime) return resolve(undefined);
    api.runtime.sendMessage(message, (response: T | undefined) => resolve(response));
  });
}

function maskValue(entity: PanelEntity) {
  if (entity.category === "private_email") {
    const [name, domain] = entity.text.split("@");
    if (!domain) return entity.text;
    return `${name.slice(0, 2)}${name.length > 2 ? "..." : ""}@${domain}`;
  }

  if (["ssn", "credit_card", "account_number"].includes(entity.category)) {
    return entity.text.replace(/[A-Za-z0-9](?=.{4})/g, "X");
  }

  return entity.text;
}

function riskLabel(severity: Severity) {
  return `${severity[0].toUpperCase()}${severity.slice(1)} Risk`;
}

function scannerLabel(modelState: string) {
  if (modelState === "model-ready") return "model and regex active";
  if (modelState === "regex-ready") return "active";
  if (modelState.includes("model-unavailable")) return "regex fallback active";
  if (modelState.includes("unsupported") || modelState.includes("unscannable")) {
    return "attachment review needed";
  }
  if (modelState.includes("scan")) return "attachment scanner active";
  if (modelState.includes("attach-error")) return "attachment action needs review";
  return "active";
}

function AttachmentPreviewSlider({
  attachment,
  onClear,
}: {
  attachment?: PanelAttachment;
  onClear: () => void;
}) {
  const [position, setPosition] = useState(50);
  const before = attachment?.beforePreview;
  const after = attachment?.afterPreview;
  const issueFiles = attachment?.files?.filter(isIssueFile) || [];
  const safeFiles = attachment?.files?.filter(isSafeFile) || [];
  const hasOnlyIssues = issueFiles.length > 0 && safeFiles.length === 0;
  const isScanning = attachment?.status === "scanning" || attachment?.status === "preparing";

  useEffect(() => {
    setPosition(50);
  }, [attachment?.originalName, attachment?.redactedName, attachment?.status]);

  if (!before || !after) {
    return (
      <div className={`mb-3 rounded-xl border bg-white p-3 ${
        hasOnlyIssues ? "border-[#E54D2E]/20" : "border-[#E8E5DF]"
      }`}>
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            hasOnlyIssues ? "bg-[#E54D2E]/8 text-[#E54D2E]" : "bg-[#12A594]/10 text-[#079B8E]"
          }`}>
            {hasOnlyIssues ? <FileWarning size={18} /> : isScanning ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{attachment?.originalName || "Attachment"}</p>
            <p className="mt-1 text-xs leading-relaxed text-[#697386]">
              {hasOnlyIssues
                ? `${issueFiles.map((file) => file.name).join(", ")} ${issueFiles.length === 1 ? "was" : "were"} not uploaded. ${SUPPORTED_FILE_COPY}`
                : isScanning
                  ? "Scanning this file before the AI chat can use it."
                  : "Preparing a safe preview before the file is attached."}
            </p>
            {hasOnlyIssues && (
              <button
                onClick={onClear}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#E8E5DF] bg-white px-3 py-2 text-xs font-bold text-[#4B5563] transition hover:bg-[#F7F8FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#079B8E]/30 active:translate-y-px"
              >
                <RotateCcw size={14} />
                Remove paused files
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const setFromClientX = (clientX: number, element: HTMLDivElement) => {
    const rect = element.getBoundingClientRect();
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.max(0, Math.min(100, Math.round(next))));
  };

  return (
    <div className="mb-3 rounded-xl border border-[#E8E5DF] bg-white p-3 shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
      <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{attachment?.originalName || "Attachment preview"}</p>
          <p className="mt-0.5 truncate text-xs text-[#697386]">
            {attachment?.redactedName ? `Redacted copy: ${attachment.redactedName}` : "Redacted copy is being prepared"}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[#E8F8F4] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#067F75]">
          Drag to compare
        </span>
      </div>

      <div
        className="relative aspect-[4/5] cursor-ew-resize overflow-hidden rounded-lg border border-[#E8E5DF] bg-[#F7F8FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#079B8E]/30"
        role="slider"
        aria-label="Compare safe copy with original"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={position}
        tabIndex={0}
        onPointerDown={(event) => {
          const target = event.currentTarget;
          target.setPointerCapture(event.pointerId);
          setFromClientX(event.clientX, target);
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          setFromClientX(event.clientX, event.currentTarget);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") setPosition((value) => Math.max(0, value - 5));
          if (event.key === "ArrowRight") setPosition((value) => Math.min(100, value + 5));
        }}
      >
        <PreviewPane preview={before} tone="before" />
        <div
          className="absolute inset-0 z-10 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          <PreviewPane preview={after} tone="after" />
        </div>
        <div
          className="pointer-events-none absolute top-0 z-20 h-full w-0.5 bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.18)]"
          style={{ left: `${position}%` }}
        />
        <div
          className="pointer-events-none absolute top-1/2 z-30 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#D7DCE2] bg-white text-[#079B8E] shadow-sm"
          style={{ left: `${position}%` }}
        >
          <span className="h-4 w-0.5 rounded-full bg-[#079B8E]" />
          <span className="ml-1 h-4 w-0.5 rounded-full bg-[#079B8E]" />
        </div>
      </div>

      <input
        aria-label="Before and after preview split"
        className="mt-3 w-full accent-[#079B8E]"
        type="range"
        min="0"
        max="100"
        value={position}
        onChange={(event) => setPosition(Number(event.target.value))}
      />
      <div className="mt-1 flex justify-between text-[10px] font-bold uppercase tracking-[0.08em] text-[#697386]">
        <span>Safe copy</span>
        <span>Original</span>
      </div>
      {attachment?.kind === "pdf" || attachment?.kind === "image" ? (
        <p className="mt-2 text-[11px] leading-relaxed text-[#697386]">
          The safe copy is rebuilt from extracted text, so formatting may change.
        </p>
      ) : null}
    </div>
  );
}

function PreviewPane({ preview, tone }: { preview: AttachmentPreview; tone: "before" | "after" }) {
  return (
    <div className={`absolute inset-0 ${tone === "after" ? "bg-[#F2FBF9]" : "bg-white"}`}>
      <div
        className={`absolute left-2 top-2 z-10 rounded-full px-2 py-1 text-[10px] font-bold ${
          tone === "after" ? "bg-[#E8F8F4] text-[#067F75]" : "bg-[#F3F4F6] text-[#4B5563]"
        }`}
      >
        {preview.label}
      </div>
      {preview.type === "image" ? (
        <img
          alt={preview.label}
          className="h-full w-full object-contain"
          src={preview.value}
        />
      ) : (
        <pre className="h-full overflow-hidden whitespace-pre-wrap break-words px-4 pb-4 pt-11 text-[11px] leading-relaxed text-[#1F2937]">
          {preview.value}
        </pre>
      )}
    </div>
  );
}

function AttachmentFileList({ files = [] }: { files?: AttachmentFileStatus[] }) {
  if (!files.length) return null;

  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-[#E8E5DF] bg-white">
      <div className="border-b border-[#EEECEA] px-3 py-2">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#697386]">Files in review</p>
      </div>
      {files.map((file) => {
        const isIssue = isIssueFile(file);
        return (
          <div key={`${file.name}-${file.status}`} className="flex items-start gap-3 border-b border-[#EEECEA] px-3 py-3 last:border-b-0">
            <div
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                isIssue
                  ? "bg-[#E54D2E]/8 text-[#E54D2E]"
                  : file.status === "redactable"
                    ? "bg-[#F5A623]/12 text-[#B65E00]"
                    : "bg-[#12A594]/10 text-[#078C7D]"
              }`}
            >
              {isIssue ? <AlertCircle size={16} /> : file.status === "redactable" ? <Paperclip size={16} /> : <CircleCheck size={16} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold">{file.name}</p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    isIssue
                      ? "bg-[#E54D2E]/8 text-[#A82712]"
                      : file.status === "redactable"
                        ? "bg-[#FFF8E8] text-[#8A5200]"
                        : "bg-[#E8F8F4] text-[#067F75]"
                  }`}
                >
                  {file.status === "redactable"
                    ? `${file.detectedCount || 0} found`
                    : file.status === "clean"
                      ? "Clear"
                      : file.status === "scanning"
                        ? "Scanning"
                        : "Needs review"}
                </span>
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-[#697386]">
                {isIssue
                  ? file.reason || "This file cannot be cleared automatically."
                  : file.redactedName
                    ? `Redacted copy: ${file.redactedName}`
                    : "This file can be attached by the safe action."}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PrivacyLensSidePanel() {
  const [state, setState] = useState<PanelState>(emptyState);
  const [tabId, setTabId] = useState<number | undefined>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);

  useEffect(() => {
    let active = true;

    sendMessage<{ ok: boolean; tabId?: number; state?: PanelState }>({
      type: "PRIVACYLENS_GET_STATE",
    }).then((response) => {
      if (!active) return;
      setTabId(response?.tabId);
      const nextState = response?.state || emptyState;
      setState(nextState);
      setSelected(new Set((nextState.entities || []).map((entity) => entity.id)));
    });

    const listener = (message: any) => {
      if (message.type !== "PRIVACYLENS_PANEL_STATE") return;
      setTabId(message.tabId);
      setState(message.state || emptyState);
      setSelected(new Set((message.state?.entities || []).map((entity: PanelEntity) => entity.id)));
    };

    extensionApi()?.runtime?.onMessage.addListener(listener);
    return () => {
      active = false;
      extensionApi()?.runtime?.onMessage.removeListener(listener);
    };
  }, []);

  const counts = useMemo(() => {
    return state.entities.reduce(
      (acc, entity) => {
        acc[entity.severity] += 1;
        return acc;
      },
      { high: 0, medium: 0, low: 0 } as Record<Severity, number>
    );
  }, [state.entities]);

  const hasEntities = state.entities.length > 0;
  const attachment = state.attachment;
  const hasAttachment = Boolean(attachment?.originalName || attachment?.redactedName);
  const attachmentFiles = attachment?.files || [];
  const issueFileCount = attachmentFiles.filter(isIssueFile).length;
  const safeFileCount = attachmentFiles.filter(isSafeFile).length;
  const hasBlockingIssues = issueFileCount > 0;
  const hasScannedAttachmentFiles = safeFileCount > 0;
  const degradedScanner = state.modelState.includes("model-unavailable");
  const needsReview = hasEntities || hasBlockingIssues || degradedScanner;
  const selectedCount = selected.size;
  const keptCount = Math.max(0, state.entities.length - selectedCount);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applySelectedRedactions = () => {
    const ids = selected.size ? Array.from(selected) : state.entities.map((entity) => entity.id);
    sendMessage({
      type: "PRIVACYLENS_APPLY_REDACTION",
      tabId,
      entityIds: ids,
    });
  };

  const redactAndSend = () => {
    sendMessage({
      type: "PRIVACYLENS_REDACT_AND_SEND",
      tabId,
      entityIds: Array.from(selected),
    });
  };

  const redactAndAttach = () => {
    sendMessage({
      type: "PRIVACYLENS_REDACT_AND_ATTACH",
      tabId,
      entityIds: Array.from(selected),
    });
  };

  const handlePrimarySend = () => {
    if (keptCount > 0 && !sendConfirmOpen) {
      setSendConfirmOpen(true);
      return;
    }

    redactAndSend();
  };

  const handlePrimaryAttach = () => {
    if (hasBlockingIssues && !hasScannedAttachmentFiles) {
      return;
    }

    if (keptCount > 0 && !sendConfirmOpen) {
      setSendConfirmOpen(true);
      return;
    }

    redactAndAttach();
  };

  const cancelBlock = () => {
    sendMessage({ type: "PRIVACYLENS_CANCEL_BLOCK", tabId });
  };

  const sendOriginal = () => {
    sendMessage({ type: "PRIVACYLENS_SEND_ORIGINAL", tabId });
  };

  const primaryAttachmentLabel = () => {
    if (hasBlockingIssues) {
      return hasScannedAttachmentFiles
        ? `Attach ${plural(safeFileCount, "safe file")} and leave out ${plural(issueFileCount, "unscanned file")}`
        : "No scanned file to attach";
    }

    if (selectedCount === 0) return "Attach with all items visible";
    if (keptCount > 0) {
      return `Attach redacted copy with ${keptCount} visible`;
    }
    return "Attach redacted copy";
  };

  const primarySendLabel = () => {
    if (degradedScanner && !hasEntities) return "Send with regex-only review";
    if (selectedCount === 0) return `Send with all ${keptCount} visible`;
    if (keptCount > 0) return `Send redacted message with ${keptCount} visible`;
    return "Send redacted message";
  };

  return (
    <main className="min-h-screen bg-[#FBFAF8] text-[#111827]">
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between border-b border-[#E8E5DF] bg-white/90 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#12A594]/10 text-[#078C7D]">
              <ShieldCheck size={22} strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">PrivacyLens</h1>
              <p className="text-[11px] font-medium text-[#697386]">
                {state.host || "AI chat"} protection
              </p>
            </div>
          </div>
          <button
            className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[#697386] transition hover:bg-[#F3F4F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#079B8E]/30 active:translate-y-px"
            onClick={cancelBlock}
            title="Cancel pending send or upload"
          >
            <X size={18} />
            <span className="text-xs font-bold">Cancel</span>
          </button>
        </header>

        <section className="flex-1 overflow-y-auto px-4 py-4">
          <div
            className={`mb-3 flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-semibold ${
              hasEntities || hasBlockingIssues
                ? "border-[#E54D2E]/25 bg-[#E54D2E]/7 text-[#A82712]"
                : state.status === "scanning"
                  ? "border-[#F5A623]/25 bg-[#F5A623]/10 text-[#8A5200]"
                  : "border-[#12A594]/20 bg-[#12A594]/8 text-[#077A6E]"
            }`}
          >
            <span className="flex items-center gap-2">
              {state.status === "scanning"
                ? <Loader2 size={16} className="animate-spin" />
                : hasEntities || hasBlockingIssues ? <AlertCircle size={16} /> : <CircleCheck size={16} />}
              {degradedScanner && !hasEntities
                ? "Model unavailable - review before sending"
                : hasAttachment && hasBlockingIssues
                ? `${plural(issueFileCount, "file")} ${issueFileCount === 1 ? "needs" : "need"} review - Upload paused`
                : hasEntities && hasAttachment
                ? `${state.entities.length} personal-data item${state.entities.length === 1 ? "" : "s"} found - Upload paused`
                : hasEntities
                    ? `${state.entities.length} personal-data item${state.entities.length === 1 ? "" : "s"} detected - Send blocked`
                  : state.status === "scanning"
                    ? hasAttachment
                      ? "Scanning attachment before this AI chat can use it"
                      : "Scanning message before send"
                    : attachment?.status === "attached"
                      ? "Redacted attachment is ready in this AI chat"
                      : "No risky data detected"}
            </span>
            {(hasEntities || hasBlockingIssues) && <Lock size={15} />}
          </div>

          <p className="mb-3 text-xs leading-relaxed text-[#5F6B7A]">
            {hasBlockingIssues
              ? "Files that cannot be scanned are not included when you attach the scanned copy. Use the original-file option only if you intend to send them unchanged."
              : degradedScanner
                ? "The model scanner is unavailable, so PrivacyLens is using regex fallback only. Review before sending."
                : <>Rows marked <span className="font-semibold text-[#067F75]">Redact</span> will be replaced. Rows marked <span className="font-semibold text-[#697386]">Keep</span> are approved for this one {hasAttachment ? "attachment" : "send"}.</>}
          </p>

          {hasAttachment && (
            <AttachmentPreviewSlider attachment={attachment} onClear={cancelBlock} />
          )}

          {hasAttachment && (
            <AttachmentFileList files={attachmentFiles} />
          )}

          {hasEntities ? (
            <div className="overflow-hidden rounded-xl border border-[#E8E5DF] bg-white shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
              {state.entities.map((entity) => {
                const Icon = iconByCategory[entity.category] || AlertCircle;
                const isSelected = selected.has(entity.id);

                return (
                  <button
                    key={entity.id}
                    onClick={() => toggle(entity.id)}
                    className={`flex w-full items-center gap-3 border-b border-[#EEECEA] px-3 py-3 text-left transition last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#079B8E]/30 active:translate-y-px ${
                      isSelected ? "bg-[#12A594]/5" : "bg-white hover:bg-[#F7F8FA]"
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        entity.severity === "high"
                          ? "bg-[#E54D2E]/8 text-[#E54D2E]"
                          : entity.severity === "medium"
                            ? "bg-[#F5A623]/12 text-[#D97706]"
                            : "bg-[#12A594]/10 text-[#078C7D]"
                      }`}
                    >
                      <Icon size={18} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold">{entity.label}</p>
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                            severityStyle[entity.severity]
                          }`}
                        >
                          {riskLabel(entity.severity)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-[#697386]">{maskValue(entity)}</p>
                    </div>

                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isSelected
                            ? "bg-[#E8F8F4] text-[#067F75]"
                            : "bg-[#F3F4F6] text-[#697386]"
                        }`}
                      >
                        {isSelected ? "Redact" : "Keep"}
                      </span>
                      <span
                        className={`relative h-5 w-9 rounded-full transition ${
                          isSelected ? "bg-[#12A594]" : "bg-[#D7DCE2]"
                        }`}
                        aria-label={isSelected ? "Selected for redaction" : "Kept for sending"}
                      >
                        <span
                          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition ${
                            isSelected ? "left-[18px]" : "left-0.5"
                          }`}
                        />
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : hasBlockingIssues ? (
            <div className="rounded-xl border border-[#E54D2E]/20 bg-white px-4 py-5 text-center">
              <AlertCircle className="mx-auto mb-3 text-[#E54D2E]" size={32} />
              <p className="text-sm font-semibold">Attachment review needed</p>
              <p className="mt-1 text-xs leading-relaxed text-[#697386]">
                PrivacyLens could not clear every selected file automatically.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-[#DDEFEA] bg-white px-4 py-6 text-center">
              <ShieldCheck className="mx-auto mb-3 text-[#12A594]" size={32} />
              <p className="text-sm font-semibold">PrivacyLens is active</p>
              <p className="mt-1 text-xs leading-relaxed text-[#697386]">
                Messages are scanned locally before this AI chat receives them.
              </p>
            </div>
          )}

          {hasEntities && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(["high", "medium", "low"] as Severity[]).map((severity) => (
                <div key={severity} className="rounded-lg border border-[#E8E5DF] bg-white px-2 py-2 text-center">
                  <p className="text-lg font-bold tabular-nums">{counts[severity]}</p>
                  <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#697386]">
                    {severity}
                  </p>
                </div>
              ))}
            </div>
          )}

          {needsReview && (
            <div className="mt-4 rounded-xl border border-[#E8E5DF] bg-white p-3">
              {hasEntities ? (
                <div className="mb-3 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-[#E8F8F4] px-2 py-2">
                    <p className="text-lg font-bold tabular-nums text-[#067F75]">{selectedCount}</p>
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#067F75]">redact</p>
                  </div>
                  <div className="rounded-lg bg-[#F7F8FA] px-2 py-2">
                    <p className="text-lg font-bold tabular-nums text-[#697386]">{keptCount}</p>
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#697386]">keep visible</p>
                  </div>
                </div>
              ) : (
                <div className="mb-3 rounded-lg bg-[#FFF8E8] px-3 py-2 text-xs leading-relaxed text-[#8A5200]">
                  {degradedScanner
                    ? "No regex-detected personal data was found, but model scanning is unavailable."
                    : "No personal data was detected, but at least one file could not be scanned."}
                </div>
              )}

              <button
                onClick={hasAttachment ? handlePrimaryAttach : handlePrimarySend}
                disabled={hasAttachment ? !hasScannedAttachmentFiles : (!hasEntities && !degradedScanner)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#079B8E] px-4 py-3 text-sm font-bold text-white shadow-[0_12px_24px_rgba(7,155,142,0.22)] transition hover:bg-[#067F75] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#079B8E]/35 active:translate-y-px disabled:cursor-not-allowed disabled:bg-[#D7DCE2] disabled:shadow-none disabled:active:translate-y-0"
              >
                {hasAttachment ? <Paperclip size={17} /> : <Send size={17} />}
                <span className="min-w-0 text-center leading-snug">
                  {hasAttachment ? primaryAttachmentLabel() : primarySendLabel()}
                </span>
              </button>

              {sendConfirmOpen && keptCount > 0 && (
                <div className="mt-3 rounded-lg border border-[#F5A623]/25 bg-[#FFF8E8] p-3">
                  <p className="text-xs leading-relaxed text-[#8A5200]">
                    {keptCount} detected item{keptCount === 1 ? "" : "s"} will remain visible.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={hasAttachment ? redactAndAttach : redactAndSend}
                      className="flex-1 rounded-md bg-[#079B8E] px-2 py-2 text-xs font-bold text-white transition hover:bg-[#067F75] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#079B8E]/35 active:translate-y-px"
                    >
                      {hasAttachment ? "Attach with kept items" : "Send with kept items"}
                    </button>
                    <button
                      onClick={() => setSendConfirmOpen(false)}
                      className="flex-1 rounded-md border border-[#E8E5DF] px-2 py-2 text-xs font-bold text-[#697386] transition hover:bg-[#F7F8FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#079B8E]/30 active:translate-y-px"
                    >
                      Review again
                    </button>
                  </div>
                </div>
              )}

              {!hasAttachment && (
                <button
                  onClick={applySelectedRedactions}
                  disabled={!hasEntities || selectedCount === 0}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-[#D7EEE9] bg-[#F2FBF9] px-4 py-2.5 text-sm font-bold text-[#067F75] transition hover:bg-[#E8F8F4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#079B8E]/30 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 disabled:active:translate-y-0"
                >
                  <PencilLine size={16} />
                  Redact selected in message
                </button>
              )}
            </div>
          )}

          <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#DDEFEA] bg-[#EFFAF8] px-3 py-3 text-xs text-[#305B63]">
            <Lightbulb className="shrink-0 text-[#079B8E]" size={17} />
            <span>
              Tip: Your SSN, IDs, and addresses can be used for identity theft.
            </span>
          </div>

          {needsReview && (
            <div className="mt-4 rounded-lg border border-[#E8E5DF] bg-white p-3">
              <button
                onClick={() => setOverrideOpen((value) => !value)}
                className="w-full rounded-md px-1 py-1 text-left text-xs font-semibold text-[#697386] transition hover:text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#079B8E]/30 active:translate-y-px"
              >
                {hasAttachment ? "Attach originals unchanged" : "Send without redaction"}
              </button>
              {overrideOpen && (
                <div className="mt-3 rounded-lg border border-[#E54D2E]/20 bg-[#E54D2E]/6 p-3">
                  <p className="text-xs leading-relaxed text-[#A82712]">
                    {hasAttachment
                      ? "This attaches every original file without redaction or scanner clearance."
                      : "This sends every detected item without redaction."}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={sendOriginal}
                      className="flex-1 rounded-md bg-[#E54D2E] px-2 py-2 text-xs font-bold text-white transition hover:bg-[#C93D22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E54D2E]/35 active:translate-y-px"
                    >
                      {hasAttachment ? "Attach originals now" : "Send without redaction"}
                    </button>
                    <button
                      onClick={() => setOverrideOpen(false)}
                      className="flex-1 rounded-md border border-[#E8E5DF] px-2 py-2 text-xs font-bold text-[#697386] transition hover:bg-[#F7F8FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#079B8E]/30 active:translate-y-px"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </section>

        <footer className="border-t border-[#E8E5DF] bg-white px-4 py-3">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-[#111827]">
              <ShieldCheck size={17} className="text-[#079B8E]" />
              {needsReview
                ? hasEntities
                  ? `${state.entities.length} item${state.entities.length === 1 ? "" : "s"} caught before ${hasAttachment ? "uploading" : "sending"}.`
                  : "Attachment paused for review."
                : attachment?.status === "attached"
                  ? attachment.omittedCount
                    ? `${plural(attachment.attachedCount || 0, "file")} attached. ${plural(attachment.omittedCount, "unscanned file")} left out.`
                    : `${plural(attachment.attachedCount || 1, "file")} attached.`
                : "Scanning all messages."}
            </span>
            <Info size={16} className="text-[#697386]" />
          </div>
          <p className="mt-2 flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[#697386]">
            <Sparkles size={12} className="text-[#079B8E]" />
            Local scanner: {scannerLabel(state.modelState)}
          </p>
        </footer>
      </div>
    </main>
  );
}

createRoot(document.getElementById("sidepanel-root")!).render(
  <StrictMode>
    <PrivacyLensSidePanel />
  </StrictMode>
);
