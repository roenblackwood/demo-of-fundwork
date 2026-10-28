"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { PageBusy } from "@/components/busy";
import { ActionBar, StepHeader } from "@/components/parts";
import { useSnackbar } from "@/components/snackbar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { skillTitle } from "@/lib/catalog";
import { cn } from "cn";
import { useDemo } from "@/lib/demo-store";
import { firstName, placeLine } from "@/lib/format";
import { getUser, requestPlace } from "@/lib/seed";
import type { Skill } from "@/lib/types";

const choiceClass =
  "flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-left text-lg font-semibold shadow-sm";

export function ApplyScreen({ id }: { id: string }) {
  const router = useRouter();
  const show = useSnackbar();
  const demo = useDemo();
  const request = demo.requests.find((item) => item.id === id);
  const [skill, setSkill] = useState<Skill | null>(null);
  const [message, setMessage] = useState("");

  if (!demo.ready) return <PageBusy />;
  if (!request) {
    return (
      <div className="space-y-4">
        <StepHeader backHref="/work" />
        <p className="text-lg">This request is not on this phone.</p>
      </div>
    );
  }

  const where = requestPlace(request);
  const place = where ? placeLine(where.town, where.parish) : "This place";
  const primary = demo.flow?.skill || demo.homeSkill;
  const extras = demo.flow?.skill ? demo.flow.extraSkills : demo.homeExtraSkills;
  const mine = [...new Set([primary, ...extras].filter((item): item is Skill => Boolean(item)))];
  const fits = mine.filter((item) => request.skills.includes(item));
  const already = demo.applications.find(
    (item) => item.requestId === request.id && item.workerId === demo.userId && item.status !== "declined",
  );

  function send() {
    if (!skill || !request) return;
    if (!demo.applyToRequest({ requestId: id, skill, message })) return;
    const owner = getUser(request.userId)?.name ?? "the investor";
    show(`Sent to ${firstName(owner)}.`);
    router.push(`/requests/${id}`);
  }

  return (
    <div className="space-y-6">
      <StepHeader backHref={`/requests/${id}`} title="Apply" hint={place} />
      {demo.role !== "worker" ? (
        <div className="space-y-4">
          <p className="text-lg leading-relaxed">Switch to a worker to apply.</p>
          <Link href="/you/switch" className="inline-flex min-h-11 items-center font-semibold text-primary">
            See an example person
          </Link>
        </div>
      ) : request.status !== "open" ? (
        <p className="text-lg">This request is not open.</p>
      ) : already ? (
        <p className="text-lg">You already have an application on this request.</p>
      ) : fits.length === 0 ? (
        <p className="text-lg leading-relaxed">None of your skills fit this request.</p>
      ) : (
        <>
          <div className="space-y-3">
            {fits.map((item) => {
              const on = skill === item;
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSkill(item)}
                  className={cn(choiceClass, on ? "border-work bg-secondary" : "border-border bg-card")}
                >
                  <span>{skillTitle(item)}</span>
                  {on ? <Check className="size-6 shrink-0 text-work" aria-hidden /> : null}
                </button>
              );
            })}
          </div>
          <div className="space-y-2">
            <Label htmlFor="apply-message">A message, if you want</Label>
            <textarea
              id="apply-message"
              value={message}
              maxLength={200}
              onChange={(event) => setMessage(event.target.value)}
              className="min-h-28 w-full rounded-xl border border-input bg-card px-3 py-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <p className="text-base text-muted-foreground">{message.length} of 200</p>
          </div>
          <ActionBar>
            <Button variant="work" size="lg" className="w-full" disabled={!skill} onClick={send}>
              Send
            </Button>
          </ActionBar>
        </>
      )}
    </div>
  );
}
