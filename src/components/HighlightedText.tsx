import { useMemo } from "react";
import type { PIIEntity } from "../types";
import { SEVERITY_MAP } from "../types";

const SEVERITY_BG: Record<string, string> = {
  high: "bg-[#E54D2E]/15 border-[#E54D2E]/30 text-[#E54D2E]",
  medium: "bg-[#F5A623]/15 border-[#F5A623]/30 text-[#9A6700]",
  low: "bg-[#12A594]/15 border-[#12A594]/30 text-[#12A594]",
};

interface Props {
  text: string;
  entities: PIIEntity[];
}

export function HighlightedText({ text, entities }: Props) {
  const segments = useMemo(() => {
    if (entities.length === 0) return [{ text, highlighted: false as const }];

    const sorted = [...entities].sort((a, b) => a.start - b.start);
    const parts: { text: string; highlighted: false | PIIEntity }[] = [];
    let cursor = 0;

    for (const entity of sorted) {
      if (entity.start > cursor) {
        parts.push({ text: text.slice(cursor, entity.start), highlighted: false });
      }
      parts.push({
        text: text.slice(entity.start, entity.end),
        highlighted: entity,
      });
      cursor = entity.end;
    }

    if (cursor < text.length) {
      parts.push({ text: text.slice(cursor), highlighted: false });
    }

    return parts;
  }, [text, entities]);

  return (
    <span>
      {segments.map((seg, i) => {
        if (!seg.highlighted) {
          return <span key={i}>{seg.text}</span>;
        }

        const severity = SEVERITY_MAP[seg.highlighted.category];
        const classes = SEVERITY_BG[severity];

        return (
          <mark
            key={i}
            className={`${classes} border rounded px-1 py-0.5 font-medium text-sm no-underline`}
            title={`${seg.highlighted.category} (${Math.round(seg.highlighted.confidence * 100)}%)`}
          >
            {seg.text}
          </mark>
        );
      })}
    </span>
  );
}
