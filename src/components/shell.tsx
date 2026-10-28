"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleDollarSign, Hammer, Home, UserRound } from "lucide-react";
import { SnackbarProvider } from "@/components/snackbar";
import { useDemo } from "@/lib/demo-store";
import { firstName } from "@/lib/format";
import { youHasUpdate } from "@/lib/requests";
import { cn } from "cn";

/**
 * Nice to have later, not in this pass:
 * - Search in the header, the way YouTube puts it above the feed.
 * - Pull to refresh on project lists.
 * - A shared move from a map pin into the country list.
 * - Saved projects, the way Instagram saves a post.
 * - A dark theme checked for the same contrast, not the unused default.
 * - Messages between an investor and a worker.
 * - Push notifications when someone applies, is invited, or accepts.
 * - More than one investor funding the same request.
 */

const tabs = [
  { id: "home", href: "/", label: "Home", icon: Home },
  { id: "invest", href: "/invest", label: "Invest", icon: CircleDollarSign },
  { id: "work", href: "/work", label: "Work", icon: Hammer },
  { id: "you", href: "/you", label: "You", icon: UserRound },
] as const;

export function Shell({ children }: { children: React.ReactNode }) {
  const { ready, name, role, userId, requests, applications, projects } = useDemo();
  const pathname = usePathname();
  const label = ready ? firstName(name) : "You";
  const current = tabFor(pathname, role);
  const attention = ready && youHasUpdate(role, userId, name, requests, applications, projects);

  return (
    <SnackbarProvider>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-card focus:px-4 focus:py-3 focus:font-semibold"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-lg items-center justify-between px-5">
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
        className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 pt-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))]"
      >
        {children}
      </div>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <div className="mx-auto grid h-16 w-full max-w-lg grid-cols-4">
          {tabs.map((tab) => {
            const on = current === tab.id;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.id}
                href={tab.href}
                aria-current={on ? "page" : undefined}
                aria-label={tab.id === "you" && attention ? "You, new update" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-sm font-semibold",
                  on ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span className="relative">
                  <Icon className="size-6" aria-hidden />
                  {tab.id === "you" && attention ? (
                    <span className="absolute top-0 right-0 size-2 rounded-full bg-primary" aria-hidden />
                  ) : null}
                </span>
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </SnackbarProvider>
  );
}

function tabFor(pathname: string, role: "investor" | "worker" | null): (typeof tabs)[number]["id"] | null {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/invest")) return "invest";
  if (pathname.startsWith("/work")) return "work";
  if (pathname.startsWith("/you")) return "you";
  if (pathname.startsWith("/projects") || pathname.startsWith("/requests")) {
    if (role === "worker") return "work";
    if (role === "investor") return "invest";
  }
  return null;
}
