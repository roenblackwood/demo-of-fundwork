"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageBusy } from "@/components/busy";
import { StepHeader } from "@/components/parts";
import { useVideos, VideoProof } from "@/components/video-proof";
import { Button } from "@/components/ui/button";
import { workPresetLabel } from "@/lib/catalog";
import { useDemo } from "@/lib/demo-store";
import { useSnackbar } from "@/components/snackbar";


export function AcceptScreen({ id }: { id: string }) {
  const demo = useDemo();
  const router = useRouter();
  const show = useSnackbar();
  const project = demo.projects.find((item) => item.id === id);
  const organizing = project?.organizerId === demo.userId;
  const videos = useVideos();

  useEffect(() => {
    if (!demo.ready || !project) return;
    if (!organizing) router.replace(`/projects/${project.id}`);
  }, [demo.ready, organizing, project, router]);

  if (!demo.ready) return <PageBusy />;
  if (!project) {
    return (
      <div className="space-y-4">
        <StepHeader backHref="/you" />
        <p className="text-lg">This project is not on this phone.</p>
      </div>
    );
  }
  if (!organizing) return <PageBusy />;

  const waiting = demo.reviewContributions.filter((item) => item.projectId === project.id && item.status === "logged");

  return (
    <div className="space-y-6">
      <StepHeader backHref={`/projects/${project.id}`} title="Logged work" hint={project.name} />
      {waiting.length === 0 ? <p className="text-lg">No logged work is waiting.</p> : null}
      {waiting.map((item) => {
        const video = videos
          .filter((row) => row.contributionId === item.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
        return (
          <section key={item.id} className="space-y-3">
            {video ? <VideoProof id={video.id} allowHide /> : <p className="text-lg">No video on this work.</p>}
            <p className="text-lg font-semibold">{workPresetLabel(item.preset)}</p>
            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={demo.saving}
              onClick={() => {
                void demo.acceptContribution(item.id).then((ok) => {
                  if (ok) show("Accepted.");
                });
              }}
            >
              Accept
            </Button>
          </section>
        );
      })}
    </div>
  );
}
