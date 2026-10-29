import { connection } from "next/server";
import { recheckPending } from "@/lib/chain/record";
import { isLive } from "@/lib/mode";
import { serverSupabase } from "@/lib/supabase/server";

// A background watcher can call this same check later. There is no job yet.

export async function POST(request: Request) {
  await connection();
  if (!isLive()) {
    return Response.json({ ok: false, reason: "Wallet checks run in the live version.", checked: 0 });
  }
  const body: unknown = await request.json().catch(() => null);
  const projectId = body && typeof body === "object" && "projectId" in body && typeof body.projectId === "string"
    ? body.projectId
    : "";
  if (!projectId) return Response.json({ ok: false, reason: "Missing project.", checked: 0 });

  const supabase = await serverSupabase();
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id ?? "";
  if (!userId) return Response.json({ ok: false, reason: "Sign in first.", checked: 0 });

  const project = await supabase.from("projects").select("organizer_id").eq("id", projectId).maybeSingle();
  if (project.data?.organizer_id !== userId) {
    return Response.json({ ok: false, reason: "Only the organizer can check again.", checked: 0 });
  }

  try {
    const result = await recheckPending(projectId);
    return Response.json(result);
  } catch {
    return Response.json({ ok: false, reason: "The test network did not answer. Try again.", checked: 0 });
  }
}
