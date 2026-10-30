"use client";

import { useDemo } from "@/lib/demo-store";
import type { ScorePart } from "@/lib/recommend";

export function CardNotes({
  id,
  sector,
  reason,
  parts,
}: {
  id: string;
  sector: string;
  reason?: string;
  parts?: ScorePart[];
}) {
  const demo = useDemo();
  const saved = demo.savedIds.includes(id);
  const lines = parts ?? [];
  return (
    <div className="px-2 pb-2">
      {reason ? (
        <p data-reason={reason} className="text-xs leading-4 text-muted-foreground">
          {reason}
        </p>
      ) : null}
      <div className="mt-1 flex flex-wrap items-center gap-x-3">
        <button
          type="button"
          className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
          onClick={() => demo.saveItem(id, sector)}
        >
          {saved ? "Saved" : "Save"}
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
          onClick={() => demo.hideItem(id, sector)}
        >
          Not interested
        </button>
      </div>
      {lines.length > 0 ? (
        <details className="mt-1">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring">
            Why am I seeing this?
          </summary>
          <div className="space-y-1 pb-2">
            {lines.map((part) => (
              <p key={part.label} className="text-sm leading-5">
                <span className="font-semibold">{part.label}.</span> {part.text}
              </p>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
