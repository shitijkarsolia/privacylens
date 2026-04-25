import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";

interface Props {
  pages: { beforeSrc: string; afterSrc: string }[];
  label?: string;
  onDownloadRedacted?: () => void;
}

export function BeforeAfterSlider({ pages, label, onDownloadRedacted }: Props) {
  const [position, setPosition] = useState(50);
  const [currentPage, setCurrentPage] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalPages = pages.length;
  const current = pages[currentPage];

  const getPosition = useCallback((clientX: number) => {
    if (!containerRef.current) return 50;
    const rect = containerRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setPosition(getPosition(e.clientX));
    },
    [getPosition]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (e.buttons === 0) return;
      setPosition(getPosition(e.clientX));
    },
    [getPosition]
  );

  if (!current) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-2"
    >
      {label && (
        <div className="flex items-center justify-between">
          <p className="text-xs font-mono text-[var(--color-text-secondary)] uppercase tracking-wider">
            {label}
          </p>
          {onDownloadRedacted && (
            <button
              onClick={onDownloadRedacted}
              className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-accent)] hover:underline"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              Download redacted
            </button>
          )}
        </div>
      )}
      <div
        ref={containerRef}
        className="relative w-full aspect-[4/3] rounded-xl overflow-hidden border border-[var(--color-border)] select-none bg-[var(--color-canvas)] touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        style={{ cursor: "col-resize" }}
      >
        {/* After (redacted) — full background */}
        <img
          src={current.afterSrc}
          alt="Redacted"
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          draggable={false}
        />

        {/* Before (original) — clipped */}
        <div
          className="absolute inset-0 overflow-hidden pointer-events-none"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          <img
            src={current.beforeSrc}
            alt="Original"
            className="absolute inset-0 w-full h-full object-contain"
            draggable={false}
          />
        </div>

        {/* Divider line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white pointer-events-none"
          style={{ left: `${position}%`, transform: "translateX(-50%)", boxShadow: "0 0 8px rgba(0,0,0,0.3)" }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white flex items-center justify-center" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.25)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2F3437" strokeWidth="2.5">
              <path d="M8 4l-6 8 6 8M16 4l6 8-6 8" />
            </svg>
          </div>
        </div>

        {/* Labels */}
        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-sm text-white text-[11px] font-mono pointer-events-none">
          Original
        </div>
        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-sm text-white text-[11px] font-mono pointer-events-none">
          Redacted
        </div>

        {/* Page navigation */}
        {totalPages > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); setCurrentPage((p) => Math.max(0, p - 1)); }}
              disabled={currentPage === 0}
              className="absolute left-2 bottom-3 w-8 h-8 rounded-lg bg-black/60 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed z-10"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-lg bg-black/60 backdrop-blur-sm text-white text-[11px] font-mono pointer-events-none z-10">
              {currentPage + 1} / {totalPages}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setCurrentPage((p) => Math.min(totalPages - 1, p + 1)); }}
              disabled={currentPage === totalPages - 1}
              className="absolute right-2 bottom-3 w-8 h-8 rounded-lg bg-black/60 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed z-10"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}
