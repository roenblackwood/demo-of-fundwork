"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PageBusy } from "@/components/busy";
import { LessonList } from "@/components/lesson-card";
import { StepHeader } from "@/components/parts";
import { Button } from "@/components/ui/button";
import { useDemo } from "@/lib/demo-store";
import { INVESTOR_CHECKS, lessonById, lessonsForMoment } from "@/lib/lessons";
import { cn } from "cn";

function commitReturn(value: string | null): string | null {
  if (value && (/^\/projects\/[^/]+\/commit$/.test(value) || /^\/requests\/[^/]+\/join$/.test(value))) return value;
  return null;
}

export function InvestorBasics() {
  const demo = useDemo();
  const router = useRouter();
  const params = useSearchParams();
  const back = commitReturn(params.get("next"));
  const lessons = lessonsForMoment("investor", "investor-basics");
  const [picks, setPicks] = useState<Record<string, boolean | undefined>>({});

  if (!demo.ready) return <PageBusy />;

  const checks = INVESTOR_CHECKS.map((check) => {
    const lesson = lessonById(check.lessonId);
    const pick = picks[check.lessonId];
    return { ...check, lesson, pick, right: pick === check.answer };
  });
  const passed = checks.every((check) => check.right);

  function choose(id: string, value: boolean) {
    setPicks((current) => ({ ...current, [id]: value }));
  }

  function finish() {
    if (!passed) return;
    demo.passInvestorBasics();
    router.push(back ?? "/invest");
  }

  return (
    <div className="space-y-6">
      <StepHeader backHref={back ?? "/invest"} title="Before you commit" />
      <p className="text-lg leading-relaxed">
        Read these five cards. Then answer three questions. You can try again.
      </p>
      <LessonList lessons={lessons} />
      {demo.investorBasicsDone ? (
        <div className="space-y-3">
          <p className="text-lg">You already passed this check.</p>
          <Link href={back ?? "/invest"} className="inline-flex min-h-11 items-center font-semibold text-primary">
            {back ? "Back to the commitment" : "See projects"}
          </Link>
        </div>
      ) : (
        <section className="space-y-4" aria-label="Check">
          <h2 className="text-xl font-semibold">Check</h2>
          {checks.map((check) => (
            <fieldset key={check.lessonId} className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
              <legend className="text-lg font-semibold leading-snug">{check.statement}</legend>
              <div className="flex gap-2">
                {[true, false].map((value) => (
                  <button
                    key={String(value)}
                    type="button"
                    aria-pressed={check.pick === value}
                    onClick={() => choose(check.lessonId, value)}
                    className={cn(
                      "inline-flex min-h-11 flex-1 items-center justify-center rounded-full border-2 px-3 text-base font-semibold",
                      check.pick === value ? "border-primary bg-secondary" : "border-border bg-background",
                    )}
                  >
                    {value ? "True" : "False"}
                  </button>
                ))}
              </div>
              {check.pick !== undefined && check.lesson ? (
                <p className="text-base leading-relaxed">
                  {check.right ? "Yes. " : "Not quite. "}
                  {check.lesson.body}
                </p>
              ) : null}
            </fieldset>
          ))}
          <Button type="button" size="lg" className="w-full" disabled={!passed} onClick={finish}>
            {back ? "Back to the commitment" : "Done"}
          </Button>
        </section>
      )}
    </div>
  );
}
