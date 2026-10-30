"use client";

import Link from "next/link";
import { PageBusy } from "@/components/busy";
import { LessonCard } from "@/components/lesson-card";
import { sectionTitle } from "@/components/parts";
import { useDemo } from "@/lib/demo-store";
import { money } from "@/lib/format";
import { lessonById } from "@/lib/lessons";
import { buildPortfolio, formatUsd, type BarRow, type LocalAmount, type PortfolioView } from "@/lib/portfolio";

function viewFor(demo: ReturnType<typeof useDemo>): PortfolioView {
  return buildPortfolio({
    userId: demo.userId,
    commitments: demo.commitments,
    projects: demo.projects,
    payments: demo.payments,
    weeks: demo.weeks,
    applications: demo.applications,
    nameFor: demo.displayNameFor,
    now: Date.now(),
  });
}

function LocalLines({ rows }: { rows: LocalAmount[] }) {
  if (rows.length === 0) return null;
  return (
    <div>
      {rows.map((row) => (
        <p key={row.currency} className="text-base text-muted-foreground">
          {money(row.amount, row.currency)}
        </p>
      ))}
    </div>
  );
}

function SplitBars({ title, note, rows }: { title: string; note: string; rows: BarRow[] }) {
  const total = rows.reduce((sum, row) => sum + row.usd, 0);
  return (
    <section className="space-y-3">
      <h2 className={sectionTitle}>{title}</h2>
      <p className="text-base text-muted-foreground">{note}</p>
      {rows.length === 0 ? <p className="text-lg">No split yet.</p> : null}
      {rows.map((row) => {
        const share = total > 0 ? (row.usd / total) * 100 : 0;
        return (
          <div key={row.label} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-base font-semibold">{row.label}</p>
              <p className="text-base">{formatUsd(row.usd)}</p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="h-2 rounded-full bg-primary" style={{ width: `${share}%` }} />
            </div>
          </div>
        );
      })}
    </section>
  );
}

export function PortfolioScreen() {
  const demo = useDemo();
  if (!demo.ready) return <PageBusy />;
  if (demo.role !== "investor") {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-4xl leading-tight">Your portfolio</h1>
        <p className="text-lg">This page is for investors.</p>
        <Link href="/you" className="inline-flex min-h-11 items-center font-semibold text-primary">
          Back to You
        </Link>
      </div>
    );
  }

  const view = viewFor(demo);
  const spread = view.concentrated ? lessonById("investor-spread") : undefined;
  const barNote =
    view.barsFrom === "confirmed"
      ? "Confirmed money."
      : "Pledged money. Nothing is confirmed on the chain yet.";

  return (
    <div className="space-y-8">
      <h1 className="font-display text-4xl leading-tight">Your portfolio</h1>

      <section className="space-y-4">
        <div>
          <p className="text-base text-muted-foreground">Pledged</p>
          <p className="text-2xl font-semibold">{formatUsd(view.pledged.usd)}</p>
          <LocalLines rows={view.pledged.local} />
        </div>
        <div>
          <p className="text-base text-muted-foreground">Confirmed on the chain</p>
          <p className="text-2xl font-semibold">{formatUsd(view.confirmed.usd)}</p>
          <LocalLines rows={view.confirmed.local} />
          {view.btcConfirmed > 0 ? (
            <p className="text-base text-muted-foreground">
              {view.btcConfirmed} BTC is confirmed. Fundwork does not price Bitcoin.
            </p>
          ) : null}
        </div>
        <div>
          <p className="text-base text-muted-foreground">Units from confirmed money</p>
          <p className="text-2xl font-semibold">{view.units}</p>
          <p className="text-base">How units pay out is not set yet.</p>
        </div>
      </section>

      <SplitBars title="By country" note={barNote} rows={view.countries} />
      <SplitBars title="By sector" note={barNote} rows={view.sectors} />
      {spread ? <LessonCard lesson={spread} /> : null}

      <section className="space-y-4">
        <h2 className={sectionTitle}>Projects you back</h2>
        {view.rows.length === 0 ? <p className="text-lg">You have not backed a project yet.</p> : null}
        {view.rows.map((row) => (
          <article key={row.projectId} className="space-y-2 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
            <h3 className="text-lg font-semibold">
              <Link href={`/projects/${row.projectId}`} className="text-primary">
                {row.name}
              </Link>
            </h3>
            <p className="text-base text-muted-foreground">{row.place}</p>
            <p className="text-base">
              {row.phase}. This tranche is {row.tranche}.
            </p>
            <div>
              <p className="text-base font-semibold">Confirmed {formatUsd(row.confirmedUsd)}</p>
              <p className="text-base text-muted-foreground">{money(row.confirmedLocal, row.currency)}</p>
              {row.btcConfirmed > 0 ? (
                <p className="text-base text-muted-foreground">{row.btcConfirmed} BTC confirmed. Not priced here.</p>
              ) : null}
            </div>
            <div>
              <p className="text-base font-semibold">Pledged {formatUsd(row.pledgedUsd)}</p>
              <p className="text-base text-muted-foreground">{money(row.pledgedLocal, row.currency)}</p>
            </div>
            <div>
              <p className="text-base font-semibold">Wages paid out {formatUsd(row.wagesUsd)}</p>
              <p className="text-base text-muted-foreground">{money(row.wagesLocal, row.currency)}</p>
              {row.btcWages > 0 ? (
                <p className="text-base text-muted-foreground">{row.btcWages} BTC in wages. Not priced here.</p>
              ) : null}
            </div>
            <p className="text-base">{row.readiness}</p>
            <p className="text-base">{row.week}</p>
            {row.warnings.map((warning) => (
              <p key={warning} className="rounded-xl bg-wait px-3 py-2 text-base text-wait-foreground">
                {warning}
              </p>
            ))}
          </article>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className={sectionTitle}>Activity</h2>
        {view.activity.length === 0 ? <p className="text-lg">Nothing new yet.</p> : null}
        <ul className="space-y-3">
          {view.activity.map((item) => (
            <li key={item.id}>
              <p className="text-sm text-muted-foreground">{item.at}</p>
              <p className="text-base">{item.text}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
