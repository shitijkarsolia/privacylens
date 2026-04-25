import type { ModelStatus as ModelStatusType } from "../types";

const STATUS_CONFIG = {
  idle: { label: "Initializing...", color: "bg-[#787774]" },
  downloading: { label: "Downloading AI model...", color: "bg-[#F5A623]" },
  loading: { label: "Preparing AI model...", color: "bg-[#F5A623]" },
  ready: { label: "AI-powered detection active", color: "bg-[#12A594]" },
  failed: { label: "Model failed — check WebGPU", color: "bg-[#E54D2E]" },
};

interface Props {
  status: ModelStatusType;
}

export function ModelStatus({ status }: Props) {
  const config = STATUS_CONFIG[status.state];

  return (
    <div className="flex items-center gap-2 text-xs font-mono text-[var(--color-text-secondary)]">
      <span className={`w-2 h-2 rounded-full ${config.color} ${status.state === "downloading" || status.state === "loading" ? "animate-pulse" : ""}`} />
      <span>{config.label}</span>
      {status.state === "downloading" && status.progress !== undefined && (
        <span className="tabular-nums">{Math.round(status.progress)}%</span>
      )}
    </div>
  );
}
