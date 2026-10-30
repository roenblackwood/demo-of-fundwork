import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Plus, UserRound } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { checkLabel } from "@/lib/ai";
import { sectorTitle, SECTOR_MARKS } from "@/lib/catalog";
import { initials, money, moneyShort } from "@/lib/format";
import { aboutUsd } from "@/lib/rates";
import { cn } from "cn";
import type { Check as TrustCheck, CheckState, Sector } from "@/lib/types";

/** Section headings share this size. Pages space them with space-y-6. */
export const sectionTitle = "text-xl font-semibold";

// The first saved photo replaces this tile on a card or a detail page.

export function SectorTile({
  sector,
  size = "card",
}: {
  sector: Sector;
  size?: "card" | "page";
}) {
  const mark = SECTOR_MARKS[sector];
  const Icon = mark.icon;
  if (size === "page") {
    return (
      <div className={cn("flex h-24 items-center gap-4 rounded-2xl px-4 min-[840px]:h-40", mark.tile)} aria-hidden>
        <Icon className="size-12 shrink-0" strokeWidth={1.75} />
        <p className="text-xl font-semibold">{sectorTitle(sector)}</p>
      </div>
    );
  }
  return (
    <div className={cn("grid aspect-video place-items-center rounded-2xl", mark.tile)} aria-hidden>
      <Icon className="size-12" strokeWidth={1.75} />
    </div>
  );
}

const AVATAR_SIZE = {
  sm: "size-7",
  md: "size-9",
  lg: "size-10",
  row: "size-8",
} as const;

export function Avatar({
  name,
  src,
  size = "lg",
  inverse = false,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof AVATAR_SIZE;
  inverse?: boolean;
}) {
  const trimmed = name.trim();
  const unnamed = trimmed.length === 0 || trimmed.toLowerCase() === "you";
  const letters = unnamed ? "" : initials(trimmed);
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full text-sm font-semibold",
        inverse ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground",
        AVATAR_SIZE[size],
      )}
      aria-hidden
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : letters ? (
        letters
      ) : (
        <UserRound className={size === "sm" || size === "row" ? "size-4" : "size-5"} aria-hidden />
      )}
    </span>
  );
}

export function MoneyText({
  amount,
  currency,
  short = false,
  suffix,
  showAbout = true,
}: {
  amount: number;
  currency: string;
  short?: boolean;
  suffix?: string;
  showAbout?: boolean;
}) {
  const local = short ? moneyShort(amount, currency) : money(amount, currency);
  const usd = showAbout ? aboutUsd(amount, currency) : "";
  return (
    <span className="inline-flex max-w-full flex-wrap items-baseline gap-x-1">
      <span className="whitespace-nowrap">{suffix ? `${local} ${suffix}` : local}</span>
      {usd ? <span className="font-normal whitespace-nowrap text-muted-foreground">· {usd}</span> : null}
    </span>
  );
}

export function FloatingAction({
  href,
  label,
  tone,
}: {
  href: string;
  label: string;
  tone: "primary" | "work";
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 min-[600px]:hidden">
      <div className="mx-auto flex w-full max-w-lg justify-end px-5 pb-3">
        <Link
          href={href}
          className={cn(
            "pointer-events-auto inline-flex h-14 items-center gap-2 rounded-full px-5 text-base font-semibold whitespace-nowrap shadow-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring",
            tone === "work" ? "bg-work text-work-foreground" : "bg-primary text-primary-foreground",
          )}
        >
          <Plus className="size-5 shrink-0" aria-hidden />
          {label}
        </Link>
      </div>
    </div>
  );
}

export function StepHeader({
  backHref,
  onBack,
  step,
  total,
  title,
  hint,
}: {
  backHref: string;
  onBack?: () => void;
  step?: number;
  total?: number;
  title?: string;
  hint?: string;
}) {
  const backClass =
    "inline-flex min-h-11 min-w-11 items-center gap-1 font-semibold text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring";
  const backInner = (
    <>
      <ChevronLeft className="size-6 shrink-0" aria-hidden />
      Back
    </>
  );
  return (
    <div className={title ? "mb-6" : "mb-4"}>
      {onBack ? (
        <button type="button" onClick={onBack} className={backClass}>
          {backInner}
        </button>
      ) : (
        <Link href={backHref} className={backClass}>
          {backInner}
        </Link>
      )}
      {step && total ? (
        <p className="mt-4 text-base font-semibold text-muted-foreground">
          Step {step} of {total}
        </p>
      ) : null}
      {title ? (
        <h1 className="mt-1 font-display text-3xl leading-tight text-foreground">{title}</h1>
      ) : null}
      {hint ? <p className="mt-2 text-lg text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function ChoiceLink({
  href,
  title,
  detail,
  onClick,
}: {
  href: string;
  title: string;
  detail?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border-2 border-border bg-card px-4 py-3 text-left shadow-sm hover:border-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
    >
      <span>
        <span className="block text-lg font-semibold">{title}</span>
        {detail ? (
          <span className="mt-1 block text-base font-normal text-muted-foreground">
            {detail}
          </span>
        ) : null}
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

export function LearnMore({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="rounded-2xl border bg-card">
      <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-3 px-4 py-3 text-lg font-semibold focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring">
        {title}
        <span aria-hidden className="text-2xl leading-none text-muted-foreground">
          +
        </span>
      </summary>
      <div className="space-y-3 px-4 pb-4 text-base leading-relaxed">{children}</div>
    </details>
  );
}

export function StatusLabel({
  status,
  kind,
  waiting,
}: {
  status: "pledged" | "accepted" | "logged";
  kind: "capital" | "work";
  waiting?: string;
}) {
  const accepted = status === "accepted";
  const label = accepted
    ? kind === "capital"
      ? "Capital accepted"
      : "Work accepted"
    : waiting
      ? waiting
      : kind === "capital"
        ? "Capital waiting on the organizer"
        : "Work waiting on the organizer";
  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center rounded-full px-3 py-1 text-sm font-semibold",
        accepted ? "bg-trust text-trust-foreground" : "bg-wait text-wait-foreground",
      )}
    >
      {label}
    </span>
  );
}

export function ApplicationStatusLabel({
  origin,
  status,
  viewer,
}: {
  origin: "applied" | "invited";
  status: "waiting" | "accepted" | "declined";
  viewer: "investor" | "worker";
}) {
  const label =
    status === "accepted"
      ? "Accepted"
      : status === "declined"
        ? "Not this time"
        : origin === "invited"
          ? viewer === "worker"
            ? "Invited. Waiting on you"
            : "Invited. Waiting on them."
          : "Waiting on the investor";
  const tone =
    status === "accepted"
      ? "bg-trust text-trust-foreground"
      : status === "declined"
        ? "bg-muted text-muted-foreground"
        : "bg-wait text-wait-foreground";
  return (
    <span className={cn("inline-flex min-h-8 items-center rounded-full px-3 py-1 text-sm font-semibold", tone)}>
      {label}
    </span>
  );
}

export function CapitalChip({ audience = "own-request" }: { audience?: "project" | "own-request" | "request" }) {
  const line =
    audience === "project"
      ? "Money counts once we see it on the chain. You send it yourself."
      : audience === "own-request"
        ? "You send it yourself. We check it on the chain. For now this request shows the amount you entered."
        : "You send it yourself. We check it on the chain.";
  return (
    <div className="space-y-2">
      <span className="inline-flex min-h-8 items-center rounded-full bg-wait px-3 py-1 text-sm font-semibold text-wait-foreground">
        Capital not checked yet.
      </span>
      <p className="text-base text-muted-foreground">{line}</p>
    </div>
  );
}

function checkTone(state: CheckState): string {
  if (state === "yes") return "border-transparent bg-trust text-trust-foreground";
  if (state === "review") return "border-transparent bg-wait text-wait-foreground";
  return "border-border bg-card text-foreground";
}

export function TrustBadges({
  checks,
  limit,
  compact = false,
}: {
  checks: TrustCheck[];
  limit?: number;
  compact?: boolean;
}) {
  const rank: Record<CheckState, number> = { yes: 0, review: 1, open: 2 };
  const ordered = [...checks].sort((a, b) => rank[a.state] - rank[b.state]);
  const shown = typeof limit === "number" ? ordered.slice(0, limit) : ordered;
  if (compact) {
    return (
      <ul className="flex flex-wrap gap-1">
        {shown.map((check) => (
          <li
            key={check.id}
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0 text-sm leading-5 font-semibold whitespace-nowrap",
              checkTone(check.state),
            )}
          >
            {check.state === "yes" ? <Check className="size-3" aria-hidden /> : null}
            {checkLabel(check.id, check.state)}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {shown.map((check) => (
        <li key={check.id}>
          <Badge variant="outline" className={checkTone(check.state)}>
            {check.state === "yes" ? <Check className="size-4" aria-hidden /> : null}
            {checkLabel(check.id, check.state)}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

export function FundingPills({ labels }: { labels: string[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {labels.map((label) => (
        <li key={label}>
          <span className="inline-flex min-h-8 items-center rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-secondary-foreground">
            {label}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function NextSteps({ items }: { items: string[] }) {
  return (
    <section>
      <h2 className={sectionTitle}>What happens next</h2>
      <ol className="mt-3 space-y-3">
        {items.map((item, index) => (
          <li key={item} className="flex gap-3 text-base leading-relaxed">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {index + 1}
            </span>
            <span className="pt-1">{item}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Checklist({
  title,
  hint,
  steps,
}: {
  title: string;
  hint?: string;
  steps: { label: string; done: boolean; href?: string; action?: string }[];
}) {
  const doneCount = steps.filter((step) => step.done).length;
  const current = steps.find((step) => !step.done);
  const value = steps.length === 0 ? 0 : Math.round((doneCount / steps.length) * 100);

  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
      <h2 className={sectionTitle}>{title}</h2>
      {hint ? <p className="mt-2 text-base leading-relaxed">{hint}</p> : null}
      <Progress value={value} aria-label={title} className="mt-4">
        <ProgressLabel className="text-base">
          {doneCount} of {steps.length} done
        </ProgressLabel>
      </Progress>
      <ol className="mt-4 space-y-3">
        {steps.map((step, index) => (
          <li key={step.label} className="flex items-start gap-3 text-lg">
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold",
                step.done
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground",
              )}
              aria-hidden
            >
              {step.done ? <Check className="size-4" /> : index + 1}
            </span>
            <span className={step.done ? "pt-1 text-muted-foreground" : "pt-1 font-semibold"}>
              {step.label}
            </span>
          </li>
        ))}
      </ol>
      {current?.href && current.action ? (
        <Link
          href={current.href}
          className={cn(buttonVariants({ size: "lg" }), "mt-5 w-full")}
        >
          {current.action}
        </Link>
      ) : null}
    </section>
  );
}

export function ActionBar({
  children,
  hideExpanded = false,
}: {
  children: React.ReactNode;
  hideExpanded?: boolean;
}) {
  return (
    <>
      <div className={cn("h-40 shrink-0", hideExpanded && "min-[840px]:hidden")} aria-hidden />
      <div
        className={cn(
          "fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-border bg-background/95 px-5 py-3 backdrop-blur min-[600px]:bottom-0 min-[600px]:left-20 min-[840px]:left-0",
          hideExpanded && "min-[840px]:hidden",
        )}
      >
        <div className="mx-auto flex w-full max-w-lg flex-col gap-2 min-[600px]:max-w-2xl">{children}</div>
      </div>
    </>
  );
}

export function SavedMark({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-3 text-lg font-semibold" role="status">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-trust text-trust-foreground">
        <Check className="size-6" aria-hidden />
      </span>
      {label}
    </p>
  );
}

export function OwnershipStrip() {
  return (
    <div className="space-y-2">
      <div
        className="flex h-3 overflow-hidden rounded-full"
        role="img"
        aria-label="Ownership set aside: people who fund it, people who build it, and Fundwork."
      >
        <div className="h-full bg-primary" style={{ width: "55%" }} />
        <div className="h-full bg-work" style={{ width: "35%" }} />
        <div className="h-full bg-platform" style={{ width: "10%" }} />
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        People who fund it, people who build it, and Fundwork.
      </p>
    </div>
  );
}

export function OwnershipSplit() {
  return (
    <>
      <p>
        Fundwork keeps a small part. The rest is for people who put in capital and people who do the work.
      </p>
      <div
        className="flex h-4 overflow-hidden rounded-full"
        role="img"
        aria-label="Ownership set aside: people who fund it have the largest part, people who build it have a large part, and Fundwork keeps a small part."
      >
        <div className="h-full bg-primary" style={{ width: "55%" }} />
        <div className="h-full bg-work" style={{ width: "35%" }} />
        <div className="h-full bg-platform" style={{ width: "10%" }} />
      </div>
      <ul className="space-y-2">
        <li className="flex items-center gap-3">
          <span className="size-4 rounded-sm bg-primary" aria-hidden />
          People who fund it
        </li>
        <li className="flex items-center gap-3">
          <span className="size-4 rounded-sm bg-work" aria-hidden />
          People who build it
        </li>
        <li className="flex items-center gap-3">
          <span className="size-4 rounded-sm bg-platform" aria-hidden />
          Fundwork
        </li>
      </ul>
    </>
  );
}
