"use client";

import Link from "next/link";
import { firstName } from "@/lib/format";
import { useDemo } from "@/lib/demo-store";

export function Shell({ children }: { children: React.ReactNode }) {
  const { ready, name } = useDemo();
  const label = ready ? firstName(name) : "You";

  return (
    <>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-card focus:px-4 focus:py-3 focus:font-semibold"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-lg items-center justify-between px-5">
          <Link
            href="/"
            className="font-display text-2xl text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
          >
            Fundwork
          </Link>
          <Link
            href="/you"
            className="inline-flex min-h-11 items-center rounded-full border bg-card px-4 font-semibold focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
          >
            {label}
          </Link>
        </div>
      </header>
      <div
        id="content"
        className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-6"
      >
        {children}
      </div>
    </>
  );
}
