"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cleanReadiness, isSite, kindById } from "@/lib/blueprints";
import { openChecks, sectorWeekly } from "@/lib/catalog";
import { investorBasicsIds, stageLessons } from "@/lib/lessons";
import {
  closeWeek as closeWeekPlan,
  emptyProgress,
  finishLessons,
  normalizeProgress,
  openWeek,
  passBasics,
  seeLessons,
  type ProgressState,
  type WeekPlan,
} from "@/lib/progress";
import {
  acceptedCount,
  baseRequest,
  listApplications,
  listAvailability,
  listProjects,
  listRequests,
  statusForTeam,
} from "@/lib/requests";
import {
  askedPlace,
  getCity,
  getTown,
  getUser,
  seedCommitments,
  seedContributions,
} from "@/lib/seed";
import type { RegionId } from "@/lib/regions";
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
  Readiness,
  Sector,
  SiteStatus,
  Skill,
  Wallet,
} from "@/lib/types";

const STORAGE_KEY = "fundwork-demo-v4";
const V3_KEY = "fundwork-demo-v3";
const V2_KEY = "fundwork-demo-v2";
const V1_KEY = "fundwork-demo-v1";

export type Flow = {
  regionId?: RegionId;
  countryId?: string;
  parishId?: string;
  townId?: string;
  sector?: Sector;
  skill?: Skill;
  extraSkills: Skill[];
};

export type Proof = {
  fileName: string;
  dataUrl: string | null;
  tooBig: boolean;
};

type Session = {
  mode: "new" | "sample";
  sampleId: string | null;
  path: PathChoice | null;
  displayName: string;
  flow: Flow | null;
  proofs: Record<string, Proof>;
  commitments: Commitment[];
  contributions: Contribution[];
  requests: CapitalRequest[];
  applications: Application[];
  availability: Availability[];
  projects: Project[];
  requestProjects: Record<string, string>;
  teamAdds: Record<string, string[]>;
  requestStatus: Record<string, CapitalRequest["status"]>;
  applicationStatus: Record<string, Application["status"]>;
  withdrawnIds: string[];
  openedProject: boolean;
  progress: ProgressState;
};

type Persisted = {
  version: 1 | 2 | 3 | 4;
  session: Partial<Session>;
};

export type RequestDraft = {
  countryId: string;
  parishId: string | null;
  townId: string;
  sector: Sector;
  budget: number;
  workersNeeded: number;
  skills: Skill[];
  note: string;
  kind: string;
  site: SiteStatus;
  readiness: Readiness;
};

export type AvailabilityDraft = {
  countryId: string;
  parishId: string | null;
  townId: string;
  skills: Skill[];
  note: string;
};

const initialSession: Session = {
  mode: "new",
  sampleId: null,
  path: null,
  displayName: "",
  flow: null,
  proofs: {},
  commitments: [],
  contributions: [],
  requests: [],
  applications: [],
  availability: [],
  projects: [],
  requestProjects: {},
  teamAdds: {},
  requestStatus: {},
  applicationStatus: {},
  withdrawnIds: [],
  openedProject: false,
  progress: emptyProgress(),
};

function isSession(value: unknown): value is Partial<Session> {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<Session>;
  return session.mode === "new" || session.mode === "sample";
}

function normalize(input: Partial<Session>): Session {
  return {
    ...initialSession,
    ...input,
    flow: input.flow
      ? {
          ...input.flow,
          extraSkills: input.flow.extraSkills ?? [],
        }
      : null,
    proofs: input.proofs ?? {},
    commitments: Array.isArray(input.commitments) ? input.commitments : [],
    contributions: Array.isArray(input.contributions) ? input.contributions : [],
    requests: Array.isArray(input.requests)
      ? input.requests.map((request) => ({
          ...request,
          projectId: request.projectId ?? null,
          kind: typeof request.kind === "string" ? request.kind : null,
          site: isSite(request.site) ? request.site : null,
          readiness: cleanReadiness(request.readiness) ?? {},
        }))
      : [],
    applications: Array.isArray(input.applications)
      ? input.applications.map((application) => ({
          ...application,
          requestId: application.requestId ?? null,
          projectId: application.projectId ?? null,
        }))
      : [],
    availability: Array.isArray(input.availability) ? input.availability : [],
    projects: Array.isArray(input.projects)
      ? input.projects.map((project) => carryOrganizer(project, input))
      : [],
    requestProjects: input.requestProjects ?? {},
    teamAdds: input.teamAdds ?? {},
    requestStatus: input.requestStatus ?? {},
    applicationStatus: input.applicationStatus ?? {},
    withdrawnIds: Array.isArray(input.withdrawnIds) ? input.withdrawnIds : [],
    openedProject: input.openedProject ?? false,
    progress: normalizeProgress(input.progress),
    path: input.path ?? null,
    sampleId: input.sampleId ?? null,
    displayName: input.displayName ?? "",
  };
}

function readPayload(raw: string | null): Persisted | null {
  if (!raw) return null;
  const parsed = JSON.parse(raw) as Persisted;
  if (
    !parsed ||
    (parsed.version !== 1 && parsed.version !== 2 && parsed.version !== 3 && parsed.version !== 4) ||
    !isSession(parsed.session)
  ) {
    return null;
  }
  return parsed;
}

function loadSession(): Session {
  if (typeof window === "undefined") return initialSession;
  try {
    const current = readPayload(window.localStorage.getItem(STORAGE_KEY));
    if (current?.version === 4) return normalize(current.session);
    if (window.localStorage.getItem(STORAGE_KEY)) return initialSession;
    const carried = readPayload(window.localStorage.getItem(V3_KEY));
    if (carried?.version === 3) return normalize(carried.session);
    if (window.localStorage.getItem(V3_KEY)) return initialSession;
    const previous = readPayload(window.localStorage.getItem(V2_KEY));
    if (previous?.version === 2) return normalize(previous.session);
    if (window.localStorage.getItem(V2_KEY)) return initialSession;
    const legacy = readPayload(window.localStorage.getItem(V1_KEY));
    if (!legacy || legacy.version !== 1) return initialSession;
    return normalize(legacy.session);
  } catch {
    return initialSession;
  }
}

function currentUserId(session: Session): string {
  if (session.mode === "sample" && session.sampleId) return session.sampleId;
  return "you";
}

function personName(session: Session): string {
  const sample = session.mode === "sample" && session.sampleId ? getUser(session.sampleId) : undefined;
  return sample?.name || session.displayName || "You";
}

function carryOrganizer(
  project: Omit<Project, "organizerId"> & { organizerId?: string | null },
  input: Partial<Session>,
): Project {
  const kind = typeof project.kind === "string" ? project.kind : null;
  const site = isSite(project.site) ? project.site : null;
  const readiness = cleanReadiness(project.readiness) ?? {};
  if (project.organizerId === null || typeof project.organizerId === "string") {
    return { ...project, organizerId: project.organizerId, kind, site, readiness };
  }
  const view: Session = { ...initialSession, ...input };
  const sameName = personName(view) === project.organizerName;
  return { ...project, organizerId: sameName ? currentUserId(view) : null, kind, site, readiness };
}

function writeDecision(
  sessionRef: { current: Session },
  setSession: (update: (current: Session) => Session) => void,
  decide: (current: Session) => Session | null,
): boolean {
  const next = decide(sessionRef.current);
  if (!next) return false;
  sessionRef.current = next;
  setSession((latest) => decide(latest) ?? latest);
  return true;
}

function nextApply(
  current: Session,
  input: { requestId: string; skill: Skill; message: string },
  stamp: { id: string; createdAt: string },
): Session | null {
  if (roleOf(current) !== "worker") return null;
  const userId = currentUserId(current);
  const request = listRequests(current).find((item) => item.id === input.requestId);
  if (!request || request.status !== "open" || request.userId === userId) return null;
  if (!request.skills.includes(input.skill)) return null;
  const existing = listApplications(current).find(
    (item) =>
      item.requestId === input.requestId &&
      item.workerId === userId &&
      item.status !== "declined",
  );
  if (existing) return null;
  const application: Application = {
    id: stamp.id,
    requestId: input.requestId,
    projectId: null,
    workerId: userId,
    skill: input.skill,
    message: input.message.trim().slice(0, 200),
    origin: "applied",
    status: "waiting",
    createdAt: stamp.createdAt,
  };
  return { ...current, applications: [...current.applications, application] };
}

function nextInvite(
  current: Session,
  requestId: string,
  workerId: string,
  stamp: { id: string; createdAt: string },
): Session | null {
  const userId = currentUserId(current);
  const request = listRequests(current).find((item) => item.id === requestId);
  if (!request || request.userId !== userId || request.status !== "open") return null;
  const post = listAvailability(current).find(
    (item) => item.userId === workerId && item.skills.some((skill) => request.skills.includes(skill)),
  );
  const skill = post ? request.skills.find((item) => post.skills.includes(item)) : undefined;
  if (!skill) return null;
  const existing = listApplications(current).find(
    (item) => item.requestId === requestId && item.workerId === workerId && item.status !== "declined",
  );
  if (existing) return null;
  const application: Application = {
    id: stamp.id,
    requestId,
    projectId: null,
    workerId,
    skill,
    message: "",
    origin: "invited",
    status: "waiting",
    createdAt: stamp.createdAt,
  };
  return { ...current, applications: [...current.applications, application] };
}

function nextApplicationStatus(
  current: Session,
  id: string,
  status: "accepted" | "declined",
): Session | null {
  const application = listApplications(current).find((item) => item.id === id);
  if (!application || application.status !== "waiting") return null;
  const userId = currentUserId(current);
  const applicationStatus = { ...current.applicationStatus, [id]: status };

  if (application.projectId && !application.requestId) {
    const project = listProjects(current).find((item) => item.id === application.projectId);
    if (!project || project.organizerId !== userId) return null;
    if (application.origin !== "applied") return null;
    if (status === "declined" || project.team.includes(application.workerId)) {
      return { ...current, applicationStatus };
    }
    const existing = current.teamAdds[project.id] ?? [];
    if (existing.includes(application.workerId)) {
      return { ...current, applicationStatus };
    }
    return {
      ...current,
      applicationStatus,
      teamAdds: {
        ...current.teamAdds,
        [project.id]: [...existing, application.workerId],
      },
    };
  }

  if (!application.requestId) return null;
  const request = baseRequest(current, application.requestId);
  const shown = listRequests(current).find((item) => item.id === application.requestId);
  if (!request || !shown) return null;
  const owner = request.userId === userId;
  const invitedWorker = application.workerId === userId && application.origin === "invited";
  if (owner) {
    if (application.origin !== "applied") return null;
  } else if (!invitedWorker) {
    return null;
  }
  if (status === "accepted") {
    const filled = acceptedCount(listApplications(current), request.id);
    if (shown.status !== "open" || filled >= request.workersNeeded) return null;
  }
  const nextApplications = listApplications({ ...current, applicationStatus });
  return {
    ...current,
    applicationStatus,
    requestStatus: {
      ...current.requestStatus,
      [request.id]: statusForTeam(shown, nextApplications),
    },
  };
}

function nextWithdraw(current: Session, id: string): Session | null {
  const application = listApplications(current).find((item) => item.id === id);
  if (!application || application.status !== "waiting") return null;
  if (application.workerId !== currentUserId(current)) return null;
  const withdrawnIds = current.withdrawnIds.includes(id)
    ? current.withdrawnIds
    : [...current.withdrawnIds, id];
  const next = { ...current, withdrawnIds };
  if (!application.requestId) return next;
  const request = listRequests(current).find((item) => item.id === application.requestId);
  if (!request) return next;
  return {
    ...next,
    requestStatus: {
      ...current.requestStatus,
      [request.id]: statusForTeam(request, listApplications(next)),
    },
  };
}

function nextAsk(
  current: Session,
  projectId: string,
  stamp: { id: string; createdAt: string },
): Session | null {
  if (roleOf(current) !== "worker") return null;
  const userId = currentUserId(current);
  const project = listProjects(current).find((item) => item.id === projectId);
  if (!project || !project.organizerId || project.team.includes(userId) || project.organizerId === userId) {
    return null;
  }
  const existing = listApplications(current).find(
    (item) => item.projectId === projectId && item.workerId === userId && item.status !== "declined",
  );
  if (existing) return null;
  const mine = workerSkills(current);
  const skill = project.needs.find((item) => mine.includes(item)) ?? mine[0] ?? project.needs[0];
  if (!skill) return null;
  const application: Application = {
    id: stamp.id,
    requestId: null,
    projectId,
    workerId: userId,
    skill,
    message: "",
    origin: "applied",
    status: "waiting",
    createdAt: stamp.createdAt,
  };
  return { ...current, applications: [...current.applications, application] };
}

function workerSkills(session: Session): Skill[] {
  const sample = session.mode === "sample" && session.sampleId ? getUser(session.sampleId) : undefined;
  if (sample?.role === "worker") {
    return [sample.skill, ...sample.extraSkills].filter((item): item is Skill => Boolean(item));
  }
  return [session.flow?.skill, ...(session.flow?.extraSkills ?? [])].filter(
    (item): item is Skill => Boolean(item),
  );
}

function roleOf(session: Session): PathChoice | null {
  const sample = session.mode === "sample" && session.sampleId ? getUser(session.sampleId) : undefined;
  return sample?.role ?? session.path;
}

function applyPath(session: Session, path: PathChoice): Session {
  const sample = session.sampleId ? getUser(session.sampleId) : undefined;
  const mismatch = session.mode === "sample" && sample && sample.role !== path;
  return {
    ...session,
    path,
    mode: mismatch ? "new" : session.mode,
    sampleId: mismatch ? null : session.sampleId,
  };
}

export type DemoValue = {
  ready: boolean;
  saving: boolean;
  userId: string;
  name: string;
  verified: boolean;
  role: PathChoice | null;
  path: PathChoice | null;
  flow: Flow | null;
  homeCountryId: string | null;
  homeParishId: string | null;
  homeTownId: string | null;
  homeSkill: Skill | null;
  homeExtraSkills: Skill[];
  proof: Proof | null;
  proofLabel: string | null;
  commitments: Commitment[];
  contributions: Contribution[];
  addedCommitments: Commitment[];
  requests: CapitalRequest[];
  applications: Application[];
  availability: Availability[];
  projects: Project[];
  addedRequests: CapitalRequest[];
  addedApplications: Application[];
  addedAvailability: Availability[];
  openedProject: boolean;
  investorBasicsDone: boolean;
  learningSeen: string[];
  learningDone: string[];
  weeks: WeekPlan[];
  wallets: Wallet[];
  projectWallets: ProjectWallet[];
  payments: Payment[];
  markLessonsSeen: (ids: string[]) => void;
  passInvestorBasics: () => void;
  saveWeek: (input: { projectId: string; goal: string; stepOne: string; stepTwo: string }) => boolean;
  closeWeek: (input: { id: string; status: "done" | "not-done"; happened: string }) => boolean;
  startPath: (path: PathChoice) => void;
  updateFlow: (patch: Partial<Flow>) => void;
  setProof: (proof: Proof | null) => void;
  setDisplayName: (name: string) => void | Promise<void>;
  addCommitment: (commitment: Commitment) => Promise<boolean>;
  addContribution: (contribution: Contribution) => Promise<boolean>;
  addRequest: (draft: RequestDraft) => Promise<string | null>;
  applyToRequest: (input: { requestId: string; skill: Skill; message: string }) => Promise<boolean>;
  inviteWorker: (requestId: string, workerId: string) => Promise<boolean>;
  setApplicationStatus: (id: string, status: "accepted" | "declined") => Promise<boolean>;
  addAvailability: (draft: AvailabilityDraft) => Promise<string | null>;
  withdrawApplication: (id: string) => Promise<boolean>;
  startProject: (requestId: string, name: string) => Promise<string | null>;
  setReadiness: (input: { requestId?: string | null; projectId?: string | null; readiness: Readiness }) => Promise<boolean>;
  askToJoin: (projectId: string) => Promise<boolean>;
  markOpened: () => void;
  useSample: (id: string) => void;
  useNewPerson: () => void;
  reset: () => void;
};

export const DemoContext = createContext<DemoValue | null>(null);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session>(initialSession);
  const [ready, setReady] = useState(false);
  const sessionRef = useRef(session);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    // Load this phone's demo after mount so the server HTML matches the first paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(loadSession());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const payload: Persisted = { version: 4, session };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [ready, session]);

  const startPath = useCallback((path: PathChoice) => {
    setSession((current) => applyPath(current, path));
  }, []);

  const updateFlow = useCallback((patch: Partial<Flow>) => {
    setSession((current) => ({
      ...current,
      flow: {
        ...current.flow,
        ...patch,
        extraSkills: patch.extraSkills ?? current.flow?.extraSkills ?? [],
      },
    }));
  }, []);

  const setDisplayName = useCallback((name: string) => {
    setSession((current) => ({ ...current, displayName: name.trim() }));
  }, []);

  const addCommitment = useCallback(async (commitment: Commitment) => {
    setSession((current) => ({
      ...current,
      commitments: [...current.commitments, commitment],
    }));
    return true;
  }, []);

  const addContribution = useCallback(async (contribution: Contribution) => {
    const seen = listProjects(sessionRef.current).find((item) => item.id === contribution.projectId);
    if (contribution.userId !== currentUserId(sessionRef.current)) return false;
    if (!seen || !seen.team.includes(contribution.userId)) return false;
    setSession((current) => {
      if (contribution.userId !== currentUserId(current)) return current;
      const project = listProjects(current).find((item) => item.id === contribution.projectId);
      if (!project || !project.team.includes(contribution.userId)) return current;
      return { ...current, contributions: [...current.contributions, contribution] };
    });
    return true;
  }, []);

  const addRequest = useCallback(async (draft: RequestDraft) => {
    if (
      roleOf(sessionRef.current) === "worker" ||
      !askedPlace(draft.countryId, draft.parishId, draft.townId) ||
      !(draft.budget > 0) ||
      !Number.isInteger(draft.workersNeeded) ||
      draft.workersNeeded < 1 ||
      draft.workersNeeded > 10 ||
      draft.skills.length === 0 ||
      !kindById(draft.sector, draft.kind) ||
      !isSite(draft.site) ||
      !cleanReadiness(draft.readiness)
    ) {
      return null;
    }
    const id = crypto.randomUUID();
    const readiness = cleanReadiness(draft.readiness) ?? {};
    setSession((current) => {
      if (roleOf(current) === "worker") return current;
      const request: CapitalRequest = {
        id,
        userId: currentUserId(current),
        countryId: draft.countryId,
        parishId: draft.parishId,
        townId: draft.townId,
        sector: draft.sector,
        budget: draft.budget,
        workersNeeded: draft.workersNeeded,
        skills: [...draft.skills],
        note: draft.note.trim().slice(0, 240),
        status: "open",
        projectId: null,
        createdAt: new Date().toISOString(),
        kind: draft.kind,
        site: draft.site,
        readiness,
      };
      return { ...current, requests: [...current.requests, request] };
    });
    return id;
  }, []);

  const applyToRequest = useCallback(
    async (input: { requestId: string; skill: Skill; message: string }) => {
      const stamp = { id: crypto.randomUUID(), createdAt: new Date().toISOString() };
      return writeDecision(sessionRef, setSession, (current) => nextApply(current, input, stamp));
    },
    [],
  );

  const inviteWorker = useCallback(async (requestId: string, workerId: string) => {
    const stamp = { id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    return writeDecision(sessionRef, setSession, (current) =>
      nextInvite(current, requestId, workerId, stamp),
    );
  }, []);

  const setApplicationStatus = useCallback(async (id: string, status: "accepted" | "declined") => {
    return writeDecision(sessionRef, setSession, (current) => nextApplicationStatus(current, id, status));
  }, []);

  const addAvailability = useCallback(async (draft: AvailabilityDraft) => {
    if (
      roleOf(sessionRef.current) === "investor" ||
      !askedPlace(draft.countryId, draft.parishId, draft.townId) ||
      draft.skills.length === 0
    ) {
      return null;
    }
    const id = crypto.randomUUID();
    setSession((current) => {
      if (roleOf(current) === "investor") return current;
      const post: Availability = {
        id,
        userId: currentUserId(current),
        countryId: draft.countryId,
        parishId: draft.parishId,
        townId: draft.townId,
        skills: [...draft.skills],
        note: draft.note.trim().slice(0, 240),
        createdAt: new Date().toISOString(),
      };
      return { ...current, availability: [...current.availability, post] };
    });
    return id;
  }, []);

  const withdrawApplication = useCallback(async (id: string) => {
    return writeDecision(sessionRef, setSession, (current) => nextWithdraw(current, id));
  }, []);

  const startProject = useCallback(async (requestId: string, name: string) => {
    const trimmed = name.trim().slice(0, 80);
    if (!trimmed) return null;
    const seen = listRequests(sessionRef.current).find((item) => item.id === requestId);
    if (
      !seen ||
      seen.userId !== currentUserId(sessionRef.current) ||
      seen.status !== "team-ready" ||
      seen.projectId
    ) {
      return null;
    }
    const id = crypto.randomUUID();
    setSession((current) => {
      const shown = listRequests(current).find((item) => item.id === requestId);
      if (!shown || shown.userId !== currentUserId(current) || shown.status !== "team-ready" || shown.projectId) {
        return current;
      }
      const accepted = listApplications(current).filter(
        (item) => item.requestId === requestId && item.status === "accepted",
      );
      const town = shown.parishId
        ? getTown(shown.parishId, shown.townId)
        : getCity(shown.countryId, shown.townId);
      const placeName = town?.name ?? "this place";
      const project: Project = {
        id,
        name: trimmed,
        countryId: shown.countryId,
        parishId: shown.parishId,
        townId: shown.townId,
        sector: shown.sector,
        summary: shown.note || `Work on this in ${placeName}.`,
        whatYouGet:
          "A part of this project, recorded as ownership units if the organizer accepts your money.",
        goalJmd: shown.budget,
        committedJmd: 0,
        workersMatched: accepted.length,
        workersNeeded: accepted.length,
        weeklyPayout: sectorWeekly(shown.sector),
        workStarted: false,
        organizerName: personName(current),
        organizerId: currentUserId(current),
        needs: [...shown.skills],
        checks: openChecks(shown.sector, shown.countryId === "jamaica"),
        team: accepted.map((item) => item.workerId),
        mentorName: null,
        kind: shown.kind ?? null,
        site: shown.site ?? null,
        readiness: shown.readiness ?? {},
      };
      const commitment: Commitment = {
        id: crypto.randomUUID(),
        userId: currentUserId(current),
        projectId: id,
        amountJmd: shown.budget,
        status: "pledged",
        createdAt: new Date().toISOString(),
      };
      return {
        ...current,
        projects: [...current.projects, project],
        commitments: [...current.commitments, commitment],
        requestProjects: { ...current.requestProjects, [requestId]: id },
        requestStatus: { ...current.requestStatus, [requestId]: "closed" },
        openedProject: true,
      };
    });
    return id;
  }, []);

  const setReadiness = useCallback(
    async (input: { requestId?: string | null; projectId?: string | null; readiness: Readiness }) => {
      const readiness = cleanReadiness(input.readiness);
      if (!readiness) return false;
      const userId = currentUserId(sessionRef.current);
      const requests = listRequests(sessionRef.current);
      const projects = listProjects(sessionRef.current);
      const request = input.requestId ? requests.find((item) => item.id === input.requestId) : undefined;
      const project = input.projectId
        ? projects.find((item) => item.id === input.projectId)
        : request?.projectId
          ? projects.find((item) => item.id === request.projectId)
          : undefined;
      const ownsRequest = Boolean(request && request.userId === userId);
      const ownsProject = Boolean(project && project.organizerId === userId);
      if (input.requestId && !ownsRequest) return false;
      if (!input.requestId && input.projectId && !ownsProject) return false;
      if (!ownsRequest && !ownsProject) return false;
      setSession((current) => {
        const nextRequests = current.requests.map((item) => {
          const sameRequest = request && item.id === request.id && item.userId === userId;
          const linked = project && item.projectId === project.id && item.userId === userId;
          if (!sameRequest && !linked) return item;
          return { ...item, readiness };
        });
        const requestInSession = request ? current.requests.some((item) => item.id === request.id) : true;
        const addedRequest =
          request && ownsRequest && !requestInSession
            ? [...nextRequests, { ...request, readiness }]
            : nextRequests;
        const nextProjects = current.projects.map((item) => {
          if (!project || item.id !== project.id || item.organizerId !== userId) return item;
          return { ...item, readiness };
        });
        const projectInSession = project ? current.projects.some((item) => item.id === project.id) : true;
        const addedProject =
          project && ownsProject && !projectInSession
            ? [...nextProjects, { ...project, readiness }]
            : nextProjects;
        return { ...current, requests: addedRequest, projects: addedProject };
      });
      return true;
    },
    [],
  );

  const askToJoin = useCallback(async (projectId: string) => {
    const stamp = { id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    return writeDecision(sessionRef, setSession, (current) => nextAsk(current, projectId, stamp));
  }, []);

  const markOpened = useCallback(() => {
    setSession((current) =>
      current.openedProject ? current : { ...current, openedProject: true },
    );
  }, []);

  const markLessonsSeen = useCallback((ids: string[]) => {
    setSession((current) => {
      const progress = seeLessons(current.progress, currentUserId(current), ids);
      if (progress === current.progress) return current;
      return { ...current, progress };
    });
  }, []);

  const passInvestorBasics = useCallback(() => {
    setSession((current) => {
      const progress = passBasics(current.progress, currentUserId(current), investorBasicsIds());
      if (progress === current.progress) return current;
      return { ...current, progress };
    });
  }, []);

  const saveWeek = useCallback((input: { projectId: string; goal: string; stepOne: string; stepTwo: string }) => {
    let saved = false;
    setSession((current) => {
      const userId = currentUserId(current);
      const project = listProjects(current).find((item) => item.id === input.projectId);
      if (!project || project.organizerId !== userId) return current;
      let progress = openWeek(current.progress, {
        id: crypto.randomUUID(),
        projectId: input.projectId,
        goal: input.goal,
        stepOne: input.stepOne,
        stepTwo: input.stepTwo,
        createdAt: new Date().toISOString(),
      });
      if (progress === current.progress) return current;
      saved = true;
      const match = stageLessons(project.sector, project.workStarted).find(
        (lesson) => lesson.action === input.goal.trim(),
      );
      if (match) progress = finishLessons(progress, userId, [match.id]);
      return { ...current, progress };
    });
    return saved;
  }, []);

  const closeWeek = useCallback((input: { id: string; status: "done" | "not-done"; happened: string }) => {
    let saved = false;
    setSession((current) => {
      const week = current.progress.weeks.find((item) => item.id === input.id && item.status === "open");
      const project = week ? listProjects(current).find((item) => item.id === week.projectId) : undefined;
      if (!week || !project || project.organizerId !== currentUserId(current)) return current;
      const progress = closeWeekPlan(current.progress, input);
      if (progress === current.progress) return current;
      saved = true;
      return { ...current, progress };
    });
    return saved;
  }, []);

  const useSample = useCallback((id: string) => {
    const user = getUser(id);
    if (!user) return;
    setSession((current) => ({
      ...current,
      mode: "sample",
      sampleId: id,
      path: user.role,
    }));
  }, []);

  const useNewPerson = useCallback(() => {
    setSession((current) => ({
      ...current,
      mode: "new",
      sampleId: null,
    }));
  }, []);

  const reset = useCallback(() => {
    setSession(initialSession);
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(V3_KEY);
    window.localStorage.removeItem(V2_KEY);
    window.localStorage.removeItem(V1_KEY);
  }, []);

  const value = useMemo<DemoValue>(() => {
    const sample =
      session.mode === "sample" && session.sampleId
        ? getUser(session.sampleId)
        : undefined;
    const userId = sample?.id ?? "you";
    const name = sample?.name || session.displayName || "You";
    const role = sample?.role ?? session.path;
    const proof = session.proofs[userId] ?? null;
    const commitments = [
      ...seedCommitments().filter((item) => item.userId === userId),
      ...session.commitments.filter((item) => item.userId === userId),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const contributions = [
      ...seedContributions().filter((item) => item.userId === userId),
      ...session.contributions.filter((item) => item.userId === userId),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return {
      ready,
      saving: false,
      userId,
      name,
      verified: sample?.verified ?? false,
      role,
      path: session.path,
      flow: session.flow,
      homeCountryId: sample?.countryId ?? null,
      homeParishId: sample?.parishId ?? null,
      homeTownId: sample?.townId ?? null,
      homeSkill: sample?.skill ?? null,
      homeExtraSkills: sample?.extraSkills ?? [],
      proof,
      proofLabel: sample?.proofLabel ?? null,
      commitments,
      contributions,
      addedCommitments: session.commitments,
      requests: listRequests(session),
      applications: listApplications(session),
      availability: listAvailability(session),
      projects: listProjects(session),
      addedRequests: session.requests,
      addedApplications: session.applications,
      addedAvailability: session.availability,
      openedProject: session.openedProject,
      investorBasicsDone: session.progress.byUser[userId]?.basics === true,
      learningSeen: session.progress.byUser[userId]?.seen ?? [],
      learningDone: session.progress.byUser[userId]?.done ?? [],
      weeks: session.progress.weeks,
      wallets: [],
      projectWallets: [],
      payments: [],
      markLessonsSeen,
      passInvestorBasics,
      saveWeek,
      closeWeek,
      startPath,
      updateFlow,
      setProof: (proofNext) => {
        setSession((current) => {
          const id =
            current.mode === "sample" && current.sampleId ? current.sampleId : "you";
          const proofs = { ...current.proofs };
          if (proofNext) proofs[id] = proofNext;
          else delete proofs[id];
          return { ...current, proofs };
        });
      },
      setDisplayName,
      addCommitment,
      addContribution,
      addRequest,
      applyToRequest,
      inviteWorker,
      setApplicationStatus,
      addAvailability,
      withdrawApplication,
      startProject,
      setReadiness,
      askToJoin,
      markOpened,
      useSample,
      useNewPerson,
      reset,
    };
  }, [
    addAvailability,
    addCommitment,
    addContribution,
    addRequest,
    applyToRequest,
    inviteWorker,
    markOpened,
    markLessonsSeen,
    passInvestorBasics,
    saveWeek,
    closeWeek,
    ready,
    reset,
    session,
    askToJoin,
    setApplicationStatus,
    setDisplayName,
    startPath,
    startProject,
    setReadiness,
    updateFlow,
    useNewPerson,
    useSample,
    withdrawApplication,
  ]);

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoValue {
  const value = useContext(DemoContext);
  if (!value) throw new Error("useDemo must be used inside DemoProvider.");
  return value;
}
