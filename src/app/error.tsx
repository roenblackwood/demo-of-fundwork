"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div>
      <h1 className="font-display text-3xl leading-tight">This page did not load.</h1>
      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={reset}
          className={cn(buttonVariants({ size: "lg" }), "w-full")}
        >
          Try again
        </button>
        <Link href="/" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}>
          Go to the start
        </Link>
      </div>
    </div>
  );
}
