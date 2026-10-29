import { getProjects, seedApplications, seedAvailability, seedRequests } from "@/lib/seed";
import type {
  Application,
  ApplicationStatus,
  Availability,
  CapitalRequest,
  PathChoice,
  Project,
  RequestStatus,
} from "@/lib/types";

export type RequestSession = {
  requests: CapitalRequest[];
  applications: Application[];
  availability: Availability[];
  projects: Project[];
  requestProjects: Record<string, string>;
  teamAdds: Record<string, string[]>;
  requestStatus: Record<string, RequestStatus>;
  applicationStatus: Record<string, ApplicationStatus>;
  withdrawnIds: string[];
};

function mergeById<T extends { id: string }>(base: T[], added: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of base) map.set(item.id, item);
  for (const item of added) map.set(item.id, item);
  return [...map.values()];
}

export function listRequests(session: RequestSession): CapitalRequest[] {
  return mergeById(seedRequests(), session.requests)
    .map((request) => {
      const projectId = session.requestProjects?.[request.id] ?? request.projectId;
      const status = projectId ? "closed" : session.requestStatus?.[request.id] ?? request.status;
      if (status === request.status && projectId === request.projectId) return request;
      return { ...request, status, projectId };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listProjects(session: RequestSession): Project[] {
  return mergeById(getProjects(), session.projects).map((project) => {
    const extra = (session.teamAdds?.[project.id] ?? []).filter((id) => !project.team.includes(id));
    if (extra.length === 0) return project;
    return {
      ...project,
      team: [...project.team, ...extra],
      workersMatched: project.workersMatched + extra.length,
    };
  });
}

export function listApplications(session: RequestSession): Application[] {
  const withdrawn = new Set(session.withdrawnIds);
  return mergeById(seedApplications(), session.applications)
    .filter((item) => !withdrawn.has(item.id))
    .map((item) => {
      const status = session.applicationStatus[item.id];
      if (!status || status === item.status) return item;
      return { ...item, status };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listAvailability(session: RequestSession): Availability[] {
  return mergeById(seedAvailability(), session.availability).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function baseRequest(session: RequestSession, id: string): CapitalRequest | undefined {
  return mergeById(seedRequests(), session.requests).find((item) => item.id === id);
}

export function acceptedCount(applications: Application[], requestId: string): number {
  return applications.filter((item) => item.requestId === requestId && item.status === "accepted")
    .length;
}

export function waitingCount(applications: Application[], requestId: string): number {
  return applications.filter(
    (item) => item.requestId === requestId && item.origin === "applied" && item.status === "waiting",
  ).length;
}

// Later, not in this pass:
// - Messages between an investor and a worker.
// - Push notifications when someone applies, is invited, or accepts.
// - More than one investor funding the same request.
export function statusForTeam(request: CapitalRequest, applications: Application[]): RequestStatus {
  if (request.status === "closed" || request.projectId) return "closed";
  if (acceptedCount(applications, request.id) >= request.workersNeeded) return "team-ready";
  return "open";
}

export function youHasUpdate(
  role: PathChoice | null,
  userId: string,
  requests: CapitalRequest[],
  applications: Application[],
  projects: Project[],
): boolean {
  if (role === "investor") {
    const requestIds = new Set(requests.filter((item) => item.userId === userId).map((item) => item.id));
    const projectIds = new Set(
      projects.filter((item) => item.organizerId === userId).map((item) => item.id),
    );
    return applications.some(
      (item) =>
        item.origin === "applied" &&
        item.status === "waiting" &&
        ((item.requestId !== null && requestIds.has(item.requestId)) ||
          (item.projectId !== null && projectIds.has(item.projectId))),
    );
  }
  if (role === "worker") {
    return applications.some(
      (item) => item.workerId === userId && item.origin === "invited" && item.status === "waiting",
    );
  }
  return false;
}
