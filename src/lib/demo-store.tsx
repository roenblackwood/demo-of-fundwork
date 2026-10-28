"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getUser, seedCommitments, seedContributions } from "@/lib/seed";
import type { RegionId } from "@/lib/regions";
import type {
  Commitment,
  Contribution,
  PathChoice,
  Sector,
  Skill,
} from "@/lib/types";

const STORAGE_KEY = "fundwork-demo-v1";

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
  openedProject: boolean;
};

type Persisted = {
  version: 1;
  session: Session;
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
  openedProject: false,
};

function isSession(value: unknown): value is Session {
  if (!value || typeof value !== "object") return false;
  const session = value as Session;
  return (
    (session.mode === "new" || session.mode === "sample") &&
    Array.isArray(session.commitments) &&
    Array.isArray(session.contributions) &&
    session.proofs !== null &&
    typeof session.proofs === "object"
  );
}

function loadSession(): Session {
  if (typeof window === "undefined") return initialSession;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialSession;
    const parsed = JSON.parse(raw) as Persisted;
    if (parsed.version !== 1 || !isSession(parsed.session)) return initialSession;
    return {
      ...initialSession,
      ...parsed.session,
      flow: parsed.session.flow
        ? {
            ...parsed.session.flow,
            extraSkills: parsed.session.flow.extraSkills ?? [],
          }
        : null,
      proofs: parsed.session.proofs ?? {},
    };
  } catch {
    return initialSession;
  }
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
  openedProject: boolean;
  startPath: (path: PathChoice) => void;
  updateFlow: (patch: Partial<Flow>) => void;
  setProof: (proof: Proof | null) => void;
  setDisplayName: (name: string) => void;
  addCommitment: (commitment: Commitment) => void;
  addContribution: (contribution: Contribution) => void;
  markOpened: () => void;
  useSample: (id: string) => void;
  useNewPerson: () => void;
  reset: () => void;
};

const DemoContext = createContext<DemoValue | null>(null);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session>(initialSession);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Load this phone's demo after mount so the server HTML matches the first paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(loadSession());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const payload: Persisted = { version: 1, session };
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
      markOpened,
      useSample,
      useNewPerson,
      reset,
    };
  }, [
    addCommitment,
    addContribution,
    markOpened,
    ready,
    session,
    setDisplayName,
    startPath,
    updateFlow,
    useNewPerson,
    useSample,
    reset,
  ]);

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoValue {
  const value = useContext(DemoContext);
  if (!value) throw new Error("useDemo must be used inside DemoProvider.");
  return value;
}
