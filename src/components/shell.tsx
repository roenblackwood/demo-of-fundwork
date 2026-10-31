"use client";

import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CircleDollarSign, Hammer, Home, UserRound } from "lucide-react";
import { SnackbarProvider } from "@/components/snackbar";
import { usePhotos } from "@/components/photo-box";
import { useDemo } from "@/lib/demo-store";
import { Avatar } from "@/components/parts";
import { buttonVariants } from "@/components/ui/button";
import { loadAreaNames, type AreaName } from "@/lib/admin1";
import { drillHref, searchPlaces, type SearchHit } from "@/lib/openings";
import { needsYouCount, youHasUpdate } from "@/lib/requests";
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
  const demo = useDemo();
  const pathname = usePathname();
  const current = tabFor(pathname, demo.role);
  const attention =
    demo.ready && (youHasUpdate(demo.role, demo.userId, demo.requests, demo.applications, demo.projects) || needsYouCount(demo.role, demo.userId, demo.requests, demo.applications, demo.projects) > 0);
  const photos = usePhotos("profile", demo.userId);
  const photo = demo.profileSet ? (photos[0]?.url ?? null) : null;
  const width = contentWidth(pathname);
  const signedIn = demo.ready && demo.profileSet;

  return (
    <SnackbarProvider>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-card focus:px-4 focus:py-3 focus:font-semibold focus-visible:ring-3 focus-visible:ring-ring"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-lg items-center px-5 min-[600px]:max-w-none min-[600px]:pl-[calc(5rem+1.25rem)] min-[840px]:hidden">
          <Link
            href="/"
            className="font-display text-2xl text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
          >
            Fundwork
          </Link>
        </div>
        <div className="mx-auto hidden h-14 w-full max-w-6xl items-center gap-4 px-5 min-[840px]:flex">
          <Link
            href="/"
            className="font-display text-2xl text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
          >
            Fundwork
          </Link>
          <nav aria-label="Main" className="flex items-center gap-1">
            {tabs
              .filter((tab) => tab.id !== "you")
              .map((tab) => (
                <NavLink key={tab.id} tab={tab} current={current} />
              ))}
          </nav>
          <HeaderSearch />
          {signedIn ? (
            <DesktopYou name={demo.name} photo={photo} attention={attention} />
          ) : (
            <Link href="/get-started" className={cn(buttonVariants({ size: "sm" }), "rounded-full")}>
              Get started
            </Link>
          )}
        </div>
      </header>
      <nav
        aria-label="Main"
        className="fixed top-0 bottom-0 left-0 z-40 hidden w-20 flex-col gap-2 border-r border-border bg-background px-2 py-3 min-[600px]:flex min-[840px]:hidden"
      >
        {tabs.map((tab) =>
          tab.id === "you" ? (
            <YouEntry key={tab.id} layout="rail" on={current === "you"} signedIn={signedIn} name={demo.name} photo={photo} attention={attention} />
          ) : (
            <RailLink key={tab.id} tab={tab} on={current === tab.id} />
          ),
        )}
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
          {tabs.map((tab) =>
            tab.id === "you" ? (
              <YouEntry key={tab.id} layout="tab" on={current === "you"} signedIn={signedIn} name={demo.name} photo={photo} attention={attention} />
            ) : (
              <TabLink key={tab.id} tab={tab} on={current === tab.id} />
            ),
          )}
        </div>
      </nav>
    </SnackbarProvider>
  );
}

function YouEntry({
  layout,
  on,
  signedIn,
  name,
  photo,
  attention,
}: {
  layout: "tab" | "rail";
  on: boolean;
  signedIn: boolean;
  name: string;
  photo: string | null;
  attention: boolean;
}) {
  const label = attention ? "You, new update" : "You";
  const className =
    layout === "rail"
      ? cn(
          "flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring",
          on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
        )
      : cn(
          "flex min-h-14 flex-col items-center justify-center gap-0.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring",
          on ? "text-primary" : "text-muted-foreground",
        );
  return (
    <Link href="/you" aria-current={on ? "page" : undefined} aria-label={label} className={className}>
      <span className="relative">
        {signedIn ? (
          <Avatar name={name} src={photo} size="sm" inverse={layout === "rail" && on} />
        ) : (
          <UserRound className="size-6" aria-hidden />
        )}
        {signedIn && attention ? (
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2",
              layout === "rail" && on ? "bg-primary-foreground ring-primary" : "bg-primary ring-background",
            )}
            aria-hidden
          />
        ) : null}
      </span>
      You
    </Link>
  );
}

type YouMenuProps = {
  name: string;
  photo: string | null;
  attention: boolean;
  startOpen?: boolean;
};

function DesktopYou({ name, photo, attention }: { name: string; photo: string | null; attention: boolean }) {
  const [Menu, setMenu] = useState<ComponentType<YouMenuProps> | null>(null);
  if (Menu) return <Menu name={name} photo={photo} attention={attention} startOpen />;
  return (
    <button
      type="button"
      aria-label="You"
      aria-haspopup="menu"
      aria-expanded={false}
      className="grid size-11 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
      onClick={() => {
        void import("@/components/avatar-menu").then((mod) => setMenu(() => mod.YouMenu));
      }}
    >
      <span className="relative">
        <Avatar name={name} src={photo} size="md" />
        {attention ? (
          <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-primary ring-2 ring-background" aria-hidden />
        ) : null}
      </span>
    </button>
  );
}

function RailLink({ tab, on }: { tab: (typeof tabs)[number]; on: boolean }) {
  const Icon = tab.icon;
  return (
    <Link
      href={tab.href}
      aria-current={on ? "page" : undefined}
      className={cn(
        "flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring",
        on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
      )}
    >
      <Icon className="size-6" aria-hidden />
      {tab.label}
    </Link>
  );
}

function TabLink({ tab, on }: { tab: (typeof tabs)[number]; on: boolean }) {
  const Icon = tab.icon;
  return (
    <Link
      href={tab.href}
      aria-current={on ? "page" : undefined}
      className={cn(
        "flex min-h-14 flex-col items-center justify-center gap-0.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring",
        on ? "text-primary" : "text-muted-foreground",
      )}
    >
      <Icon className="size-6" aria-hidden />
      {tab.label}
    </Link>
  );
}

function NavLink({
  tab,
  current,
}: {
  tab: (typeof tabs)[number];
  current: (typeof tabs)[number]["id"] | null;
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
      {tab.label}
    </Link>
  );
}

function HeaderSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [areas, setAreas] = useState<AreaName[] | undefined>(undefined);
  useEffect(() => {
    if (query.trim().length < 2 || areas) return;
    let live = true;
    loadAreaNames().then((rows) => {
      if (live) setAreas(rows);
    });
    return () => {
      live = false;
    };
  }, [query, areas]);
  const hits = query.trim().length >= 2 ? searchPlaces(query, areas) : [];

  function pick(hit: SearchHit) {
    setQuery("");
    router.push(drillHref(hit));
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
  if (pathname.startsWith("/get-started") || pathname.startsWith("/you/profile")) return "max-w-2xl";
  if (pathname === "/you") return "max-w-lg min-[600px]:max-w-3xl";
  if (/\/(commit|apply|log|accept)(\/|$)/.test(pathname)) return "max-w-2xl";
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
