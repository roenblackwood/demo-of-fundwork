"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { PageBusy } from "@/components/busy";
import { ActionBar, NextSteps, SavedMark, StepHeader } from "@/components/parts";
import { Button, buttonVariants } from "@/components/ui/button";
import { useVideos, VideoProof } from "@/components/video-proof";
import { VideoRecorder } from "@/components/video-recorder";
import { WORK_PRESETS, workPresetLabel } from "@/lib/catalog";
import { cn } from "cn";
import { savedLabel } from "@/lib/copy";
import { useDemo } from "@/lib/demo-store";
import { workerUnits } from "@/lib/ownership";
import { attachVideo, currentPhaseName } from "@/lib/videos";
import type { Skill, WorkPreset } from "@/lib/types";

export function LogScreen({ id }: { id: string }) {
  const router = useRouter();
  const demo = useDemo();
  const project = demo.projects.find((item) => item.id === id);
  const [preset, setPreset] = useState<WorkPreset | null>(null);
  const [adding, setAdding] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);
  const skill: Skill =
    demo.flow?.skill ||
    demo.homeSkill ||
    project?.needs[0] ||
    "building";

  useEffect(() => {
    if (!demo.ready || !project) return;
    if (!project.team.includes(demo.userId)) router.replace(`/projects/${project.id}`);
  }, [demo.ready, demo.userId, project, router]);

  if (!demo.ready) return <PageBusy />;
  if (!project) {
    return (
      <div className="space-y-4">
        <StepHeader backHref="/work" />
        <p className="text-lg">This project is not on this phone.</p>
      </div>
    );
  }
  if (!project.team.includes(demo.userId)) return <PageBusy />;

  async function save() {
    if (!project || !preset || demo.saving) return;
    const id = crypto.randomUUID();
    const ok = await demo.addContribution({
      id,
      userId: demo.userId,
      projectId: project.id,
      skill,
      preset,
      status: "logged",
      createdAt: new Date().toISOString(),
    });
    if (!ok) return;
    if (videoId) await attachVideo(videoId, id);
    router.push(`/projects/${project.id}/logged`);
  }

  return (
    <div className="space-y-6">
      <StepHeader
        backHref={`/projects/${project.id}`}
        title="What did you do?"
        hint={project.name}
      />
      <p className="text-lg leading-relaxed">You are paid in a stable unit.</p>
      <div className="space-y-3">
        {WORK_PRESETS.map((item) => {
          const selected = preset === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setPreset(item.id)}
              className={cn(
                "flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border-2 px-4 text-left text-lg font-semibold",
                selected
                  ? "border-work bg-work/10 text-foreground"
                  : "border-border bg-card",
              )}
            >
              <span>{item.label}</span>
              {selected ? <Check className="size-6 shrink-0 text-work" aria-hidden /> : null}
            </button>
          );
        })}
      </div>
      {preset ? (
        <p className="text-lg leading-relaxed">
          {workPresetLabel(preset)} becomes about {workerUnits(preset)} ownership units, once the organizer accepts it.
        </p>
      ) : null}
      {videoId ? (
        <VideoProof id={videoId} />
      ) : adding ? (
        <VideoRecorder project={project} phase={currentPhaseName(project)} onSaved={setVideoId} />
      ) : (
        <Button type="button" size="lg" variant="outline" className="w-full" onClick={() => setAdding(true)}>
          Add a video
        </Button>
      )}
      <ActionBar>
        <Button
          size="lg"
          variant="work"
          className="w-full"
          disabled={!preset || demo.saving}
          aria-busy={demo.saving}
          onClick={() => void save()}
        >
          {preset ? "Log this work" : "Choose the work"}
        </Button>
      </ActionBar>
    </div>
  );
}

export function LoggedScreen({ id }: { id: string }) {
  const demo = useDemo();
  const project = demo.projects.find((item) => item.id === id);
  const videos = useVideos();
  const contribution = demo.contributions.find((item) => item.projectId === id && item.userId === demo.userId);
  const video = contribution ? videos.find((item) => item.contributionId === contribution.id) : undefined;

  if (!demo.ready) return <PageBusy />;
  if (!project || !contribution) {
    return (
      <div>
        <StepHeader backHref={`/projects/${id}`} title="No work saved" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StepHeader backHref="/you" title="You logged work" hint={project.name} />
      {video ? <VideoProof id={video.id} /> : null}
      <SavedMark label={savedLabel()} />
      <p className="text-3xl font-semibold">{workPresetLabel(contribution.preset)}</p>
      <p className="text-lg leading-relaxed">
        About {workerUnits(contribution.preset)} ownership units, waiting on the organizer.
      </p>
      <NextSteps
        items={[
          "Your work is saved on this phone.",
          "The organizer reviews it.",
          "If they accept it, it turns into ownership units.",
        ]}
      />
      <ActionBar>
        <Link href="/you/ownership" className={cn(buttonVariants({ variant: "work", size: "lg" }), "w-full")}>
          See your ownership units
        </Link>
      </ActionBar>
    </div>
  );
}
