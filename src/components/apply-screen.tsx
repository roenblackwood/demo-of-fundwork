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
import { UseDraftButton } from "@/components/guide-card";
import { skillTitle } from "@/lib/catalog";
import { START_CHOICES, toolsForSkills, type StartWhen } from "@/lib/profile";
import { useProfileGate } from "@/components/profile-gate";
import { cn } from "cn";
import { useDemo } from "@/lib/demo-store";
import { firstName, placeLine } from "@/lib/format";
import { getCountry, requestPlace } from "@/lib/seed";
import type { Skill } from "@/lib/types";

const choiceClass =
  "flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-left text-lg font-semibold shadow-sm";

export function ApplyScreen({ id }: { id: string }) {
  const router = useRouter();
  const show = useSnackbar();
  const demo = useDemo();
  const allowed = useProfileGate();
  const request = demo.requests.find((item) => item.id === id);
  const [tools, setTools] = useState<string[]>([]);
  const [days, setDays] = useState<number | null>(null);
  const [startWhen, setStartWhen] = useState<StartWhen | null>(null);
  const [skill, setSkill] = useState<Skill | null>(null);
  const [message, setMessage] = useState("");

  if (!demo.ready || !allowed) return <PageBusy />;
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
  const fromProfile = demo.profile.skillLevels.map((item) => item.skill);
  const mine = [...new Set([primary, ...extras, ...fromProfile].filter((item): item is Skill => Boolean(item)))];
  const askSetup =
    demo.profile.tools.length === 0 && demo.profile.daysPerWeek === null && demo.profile.startWhen === null;
  const fits = mine.filter((item) => request.skills.includes(item));
  const already = demo.applications.find(
    (item) => item.requestId === request.id && item.workerId === demo.userId && item.status !== "declined",
  );

  async function send() {
    if (!skill || !request || demo.saving) return;
    if (!(await demo.applyToRequest({ requestId: id, skill, message }))) return;
    const owner = demo.displayNameFor(request.userId);
    show(owner ? `Sent to ${firstName(owner)}.` : "Sent to the investor.");
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
      ) : askSetup ? (
        <SetupQuestion
          skills={mine}
          tools={tools}
          days={days}
          startWhen={startWhen}
          onTools={setTools}
          onDays={setDays}
          onStart={setStartWhen}
          onSave={() => {
            void demo.savePersonProfile({
              ...demo.profile,
              tools,
              daysPerWeek: days,
              startWhen: startWhen ?? "later",
            });
          }}
          onSkip={() => {
            void demo.savePersonProfile({ ...demo.profile, startWhen: "later" });
          }}
        />
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
          <UseDraftButton
            request={request}
            placeName={where?.town ?? "this place"}
            countryName={getCountry(request.countryId)?.name ?? "this country"}
            onUse={setMessage}
          />
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
            <Button variant="work" size="lg" className="w-full" disabled={!skill || demo.saving} aria-busy={demo.saving} onClick={() => void send()}>
              Send
            </Button>
          </ActionBar>
        </>
      )}
    </div>
  );
}

function SetupQuestion({
  skills,
  tools,
  days,
  startWhen,
  onTools,
  onDays,
  onStart,
  onSave,
  onSkip,
}: {
  skills: Skill[];
  tools: string[];
  days: number | null;
  startWhen: StartWhen | null;
  onTools: (next: string[]) => void;
  onDays: (next: number) => void;
  onStart: (next: StartWhen) => void;
  onSave: () => void;
  onSkip: () => void;
}) {
  const groups = toolsForSkills(skills);
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">What do you bring, and when can you start?</h2>
      {groups.map((group) => (
        <div key={group.skill} className="space-y-2">
          <p className="font-semibold">{skillTitle(group.skill)}</p>
          <div className="flex flex-wrap gap-2">
            {group.tools.map((tool) => {
              const on = tools.includes(tool);
              return (
                <button
                  key={tool}
                  type="button"
                  aria-pressed={on}
                  className={cn(choiceClass, "w-auto", on ? "border-work bg-secondary" : "border-border bg-card")}
                  onClick={() => onTools(on ? tools.filter((item) => item !== tool) : [...tools, tool])}
                >
                  {tool}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="space-y-2">
        <p className="font-semibold">Days a week</p>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((day) => (
            <button
              key={day}
              type="button"
              aria-pressed={days === day}
              className={cn(choiceClass, "w-14 justify-center", days === day ? "border-work bg-secondary" : "border-border bg-card")}
              onClick={() => onDays(day)}
            >
              {day}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {START_CHOICES.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={startWhen === item.id}
            className={cn(choiceClass, startWhen === item.id ? "border-work bg-secondary" : "border-border bg-card")}
            onClick={() => onStart(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <Button variant="work" size="lg" className="w-full" onClick={onSave}>
        Save
      </Button>
      <Button variant="outline" size="lg" className="w-full" onClick={onSkip}>
        Skip
      </Button>
    </div>
  );
}
