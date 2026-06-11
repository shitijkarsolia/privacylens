import type { ModelStatus as ModelStatusType } from "../types";

const STATUS_CONFIG: Record<
  ModelStatusType["state"],
  { label: (s: ModelStatusType) => string; color: string; pulse?: boolean }
> = {
  idle: { label: () => "Initializing...", color: "bg-[#787774]", pulse: true },
  downloading: {
    label: () => "Downloading on-device AI model...",
    color: "bg-[#F5A623]",
    pulse: true,
  },
  loading: {
    label: () => "Preparing AI model...",
    color: "bg-[#F5A623]",
    pulse: true,
  },
  ready: {
    label: (s) =>
      s.runtime === "browser"
        ? "On-device AI detection active"
        : "AI detection active",
    color: "bg-[#12A594]",
  },
  fallback: {
    label: () => "Pattern detection active",
    color: "bg-[#12A594]",
  },
  failed: {
    label: () => "AI model unavailable - pattern scan active",
    color: "bg-[#F5A623]",
  },
};

interface Props {
  status: ModelStatusType;
}

export function ModelStatus({ status }: Props) {
  const config = STATUS_CONFIG[status.state];

  return (
    <div
      className="flex items-center gap-2 text-xs font-mono text-[var(--color-text-secondary)]"
      title={
        status.state === "fallback"
          ? "Deep AI model is not available here; the instant pattern scanner still blocks personal data."
          : undefined
      }
    >
      <span
        className={`w-2 h-2 rounded-full ${config.color} ${config.pulse ? "animate-pulse" : ""}`}
      />
      <span>{config.label(status)}</span>
      {status.state === "downloading" && status.progress !== undefined && (
        <span className="tabular-nums">{Math.round(status.progress)}%</span>
      )}
    </div>
  );
}
