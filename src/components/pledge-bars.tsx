import { initials } from "@/lib/format";
import { aboutUsd } from "@/lib/rates";
import { capitalSentence, teamSentence, type BackerMark } from "@/lib/pledges";
import { cn } from "cn";

function Meter({ value, max, tone }: { value: number; max: number; tone: "primary" | "work" }) {
  const ratio = max <= 0 ? 0 : Math.min(1, Math.max(0, value / max));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
      <div
        className={cn("h-full", tone === "work" ? "bg-work" : "bg-primary")}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  );
}

export function CapitalBar({
  pledged,
  budget,
  investors,
  currency,
  compact = false,
}: {
  pledged: number;
  budget: number;
  investors: number;
  currency: string;
  compact?: boolean;
}) {
  const about = aboutUsd(pledged, currency);
  const line = capitalSentence(pledged, budget, investors, currency);
  return (
    <div className="space-y-1">
      <div className={compact ? "h-1 overflow-hidden rounded-full bg-muted" : undefined} aria-hidden={compact}>
        {compact ? (
          <div
            className="h-full bg-primary"
            style={{ width: `${budget <= 0 ? 0 : Math.min(100, (pledged / budget) * 100)}%` }}
          />
        ) : (
          <Meter value={pledged} max={budget} tone="primary" />
        )}
      </div>
      <p className={compact ? "text-[11px] leading-4" : "text-base"}>
        {line}
        {about ? `, ${about}` : ""}
      </p>
    </div>
  );
}

export function TeamBar({ accepted, needed }: { accepted: number; needed: number }) {
  return (
    <div className="space-y-1">
      <Meter value={accepted} max={needed} tone="work" />
      <p className="text-base">{teamSentence(accepted, needed)}</p>
    </div>
  );
}

export function BackersRow({ people }: { people: BackerMark[] }) {
  if (people.length === 0) return null;
  const shown = people.slice(0, 5);
  const extra = people.length - shown.length;
  return (
    <div className="flex items-center gap-1" aria-label="Backers">
      {shown.map((person, index) =>
        person.named ? (
          <span
            key={`${person.label}-${index}`}
            className="grid size-8 place-items-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground"
            aria-label={person.label}
            title={person.label}
          >
            {initials(person.label)}
          </span>
        ) : (
          <span
            key={`quiet-${index}`}
            className="size-8 rounded-full bg-muted"
            aria-label="An investor"
            title="An investor"
          />
        ),
      )}
      {extra > 0 ? <span className="pl-1 text-sm font-semibold">+{extra}</span> : null}
    </div>
  );
}
