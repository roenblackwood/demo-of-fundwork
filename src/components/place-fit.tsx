"use client";

import { useState } from "react";
import { LearnMore, sectionTitle } from "@/components/parts";
import { sectorTitle } from "@/lib/catalog";
import {
  NOT_ADVICE,
  NOT_WRITTEN,
  fitForPlace,
  placeFit,
  placeLabel,
  riskSources,
  sourcesOf,
  topSectorTitles,
  type FitSource,
} from "@/lib/region-fit";

export function FitFooter({ sources }: { sources: FitSource[] }) {
  return (
    <div className="space-y-3">
      <LearnMore title="Sources">
        {sources.length === 0 ? (
          <p>No sources on this page.</p>
        ) : (
          <ul className="space-y-2">
            {sources.map((source) => (
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
        )}
      </LearnMore>
      <p className="text-base text-muted-foreground">{NOT_ADVICE}</p>
    </div>
  );
}

export function FitPanel({ placeId }: { placeId: string }) {
  const fit = placeFit(placeId);
  const name = placeLabel(placeId);
  if (!fit) {
    return (
      <div className="space-y-4">
        <h2 className={sectionTitle}>What works here</h2>
        <p className="text-lg font-semibold">{name}</p>
        <p className="text-lg">{NOT_WRITTEN}</p>
        <FitFooter sources={[]} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <h2 className={sectionTitle}>What works here</h2>
      <p className="text-lg font-semibold">{name}</p>
      {fit.sectors.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold">Suited sectors</h3>
          {fit.sectors.map((item) => (
            <div key={item.sector}>
              <p className="font-semibold">{sectorTitle(item.sector)}</p>
              <p className="text-base">{item.why}</p>
            </div>
          ))}
        </section>
      ) : null}
      {fit.seasons.map((item) => (
        <p key={item.line} className="text-base">
          {item.line}
        </p>
      ))}
      {fit.risks.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-lg font-semibold">Risks</h3>
          <ul className="space-y-2">
            {fit.risks.map((item) => (
              <li key={item.line} className="text-base">
                {item.line}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {fit.advice.map((card) => (
        <article key={card.title} className="space-y-2 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
          <h3 className="text-lg font-semibold leading-snug">{card.title}</h3>
          <p className="text-base leading-relaxed">{card.body}</p>
          <p className="text-base font-semibold leading-snug">{card.rule}</p>
          <p className="text-base leading-snug">{card.action}</p>
        </article>
      ))}
      <FitFooter sources={sourcesOf(fit)} />
    </div>
  );
}

export function WhatWorksButton({ placeId }: { placeId: string }) {
  const [open, setOpen] = useState(false);
  const name = placeLabel(placeId);
  return (
    <>
      <button
        type="button"
        className="inline-flex min-h-11 items-center font-semibold text-primary"
        aria-label={`What works here, ${name}`}
        onClick={() => setOpen(true)}
      >
        What works here
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 min-[840px]:items-center"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`What works here, ${name}`}
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-background p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex justify-end">
              <button type="button" className="min-h-11 font-semibold text-primary" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            <FitPanel placeId={placeId} />
          </div>
        </div>
      ) : null}
    </>
  );
}

export function SectorHint({ placeId }: { placeId: string }) {
  const titles = topSectorTitles(placeId, 2);
  if (titles.length === 0) return null;
  return <span className="mt-1 block text-sm font-normal text-muted-foreground">{titles.join(", ")}</span>;
}

export function ThisPlace({
  countryId,
  parishId,
  collapsed = false,
}: {
  countryId: string;
  parishId: string | null;
  collapsed?: boolean;
}) {
  const fit = fitForPlace(parishId, countryId);
  const risks = fit?.risks ?? [];
  const body = (
    <>
      {risks.length === 0 ? <p className="text-lg">{NOT_WRITTEN}</p> : null}
      {risks.map((item) => (
        <p key={item.line} className="text-lg">
          {item.line}
        </p>
      ))}
      <FitFooter sources={riskSources(parishId, countryId)} />
    </>
  );
  if (collapsed) {
    return (
      <details className="rounded-2xl border-2 border-border bg-card">
        <summary className="flex min-h-14 cursor-pointer list-none items-center px-4 py-3 text-base font-semibold [&::-webkit-details-marker]:hidden">
          This place
        </summary>
        <div className="space-y-3 px-4 pb-4">{body}</div>
      </details>
    );
  }
  return (
    <section className="space-y-3">
      <h2 className={sectionTitle}>This place</h2>
      {body}
    </section>
  );
}
