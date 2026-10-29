"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  inviteWorker as inviteWorkerAction,
  postApplication,
  postAvailability,
  postCommitment,
  postContribution,
  postRequest,
  saveDisplayName,
  setApplicationStatus as setApplicationStatusAction,
  startProject as startProjectAction,
  withdrawApplication as withdrawApplicationAction,
} from "@/app/actions/live";
import { isSkill } from "@/lib/catalog";
import { DemoContext, type AvailabilityDraft, type DemoValue, type Flow, type Proof, type RequestDraft } from "@/lib/demo-store";
import {
  mapApplication,
  mapAvailability,
  mapCommitment,
  mapContribution,
  mapProject,
  mapPublicPerson,
  mapRequest,
  newest,
} from "@/lib/live-rows";
import { notifySaveError } from "@/components/snackbar";
import { askedPlace, rememberLivePeople } from "@/lib/seed";
import { browserSupabase } from "@/lib/supabase/browser";
import type {
  Application,
  Availability,
  CapitalRequest,
  Commitment,
  Contribution,
  PathChoice,
  Project,
  Skill,
} from "@/lib/types";

type Snapshot = {
  userId: string;
  name: string;
  role: PathChoice | null;
  homeCountryId: string | null;
  homeParishId: string | null;
  homeTownId: string | null;
  homeSkill: Skill | null;
  homeExtraSkills: Skill[];
  commitments: Commitment[];
  contributions: Contribution[];
  addedCommitments: Commitment[];
  requests: CapitalRequest[];
  applications: Application[];
  availability: Availability[];
  projects: Project[];
};

let reloadLive: (() => Promise<void>) | null = null;

export function refreshLiveStore(): Promise<void> {
  return reloadLive?.() ?? Promise.resolve();
}

const emptySnapshot: Snapshot = {
  userId: "",
  name: "",
  role: null,
  homeCountryId: null,
  homeParishId: null,
  homeTownId: null,
  homeSkill: null,
  homeExtraSkills: [],
  commitments: [],
  contributions: [],
  addedCommitments: [],
  requests: [],
  applications: [],
  availability: [],
  projects: [],
};

function rowsOf(value: { data: unknown[] | null }): Record<string, unknown>[] {
  return (value.data ?? []).filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
}

async function loadSnapshot(): Promise<Snapshot> {
  const supabase = browserSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  const [projectRows, memberRows, requestRows, applicationRows, availabilityRows, peopleRows, commitmentRows, contributionRows, mine] =
    await Promise.all([
      supabase.from("projects").select("*"),
      supabase.from("project_members").select("project_id, worker_id"),
      supabase.from("capital_requests").select("*"),
      user ? supabase.from("applications").select("*") : Promise.resolve({ data: [] }),
      supabase.from("availability").select("*"),
      supabase.from("public_profiles").select("id, name, role, country_id, parish_id, town_id"),
      user ? supabase.from("commitments").select("*") : Promise.resolve({ data: [] }),
      user ? supabase.from("contributions").select("*") : Promise.resolve({ data: [] }),
      user
        ? supabase.from("profiles").select("name, role, country_id, parish_id, town_id, skill, extra_skills").eq("id", user.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const people = rowsOf(peopleRows).flatMap((row) => {
    const person = mapPublicPerson(row);
    return person ? [person] : [];
  });
  rememberLivePeople(people);

  const teamByProject = new Map<string, string[]>();
  for (const row of rowsOf(memberRows)) {
    const projectId = typeof row.project_id === "string" ? row.project_id : "";
    const workerId = typeof row.worker_id === "string" ? row.worker_id : "";
    if (!projectId || !workerId) continue;
    const team = teamByProject.get(projectId) ?? [];
    team.push(workerId);
    teamByProject.set(projectId, team);
  }

  const commitments = newest(rowsOf(commitmentRows).flatMap((row) => {
    const item = mapCommitment(row);
    return item ? [item] : [];
  }));

  const projects = rowsOf(projectRows).flatMap((row) => {
    const id = typeof row.id === "string" ? row.id : "";
    const project = mapProject(row, teamByProject.get(id) ?? [], 0);
    return project ? [project] : [];
  });

  const profile = mine.data;
  const role = profile?.role === "investor" || profile?.role === "worker" ? profile.role : null;
  const skill = typeof profile?.skill === "string" && isSkill(profile.skill) ? profile.skill : null;
  const extra = Array.isArray(profile?.extra_skills)
    ? profile.extra_skills.filter((item): item is Skill => typeof item === "string" && isSkill(item))
    : [];

  const ownCommitments = user ? commitments.filter((item) => item.userId === user.id) : [];
  const contributions = newest(rowsOf(contributionRows).flatMap((row) => {
    const item = mapContribution(row);
    return item ? [item] : [];
  })).filter((item) => !user || item.userId === user.id);

  return {
    userId: user?.id ?? "",
    name: typeof profile?.name === "string" ? profile.name : "",
    role,
    homeCountryId: typeof profile?.country_id === "string" ? profile.country_id : null,
    homeParishId: typeof profile?.parish_id === "string" ? profile.parish_id : null,
    homeTownId: typeof profile?.town_id === "string" ? profile.town_id : null,
    homeSkill: skill,
    homeExtraSkills: extra,
    commitments: ownCommitments,
    contributions,
    addedCommitments: commitments,
    requests: newest(rowsOf(requestRows).flatMap((row) => {
      const item = mapRequest(row);
      return item ? [item] : [];
    })),
    applications: newest(rowsOf(applicationRows).flatMap((row) => {
      const item = mapApplication(row);
      return item ? [item] : [];
    })),
    availability: newest(rowsOf(availabilityRows).flatMap((row) => {
      const item = mapAvailability(row);
      return item ? [item] : [];
    })),
    projects,
  };
}

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot>(emptySnapshot);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [path, setPath] = useState<PathChoice | null>(null);
  const [proof, setProofState] = useState<Proof | null>(null);
  const [openedProject, setOpenedProject] = useState(false);
  const snapshotRef = useRef(snapshot);
  const savingRef = useRef(false);
  const flowStarted = useRef(false);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const reload = useCallback(async () => {
    try {
      const next = await loadSnapshot();
      setSnapshot(next);
      if (!flowStarted.current && next.homeCountryId) {
        flowStarted.current = true;
        setFlow({
          countryId: next.homeCountryId,
          parishId: next.homeParishId ?? undefined,
          townId: next.homeTownId ?? undefined,
          skill: next.homeSkill ?? undefined,
          extraSkills: next.homeExtraSkills,
        });
        setPath(next.role);
      }
    } catch {
      setSnapshot(emptySnapshot);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    reloadLive = reload;
    let cancel = false;
    // Load after mount so the server HTML matches the first paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload().then(() => {
      if (cancel) return;
    });
    const onFocus = () => {
      if (!savingRef.current) void reload();
    };
    const supabase = browserSupabase();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && !savingRef.current) void reload();
    });
    window.addEventListener("focus", onFocus);
    return () => {
      cancel = true;
      if (reloadLive === reload) reloadLive = null;
      data.subscription.unsubscribe();
      window.removeEventListener("focus", onFocus);
    };
  }, [reload]);

  const commitFlag = useCallback(async (localOk: boolean, run: () => Promise<boolean>) => {
    if (!localOk || savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    try {
      const ok = await run();
      if (!ok) notifySaveError();
      else await reload();
      return ok;
    } catch {
      notifySaveError();
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [reload]);

  const commitId = useCallback(async (localOk: boolean, run: () => Promise<string | null>) => {
    if (!localOk || savingRef.current) return null;
    savingRef.current = true;
    setSaving(true);
    try {
      const id = await run();
      if (!id) notifySaveError();
      else await reload();
      return id;
    } catch {
      notifySaveError();
      return null;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [reload]);

  const value = useMemo<DemoValue>(() => {
    const current = snapshot;
    const role = current.role ?? path;

    return {
      ready,
      saving,
      userId: current.userId,
      name: current.name || "You",
      verified: false,
      role,
      path,
      flow,
      homeCountryId: current.homeCountryId,
      homeParishId: current.homeParishId,
      homeTownId: current.homeTownId,
      homeSkill: current.homeSkill,
      homeExtraSkills: current.homeExtraSkills,
      proof,
      proofLabel: null,
      commitments: current.commitments,
      contributions: current.contributions,
      addedCommitments: current.addedCommitments,
      requests: current.requests,
      applications: current.applications,
      availability: current.availability,
      projects: current.projects,
      addedRequests: current.requests.filter((item) => item.userId === current.userId),
      addedApplications: current.applications.filter((item) => item.workerId === current.userId),
      addedAvailability: current.availability.filter((item) => item.userId === current.userId),
      openedProject,
      startPath: (next) => setPath(next),
      updateFlow: (patch) => {
        setFlow((item) => ({
          ...item,
          ...patch,
          extraSkills: patch.extraSkills ?? item?.extraSkills ?? [],
        }));
      },
      setProof: setProofState,
      setDisplayName: async (name) => {
        const trimmed = name.trim();
        if (!trimmed || !snapshotRef.current.userId) return;
        const ok = await saveDisplayName(trimmed);
        if (!ok) notifySaveError();
        else await reload();
      },
      addCommitment: (commitment) => {
        const seen = snapshotRef.current;
        const local =
          seen.role === "investor" &&
          commitment.userId === seen.userId &&
          commitment.amountJmd > 0 &&
          seen.projects.some((project) => project.id === commitment.projectId);
        return commitFlag(local, () =>
          postCommitment({ projectId: commitment.projectId, amount: commitment.amountJmd }),
        );
      },
      addContribution: (contribution) => {
        const seen = snapshotRef.current;
        const project = seen.projects.find((item) => item.id === contribution.projectId);
        const local = Boolean(
          project &&
            contribution.userId === seen.userId &&
            project.team.includes(seen.userId),
        );
        return commitFlag(local, () =>
          postContribution({
            projectId: contribution.projectId,
            skill: contribution.skill,
            preset: contribution.preset,
          }),
        );
      },
      addRequest: (draft: RequestDraft) => {
        const seen = snapshotRef.current;
        const local =
          seen.role === "investor" &&
          Boolean(askedPlace(draft.countryId, draft.parishId, draft.townId)) &&
          draft.budget > 0 &&
          Number.isInteger(draft.workersNeeded) &&
          draft.workersNeeded >= 1 &&
          draft.workersNeeded <= 10 &&
          draft.skills.length > 0;
        return commitId(local, () => postRequest(draft));
      },
      applyToRequest: (input) => {
        const seen = snapshotRef.current;
        const request = seen.requests.find((item) => item.id === input.requestId);
        const existing = seen.applications.find(
          (item) =>
            item.requestId === input.requestId &&
            item.workerId === seen.userId &&
            item.status !== "declined",
        );
        const local = Boolean(
          request &&
            seen.role === "worker" &&
            request.status === "open" &&
            request.userId !== seen.userId &&
            request.skills.includes(input.skill) &&
            !existing,
        );
        return commitFlag(local, () =>
          postApplication({
            requestId: input.requestId,
            projectId: null,
            skill: input.skill,
            message: input.message,
          }),
        );
      },
      inviteWorker: (requestId, workerId) => {
        const seen = snapshotRef.current;
        const request = seen.requests.find((item) => item.id === requestId);
        const post = seen.availability.find(
          (item) => item.userId === workerId && item.skills.some((skill) => request?.skills.includes(skill)),
        );
        const skill = request && post ? request.skills.find((item) => post.skills.includes(item)) : undefined;
        const existing = seen.applications.find(
          (item) => item.requestId === requestId && item.workerId === workerId && item.status !== "declined",
        );
        const local = Boolean(
          request &&
            skill &&
            request.userId === seen.userId &&
            request.status === "open" &&
            !existing,
        );
        return commitFlag(local, () => inviteWorkerAction(requestId, workerId, skill as Skill));
      },
      setApplicationStatus: async (id, status) => {
        const seen = snapshotRef.current;
        const application = seen.applications.find((item) => item.id === id);
        if (!application || application.status !== "waiting") return false;
        if (application.projectId && !application.requestId) {
          const project = seen.projects.find((item) => item.id === application.projectId);
          const local = Boolean(project && project.organizerId === seen.userId && application.origin === "applied");
          return commitFlag(local, () => setApplicationStatusAction(id, status));
        }
        const request = seen.requests.find((item) => item.id === application.requestId);
        if (!request) return false;
        const owner = request.userId === seen.userId && application.origin === "applied";
        const invited = application.workerId === seen.userId && application.origin === "invited";
        if (!owner && !invited) return false;
        if (status === "accepted") {
          const filled = seen.applications.filter(
            (item) => item.requestId === request.id && item.status === "accepted",
          ).length;
          if (request.status !== "open" || filled >= request.workersNeeded) return false;
        }
        return commitFlag(true, () => setApplicationStatusAction(id, status));
      },
      addAvailability: (draft: AvailabilityDraft) => {
        const seen = snapshotRef.current;
        const local =
          seen.role === "worker" &&
          Boolean(askedPlace(draft.countryId, draft.parishId, draft.townId)) &&
          draft.skills.length > 0;
        return commitId(local, () => postAvailability(draft));
      },
      withdrawApplication: (id) => {
        const seen = snapshotRef.current;
        const application = seen.applications.find((item) => item.id === id);
        const local = Boolean(
          application && application.status === "waiting" && application.workerId === seen.userId,
        );
        return commitFlag(local, () => withdrawApplicationAction(id));
      },
      startProject: async (requestId, name) => {
        const seen = snapshotRef.current;
        const trimmed = name.trim().slice(0, 80);
        const request = seen.requests.find((item) => item.id === requestId);
        const local = Boolean(
          trimmed &&
            request &&
            request.userId === seen.userId &&
            request.status === "team-ready" &&
            !request.projectId,
        );
        const id = await commitId(local, () => startProjectAction(requestId, trimmed));
        if (id) setOpenedProject(true);
        return id;
      },
      askToJoin: (projectId) => {
        const seen = snapshotRef.current;
        const project = seen.projects.find((item) => item.id === projectId);
        const existing = seen.applications.find(
          (item) => item.projectId === projectId && item.workerId === seen.userId && item.status !== "declined",
        );
        const mine = [seen.homeSkill, ...seen.homeExtraSkills].filter((item): item is Skill => Boolean(item));
        const fromFlow = [flow?.skill, ...(flow?.extraSkills ?? [])].filter((item): item is Skill => Boolean(item));
        const skills = fromFlow.length > 0 ? fromFlow : mine;
        const skill = project?.needs.find((item) => skills.includes(item)) ?? skills[0] ?? project?.needs[0];
        const local = Boolean(
          project &&
            skill &&
            seen.role === "worker" &&
            project.organizerId &&
            project.organizerId !== seen.userId &&
            !project.team.includes(seen.userId) &&
            !existing,
        );
        return commitFlag(local, () =>
          postApplication({ requestId: null, projectId, skill: skill as Skill, message: "" }),
        );
      },
      markOpened: () => setOpenedProject(true),
      useSample: () => {},
      useNewPerson: () => {},
      reset: () => {},
    };
  }, [commitFlag, commitId, flow, openedProject, path, proof, ready, reload, saving, snapshot]);

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}
