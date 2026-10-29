import { isSector, sectorWeekly } from "@/lib/catalog";
import { starterGuide, workerGuide, type StarterGuide, type WorkerGuide } from "@/lib/ai";
import { GUIDE_VERSION } from "@/lib/guides";
import { rewriteGuide } from "@/lib/guide-model";
import {
  currencyOf,
  getCountry,
  getParishes,
  getProject,
  projectPlace,
  requestPlace,
  seedRequests,
} from "@/lib/seed";

function knownPlace(countryId: string, placeName: unknown): placeName is string {
  if (typeof placeName !== "string" || placeName.length < 1 || placeName.length > 80) return false;
  if (countryId === "jamaica") {
    return getParishes().some((parish) => parish.towns.some((town) => town.name === placeName));
  }
  return getCountry(countryId)?.cities.some((city) => city.name === placeName) ?? false;
}

function starterFrom(body: Record<string, unknown>): { key: string; guide: StarterGuide } | null {
  const countryId = body.countryId;
  const sector = body.sector;
  if (typeof countryId !== "string" || !getCountry(countryId)) return null;
  if (typeof sector !== "string" || !isSector(sector)) return null;
  if (!knownPlace(countryId, body.placeName)) return null;
  const guide = starterGuide({
    countryId,
    countryName: getCountry(countryId)?.name ?? countryId,
    sector,
    placeName: body.placeName,
  });
  return {
    key: `starter|${GUIDE_VERSION}|${countryId}|${sector}|${body.placeName}`,
    guide,
  };
}

function workerFrom(
  body: Record<string, unknown>,
): { key: string; guide: WorkerGuide } | null | "bad" {
  const requestId = body.requestId;
  const projectId = body.projectId;
  const hasRequest = typeof requestId === "string" && requestId.length > 0;
  const hasProject = typeof projectId === "string" && projectId.length > 0;
  if (hasRequest === hasProject) return "bad";

  if (hasRequest) {
    const request = seedRequests().find((item) => item.id === requestId);
    if (!request) return null;
    const where = requestPlace(request);
    if (!where) return null;
    const guide = workerGuide({
      countryId: request.countryId,
      countryName: getCountry(request.countryId)?.name ?? request.countryId,
      sector: request.sector,
      placeName: where.town,
      skills: request.skills,
      weekly: sectorWeekly(request.sector),
      currency: currencyOf(request.countryId),
      forProject: false,
    });
    return { key: `worker|${GUIDE_VERSION}|request|${request.id}`, guide };
  }

  const project = getProject(projectId as string);
  if (!project) return null;
  const where = projectPlace(project);
  if (!where) return null;
  const guide = workerGuide({
    countryId: project.countryId,
    countryName: getCountry(project.countryId)?.name ?? project.countryId,
    sector: project.sector,
    placeName: where.town,
    skills: project.needs,
    weekly: project.weeklyPayout,
    currency: currencyOf(project.countryId),
    forProject: true,
  });
  return { key: `worker|${GUIDE_VERSION}|project|${project.id}`, guide };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }

  if (body.kind === "starter") {
    const built = starterFrom(body);
    if (!built) return Response.json({ error: "Bad request." }, { status: 400 });
    const guide = await rewriteGuide(built.key, built.guide);
    return Response.json({ guide });
  }

  if (body.kind === "worker") {
    const built = workerFrom(body);
    if (built === "bad") return Response.json({ error: "Bad request." }, { status: 400 });
    if (!built) return Response.json({ error: "Not found." }, { status: 404 });
    const guide = await rewriteGuide(built.key, built.guide);
    return Response.json({ guide });
  }

  return Response.json({ error: "Bad request." }, { status: 400 });
}
