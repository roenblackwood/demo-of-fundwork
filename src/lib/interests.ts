export type InterestKind = "commit" | "join" | "send";

export type CapitalInterest = {
  id: string;
  userId: string;
  projectId: string | null;
  requestId: string | null;
  amount: number | null;
  kind: InterestKind;
  createdAt: string;
};

export type InterestDraft = {
  projectId: string | null;
  requestId: string | null;
  amount: number | null;
  kind: InterestKind;
};

function cleanAmount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) return null;
  return Math.round(value);
}

export function cleanInterests(value: unknown): CapitalInterest[] {
  if (!Array.isArray(value)) return [];
  const out: CapitalInterest[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const item = row as Partial<CapitalInterest>;
    if (typeof item.id !== "string" || typeof item.userId !== "string") continue;
    if (item.kind !== "commit" && item.kind !== "join" && item.kind !== "send") continue;
    const projectId = typeof item.projectId === "string" && item.projectId ? item.projectId : null;
    const requestId = typeof item.requestId === "string" && item.requestId ? item.requestId : null;
    if (!projectId && !requestId) continue;
    out.push({
      id: item.id,
      userId: item.userId,
      projectId,
      requestId,
      amount: cleanAmount(item.amount),
      kind: item.kind,
      createdAt: typeof item.createdAt === "string" ? item.createdAt : "",
    });
  }
  return out;
}
