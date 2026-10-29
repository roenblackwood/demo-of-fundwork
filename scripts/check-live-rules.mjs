import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(new URL("../.env.local", import.meta.url));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

const results = [];
function report(ok, label) {
  results.push({ ok, label });
  console.log(`${ok ? "pass" : "fail"}: ${label}`);
}

if (!url || !anonKey || !serviceKey) {
  report(
    false,
    "Could not run. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const stamp = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
const password = randomBytes(18).toString("base64url");
const projectA = `live-check-a-${stamp}`;
const projectB = `live-check-b-${stamp}`;
const userIds = [];
let requestId = null;
let startedProjectId = null;
let availabilityId = null;

function userClient() {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function makeUser(role, name) {
  const email = `live-check-${role}-${stamp}@example.com`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw new Error(created.error?.message ?? "Could not create a test user.");
  }
  const id = created.data.user.id;
  userIds.push(id);
  const profile = await admin.from("profiles").insert({
    id,
    name,
    role,
    country_id: "ghana",
    parish_id: null,
    town_id: "tamale",
    skill: role === "worker" ? "water" : null,
    extra_skills: [],
  });
  if (profile.error) throw new Error(profile.error.message);
  const client = userClient();
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error) throw new Error(signed.error.message);
  return { id, client };
}

async function cleanup() {
  const projectIds = [projectA, projectB, startedProjectId].filter(Boolean);
  if (projectIds.length > 0) {
    await admin.from("contributions").delete().in("project_id", projectIds);
    await admin.from("commitments").delete().in("project_id", projectIds);
    await admin.from("project_members").delete().in("project_id", projectIds);
    await admin.from("applications").delete().in("project_id", projectIds);
  }
  if (userIds.length > 0) {
    await admin.from("contributions").delete().in("user_id", userIds);
    await admin.from("commitments").delete().in("user_id", userIds);
    await admin.from("applications").delete().in("worker_id", userIds);
    await admin.from("availability").delete().in("user_id", userIds);
  }
  if (requestId) {
    await admin.from("applications").delete().eq("request_id", requestId);
    await admin.from("capital_requests").delete().eq("id", requestId);
  }
  if (projectIds.length > 0) {
    await admin.from("projects").delete().in("id", projectIds);
  }
  if (availabilityId) {
    await admin.from("availability").delete().eq("id", availabilityId);
  }
  for (const id of userIds) {
    await admin.from("profiles").delete().eq("id", id);
    await admin.auth.admin.deleteUser(id);
  }
}

function hidden(result, secretIds) {
  if (result.error) return true;
  const rows = result.data ?? [];
  return !rows.some((row) => secretIds.includes(row.id));
}

try {
  const investor = await makeUser("investor", "Marcia Bennett");
  const member = await makeUser("worker", "Keisha Palmer");
  const outsider = await makeUser("worker", "Omar Grant");

  const projects = await admin.from("projects").insert([
    {
      id: projectA,
      organizer_id: null,
      organizer_name: "Check",
      name: "Check project A",
      country_id: "ghana",
      parish_id: null,
      town_id: "tamale",
      sector: "water",
      summary: "Check.",
      what_you_get: "A part of this project.",
      goal: 1000,
      workers_needed: 1,
      weekly_payout: 16000,
      work_started: false,
      needs: ["water"],
      checks: [],
    },
    {
      id: projectB,
      organizer_id: null,
      organizer_name: "Check",
      name: "Check project B",
      country_id: "ghana",
      parish_id: null,
      town_id: "tamale",
      sector: "water",
      summary: "Check.",
      what_you_get: "A part of this project.",
      goal: 1000,
      workers_needed: 1,
      weekly_payout: 16000,
      work_started: false,
      needs: ["water"],
      checks: [],
    },
  ]);
  if (projects.error) throw new Error(projects.error.message);

  const membership = await admin.from("project_members").insert({
    project_id: projectA,
    worker_id: member.id,
  });
  if (membership.error) throw new Error(membership.error.message);

  const onOther = await member.client.from("contributions").insert({
    user_id: member.id,
    project_id: projectB,
    skill: "water",
    preset: "day",
    status: "logged",
  });
  report(
    Boolean(onOther.error),
    "A worker who is a member of project A cannot insert a contribution on project B.",
  );

  const onOwn = await member.client.from("contributions").insert({
    user_id: member.id,
    project_id: projectA,
    skill: "water",
    preset: "day",
    status: "logged",
  });
  report(!onOwn.error, "A member can log work on their own project.");

  const outsiderInsert = await outsider.client.from("contributions").insert({
    user_id: outsider.id,
    project_id: projectA,
    skill: "water",
    preset: "day",
    status: "logged",
  });
  report(Boolean(outsiderInsert.error), "A non-member cannot insert a contribution at all.");

  const request = await admin
    .from("capital_requests")
    .insert({
      user_id: investor.id,
      country_id: "ghana",
      parish_id: null,
      town_id: "tamale",
      sector: "water",
      budget: 5000,
      workers_needed: 1,
      skills: ["water"],
      note: "Check.",
      status: "open",
    })
    .select("id")
    .single();
  if (request.error) throw new Error(request.error.message);
  requestId = request.data.id;

  const applications = await admin
    .from("applications")
    .insert([
      {
        request_id: requestId,
        worker_id: member.id,
        skill: "water",
        origin: "applied",
        status: "waiting",
      },
      {
        request_id: requestId,
        worker_id: outsider.id,
        skill: "water",
        origin: "applied",
        status: "waiting",
      },
    ])
    .select("id, worker_id");
  if (applications.error) throw new Error(applications.error.message);
  const firstApp = applications.data.find((row) => row.worker_id === member.id);
  const secondApp = applications.data.find((row) => row.worker_id === outsider.id);

  const firstAccept = await investor.client.rpc("set_application_status", {
    application_id: firstApp.id,
    status: "accepted",
  });
  const secondAccept = await investor.client.rpc("set_application_status", {
    application_id: secondApp.id,
    status: "accepted",
  });
  report(
    firstAccept.data === true && secondAccept.data === false && !secondAccept.error,
    "A second accept on a full request is refused.",
  );

  const started = await investor.client.rpc("start_project", {
    request_id: requestId,
    name: "Check live project",
  });
  startedProjectId = typeof started.data === "string" ? started.data : null;
  const members = startedProjectId
    ? await admin.from("project_members").select("worker_id").eq("project_id", startedProjectId)
    : { data: [], error: started.error };
  const memberIds = (members.data ?? []).map((row) => row.worker_id);
  const startedRow = startedProjectId
    ? await admin.from("projects").select("checks").eq("id", startedProjectId).single()
    : { data: null };
  const checkIds = Array.isArray(startedRow.data?.checks)
    ? startedRow.data.checks.map((item) => item.id).join(",")
    : "";
  report(
    Boolean(startedProjectId) &&
      !started.error &&
      memberIds.includes(member.id) &&
      !memberIds.includes(outsider.id) &&
      checkIds === "organizer,engineer,community",
    "start_project works on a team-ready request and adds the members.",
  );

  const posted = await admin
    .from("availability")
    .insert({
      user_id: member.id,
      country_id: "ghana",
      parish_id: null,
      town_id: "tamale",
      skills: ["water"],
      note: "Check.",
    })
    .select("id")
    .single();
  if (posted.error) throw new Error(posted.error.message);
  availabilityId = posted.data.id;

  const anon = userClient();
  const anonPeople = await anon.from("public_profiles").select("id");
  const anonPosts = await anon.from("availability").select("id");
  const peopleHidden = hidden(anonPeople, userIds);
  const postsHidden = hidden(anonPosts, [availabilityId]);
  report(
    peopleHidden && postsHidden,
    "An anon client cannot read public_profiles or availability.",
  );

  const seen = await member.client.from("public_profiles").select("id, name").eq("id", investor.id).maybeSingle();
  report(
    seen.data?.name === "Marcia B." && seen.data?.name !== "Marcia Bennett",
    "A signed-in user sees a short public name.",
  );
} catch (error) {
  report(false, error instanceof Error ? error.message : "The live check stopped.");
} finally {
  try {
    await cleanup();
  } catch (error) {
    report(false, error instanceof Error ? `Cleanup failed. ${error.message}` : "Cleanup failed.");
  }
}

if (results.some((item) => !item.ok)) process.exit(1);
