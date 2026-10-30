"use client";

import { useState } from "react";
import { chipLabel, countryRule, rulesSummary, statusLabel, type CountryRule } from "@/lib/country-rules";

const chipClass =
  "inline-flex min-h-11 shrink-0 items-center self-center rounded-full border-2 border-border bg-card px-3 text-sm font-semibold whitespace-nowrap focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring";

function sourceList(rule: CountryRule) {
  if (rule.sources.length === 0) return null;
  return (
    <ul className="space-y-1">
      {rule.sources.map((source) => (
        <li key={source.url}>
          <a
            href={source.url}
            className="font-semibold text-primary underline"
            target="_blank"
            rel="noreferrer"
          >
            {source.title}
          </a>
        </li>
      ))}
    </ul>
  );
}

function noteLine(rule: CountryRule): string {
  return rule.cryptoNote || "No source on file yet.";
}

export function CountryRuleRow({
  countryId,
  children,
}: {
  countryId: string;
  children: React.ReactNode;
}) {
  const rule = countryRule(countryId);
  const label = rule ? chipLabel(rule.status) : null;
  const [open, setOpen] = useState(false);
  if (!rule || !label) return children;
  return (
    <div className="space-y-2">
      <div className="flex items-stretch gap-2">
        <div className="min-w-0 flex-1">{children}</div>
        <button
          type="button"
          className={chipClass}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {label}
        </button>
      </div>
      {open ? (
        <div className="space-y-2 rounded-2xl border-2 border-border bg-card px-4 py-3">
          <p className="text-base">{noteLine(rule)}</p>
          {rule.investNote ? <p className="text-base">{rule.investNote}</p> : null}
          {sourceList(rule)}
        </div>
      ) : null}
    </div>
  );
}

export function RulesChip({ countryId }: { countryId: string }) {
  const rule = countryRule(countryId);
  const label = rule ? chipLabel(rule.status) : null;
  if (!label) return null;
  return (
    <a href="#rules-here" className={chipClass}>
      {label}
    </a>
  );
}

export function RulesHere({ countryId }: { countryId: string }) {
  const rule = countryRule(countryId);
  if (!rule || rule.status === "blocked") return null;
  return (
    <details id="rules-here" className="rounded-2xl border-2 border-border bg-card">
      <summary className="flex min-h-14 cursor-pointer list-none items-center px-4 py-3 text-base font-semibold [&::-webkit-details-marker]:hidden">
        {rulesSummary(rule)}
      </summary>
      <div className="space-y-2 px-4 pb-4">
        <p className="text-base">{statusLabel(rule.status)}</p>
        <p className="text-base">{noteLine(rule)}</p>
        {rule.investNote ? <p className="text-base">{rule.investNote}</p> : null}
        {sourceList(rule)}
        <p className="text-sm text-muted-foreground">Checked {rule.checkedOn}</p>
        <p className="text-sm text-muted-foreground">Fundwork does not give legal advice.</p>
      </div>
    </details>
  );
}
