"use client";

import { useEffect, useId, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bookmark, MoreHorizontal } from "lucide-react";
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
  const router = useRouter();
  const pathname = usePathname();
  const saved = demo.savedIds.includes(id);
  const lines = parts ?? [];
  const [open, setOpen] = useState(false);
  const [why, setWhy] = useState(false);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest(`[data-card-menu="${menuId}"]`)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, menuId]);

  return (
    <>
      <div className="absolute top-0 right-0 z-10 flex" data-card-menu={menuId}>
        <button
          type="button"
          aria-label="Save"
          aria-pressed={saved}
          className="inline-flex size-11 items-center justify-center rounded-full text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
          onClick={() => {
            if (!demo.profileSet) {
              const params = new URLSearchParams();
              params.set("next", pathname);
              params.set("save", id);
              params.set("sector", sector);
              router.push(`/get-started?${params.toString()}`);
              return;
            }
            demo.saveItem(id, sector);
          }}
        >
          <Bookmark className={saved ? "size-5 fill-current" : "size-5"} aria-hidden />
        </button>
        <button
          type="button"
          aria-label="More"
          aria-expanded={open}
          aria-controls={menuId}
          className="inline-flex size-11 items-center justify-center rounded-full text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
          onClick={() => setOpen((value) => !value)}
        >
          <MoreHorizontal className="size-5" aria-hidden />
        </button>
        {open ? (
          <div
            id={menuId}
            role="menu"
            className="absolute top-11 right-0 w-56 rounded-2xl border-2 border-border bg-card py-1 shadow-sm"
          >
            <button
              type="button"
              role="menuitem"
              className="flex min-h-11 w-full items-center px-4 text-left text-sm font-semibold hover:bg-secondary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
              onClick={() => {
                setOpen(false);
                demo.hideItem(id, sector);
              }}
            >
              Not interested
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex min-h-11 w-full items-center px-4 text-left text-sm font-semibold hover:bg-secondary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
              onClick={() => {
                setOpen(false);
                setWhy((value) => !value);
              }}
            >
              Why am I seeing this
            </button>
          </div>
        ) : null}
      </div>
      {reason ? (
        <p data-reason={reason} className="px-2 pb-2 text-sm leading-5 text-muted-foreground">
          {reason}
        </p>
      ) : null}
      {why ? (
        <div className="space-y-1 px-2 pb-2">
          {lines.length === 0 ? <p className="text-sm leading-5">No extra reason on this card.</p> : null}
          {lines.map((part) => (
            <p key={part.label} className="text-sm leading-5">
              <span className="font-semibold">{part.label}.</span> {part.text}
            </p>
          ))}
        </div>
      ) : null}
    </>
  );
}
