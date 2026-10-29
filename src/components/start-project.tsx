"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageBusy } from "@/components/busy";
import { ActionBar, StepHeader } from "@/components/parts";
import { useSnackbar } from "@/components/snackbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sectorTitle } from "@/lib/catalog";
import { useDemo } from "@/lib/demo-store";
import { placeLine } from "@/lib/format";
import { requestPlace } from "@/lib/seed";

export function StartProjectScreen({ id }: { id: string }) {
  const router = useRouter();
  const show = useSnackbar();
  const demo = useDemo();
  const request = demo.requests.find((item) => item.id === id);
  const where = request ? requestPlace(request) : undefined;
  const town = where?.town ?? "this place";
  const suggested = request ? `${sectorTitle(request.sector)} in ${town}` : "";
  const [name, setName] = useState<string | null>(null);
  const value = name ?? suggested;

  if (!demo.ready) return <PageBusy />;
  if (!request) {
    return (
      <div className="space-y-4">
        <StepHeader backHref="/invest" />
        <p className="text-lg">This request is not on this phone.</p>
      </div>
    );
  }

  const place = where ? placeLine(where.town, where.parish) : "This place";
  const isOwner = demo.userId === request.userId;

  if (request.projectId) {
    return (
      <div className="space-y-4">
        <StepHeader backHref={`/requests/${request.id}`} title={place} />
        <p className="text-lg">This is now a project.</p>
        <Link href={`/projects/${request.projectId}`} className="inline-flex min-h-11 items-center font-semibold text-primary">
          See the project
        </Link>
      </div>
    );
  }

  if (!isOwner || request.status !== "team-ready") {
    return (
      <div className="space-y-4">
        <StepHeader backHref={`/requests/${request.id}`} title={place} />
        <p className="text-lg">The team is not ready yet.</p>
      </div>
    );
  }

  async function start() {
    const trimmed = value.trim();
    if (!trimmed || !request || demo.saving) return;
    const projectId = await demo.startProject(request.id, trimmed);
    if (!projectId) return;
    show(`${trimmed} is now a project.`);
    router.push(`/projects/${projectId}`);
  }

  return (
    <div className="space-y-6">
      <StepHeader backHref={`/requests/${request.id}`} title="Name the project" hint={place} />
      <div className="space-y-2">
        <Label htmlFor="project-name">Project name</Label>
        <Input
          id="project-name"
          value={value}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <ActionBar>
        <Button size="lg" className="w-full" disabled={!value.trim() || demo.saving} aria-busy={demo.saving} onClick={() => void start()}>
          Start the project
        </Button>
      </ActionBar>
    </div>
  );
}
