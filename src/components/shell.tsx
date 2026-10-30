"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CircleDollarSign, Hammer, Home, UserRound } from "lucide-react";
import { SnackbarProvider } from "@/components/snackbar";
import { useDemo } from "@/lib/demo-store";
import { Avatar } from "@/components/parts";
import { searchPlaces, type SearchHit } from "@/lib/openings";
import { youHasUpdate } from "@/lib/requests";
import { cn } from "cn";

/**
 * Nice to have later, not in this pass:
 * - Pull to refresh on project lists.
 * - A shared move from a map pin into the country list.
 * - Saved projects, the way Instagram saves a post.
 * - A dark theme checked for the same contrast, not the unused default.
 * - Real photos instead of sector tiles.
 * - Messages between an investor and a worker.
 * - Push notifications when someone applies, is invited, or accepts.
 * - More than one investor funding the same request.
 * - Guides in more languages.
 * - A guide that updates when a check changes.
 * - Asking a follow-up question.
 * - Phone and WhatsApp sign-in.
 * - Organizers accepting logged work. Capital is accepted by the chain check once a project has a wallet.
 * - Mainnet, Lightning, multisig or escrow, a background watcher, and local cash-out partners.
 * - Email when someone applies.
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
  const current = tabFor(pathname, role);
  const attention = ready && youHasUpdate(role, userId, requests, applications, projects);
  const showYou = ready && name.trim() && name !== "You";
  const width = contentWidth(pathname);

  return (
    <SnackbarProvider>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-card focus:px-4 focus:py-3 focus:font-semibold focus-visible:ring-3 focus-visible:ring-ring"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-lg items-center justify-between px-5 min-[600px]:max-w-none min-[600px]:pl-[calc(5rem+1.25rem)] min-[840px]:hidden">
          <Link
            href="/"
            className="font-display text-2xl text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
          >
            Fundwork
          </Link>
          {showYou ? <YouLink name={name} /> : null}
        </div>
        <div className="mx-auto hidden h-14 w-full max-w-6xl items-center gap-4 px-5 min-[840px]:flex">
          <Link
            href="/"
            className="font-display text-2xl text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
          >
            Fundwork
          </Link>
          <nav aria-label="Main" className="flex items-center gap-1">
            {tabs.map((tab) => (
              <NavLink key={tab.id} tab={tab} current={current} attention={attention} />
            ))}
          </nav>
          <HeaderSearch />
          <YouLink name={showYou ? name : "You"} />
        </div>
      </header>
      <nav
        aria-label="Main"
        className="fixed top-0 bottom-0 left-0 z-40 hidden w-20 flex-col gap-2 border-r border-border bg-background px-2 py-3 min-[600px]:flex min-[840px]:hidden"
      >
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
                "flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring",
                on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              <span className="relative">
                <Icon className="size-6" aria-hidden />
                {tab.id === "you" && attention ? (
                  <span
                    className={cn(
                      "absolute top-0 right-0 size-2 rounded-full",
                      on ? "bg-primary-foreground" : "bg-primary",
                    )}
                    aria-hidden
                  />
                ) : null}
              </span>
              {tab.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex w-full min-w-0 flex-1 flex-col min-[600px]:pl-20 min-[840px]:pl-0">
        <div
          id="content"
          className={cn(
            "mx-auto flex w-full min-w-0 flex-1 flex-col px-5 pt-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] min-[600px]:pb-8 [&>*]:min-w-0",
            width,
          )}
        >
          {children}
        </div>
      </div>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur min-[600px]:hidden"
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
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring",
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

function YouLink({ name }: { name: string }) {
  return (
    <Link
      href="/you"
      aria-label="You"
      className="grid size-11 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
    >
      <Avatar name={name} />
    </Link>
  );
}

function NavLink({
  tab,
  current,
  attention,
}: {
  tab: (typeof tabs)[number];
  current: (typeof tabs)[number]["id"] | null;
  attention: boolean;
}) {
  const on = current === tab.id;
  return (
    <Link
      href={tab.href}
      aria-current={on ? "page" : undefined}
      className={cn(
        "rounded-full px-3 py-2 text-base font-semibold focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring",
        on ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
      )}
    >
      {tab.id === "you" && attention ? "You" : tab.label}
      {tab.id === "you" && attention ? <span className="sr-only">, new update</span> : null}
    </Link>
  );
}

function HeaderSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const hits = query.trim().length >= 2 ? searchPlaces(query) : [];

  function pick(hit: SearchHit) {
    sessionStorage.setItem("fundwork-place", JSON.stringify(hit));
    setQuery("");
    router.push("/");
  }

  return (
    <div className="relative min-w-0 flex-1">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search a town or country"
        aria-label="Search a town or country"
        className="h-11 w-full max-w-md rounded-full border-2 border-border bg-card px-4 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring"
      />
      {hits.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-64 w-full max-w-md overflow-y-auto rounded-2xl border-2 border-border bg-card py-1 shadow-sm">
          {hits.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                className="flex min-h-11 w-full flex-col justify-center px-4 text-left hover:bg-secondary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
                onClick={() => pick(hit)}
              >
                <span className="font-semibold">{hit.label}</span>
                <span className="text-sm text-muted-foreground">{hit.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function contentWidth(pathname: string): string {
  if (/\/(commit|apply|log)(\/|$)/.test(pathname)) return "max-w-2xl";
  if (pathname.includes("/start")) return "max-w-2xl min-[840px]:max-w-6xl";
  return "max-w-lg min-[600px]:max-w-3xl min-[840px]:max-w-6xl";
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
