"use server";

import { serverSupabase } from "@/lib/supabase/server";

const SUBJECTS = new Set(["request", "project", "profile"]);

async function callerId(): Promise<string | null> {
  const supabase = await serverSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

export async function listPhotos(
  subject: string,
  subjectId: string,
): Promise<{ id: string; alt: string; url: string }[]> {
  if (!SUBJECTS.has(subject) || !subjectId) return [];
  const supabase = await serverSupabase();
  const { data, error } = await supabase
    .from("photos")
    .select("id, alt, storage_path, created_at")
    .eq("subject", subject)
    .eq("subject_id", subjectId)
    .order("created_at");
  if (error || !data) return [];
  const rows: { id: string; alt: string; url: string }[] = [];
  for (const row of data) {
    const path = typeof row.storage_path === "string" ? row.storage_path : "";
    const signed = path ? await supabase.storage.from("photos").createSignedUrl(path, 60 * 60) : null;
    const url = signed?.data?.signedUrl;
    if (!url || typeof row.id !== "string" || typeof row.alt !== "string") continue;
    rows.push({ id: row.id, alt: row.alt, url });
  }
  return rows;
}

export async function addPhoto(form: FormData): Promise<boolean> {
  const id = await callerId();
  if (!id) return false;
  const subject = String(form.get("subject") ?? "");
  const subjectId = String(form.get("subjectId") ?? "");
  const alt = String(form.get("alt") ?? "").trim().slice(0, 200);
  const file = form.get("file");
  if (!SUBJECTS.has(subject) || !subjectId || !alt || !(file instanceof File) || file.size < 1) return false;
  const supabase = await serverSupabase();
  const existing = await supabase
    .from("photos")
    .select("id")
    .eq("subject", subject)
    .eq("subject_id", subjectId);
  if (existing.error || (existing.data?.length ?? 0) >= 4) return false;
  const photoId = crypto.randomUUID();
  const path = `${id}/${photoId}.webp`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const uploaded = await supabase.storage.from("photos").upload(path, bytes, {
    contentType: "image/webp",
    upsert: false,
  });
  if (uploaded.error) return false;
  const inserted = await supabase.from("photos").insert({
    id: photoId,
    owner_id: id,
    subject,
    subject_id: subjectId,
    alt,
    storage_path: path,
  });
  if (inserted.error) {
    await supabase.storage.from("photos").remove([path]);
    return false;
  }
  return true;
}
