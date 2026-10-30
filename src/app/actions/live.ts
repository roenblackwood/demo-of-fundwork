"use server";

import { cleanReadiness, isSite, kindById } from "@/lib/blueprints";
import { profileToRow, type PersonProfile } from "@/lib/profile";
import { defaultPhases } from "@/lib/capital";
import { isSector, isSkill } from "@/lib/catalog";
import { askedPlace } from "@/lib/seed";
import { adminSupabase } from "@/lib/supabase/admin";
import { serverSupabase } from "@/lib/supabase/server";
import type { PathChoice, Readiness, Sector, SiteStatus, Skill, WorkPreset } from "@/lib/types";

async function callerId(): Promise<string | null> {
  const supabase = await serverSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

export async function saveProfile(input: {
  name: string;
  role: PathChoice;
  countryId: string;
  parishId: string | null;
  townId: string;
  skill: Skill | null;
  extraSkills: Skill[];
}): Promise<boolean> {
  const id = await callerId();
  if (!id) return false;
  const name = input.name.trim().slice(0, 80);
  if (!name || (input.role !== "investor" && input.role !== "worker")) return false;
  if (!askedPlace(input.countryId, input.parishId, input.townId)) return false;
  const skill = input.role === "worker" && input.skill && isSkill(input.skill) ? input.skill : null;
  if (input.role === "worker" && !skill) return false;
  const extra = input.role === "worker"
    ? [...new Set(input.extraSkills.filter((item) => isSkill(item) && item !== skill))]
    : [];
  const supabase = await serverSupabase();
  const { error } = await supabase.from("profiles").upsert(
    {
      id,
      name,
      role: input.role,
      country_id: input.countryId,
      parish_id: input.parishId,
      town_id: input.townId,
      skill,
      extra_skills: extra,
    },
    { onConflict: "id" },
  );
  return !error;
}

export async function setLiveRole(role: PathChoice): Promise<boolean> {
  const id = await callerId();
  if (!id || (role !== "investor" && role !== "worker")) return false;
  const supabase = await serverSupabase();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
  return !error;
}

export async function saveDisplayName(name: string): Promise<boolean> {
  const id = await callerId();
  const trimmed = name.trim().slice(0, 80);
  if (!id || !trimmed) return false;
  const supabase = await serverSupabase();
  const { error } = await supabase.from("profiles").update({ name: trimmed }).eq("id", id);
  return !error;
}

export async function postRequest(input: {
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
  share: number;
}): Promise<string | null> {
  const id = await callerId();
  if (!id) return null;
  if (!askedPlace(input.countryId, input.parishId, input.townId)) return null;
  if (!isSector(input.sector) || !(input.budget > 0)) return null;
  if (!Number.isInteger(input.workersNeeded) || input.workersNeeded < 1 || input.workersNeeded > 10) {
    return null;
  }
  if (!kindById(input.sector, input.kind) || !isSite(input.site)) return null;
  if (!(input.share >= 1) || input.share > input.budget) return null;
  const readiness = cleanReadiness(input.readiness);
  if (!readiness) return null;
  const skills = [...new Set(input.skills.filter((item) => isSkill(item)))];
  if (skills.length === 0) return null;
  const supabase = await serverSupabase();
  const { data, error } = await supabase
    .from("capital_requests")
    .insert({
      user_id: id,
      country_id: input.countryId,
      parish_id: input.parishId,
      town_id: input.townId,
      sector: input.sector,
      budget: input.budget,
      workers_needed: input.workersNeeded,
      skills,
      note: input.note.trim().slice(0, 240),
      status: "open",
      project_id: null,
      kind: input.kind,
      site: input.site,
      readiness,
      poster_amount: input.share,
    })
    .select("id")
    .single();
  if (error || !data?.id) return null;
  return String(data.id);
}

export async function pledgeToRequest(input: {
  requestId: string;
  amount: number;
  showName: boolean;
}): Promise<boolean> {
  const id = await callerId();
  if (!id || !(input.amount >= 1) || !input.requestId) return false;
  const supabase = await serverSupabase();
  const { data, error } = await supabase.rpc("pledge_to_request", {
    request_id: input.requestId,
    amount: input.amount,
    show_name: input.showName,
  });
  return !error && typeof data === "string" && data.length > 0;
}

export async function withdrawRequestPledge(pledgeId: string): Promise<boolean> {
  const id = await callerId();
  if (!id || !pledgeId) return false;
  const supabase = await serverSupabase();
  const { data, error } = await supabase.rpc("withdraw_request_pledge", { pledge_id: pledgeId });
  return !error && data === true;
}

export async function closeRequest(requestId: string): Promise<boolean> {
  const id = await callerId();
  if (!id || !requestId) return false;
  const supabase = await serverSupabase();
  const { data, error } = await supabase.rpc("close_request", { request_id: requestId });
  return !error && data === true;
}

export async function postAvailability(input: {
  countryId: string;
  parishId: string | null;
  townId: string;
  skills: Skill[];
  note: string;
}): Promise<string | null> {
  const id = await callerId();
  if (!id) return null;
  if (!askedPlace(input.countryId, input.parishId, input.townId)) return null;
  const skills = [...new Set(input.skills.filter((item) => isSkill(item)))];
  if (skills.length === 0) return null;
  const supabase = await serverSupabase();
  const { data, error } = await supabase
    .from("availability")
    .insert({
      user_id: id,
      country_id: input.countryId,
      parish_id: input.parishId,
      town_id: input.townId,
      skills,
      note: input.note.trim().slice(0, 240),
    })
    .select("id")
    .single();
  if (error || !data?.id) return null;
  return String(data.id);
}

export async function postApplication(input: {
  requestId: string | null;
  projectId: string | null;
  skill: Skill;
  message: string;
}): Promise<boolean> {
  const id = await callerId();
  if (!id || !isSkill(input.skill)) return false;
  const hasRequest = Boolean(input.requestId);
  const hasProject = Boolean(input.projectId);
  if (hasRequest === hasProject) return false;
  const supabase = await serverSupabase();
  const { error } = await supabase.from("applications").insert({
    request_id: input.requestId,
    project_id: input.projectId,
    worker_id: id,
    skill: input.skill,
    message: input.message.trim().slice(0, 200),
    origin: "applied",
    status: "waiting",
  });
  return !error;
}

async function ensureProjectPhases(projectId: string): Promise<void> {
  const admin = adminSupabase();
  if (!admin) return;
  const supabase = await serverSupabase();
  const row = await supabase.from("projects").select("sector, kind, phases, work_started").eq("id", projectId).maybeSingle();
  const data = row.data;
  if (!data || data.work_started === true) return;
  const stored = Array.isArray(data.phases)
    ? data.phases.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  if (stored.length > 0) return;
  const sector = typeof data.sector === "string" && isSector(data.sector) ? data.sector : null;
  if (!sector) return;
  const kind = typeof data.kind === "string" ? data.kind : null;
  await admin.rpc("set_project_phases", {
    p_project_id: projectId,
    p_phases: defaultPhases(sector, kind),
  });
}

export async function saveProfileDetails(profile: PersonProfile): Promise<boolean> {
  const id = await callerId();
  if (!id) return false;
  const supabase = await serverSupabase();
  const { error } = await supabase.from("profile_details").upsert(
    profileToRow(id, { ...profile, done: true }),
    { onConflict: "user_id" },
  );
  return !error;
}

export async function saveHomeTown(input: {
  countryId: string;
  parishId: string | null;
  townId: string;
}): Promise<boolean> {
  const id = await callerId();
  if (!id || !askedPlace(input.countryId, input.parishId, input.townId)) return false;
  const supabase = await serverSupabase();
  const { error } = await supabase
    .from("profiles")
    .update({
      country_id: input.countryId,
      parish_id: input.parishId,
      town_id: input.townId,
    })
    .eq("id", id);
  return !error;
}

export async function setSignal(input: {
  itemId: string;
  kind: "saved" | "hidden" | "clear";
  sector: string;
}): Promise<boolean> {
  const id = await callerId();
  if (!id || !input.itemId) return false;
  const supabase = await serverSupabase();
  if (input.kind === "clear") {
    const { error } = await supabase.from("user_signals").delete().eq("user_id", id).eq("item_id", input.itemId);
    return !error;
  }
  const { error } = await supabase.from("user_signals").upsert(
    {
      user_id: id,
      item_id: input.itemId,
      kind: input.kind,
      sector: input.sector,
    },
    { onConflict: "user_id,item_id" },
  );
  return !error;
}

export async function postCommitment(input: {
  projectId: string;
  amount: number;
  showName?: boolean;
}): Promise<boolean> {
  const id = await callerId();
  if (!id || !(input.amount > 0) || !input.projectId) return false;
  const admin = adminSupabase();
  if (admin) {
    const project = await admin.from("projects").select("goal").eq("id", input.projectId).maybeSingle();
    const existing = await admin.from("commitments").select("amount").eq("project_id", input.projectId);
    const goal = Number(project.data?.goal ?? 0);
    const used = (existing.data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
    if (!(goal > 0) || used + input.amount > goal) return false;
  }
  const supabase = await serverSupabase();
  await ensureProjectPhases(input.projectId);
  // The database sets counts_at. A first commitment is held for 24 hours.
  const { error } = await supabase.from("commitments").insert({
    user_id: id,
    project_id: input.projectId,
    amount: input.amount,
    status: "pledged",
    show_name: input.showName !== false,
  });
  return !error;
}

export async function postContribution(input: {
  projectId: string;
  skill: Skill;
  preset: WorkPreset;
}): Promise<boolean> {
  const id = await callerId();
  if (!id || !input.projectId || !isSkill(input.skill)) return false;
  if (input.preset !== "day" && input.preset !== "few" && input.preset !== "week") return false;
  const supabase = await serverSupabase();
  const { error } = await supabase.from("contributions").insert({
    user_id: id,
    project_id: input.projectId,
    skill: input.skill,
    preset: input.preset,
    status: "logged",
  });
  return !error;
}

export async function acceptContribution(contributionId: string): Promise<boolean> {
  const id = await callerId();
  if (!id || !contributionId) return false;
  const supabase = await serverSupabase();
  const { data, error } = await supabase.rpc("accept_contribution", {
    contribution_id: contributionId,
  });
  return !error && data === true;
}

export async function inviteWorker(requestId: string, workerId: string, skill: Skill): Promise<boolean> {
  const id = await callerId();
  if (!id || !isSkill(skill)) return false;
  const supabase = await serverSupabase();
  const { data, error } = await supabase.rpc("invite_worker", {
    request_id: requestId,
    worker_id: workerId,
    skill,
  });
  return !error && Boolean(data);
}

export async function setApplicationStatus(
  applicationId: string,
  status: "accepted" | "declined",
): Promise<boolean> {
  const id = await callerId();
  if (!id) return false;
  const supabase = await serverSupabase();
  const { data, error } = await supabase.rpc("set_application_status", {
    application_id: applicationId,
    status,
  });
  return !error && data === true;
}

export async function withdrawApplication(applicationId: string): Promise<boolean> {
  const id = await callerId();
  if (!id) return false;
  const supabase = await serverSupabase();
  const { data, error } = await supabase.rpc("withdraw_application", {
    application_id: applicationId,
  });
  return !error && data === true;
}

export async function setReadiness(input: {
  requestId?: string | null;
  projectId?: string | null;
  readiness: Readiness;
}): Promise<boolean> {
  const id = await callerId();
  const readiness = cleanReadiness(input.readiness);
  if (!id || !readiness) return false;
  if (!input.requestId && !input.projectId) return false;
  const supabase = await serverSupabase();
  const { data, error } = await supabase.rpc("set_readiness", {
    p_request_id: input.requestId ?? null,
    p_project_id: input.projectId ?? null,
    p_readiness: readiness,
  });
  return !error && data === true;
}

export async function startProject(requestId: string, name: string): Promise<string | null> {
  const id = await callerId();
  const trimmed = name.trim().slice(0, 80);
  if (!id || !trimmed) return null;
  const supabase = await serverSupabase();
  const { data, error } = await supabase.rpc("start_project", {
    request_id: requestId,
    name: trimmed,
  });
  if (error || typeof data !== "string" || !data) return null;
  await ensureProjectPhases(data);
  return data;
}

export async function savePhaseSplit(input: { projectId: string; shares: number[] }): Promise<boolean> {
  const id = await callerId();
  if (!id || !input.projectId || input.shares.length === 0) return false;
  if (input.shares.some((share) => !(share > 0))) return false;
  const supabase = await serverSupabase();
  const row = await supabase
    .from("projects")
    .select("organizer_id, sector, kind, phases, work_started")
    .eq("id", input.projectId)
    .maybeSingle();
  if (!row.data || row.data.organizer_id !== id || row.data.work_started === true) return false;
  const stored = Array.isArray(row.data.phases)
    ? row.data.phases.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const sector = typeof row.data.sector === "string" && isSector(row.data.sector) ? row.data.sector : null;
  const kind = typeof row.data.kind === "string" ? row.data.kind : null;
  const phases = stored.length > 0 ? stored : sector ? defaultPhases(sector, kind) : [];
  if (phases.length === 0 || input.shares.length !== phases.length) return false;
  if (stored.length === 0) {
    const admin = adminSupabase();
    if (!admin) return false;
    const set = await admin.rpc("set_project_phases", { p_project_id: input.projectId, p_phases: phases });
    if (set.error) return false;
  }
  const { data, error } = await supabase.rpc("set_project_split", {
    p_project_id: input.projectId,
    p_shares: input.shares,
  });
  return !error && data === true;
}

export async function markPhaseDone(projectId: string): Promise<boolean> {
  const id = await callerId();
  if (!id || !projectId) return false;
  const supabase = await serverSupabase();
  const project = await supabase.from("projects").select("readiness, organizer_id").eq("id", projectId).maybeSingle();
  if (project.data?.organizer_id !== id) return false;
  const readiness = cleanReadiness(project.data.readiness);
  if (!readiness) return false;
  const { data, error } = await supabase.rpc("mark_phase_done", {
    p_project_id: projectId,
    p_readiness: readiness,
  });
  return !error && data === true;
}
