"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "cn";

export type SheetStop = "peek" | "half" | "full";

const STORAGE_KEY = "fundwork-sheet";
const STOPS: SheetStop[] = ["peek", "half", "full"];

export function readSheetStop(): SheetStop {
  if (typeof window === "undefined") return "peek";
  const saved = sessionStorage.getItem(STORAGE_KEY);
  return saved === "half" || saved === "full" || saved === "peek" ? saved : "peek";
}

export function writeSheetStop(stop: SheetStop) {
  sessionStorage.setItem(STORAGE_KEY, stop);
}

function stopIndex(stop: SheetStop): number {
  return STOPS.indexOf(stop);
}

export function ResultsSheet({
  label,
  notice,
  stop,
  onStop,
  children,
}: {
  label: string;
  notice?: string | null;
  stop: SheetStop;
  onStop: (stop: SheetStop) => void;
  children: React.ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState(640);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const drag = useRef<{ y: number; h: number; latest: number } | null>(null);
  const peek = 112;
  const half = Math.max(420, Math.round(frame * 0.62));
  const full = frame;
  const heights: Record<SheetStop, number> = { peek, half, full };
  const height = dragHeight ?? heights[stop];
  const open = height > peek + 12;

  useEffect(() => {
    const parent = root.current?.parentElement;
    if (!parent) return;
    const apply = () => setFrame(parent.clientHeight);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    root.current?.parentElement?.style.setProperty("--fw-sheet", `${Math.min(height, Math.max(peek, frame - 72))}px`);
  }, [height, frame]);

  function step(direction: 1 | -1) {
    const next = STOPS[Math.min(STOPS.length - 1, Math.max(0, stopIndex(stop) + direction))];
    setDragHeight(null);
    onStop(next);
  }

  function nearest(value: number): SheetStop {
    return STOPS.reduce((best, name) =>
      Math.abs(heights[name] - value) < Math.abs(heights[best] - value) ? name : best,
    );
  }

  return (
    <div
      ref={root}
      className="absolute inset-x-0 bottom-0 z-10 mx-auto flex w-full max-w-lg flex-col rounded-t-3xl bg-background shadow-[0_-8px_24px_rgba(26,35,48,0.12)]"
      style={{ height }}
    >
      <div
        className="shrink-0 cursor-grab touch-none px-3 pt-2 pb-1 active:cursor-grabbing"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          drag.current = { y: event.clientY, h: height, latest: height };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          const next = Math.min(full, Math.max(peek, drag.current.h + (drag.current.y - event.clientY)));
          drag.current.latest = next;
          setDragHeight(next);
        }}
        onPointerUp={() => {
          if (!drag.current) return;
          const value = drag.current.latest;
          drag.current = null;
          setDragHeight(null);
          onStop(nearest(value));
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDragHeight(null);
        }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-full px-2 text-base font-semibold text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring disabled:text-muted-foreground"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => step(-1)}
            disabled={stop === "peek"}
          >
            Show less
          </button>
          <div
            role="slider"
            tabIndex={0}
            aria-label="Results sheet"
            aria-valuemin={0}
            aria-valuemax={2}
            aria-valuenow={stopIndex(stop)}
            aria-valuetext={stop}
            className="flex min-h-11 flex-1 items-center justify-center focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
            onKeyDown={(event) => {
              if (event.key === "ArrowUp" || event.key === "ArrowRight") {
                event.preventDefault();
                step(1);
              }
              if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
                event.preventDefault();
                step(-1);
              }
            }}
          >
            <span className="h-1.5 w-10 rounded-full bg-foreground/20" />
          </div>
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-full px-2 text-base font-semibold text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring disabled:text-muted-foreground"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => step(1)}
            disabled={stop === "full"}
          >
            Show more
          </button>
        </div>
        <p className="pb-1 text-center text-sm text-muted-foreground">{label}</p>
        {notice ? <p className="px-1 pb-2 text-center text-base">{notice}</p> : null}
      </div>
      <div
        className={cn("min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 pb-3", !open && "hidden")}
      >
        {children}
      </div>
    </div>
  );
}
