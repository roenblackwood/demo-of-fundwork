import { seedApplications, seedAvailability, seedRequests } from "@/lib/seed";
import type {
  Application,
  ApplicationStatus,
  Availability,
  CapitalRequest,
  PathChoice,
  RequestStatus,
} from "@/lib/types";

export type RequestSession = {
  requests: CapitalRequest[];
  applications: Application[];
  availability: Availability[];
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
      const status = session.requestStatus[request.id];
      if (!status || status === request.status) return request;
      return { ...request, status };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
// - A team-ready request can become a project.
// - The investor and the worker can message each other.
// - Push notifications when someone applies, is invited, or accepts.
export function statusForTeam(request: CapitalRequest, applications: Application[]): RequestStatus {
  if (request.status === "closed") return "closed";
  if (acceptedCount(applications, request.id) >= request.workersNeeded) return "team-ready";
  return "open";
}

export function youHasUpdate(
  role: PathChoice | null,
  userId: string,
  requests: CapitalRequest[],
  applications: Application[],
): boolean {
  if (role === "investor") {
    const mine = new Set(requests.filter((item) => item.userId === userId).map((item) => item.id));
    return applications.some(
      (item) => mine.has(item.requestId) && item.origin === "applied" && item.status === "waiting",
    );
  }
  if (role === "worker") {
    return applications.some(
      (item) => item.workerId === userId && item.origin === "invited" && item.status === "waiting",
    );
  }
  return false;
}
