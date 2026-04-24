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
  const dragging = useRef(false);

  const updatePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setPosition(pct);
  }, []);

  const handleMouseDown = useCallback(() => {
    dragging.current = true;
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging.current) return;
      updatePosition(e.clientX);
    },
    [updatePosition]
  );

  const handleMouseUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      updatePosition(e.touches[0].clientX);
    },
    [updatePosition]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      updatePosition(e.clientX);
    },
    [updatePosition]
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
        className="relative w-full aspect-[4/3] rounded-xl overflow-hidden border border-[var(--color-border)] cursor-col-resize select-none bg-[var(--color-canvas)]"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchMove={handleTouchMove}
        onClick={handleClick}
      >
        {/* After (redacted) — full background */}
        <img
          src={afterSrc}
          alt="Redacted"
          className="absolute inset-0 w-full h-full object-contain"
          draggable={false}
        />

        {/* Before (original) — clipped */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${position}%` }}
        >
          <img
            src={beforeSrc}
            alt="Original"
            className="absolute inset-0 w-full h-full object-contain"
            style={{ width: containerRef.current?.offsetWidth || "100%" }}
            draggable={false}
          />
        </div>

        {/* Divider line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.3)]"
          style={{ left: `${position}%`, transform: "translateX(-50%)" }}
        >
          {/* Handle */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.2)] flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2F3437" strokeWidth="2.5">
              <path d="M8 4l-6 8 6 8M16 4l6 8-6 8" />
            </svg>
          </div>
        </div>

        {/* Labels */}
        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-sm text-white text-[11px] font-mono">
          Original
        </div>
        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-sm text-white text-[11px] font-mono">
          Redacted
        </div>
      </div>
    </motion.div>
  );
}
