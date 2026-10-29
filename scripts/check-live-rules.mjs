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
const projectC = `live-check-c-${stamp}`;
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

function holdHours(row) {
  return (new Date(row.counts_at).getTime() - new Date(row.created_at).getTime()) / 3600000;
}

async function cleanup() {
  const projectIds = [projectA, projectB, projectC, startedProjectId].filter(Boolean);
  if (userIds.length > 0) {
    await admin.from("wallet_checks").delete().in("user_id", userIds);
    await admin.from("wallets").delete().in("user_id", userIds);
  }
  if (projectIds.length > 0) {
    await admin.from("payments").delete().in("project_id", projectIds);
    await admin.from("project_wallets").delete().in("project_id", projectIds);
    await admin.from("weekly_goals").delete().in("project_id", projectIds);
    await admin.from("contributions").delete().in("project_id", projectIds);
    await admin.from("commitments").delete().in("project_id", projectIds);
    await admin.from("project_members").delete().in("project_id", projectIds);
    await admin.from("applications").delete().in("project_id", projectIds);
  }
  if (userIds.length > 0) {
    await admin.from("lesson_progress").delete().in("user_id", userIds);
    await admin.from("weekly_goals").delete().in("user_id", userIds);
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
      kind: "rainwater",
      site: "own",
      readiness: { "check:parish-letter": "not-yet" },
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
    ? await admin.from("projects").select("checks, kind, site, readiness").eq("id", startedProjectId).single()
    : { data: null };
  const checkIds = Array.isArray(startedRow.data?.checks)
    ? startedRow.data.checks.map((item) => item.id).join(",")
    : "";
  report(
    Boolean(startedProjectId) &&
      !started.error &&
      memberIds.includes(member.id) &&
      !memberIds.includes(outsider.id) &&
      checkIds === "organizer,engineer,community" &&
      startedRow.data?.kind === "rainwater" &&
      startedRow.data?.site === "own" &&
      startedRow.data?.readiness?.["check:parish-letter"] === "not-yet",
    "start_project works on a team-ready request, adds the members, and copies kind, site, and readiness.",
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

  const ada = await makeUser("investor", "Ada Hold");
  const past = "2000-01-01T00:00:00.000Z";
  const blockedBasics = await ada.client
    .from("profiles")
    .update({ investor_basics_at: past })
    .eq("id", ada.id);
  const beforeBasics = await admin.from("profiles").select("investor_basics_at").eq("id", ada.id).single();
  const refused = await ada.client.from("commitments").insert({
    user_id: ada.id,
    project_id: projectA,
    amount: 10,
    status: "pledged",
    counts_at: past,
  });
  const passed = await ada.client.rpc("pass_investor_basics");
  const changedBasics = await ada.client
    .from("profiles")
    .update({ investor_basics_at: past })
    .eq("id", ada.id);
  const afterBasics = await admin.from("profiles").select("investor_basics_at").eq("id", ada.id).single();
  const basicsValue = afterBasics.data?.investor_basics_at ? String(afterBasics.data.investor_basics_at) : "";
  report(
    Boolean(blockedBasics.error) &&
      !beforeBasics.data?.investor_basics_at &&
      Boolean(changedBasics.error) &&
      Boolean(basicsValue) &&
      !basicsValue.startsWith("2000-"),
    "A user cannot set investor_basics_at through a profile update.",
  );

  const first = await ada.client.from("commitments").insert({
    user_id: ada.id,
    project_id: projectA,
    amount: 10,
    status: "pledged",
    counts_at: past,
  });
  const second = await ada.client.from("commitments").insert({
    user_id: ada.id,
    project_id: projectA,
    amount: 11,
    status: "pledged",
    counts_at: past,
  });
  const adaRows = await admin
    .from("commitments")
    .select("amount, counts_at, created_at")
    .eq("user_id", ada.id)
    .order("amount");
  const adaFirst = (adaRows.data ?? []).find((row) => Number(row.amount) === 10);
  const adaSecond = (adaRows.data ?? []).find((row) => Number(row.amount) === 11);
  report(
    Boolean(refused.error) && !passed.error && !first.error,
    "A commitment insert is refused before pass_investor_basics() and allowed after.",
  );
  report(
    !first.error &&
      !second.error &&
      Boolean(adaFirst) &&
      Boolean(adaSecond) &&
      holdHours(adaFirst) > 23 &&
      holdHours(adaFirst) < 25 &&
      Math.abs(holdHours(adaSecond)) < 0.1,
    "A direct insert with counts_at in the past still gets a 24-hour hold on a first commitment, and no hold on a second.",
  );

  const ben = await makeUser("investor", "Ben Organizer");
  const cara = await makeUser("investor", "Cara Funder");
  const benPass = await ben.client.rpc("pass_investor_basics");
  const caraPass = await cara.client.rpc("pass_investor_basics");
  const organized = await admin.from("projects").insert({
    id: projectC,
    organizer_id: ben.id,
    organizer_name: "Ben Organizer",
    name: "Check project C",
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
  });
  const caraPledge = await cara.client.from("commitments").insert({
    user_id: cara.id,
    project_id: projectC,
    amount: 12,
    status: "pledged",
    counts_at: past,
  });
  const benPledge = await ben.client.from("commitments").insert({
    user_id: ben.id,
    project_id: projectC,
    amount: 13,
    status: "pledged",
    counts_at: past,
  });
  const benRow = await admin
    .from("commitments")
    .select("counts_at, created_at")
    .eq("user_id", ben.id)
    .maybeSingle();
  report(
    !organized.error &&
      !benPass.error &&
      !caraPass.error &&
      !caraPledge.error &&
      !benPledge.error &&
      Boolean(benRow.data) &&
      holdHours(benRow.data) > 23 &&
      holdHours(benRow.data) < 25,
    "An organizer whose project already has someone else's commitment still gets the hold on their own first one.",
  );

  const goal = await ben.client
    .from("weekly_goals")
    .insert({
      project_id: projectC,
      user_id: ben.id,
      goal: "Count the cash",
      plan: ["Open the book", "Write the total"],
      status: "open",
      note: "",
      week_of: "2026-10-29",
    })
    .select("id")
    .single();
  const goalId = goal.data?.id ?? "";
  const workerRead = await outsider.client.from("weekly_goals").select("id");
  const leaked = (workerRead.data ?? []).some((row) => row.id === goalId);
  const workerWrite = await outsider.client.from("weekly_goals").insert({
    project_id: projectC,
    user_id: outsider.id,
    goal: "Not yours",
    plan: ["One", "Two"],
    status: "open",
    note: "",
    week_of: "2026-10-29",
  });
  const workerUpdate = await outsider.client.from("weekly_goals").update({ goal: "Stolen" }).eq("id", goalId).select("id");
  const kept = goalId
    ? await admin.from("weekly_goals").select("goal").eq("id", goalId).maybeSingle()
    : { data: null };
  report(
    Boolean(goalId) &&
      !workerRead.error &&
      !leaked &&
      Boolean(workerWrite.error) &&
      ((workerUpdate.data ?? []).length === 0) &&
      kept.data?.goal === "Count the cash",
    "A worker cannot read or write another organizer's weekly_goals.",
  );

  const benAddress = `tb1q${stamp.replace(/[^a-z0-9]/g, "").slice(0, 24)}fundworkben`;
  const wrongAddress = `tb1q${stamp.replace(/[^a-z0-9]/g, "").slice(0, 24)}fundwrong`;
  const tx = (mark) => `${mark}${stamp.replace(/[^a-f0-9]/gi, "")}`.padEnd(64, "0").slice(0, 64);
  const caraCommitment = await admin
    .from("commitments")
    .select("id, status, amount")
    .eq("user_id", cara.id)
    .eq("project_id", projectC)
    .maybeSingle();
  const caraId = caraCommitment.data?.id ?? "";
  const paymentInsert = await cara.client.from("payments").insert({
    project_id: projectC,
    kind: "capital-in",
    chain: "bitcoin-signet",
    tx_id: tx("aa"),
    from_address: "tb1qfrom",
    to_address: benAddress,
    asset: "BTC",
    amount: 12,
    confirmations: 3,
    status: "confirmed",
  });
  const paymentRpc = await cara.client.rpc("record_observed_payment", {
    p_project_id: projectC,
    p_kind: "capital-in",
    p_chain: "bitcoin-signet",
    p_tx_id: tx("bb"),
    p_from_address: "tb1qfrom",
    p_from_addresses: ["tb1qfrom"],
    p_to_address: benAddress,
    p_asset: "BTC",
    p_amount: 12,
    p_confirmations: 3,
    p_commitment_id: caraId,
    p_contribution_id: null,
    p_failed: false,
    p_ambiguous: false,
  });
  report(
    Boolean(paymentInsert.error) && Boolean(paymentRpc.error),
    "A signed-in person cannot insert a payment.",
  );

  const wallet = await ben.client
    .from("wallets")
    .insert({
      user_id: ben.id,
      chain: "bitcoin-signet",
      address: benAddress,
      label: "Ben",
    })
    .select("id, verified_at")
    .single();
  const walletId = wallet.data?.id ?? "";
  const stamped = walletId
    ? await ben.client.from("wallets").update({ verified_at: new Date().toISOString() }).eq("id", walletId).select("id")
    : { data: [], error: null };
  const sneaky = await ben.client.from("wallets").insert({
    user_id: ben.id,
    chain: "base-sepolia",
    address: `0x${"ab".repeat(20)}`,
    verified_at: new Date().toISOString(),
  });
  const markRpc = await ben.client.rpc("mark_wallet_checked", { p_wallet_id: walletId, p_owner_id: ben.id });
  const before = walletId
    ? await admin.from("wallets").select("verified_at").eq("id", walletId).maybeSingle()
    : { data: null };
  const earlyWallet = await ben.client.rpc("set_project_wallet", {
    p_project_id: projectC,
    p_chain: "bitcoin-signet",
    p_address: benAddress,
  });
  const marked = walletId
    ? await admin.rpc("mark_wallet_checked", { p_wallet_id: walletId, p_owner_id: ben.id })
    : { error: { message: "no wallet" }, data: null };
  const after = walletId
    ? await admin.from("wallets").select("verified_at").eq("id", walletId).maybeSingle()
    : { data: null };
  report(
    !wallet.error &&
      wallet.data?.verified_at == null &&
      Boolean(sneaky.error) &&
      Boolean(markRpc.error) &&
      ((stamped.data ?? []).length === 0) &&
      before.data?.verified_at == null &&
      Boolean(earlyWallet.error) &&
      !marked.error &&
      Boolean(after.data?.verified_at),
    "A signed-in person cannot set verified_at.",
  );

  const setWallet = await ben.client.rpc("set_project_wallet", {
    p_project_id: projectC,
    p_chain: "bitcoin-signet",
    p_address: benAddress,
  });
  const outsiderWallet = await outsider.client.rpc("set_project_wallet", {
    p_project_id: projectC,
    p_chain: "bitcoin-signet",
    p_address: benAddress,
  });
  const hand = caraId
    ? await admin.from("commitments").update({ status: "accepted" }).eq("id", caraId).select("status")
    : { error: null, data: [] };
  const stillPledged = caraId
    ? await admin.from("commitments").select("status").eq("id", caraId).maybeSingle()
    : { data: null };

  const caraAddress = `tb1q${stamp.replace(/[^a-z0-9]/g, "").slice(0, 20)}fundcara`;
  const caraWallet = await cara.client
    .from("wallets")
    .insert({
      user_id: cara.id,
      chain: "bitcoin-signet",
      address: caraAddress,
      label: "Cara",
    })
    .select("id")
    .single();
  const caraMarked = caraWallet.data?.id
    ? await admin.rpc("mark_wallet_checked", { p_wallet_id: caraWallet.data.id, p_owner_id: cara.id })
    : { error: { message: "no wallet" } };

  async function observe(mark, to, amount, confirmations, from = caraAddress) {
    return admin.rpc("record_observed_payment", {
      p_project_id: projectC,
      p_kind: "capital-in",
      p_chain: "bitcoin-signet",
      p_tx_id: tx(mark),
      p_from_address: from,
      p_from_addresses: [from],
      p_to_address: to,
      p_asset: "BTC",
      p_amount: amount,
      p_confirmations: confirmations,
      p_commitment_id: caraId,
      p_contribution_id: null,
      p_failed: false,
      p_ambiguous: false,
    });
  }

  const wrong = await observe("c1", wrongAddress, 12, 3);
  const afterWrong = await admin.from("commitments").select("status").eq("id", caraId).maybeSingle();
  const waiting = await observe("c2", benAddress, 12, 1);
  const afterWaiting = await admin.from("commitments").select("status").eq("id", caraId).maybeSingle();
  const short = await observe("c3", benAddress, 11, 3);
  const afterShort = await admin.from("commitments").select("status").eq("id", caraId).maybeSingle();
  const stranger = await observe("c5", benAddress, 12, 3, benAddress);
  const afterStranger = await admin.from("commitments").select("status").eq("id", caraId).maybeSingle();
  const mixedFrom = `TB1Q${caraAddress.slice(4)}`;
  const covered = await observe("c4", benAddress, 12, 3, mixedFrom);
  const afterCovered = await admin.from("commitments").select("status").eq("id", caraId).maybeSingle();
  report(
    !caraMarked.error &&
      !setWallet.error &&
      Boolean(outsiderWallet.error) &&
      Boolean(hand.error) &&
      stillPledged.data?.status === "pledged" &&
      wrong.data?.status === "mismatch" &&
      afterWrong.data?.status === "pledged" &&
      waiting.data?.status === "pending" &&
      afterWaiting.data?.status === "pledged" &&
      short.data?.status === "mismatch" &&
      afterShort.data?.status === "pledged" &&
      stranger.data?.status === "mismatch" &&
      stranger.data?.reason === "This was not sent from your checked wallet." &&
      afterStranger.data?.status === "pledged" &&
      covered.data?.status === "confirmed" &&
      covered.data?.from_address === caraAddress &&
      afterCovered.data?.status === "accepted",
    "A commitment is accepted only after a confirmed capital-in that covers it, and a payment to the wrong address is a mismatch.",
  );
  report(
    stranger.data?.status === "mismatch" && afterStranger.data?.status === "pledged",
    "A payment to the project address from someone else's wallet cannot be claimed.",
  );

  const workerAddress = `tb1q${stamp.replace(/[^a-z0-9]/g, "").slice(0, 18)}fundworker`;
  const joined = await admin.from("project_members").insert({ project_id: projectC, worker_id: member.id });
  const workerWallet = await admin
    .from("wallets")
    .insert({
      user_id: member.id,
      chain: "bitcoin-signet",
      address: workerAddress,
      label: "Work",
    })
    .select("id")
    .single();
  const workerMarked = workerWallet.data?.id
    ? await admin.rpc("mark_wallet_checked", { p_wallet_id: workerWallet.data.id, p_owner_id: member.id })
    : { error: { message: "no wallet" } };
  const payout = await admin.rpc("record_observed_payment", {
    p_project_id: projectC,
    p_kind: "pay-out",
    p_chain: "bitcoin-signet",
    p_tx_id: tx("c6"),
    p_from_address: "tb1qnottheproject",
    p_from_addresses: ["tb1qnottheproject"],
    p_to_address: workerAddress,
    p_asset: "BTC",
    p_amount: 1,
    p_confirmations: 3,
    p_commitment_id: null,
    p_contribution_id: null,
    p_failed: false,
    p_ambiguous: false,
  });
  report(
    !joined.error &&
      !workerMarked.error &&
      payout.data?.status === "mismatch" &&
      payout.data?.reason === "This did not come from the project wallet.",
    "A pay-out from a non-project wallet is a mismatch.",
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
