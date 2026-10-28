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
import {
  baseRequest,
  listApplications,
  listAvailability,
  listRequests,
  statusForTeam,
} from "@/lib/requests";
import { askedPlace, getUser, seedCommitments, seedContributions } from "@/lib/seed";
import type { RegionId } from "@/lib/regions";
import type {
  Application,
  Availability,
  CapitalRequest,
  Commitment,
  Contribution,
  PathChoice,
  Sector,
  Skill,
} from "@/lib/types";

const STORAGE_KEY = "fundwork-demo-v2";
const LEGACY_KEY = "fundwork-demo-v1";

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
  requestStatus: Record<string, CapitalRequest["status"]>;
  applicationStatus: Record<string, Application["status"]>;
  withdrawnIds: string[];
  openedProject: boolean;
};

type Persisted = {
  version: 1 | 2;
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
  requestStatus: {},
  applicationStatus: {},
  withdrawnIds: [],
  openedProject: false,
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
    requests: Array.isArray(input.requests) ? input.requests : [],
    applications: Array.isArray(input.applications) ? input.applications : [],
    availability: Array.isArray(input.availability) ? input.availability : [],
    requestStatus: input.requestStatus ?? {},
    applicationStatus: input.applicationStatus ?? {},
    withdrawnIds: Array.isArray(input.withdrawnIds) ? input.withdrawnIds : [],
    openedProject: input.openedProject ?? false,
    path: input.path ?? null,
    sampleId: input.sampleId ?? null,
    displayName: input.displayName ?? "",
  };
}

function readPayload(raw: string | null): Persisted | null {
  if (!raw) return null;
  const parsed = JSON.parse(raw) as Persisted;
  if (!parsed || (parsed.version !== 1 && parsed.version !== 2) || !isSession(parsed.session)) {
    return null;
  }
  return parsed;
}

function loadSession(): Session {
  if (typeof window === "undefined") return initialSession;
  try {
    const current = readPayload(window.localStorage.getItem(STORAGE_KEY));
    if (current?.version === 2) return normalize(current.session);
    if (window.localStorage.getItem(STORAGE_KEY)) return initialSession;
    const legacy = readPayload(window.localStorage.getItem(LEGACY_KEY));
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

type DemoValue = {
  ready: boolean;
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
  addedRequests: CapitalRequest[];
  addedApplications: Application[];
  addedAvailability: Availability[];
  openedProject: boolean;
  startPath: (path: PathChoice) => void;
  updateFlow: (patch: Partial<Flow>) => void;
  setProof: (proof: Proof | null) => void;
  setDisplayName: (name: string) => void;
  addCommitment: (commitment: Commitment) => void;
  addContribution: (contribution: Contribution) => void;
  addRequest: (draft: RequestDraft) => string | null;
  applyToRequest: (input: { requestId: string; skill: Skill; message: string }) => void;
  inviteWorker: (requestId: string, workerId: string) => void;
  setApplicationStatus: (id: string, status: "accepted" | "declined") => void;
  addAvailability: (draft: AvailabilityDraft) => string | null;
  withdrawApplication: (id: string) => void;
  markOpened: () => void;
  useSample: (id: string) => void;
  useNewPerson: () => void;
  reset: () => void;
};

const DemoContext = createContext<DemoValue | null>(null);

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
    const payload: Persisted = { version: 2, session };
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

  const addCommitment = useCallback((commitment: Commitment) => {
    setSession((current) => ({
      ...current,
      commitments: [...current.commitments, commitment],
    }));
  }, []);

  const addContribution = useCallback((contribution: Contribution) => {
    setSession((current) => ({
      ...current,
      contributions: [...current.contributions, contribution],
    }));
  }, []);

  const addRequest = useCallback((draft: RequestDraft) => {
    if (
      roleOf(sessionRef.current) === "worker" ||
      !askedPlace(draft.countryId, draft.parishId, draft.townId) ||
      !(draft.budget > 0) ||
      !Number.isInteger(draft.workersNeeded) ||
      draft.workersNeeded < 1 ||
      draft.workersNeeded > 10 ||
      draft.skills.length === 0
    ) {
      return null;
    }
    const id = crypto.randomUUID();
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
        createdAt: new Date().toISOString(),
      };
      return { ...current, requests: [...current.requests, request] };
    });
    return id;
  }, []);

  const applyToRequest = useCallback(
    (input: { requestId: string; skill: Skill; message: string }) => {
      setSession((current) => {
        if (roleOf(current) !== "worker") return current;
        const userId = currentUserId(current);
        const request = listRequests(current).find((item) => item.id === input.requestId);
        if (!request || request.status !== "open" || request.userId === userId) return current;
        if (!request.skills.includes(input.skill)) return current;
        const existing = listApplications(current).find(
          (item) =>
            item.requestId === input.requestId &&
            item.workerId === userId &&
            item.status !== "declined",
        );
        if (existing) return current;
        const application: Application = {
          id: crypto.randomUUID(),
          requestId: input.requestId,
          workerId: userId,
          skill: input.skill,
          message: input.message.trim().slice(0, 200),
          origin: "applied",
          status: "waiting",
          createdAt: new Date().toISOString(),
        };
        return { ...current, applications: [...current.applications, application] };
      });
    },
    [],
  );

  const inviteWorker = useCallback((requestId: string, workerId: string) => {
    setSession((current) => {
      const userId = currentUserId(current);
      const request = listRequests(current).find((item) => item.id === requestId);
      if (!request || request.userId !== userId || request.status !== "open") return current;
      const post = listAvailability(current).find(
        (item) => item.userId === workerId && item.skills.some((skill) => request.skills.includes(skill)),
      );
      const skill = post ? request.skills.find((item) => post.skills.includes(item)) : undefined;
      if (!skill) return current;
      const existing = listApplications(current).find(
        (item) => item.requestId === requestId && item.workerId === workerId && item.status !== "declined",
      );
      if (existing) return current;
      const application: Application = {
        id: crypto.randomUUID(),
        requestId,
        workerId,
        skill,
        message: "",
        origin: "invited",
        status: "waiting",
        createdAt: new Date().toISOString(),
      };
      return { ...current, applications: [...current.applications, application] };
    });
  }, []);

  const setApplicationStatus = useCallback((id: string, status: "accepted" | "declined") => {
    setSession((current) => {
      const application = listApplications(current).find((item) => item.id === id);
      if (!application || application.status !== "waiting") return current;
      const request = baseRequest(current, application.requestId);
      if (!request || request.status === "closed") return current;
      const userId = currentUserId(current);
      const owner = request.userId === userId;
      const invitedWorker = application.workerId === userId && application.origin === "invited";
      if (owner) {
        if (application.origin !== "applied") return current;
      } else if (!invitedWorker) {
        return current;
      }
      const applicationStatus = { ...current.applicationStatus, [id]: status };
      const nextApplications = listApplications({ ...current, applicationStatus });
      const requestStatus = {
        ...current.requestStatus,
        [request.id]: statusForTeam(request, nextApplications),
      };
      return { ...current, applicationStatus, requestStatus };
    });
  }, []);

  const addAvailability = useCallback((draft: AvailabilityDraft) => {
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

  const withdrawApplication = useCallback((id: string) => {
    setSession((current) => {
      const application = listApplications(current).find((item) => item.id === id);
      if (!application || application.status !== "waiting") return current;
      if (application.workerId !== currentUserId(current)) return current;
      const withdrawnIds = current.withdrawnIds.includes(id)
        ? current.withdrawnIds
        : [...current.withdrawnIds, id];
      const next = { ...current, withdrawnIds };
      const request = baseRequest(current, application.requestId);
      if (!request) return next;
      return {
        ...next,
        requestStatus: {
          ...current.requestStatus,
          [request.id]: statusForTeam(request, listApplications(next)),
        },
      };
    });
  }, []);

  const markOpened = useCallback(() => {
    setSession((current) =>
      current.openedProject ? current : { ...current, openedProject: true },
    );
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
    window.localStorage.removeItem(LEGACY_KEY);
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
      addedRequests: session.requests,
      addedApplications: session.applications,
      addedAvailability: session.availability,
      openedProject: session.openedProject,
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
    ready,
    reset,
    session,
    setApplicationStatus,
    setDisplayName,
    startPath,
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
