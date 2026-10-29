"use server";

import { cleanReadiness, isSite, kindById } from "@/lib/blueprints";
import { isSector, isSkill } from "@/lib/catalog";
import { askedPlace } from "@/lib/seed";
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
}): Promise<string | null> {
  const id = await callerId();
  if (!id) return null;
  if (!askedPlace(input.countryId, input.parishId, input.townId)) return null;
  if (!isSector(input.sector) || !(input.budget > 0)) return null;
  if (!Number.isInteger(input.workersNeeded) || input.workersNeeded < 1 || input.workersNeeded > 10) {
    return null;
  }
  if (!kindById(input.sector, input.kind) || !isSite(input.site)) return null;
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
    })
    .select("id")
    .single();
  if (error || !data?.id) return null;
  return String(data.id);
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

export async function postCommitment(input: { projectId: string; amount: number }): Promise<boolean> {
  const id = await callerId();
  if (!id || !(input.amount > 0) || !input.projectId) return false;
  const supabase = await serverSupabase();
  // The database sets counts_at. A first commitment is held for 24 hours.
  const { error } = await supabase.from("commitments").insert({
    user_id: id,
    project_id: input.projectId,
    amount: input.amount,
    status: "pledged",
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
  return data;
}
