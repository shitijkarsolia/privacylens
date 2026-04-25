import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";

interface Props {
  beforeSrc: string;
  afterSrc: string;
  label?: string;
}

export function BeforeAfterSlider({ beforeSrc, afterSrc, label }: Props) {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-2"
    >
      {label && (
        <p className="text-xs font-mono text-[var(--color-text-secondary)] uppercase tracking-wider">
          {label}
        </p>
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
          src={afterSrc}
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
            src={beforeSrc}
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
      </div>
    </motion.div>
  );
}
