"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  inviteWorker as inviteWorkerAction,
  closeRequest as closeRequestAction,
  pledgeToRequest as pledgeToRequestAction,
  postApplication,
  postAvailability,
  postCommitment,
  postInterest,
  acceptContribution as acceptContributionAction,
  postContribution,
  postRequest,
  withdrawRequestPledge as withdrawRequestPledgeAction,
  saveDisplayName,
  saveHomeTown,
  saveProfile,
  saveProfileDetails,
  setLiveRole,
  setSignal,
  markPhaseDone as markPhaseDoneAction,
  savePhaseSplit as savePhaseSplitAction,
  setReadiness as setReadinessAction,
  setApplicationStatus as setApplicationStatusAction,
  startProject as startProjectAction,
  withdrawApplication as withdrawApplicationAction,
} from "@/app/actions/live";
import { cleanReadiness, isSite, kindById } from "@/lib/blueprints";
import { phasesFor, readinessChangeNote } from "@/lib/capital";
import { isSkill } from "@/lib/catalog";
import { cleanInterests, type CapitalInterest, type InterestDraft } from "@/lib/interests";
import {
  emptyProfile,
  profileFromRow,
  resolvedProfile,
  sectorDown as sectorDownOf,
  trackFor,
  type PersonProfile,
} from "@/lib/profile";
import { canCommitMoney, cleanResidence, investStanding } from "@/lib/residence";
import { investorBasicsIds, stageLessons } from "@/lib/lessons";
import type { WeekPlan } from "@/lib/progress";
import { DemoContext, type AvailabilityDraft, type DemoValue, type Flow, type Proof, type RequestDraft } from "@/lib/demo-store";
import {
  mapApplication,
  mapAvailability,
  mapCommitment,
  mapContribution,
  mapPayment,
  mapPledge,
  mapProject,
  mapProjectWallet,
  mapPublicPerson,
  mapRequest,
  mapTranche,
  mapWallet,
  newest,
} from "@/lib/live-rows";
import { notifySaveError } from "@/components/snackbar";
import { capitalReserved } from "@/lib/ownership";
import { convertedBacking, joinBlock, withdrawBlock } from "@/lib/pledges";
import { REGIONS, leadCountry, type RegionId } from "@/lib/regions";
import { askedPlace, getCountry, getParish, getParishes, rememberLivePeople } from "@/lib/seed";
import type { RequestPledge } from "@/lib/types";
import { browserSupabase } from "@/lib/supabase/browser";
import type {
  Application,
  Availability,
  CapitalRequest,
  Commitment,
  Contribution,
  PathChoice,
  Payment,
  Project,
  ProjectWallet,
  Skill,
  Wallet,
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
  capitalInterests: CapitalInterest[];
  contributions: Contribution[];
  reviewContributions: Contribution[];
  addedCommitments: Commitment[];
  requests: CapitalRequest[];
  pledges: RequestPledge[];
  applications: Application[];
  availability: Availability[];
  projects: Project[];
  investorBasicsDone: boolean;
  learningSeen: string[];
  learningDone: string[];
  weeks: WeekPlan[];
  wallets: Wallet[];
  projectWallets: ProjectWallet[];
  payments: Payment[];
  names: Record<string, string>;
  profile: PersonProfile | null;
  savedIds: string[];
  hidden: { id: string; sector: string }[];
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
  capitalInterests: [],
  contributions: [],
  reviewContributions: [],
  addedCommitments: [],
  requests: [],
  pledges: [],
  applications: [],
  availability: [],
  projects: [],
  investorBasicsDone: false,
  learningSeen: [],
  learningDone: [],
  weeks: [],
  wallets: [],
  projectWallets: [],
  payments: [],
  names: {},
  profile: null,
  savedIds: [],
  hidden: [],
};

function investorTown(places: string[]): { countryId: string; parishId: string | null; townId: string } | null {
  const picked = places.find((id) => REGIONS.some((region) => region.id === id));
  const region = (picked ?? "caribbean") as RegionId;
  if (!picked || region === "caribbean") {
    const parish = getParish("westmoreland") ?? getParishes()[0];
    const town = parish?.towns[0];
    if (!parish || !town) return null;
    return { countryId: "jamaica", parishId: parish.id, townId: town.id };
  }
  const country = getCountry(leadCountry(region));
  const city = country?.cities[0];
  if (!country || !city) return null;
  return { countryId: country.id, parishId: null, townId: city.id };
}

function textList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function mapWeek(row: Record<string, unknown>): WeekPlan | null {
  const id = typeof row.id === "string" ? row.id : "";
  const projectId = typeof row.project_id === "string" ? row.project_id : "";
  const goal = typeof row.goal === "string" ? row.goal : "";
  const status = row.status === "open" || row.status === "done" || row.status === "not-done" ? row.status : null;
  if (!id || !projectId || !goal || !status) return null;
  const plan = textList(row.plan);
  return {
    id,
    projectId,
    goal,
    stepOne: plan[0] ?? "",
    stepTwo: plan[1] ?? "",
    status,
    happened: typeof row.note === "string" ? row.note : "",
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
  };
}

function mergePledges(amounts: Record<string, unknown>[], named: Record<string, unknown>[]): RequestPledge[] {
  const byId = new Map<string, RequestPledge>();
  for (const row of amounts) {
    const item = mapPledge(row);
    if (item) byId.set(item.id, item);
  }
  for (const row of named) {
    const item = mapPledge(row);
    if (item) byId.set(item.id, item);
  }
  return [...byId.values()];
}

function rowsOf(value: { data: unknown[] | null }): Record<string, unknown>[] {
  return (value.data ?? []).filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
}

function liveProfile(row: Record<string, unknown> | null, residence: unknown): PersonProfile | null {
  const details = profileFromRow(row);
  const code = cleanResidence(residence);
  if (details) return { ...details, residence: code };
  if (!code) return null;
  return { ...emptyProfile(), done: true, residence: code };
}

async function loadSnapshot(): Promise<Snapshot> {
  const supabase = browserSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  const [projectRows, memberRows, requestRows, applicationRows, availabilityRows, peopleRows, commitmentRows, contributionRows, mine, goalRows, lessonRows, walletRows, projectWalletRows, paymentRows, trancheRows, detailRows, signalRows, pledgeRows, pledgeNameRows, interestRows] =
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
        ? supabase.from("profiles").select("name, role, country_id, parish_id, town_id, skill, extra_skills, investor_basics_at, residence_country").eq("id", user.id).maybeSingle()
        : Promise.resolve({ data: null }),
      user ? supabase.from("weekly_goals").select("*") : Promise.resolve({ data: [] }),
      user ? supabase.from("lesson_progress").select("lesson_id, seen_at, done_at") : Promise.resolve({ data: [] }),
      user ? supabase.from("wallets").select("*") : Promise.resolve({ data: [] }),
      user ? supabase.from("project_wallets").select("*") : Promise.resolve({ data: [] }),
      user ? supabase.from("payments").select("*") : Promise.resolve({ data: [] }),
      user ? supabase.from("capital_tranches").select("*") : Promise.resolve({ data: [] }),
      user
        ? supabase.from("profile_details").select("*").eq("user_id", user.id).maybeSingle()
        : Promise.resolve({ data: null }),
      user ? supabase.from("user_signals").select("item_id, kind, sector") : Promise.resolve({ data: [] }),
      supabase.from("request_pledges").select("id, request_id, amount, status, created_at"),
      user
        ? supabase.from("request_pledge_names").select("id, request_id, user_id, name, show_name, amount, status, created_at")
        : Promise.resolve({ data: [] }),
      user
        ? supabase.from("capital_interests").select("id, user_id, project_id, request_id, amount, kind, created_at").eq("user_id", user.id)
        : Promise.resolve({ data: [] }),
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

  const trancheList = rowsOf(trancheRows).flatMap((row) => {
    const item = mapTranche(row);
    return item ? [item] : [];
  });
  const commitments = newest(rowsOf(commitmentRows).flatMap((row) => {
    const item = mapCommitment(row);
    return item ? [item] : [];
  })).map((item) => ({
    ...item,
    tranches: trancheList
      .filter((row) => row.commitmentId === item.id)
      .sort((left, right) => left.position - right.position)
      .map((row) => ({
        phase: row.phase,
        position: row.position,
        amount: row.amount,
        status: row.status,
      })),
  }));

  const projects = rowsOf(projectRows).flatMap((row) => {
    const id = typeof row.id === "string" ? row.id : "";
    const project = mapProject(row, teamByProject.get(id) ?? [], 0);
    return project ? [project] : [];
  });

  const names: Record<string, string> = {};
  for (const person of people) {
    if (person.id && person.name.trim()) names[person.id] = person.name.trim();
  }

  const profile = mine.data;
  if (user?.id && typeof profile?.name === "string" && profile.name.trim() && !names[user.id]) {
    names[user.id] = profile.name.trim();
  }
  const role = profile?.role === "investor" || profile?.role === "worker" ? profile.role : null;
  const skill = typeof profile?.skill === "string" && isSkill(profile.skill) ? profile.skill : null;
  const extra = Array.isArray(profile?.extra_skills)
    ? profile.extra_skills.filter((item): item is Skill => typeof item === "string" && isSkill(item))
    : [];

  const ownCommitments = user ? commitments.filter((item) => item.userId === user.id) : [];
  const allContributions = newest(rowsOf(contributionRows).flatMap((row) => {
    const item = mapContribution(row);
    return item ? [item] : [];
  }));
  const contributions = allContributions.filter((item) => !user || item.userId === user.id);
  const reviewContributions = user
    ? allContributions.filter((item) => {
        const project = projects.find((row) => row.id === item.projectId);
        return project?.organizerId === user.id;
      })
    : [];

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
    reviewContributions,
    addedCommitments: commitments,
    requests: newest(rowsOf(requestRows).flatMap((row) => {
      const item = mapRequest(row);
      return item ? [item] : [];
    })),
    pledges: mergePledges(rowsOf(pledgeRows), rowsOf(pledgeNameRows)),
    applications: newest(rowsOf(applicationRows).flatMap((row) => {
      const item = mapApplication(row);
      return item ? [item] : [];
    })),
    availability: newest(rowsOf(availabilityRows).flatMap((row) => {
      const item = mapAvailability(row);
      return item ? [item] : [];
    })),
    projects,
    investorBasicsDone: typeof profile?.investor_basics_at === "string" && profile.investor_basics_at.length > 0,
    learningSeen: rowsOf(lessonRows).flatMap((row) =>
      typeof row.lesson_id === "string" && row.seen_at ? [row.lesson_id] : [],
    ),
    names,
    learningDone: rowsOf(lessonRows).flatMap((row) =>
      typeof row.lesson_id === "string" && row.done_at ? [row.lesson_id] : [],
    ),
    weeks: rowsOf(goalRows).flatMap((row) => {
      const week = mapWeek(row);
      return week ? [week] : [];
    }),
    wallets: rowsOf(walletRows).flatMap((row) => {
      const item = mapWallet(row);
      return item ? [item] : [];
    }),
    projectWallets: rowsOf(projectWalletRows).flatMap((row) => {
      const item = mapProjectWallet(row);
      return item ? [item] : [];
    }),
    payments: rowsOf(paymentRows).flatMap((row) => {
      const item = mapPayment(row);
      return item ? [item] : [];
    }),
    capitalInterests: cleanInterests(
      rowsOf(interestRows).map((row) => ({
        id: row.id,
        userId: row.user_id,
        projectId: row.project_id,
        requestId: row.request_id,
        amount: typeof row.amount === "number" ? row.amount : typeof row.amount === "string" ? Number(row.amount) : null,
        kind: row.kind,
        createdAt: row.created_at,
      })),
    ),
    profile: liveProfile(detailRows.data as Record<string, unknown> | null, profile?.residence_country),
    savedIds: rowsOf(signalRows).flatMap((row) =>
      row.kind === "saved" && typeof row.item_id === "string" ? [row.item_id] : [],
    ),
    hidden: rowsOf(signalRows).flatMap((row) => {
      if (row.kind !== "hidden" || typeof row.item_id !== "string") return [];
      return [{ id: row.item_id, sector: typeof row.sector === "string" ? row.sector : "" }];
    }),
  };
}

function withIds(current: string[], ids: string[]): string[] {
  return [...new Set([...current, ...ids.filter(Boolean)])];
}

async function saveLessonsSeen(userId: string, ids: string[]): Promise<boolean> {
  const seenAt = new Date().toISOString();
  const { error } = await browserSupabase().from("lesson_progress").upsert(
    ids.map((lessonId) => ({ user_id: userId, lesson_id: lessonId, seen_at: seenAt })),
    { onConflict: "user_id,lesson_id" },
  );
  return !error;
}

async function saveLessonsDone(userId: string, ids: string[]): Promise<boolean> {
  const stamp = new Date().toISOString();
  const { error } = await browserSupabase().from("lesson_progress").upsert(
    ids.map((lessonId) => ({ user_id: userId, lesson_id: lessonId, seen_at: stamp, done_at: stamp })),
    { onConflict: "user_id,lesson_id" },
  );
  return !error;
}

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot>(emptySnapshot);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [path, setPath] = useState<PathChoice | null>(null);
  const [seeEverywhere, setSeeEverywhereState] = useState(false);
  const [nearMe, setNearMeState] = useState(false);
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
      capitalInterests: current.capitalInterests,
      contributions: current.contributions,
      acceptContribution: (id) => {
        const seen = snapshotRef.current;
        const row = seen.reviewContributions.find((item) => item.id === id && item.status === "logged");
        const project = row ? seen.projects.find((item) => item.id === row.projectId) : undefined;
        const local = Boolean(row && project && project.organizerId === seen.userId);
        return commitFlag(local, () => acceptContributionAction(id));
      },
      reviewContributions: current.reviewContributions,
      addedCommitments: current.addedCommitments,
      requests: current.requests,
      pledges: current.pledges,
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
      displayNameFor: (id: string) => {
        const named = current.names[id]?.trim() ?? "";
        if (named) return named;
        if (id && id === current.userId) return current.name.trim();
        return "";
      },
      registerInterest: async (draft: InterestDraft) => {
        const seen = snapshotRef.current;
        const projectId = draft.projectId || null;
        const requestId = draft.requestId || null;
        const local = Boolean(
          investStanding(seen.profile?.residence) === "interest" &&
            seen.role === "investor" &&
            (projectId || requestId),
        );
        return commitFlag(local, () => postInterest(draft));
      },
      addCommitment: (commitment) => {
        const seen = snapshotRef.current;
        const project = seen.projects.find((item) => item.id === commitment.projectId);
        const reserved = project
          ? Math.max(
              capitalReserved(project.committedJmd, seen.addedCommitments, project.id),
              convertedBacking(project.id, seen.requests, seen.pledges),
            )
          : 0;
        const room = project ? Math.max(0, project.goalJmd - reserved) : 0;
        const local =
          canCommitMoney(seen.profile?.residence) &&
          seen.role === "investor" &&
          commitment.userId === seen.userId &&
          commitment.amountJmd > 0 &&
          Boolean(project) &&
          commitment.amountJmd <= room;
        return commitFlag(local, () =>
          postCommitment({
            projectId: commitment.projectId,
            amount: commitment.amountJmd,
            showName: commitment.showName,
          }),
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
          draft.skills.length > 0 &&
          Boolean(kindById(draft.sector, draft.kind)) &&
          isSite(draft.site) &&
          Boolean(cleanReadiness(draft.readiness)) &&
          draft.share >= 1 &&
          draft.share <= draft.budget;
        return commitId(local, () => postRequest(draft));
      },
      pledgeToRequest: async (input) => {
        const seen = snapshotRef.current;
        if (!canCommitMoney(seen.profile?.residence)) return "closed";
        const blocked = joinBlock({
          role: seen.role,
          basics: seen.investorBasicsDone,
          request: seen.requests.find((item) => item.id === input.requestId),
          pledges: seen.pledges,
          userId: seen.userId,
          amount: input.amount,
        });
        if (blocked) return blocked;
        const ok = await commitFlag(true, () => pledgeToRequestAction(input));
        return ok ? "ok" : "left";
      },
      withdrawRequestPledge: async (pledgeId) => {
        const seen = snapshotRef.current;
        const pledge = seen.pledges.find((item) => item.id === pledgeId);
        const blocked = withdrawBlock({
          request: pledge ? seen.requests.find((item) => item.id === pledge.requestId) : undefined,
          pledges: seen.pledges,
          userId: seen.userId,
          pledgeId,
        });
        if (blocked) return blocked;
        const ok = await commitFlag(true, () => withdrawRequestPledgeAction(pledgeId));
        return ok ? "ok" : "missing";
      },
      closeRequest: (requestId) => {
        const seen = snapshotRef.current;
        const request = seen.requests.find((item) => item.id === requestId);
        const local = Boolean(
          request && request.userId === seen.userId && !request.projectId && request.status !== "closed",
        );
        return commitFlag(local, () => closeRequestAction(requestId));
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
      setReadiness: (input) => {
        const seen = snapshotRef.current;
        const readiness = cleanReadiness(input.readiness);
        const request = input.requestId ? seen.requests.find((item) => item.id === input.requestId) : undefined;
        const project = input.projectId ? seen.projects.find((item) => item.id === input.projectId) : undefined;
        const ownsRequest = Boolean(request && request.userId === seen.userId);
        const ownsProject = Boolean(project && project.organizerId === seen.userId);
        const local = Boolean(readiness && ((input.requestId && ownsRequest) || (!input.requestId && ownsProject)));
        return commitFlag(local, () => setReadinessAction(input));
      },
      rememberPhaseBaseline: () => {},
      savePhaseSplit: (input) => {
        const seen = snapshotRef.current;
        const project = seen.projects.find((item) => item.id === input.projectId);
        const phases = project ? phasesFor(project) : [];
        if (!seen.userId || !project || project.organizerId !== seen.userId || project.workStarted) return false;
        if (input.shares.length !== phases.length || input.shares.some((share) => !(share > 0))) return false;
        const confirmed = seen.addedCommitments.some(
          (item) => item.projectId === project.id && item.tranches?.some((row) => row.status === "confirmed"),
        );
        if (confirmed) return false;
        void (async () => {
          const ok = await savePhaseSplitAction(input);
          if (!ok) notifySaveError();
          await reload();
        })();
        return true;
      },
      markPhaseDone: (projectId) => {
        const seen = snapshotRef.current;
        const project = seen.projects.find((item) => item.id === projectId);
        if (!project || project.organizerId !== seen.userId) return false;
        const note = readinessChangeNote(project.phaseBaseline ?? {}, project.readiness ?? {});
        if (!note) return false;
        void (async () => {
          const ok = await markPhaseDoneAction(projectId);
          if (!ok) notifySaveError();
          await reload();
        })();
        return true;
      },
      startProject: async (requestId, name) => {
        const seen = snapshotRef.current;
        const trimmed = name.trim().slice(0, 80);
        const request = seen.requests.find((item) => item.id === requestId);
        const local = Boolean(
          canCommitMoney(seen.profile?.residence) &&
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
        const fromProfile = (seen.profile?.skillLevels ?? []).map((item) => item.skill);
        const skills = [...new Set([...fromFlow, ...mine, ...fromProfile])];
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
      investorBasicsDone: current.investorBasicsDone,
      learningSeen: current.learningSeen,
      learningDone: current.learningDone,
      weeks: current.weeks,
      wallets: current.wallets,
      projectWallets: current.projectWallets,
      payments: current.payments,
      markLessonsSeen: (ids) => {
        const seen = snapshotRef.current;
        if (!seen.userId) return;
        const fresh = ids.filter((id) => id && !seen.learningSeen.includes(id));
        if (fresh.length === 0) return;
        setSnapshot((item) => ({ ...item, learningSeen: withIds(item.learningSeen, fresh) }));
        void saveLessonsSeen(seen.userId, fresh).then((ok) => {
          if (!ok) notifySaveError();
        });
      },
      passInvestorBasics: () => {
        const seen = snapshotRef.current;
        if (!seen.userId) return;
        const ids = investorBasicsIds();
        setSnapshot((item) => ({
          ...item,
          investorBasicsDone: true,
          learningSeen: withIds(item.learningSeen, ids),
          learningDone: withIds(item.learningDone, ids),
        }));
        void (async () => {
          const passed = await browserSupabase().rpc("pass_investor_basics");
          const lessonsOk = passed.error ? false : await saveLessonsDone(seen.userId, ids);
          if (passed.error || !lessonsOk) notifySaveError();
          await reload();
        })();
      },
      saveWeek: (input) => {
        const seen = snapshotRef.current;
        const project = seen.projects.find((item) => item.id === input.projectId);
        const goal = input.goal.trim().slice(0, 140);
        const stepOne = input.stepOne.trim();
        const stepTwo = input.stepTwo.trim();
        if (!seen.userId || !project || project.organizerId !== seen.userId) return false;
        if (!goal || !stepOne || !stepTwo) return false;
        if (seen.weeks.some((week) => week.projectId === input.projectId && week.status === "open")) return false;
        const week: WeekPlan = {
          id: crypto.randomUUID(),
          projectId: input.projectId,
          goal,
          stepOne,
          stepTwo,
          status: "open",
          happened: "",
          createdAt: new Date().toISOString(),
        };
        const match = stageLessons(project.sector, project.workStarted).find((lesson) => lesson.action === goal);
        setSnapshot((item) => ({
          ...item,
          weeks: [...item.weeks, week],
          learningSeen: match ? withIds(item.learningSeen, [match.id]) : item.learningSeen,
          learningDone: match ? withIds(item.learningDone, [match.id]) : item.learningDone,
        }));
        void (async () => {
          const { error } = await browserSupabase().from("weekly_goals").insert({
            id: week.id,
            project_id: week.projectId,
            user_id: seen.userId,
            goal,
            plan: [stepOne, stepTwo],
            status: "open",
            note: "",
            week_of: week.createdAt.slice(0, 10),
          });
          const lessonsOk = !error && match ? await saveLessonsDone(seen.userId, [match.id]) : !error;
          if (error || !lessonsOk) notifySaveError();
          await reload();
        })();
        return true;
      },
      closeWeek: (input) => {
        const seen = snapshotRef.current;
        const week = seen.weeks.find((item) => item.id === input.id && item.status === "open");
        const project = week ? seen.projects.find((item) => item.id === week.projectId) : undefined;
        const happened = input.happened.trim().slice(0, 140);
        if (!week || !project || project.organizerId !== seen.userId || !happened) return false;
        setSnapshot((item) => ({
          ...item,
          weeks: item.weeks.map((entry) =>
            entry.id === week.id ? { ...entry, status: input.status, happened } : entry,
          ),
        }));
        void (async () => {
          const { error } = await browserSupabase()
            .from("weekly_goals")
            .update({ status: input.status, note: happened })
            .eq("id", week.id);
          if (error) notifySaveError();
          await reload();
        })();
        return true;
      },
      profile: resolvedProfile(current.userId, current.profile ?? undefined).profile,
      profileSet: resolvedProfile(current.userId, current.profile ?? undefined).set,
      savedIds: current.savedIds,
      hiddenIds: current.hidden.map((item) => item.id),
      sectorDown: sectorDownOf(current.hidden),
      seeEverywhere,
      nearMe,
      track: trackFor(current.userId, current.contributions, current.payments),
      savePersonProfile: async (profile) => {
        const ok = await saveProfileDetails(profile);
        if (!ok) notifySaveError();
        else await reload();
      },
      saveItem: (itemId, sector) => {
        const saved = current.savedIds.includes(itemId);
        void setSignal({ itemId, kind: saved ? "clear" : "saved", sector }).then((ok) => {
          if (!ok) notifySaveError();
          return reload();
        });
      },
      hideItem: (itemId, sector) => {
        void setSignal({ itemId, kind: "hidden", sector }).then((ok) => {
          if (!ok) notifySaveError();
          return reload();
        });
      },
      setSeeEverywhere: setSeeEverywhereState,
      setNearMe: setNearMeState,
      setHomeTown: (place) => {
        setFlow((item) => ({
          extraSkills: item?.extraSkills ?? [],
          ...item,
          countryId: place.countryId,
          parishId: place.parishId ?? undefined,
          townId: place.townId,
        }));
        void saveHomeTown(place).then((ok) => {
          if (!ok) notifySaveError();
          return reload();
        });
      },
      completeStart: async (draft) => {
        const name = draft.name.trim().slice(0, 80);
        if (!name) return false;
        const place = draft.place ?? (draft.role === "investor" ? investorTown(draft.profile.places) : null);
        if (!place) return false;
        const profile = { ...draft.profile, done: true };
        flowStarted.current = true;
        setPath(draft.role);
        if (draft.role === "worker" && draft.place) {
          setFlow({
            countryId: draft.place.countryId,
            parishId: draft.place.parishId ?? undefined,
            townId: draft.place.townId,
            skill: draft.skill ?? undefined,
            extraSkills: draft.extraSkills,
          });
        }
        const optimistic = {
          ...snapshotRef.current,
          name,
          role: draft.role,
          profile,
          homeCountryId: draft.role === "worker" ? place.countryId : snapshotRef.current.homeCountryId,
          homeParishId: draft.role === "worker" ? place.parishId : snapshotRef.current.homeParishId,
          homeTownId: draft.role === "worker" ? place.townId : snapshotRef.current.homeTownId,
          homeSkill: draft.skill,
          homeExtraSkills: draft.extraSkills,
        };
        snapshotRef.current = optimistic;
        setSnapshot(optimistic);
        const saved = await saveProfile({
          name,
          role: draft.role,
          countryId: place.countryId,
          parishId: place.parishId,
          townId: place.townId,
          skill: draft.skill,
          extraSkills: draft.extraSkills,
          residence: draft.profile.residence,
        });
        if (!saved) {
          notifySaveError();
          await reload();
          return false;
        }
        const details = await saveProfileDetails(profile);
        if (!details) notifySaveError();
        await reload();
        return details;
      },
      switchRole: () => {
        const seen = snapshotRef.current;
        const current = seen.role ?? path;
        if (current !== "investor" && current !== "worker") return;
        const next: PathChoice = current === "investor" ? "worker" : "investor";
        setPath(next);
        snapshotRef.current = { ...seen, role: next };
        setSnapshot((item) => ({ ...item, role: next }));
        void setLiveRole(next).then((ok) => {
          if (!ok) notifySaveError();
          return reload();
        });
      },
      useSample: () => {},
      useNewPerson: () => {},
      reset: () => {},
    };
  }, [commitFlag, commitId, flow, nearMe, openedProject, path, proof, ready, reload, saving, seeEverywhere, snapshot]);

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}
