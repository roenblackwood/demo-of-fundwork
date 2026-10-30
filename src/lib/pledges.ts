import { moneyShort } from "@/lib/format";
import type { CapitalRequest, RequestPledge } from "@/lib/types";

export type PledgeResult = "ok" | "left" | "basics" | "closed" | "full" | "own" | "role" | "amount";

export type WithdrawResult = "ok" | "lead" | "started" | "own" | "missing";

export function activePledges(pledges: RequestPledge[], requestId: string): RequestPledge[] {
  return pledges.filter((item) => item.requestId === requestId && item.status === "pledged");
}

export function pledgedAmount(pledges: RequestPledge[], requestId: string): number {
  return activePledges(pledges, requestId).reduce((sum, item) => sum + item.amount, 0);
}

export function leftToPledge(budget: number, pledges: RequestPledge[], requestId: string): number {
  return Math.max(0, budget - pledgedAmount(pledges, requestId));
}

export function capitalSentence(
  pledged: number,
  budget: number,
  investors: number,
  currency: string,
): string {
  const count = investors === 1 ? "1 investor" : `${investors} investors`;
  return `${moneyShort(pledged, currency)} of ${moneyShort(budget, currency)} from ${count}`;
}

export function teamSentence(accepted: number, needed: number): string {
  return `${accepted} of ${needed} workers`;
}

export type BackerMark = {
  label: string;
  named: boolean;
};

export function backerMarks(
  request: Pick<CapitalRequest, "id" | "userId">,
  pledges: RequestPledge[],
  nameFor: (userId: string) => string,
): BackerMark[] {
  const rows = activePledges(pledges, request.id).sort((a, b) => {
    if (a.userId && a.userId === request.userId && b.userId !== request.userId) return -1;
    if (b.userId && b.userId === request.userId && a.userId !== request.userId) return 1;
    return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
  });
  return rows.map((row) => {
    if (!row.showName || !row.userId) return { label: "An investor", named: false };
    const name = nameFor(row.userId).trim();
    if (!name) return { label: "An investor", named: false };
    return { label: name, named: true };
  });
}

/** A request with no pledge rows gets the poster's full budget as the lead pledge. */
export function withLeadPledges(requests: CapitalRequest[], pledges: RequestPledge[]): RequestPledge[] {
  const seen = new Set(pledges.map((item) => item.requestId));
  const added: RequestPledge[] = [];
  for (const request of requests) {
    if (seen.has(request.id)) continue;
    seen.add(request.id);
    const closed = request.status === "closed" || Boolean(request.projectId);
    added.push({
      id: `lead-${request.id}`,
      requestId: request.id,
      userId: request.userId,
      amount: request.budget,
      status: closed ? "converted" : "pledged",
      showName: true,
      createdAt: request.createdAt,
    });
  }
  return [...pledges, ...added];
}

export function convertedBacking(
  projectId: string,
  requests: CapitalRequest[],
  pledges: RequestPledge[],
): number {
  const ids = new Set(requests.filter((item) => item.projectId === projectId).map((item) => item.id));
  return pledges.reduce((sum, item) => {
    if (!ids.has(item.requestId) || item.status !== "converted") return sum;
    return sum + item.amount;
  }, 0);
}

export function joinBlock(input: {
  role: string | null;
  basics: boolean;
  request: CapitalRequest | undefined;
  pledges: RequestPledge[];
  userId: string;
  amount: number;
}): PledgeResult | null {
  if (input.role !== "investor") return "role";
  if (!input.basics) return "basics";
  const request = input.request;
  if (!request || request.projectId || request.status === "closed") return "closed";
  if (request.status !== "open" && request.status !== "team-ready") return "closed";
  const active = activePledges(input.pledges, request.id);
  if (active.some((item) => item.userId === input.userId)) return "own";
  if (!(input.amount >= 1)) return "amount";
  const left = leftToPledge(request.budget, input.pledges, request.id);
  if (input.amount > left) return left > 0 ? "left" : "full";
  return null;
}

export function withdrawBlock(input: {
  request: CapitalRequest | undefined;
  pledges: RequestPledge[];
  userId: string;
  pledgeId: string;
}): WithdrawResult | null {
  const pledge = input.pledges.find((item) => item.id === input.pledgeId);
  if (!pledge || pledge.status !== "pledged") return "missing";
  if (pledge.userId !== input.userId) return "own";
  const request = input.request ?? undefined;
  if (!request || request.id !== pledge.requestId) return "missing";
  if (request.projectId) return "started";
  const others = activePledges(input.pledges, request.id).filter((item) => item.id !== pledge.id);
  if (pledge.userId === request.userId && others.length > 0) return "lead";
  return null;
}
