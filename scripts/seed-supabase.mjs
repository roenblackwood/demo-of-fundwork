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
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  process.exit(1);
}

const seed = JSON.parse(readFileSync(new URL("../data/seed.json", import.meta.url), "utf8"));
const rows = seed.projects.map((project) => ({
  id: project.id,
  organizer_id: null,
  organizer_name: project.organizerName,
  name: project.name,
  country_id: project.countryId,
  parish_id: project.parishId,
  town_id: project.townId,
  sector: project.sector,
  summary: project.summary,
  what_you_get: project.whatYouGet,
  goal: project.goalJmd,
  workers_needed: project.workersNeeded,
  weekly_payout: project.weeklyPayout,
  work_started: project.workStarted,
  needs: project.needs,
  checks: project.checks,
}));

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { error } = await supabase.from("projects").upsert(rows, { onConflict: "id" });
if (error) {
  console.error(error.message);
  process.exit(1);
}

console.log(`Seeded ${rows.length} projects. Sample people are not accounts, so they have no members.`);
