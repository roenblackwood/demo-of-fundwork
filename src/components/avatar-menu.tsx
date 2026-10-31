"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/parts";
import { useDemo } from "@/lib/demo-store";
import { isLive } from "@/lib/mode";
import { needsYouCount } from "@/lib/requests";
import { cn } from "cn";

export function YouMenu({
  name,
  photo,
  attention,
  startOpen = false,
}: {
  name: string;
  photo: string | null;
  attention: boolean;
  startOpen?: boolean;
}) {
  const demo = useDemo();
  const router = useRouter();
  const [open, setOpen] = useState(startOpen);
  const [email, setEmail] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const count = needsYouCount(demo.role, demo.userId, demo.requests, demo.applications, demo.projects);
  const sample = !isLive() && demo.userId !== "you";
  const subtitle = isLive() ? email : sample ? "Sample person" : "";

  useEffect(() => {
    if (!open || !isLive()) return;
    let live = true;
    void import("@/lib/supabase/browser").then(({ browserSupabase }) =>
      browserSupabase().auth.getUser().then(({ data }) => {
        if (live) setEmail(data.user?.email ?? "");
      }),
    );
    return () => {
      live = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const first = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
    first?.focus();
    function onPointer(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  function onMenuKey(event: React.KeyboardEvent<HTMLDivElement>) {
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(index + 1) % items.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1]?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  async function signOut() {
    const { browserSupabase } = await import("@/lib/supabase/browser");
    const { refreshLiveStore } = await import("@/lib/live-store");
    await browserSupabase().auth.signOut();
    await refreshLiveStore();
    router.push("/");
  }

  const items: { id: string; label: string; href?: string; count?: number; onSelect?: () => void }[] = [
    { id: "profile", label: "Your profile", href: "/you/profile" },
  ];
  if (demo.role === "investor") items.push({ id: "portfolio", label: "Your portfolio", href: "/you/portfolio" });
  items.push(
    { id: "saved", label: "Saved", href: "/you#saved" },
    { id: "needs", label: "Needs you", href: "/you#needs-you", count },
    { id: "wallet", label: "Check a wallet", href: "/you/wallet" },
  );
  if (demo.role === "investor" || demo.role === "worker") {
    items.push({
      id: "switch",
      label: demo.role === "investor" ? "Switch to working" : "Switch to investing",
      onSelect: () => demo.switchRole(),
    });
  }
  if (isLive()) items.push({ id: "out", label: "Sign out", onSelect: () => void signOut() });

  const itemClass =
    "flex min-h-11 w-full items-center justify-between gap-3 px-4 text-left text-base font-semibold hover:bg-secondary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring";

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label="You"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        className="grid size-11 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="relative">
          <Avatar name={name} src={photo} size="md" />
          {attention ? (
            <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-primary ring-2 ring-background" aria-hidden />
          ) : null}
        </span>
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="You"
          onKeyDown={onMenuKey}
          className="absolute top-12 right-0 z-50 w-64 rounded-2xl border-2 border-border bg-card py-1 shadow-sm"
        >
          <p className="px-4 py-2">
            <span className="block font-semibold">{name.trim() && name !== "You" ? name : "You"}</span>
            {subtitle ? <span className="block text-sm text-muted-foreground">{subtitle}</span> : null}
          </p>
          {items.map((item) =>
            item.href ? (
              <Link key={item.id} href={item.href} role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
                <span>{item.label}</span>
                {typeof item.count === "number" ? <span>{item.count}</span> : null}
              </Link>
            ) : (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className={cn(itemClass)}
                onClick={() => {
                  item.onSelect?.();
                  close();
                }}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
