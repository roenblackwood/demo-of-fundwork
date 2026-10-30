// Gallery uploads need GPS metadata removal on the server first.
// Server-side transcoding and multiple quality levels can come later.
// Automatic face blurring can come later.

import { Upload } from "tus-js-client";
import { phasesFor } from "@/lib/capital";
import { isLive } from "@/lib/mode";
import { compressPhoto } from "@/lib/photos";
import { getCity, getTown } from "@/lib/seed";
import { browserSupabase } from "@/lib/supabase/browser";
import type { Sector } from "@/lib/types";

export const VIDEO_MAX_SECONDS = 30;
export const VIDEO_BITS = 1_200_000;
export const VIDEO_CHUNK = 1024 * 1024;
export const VIDEO_CAP = 5;
export const VIDEO_BYTES = 8 * 1024 * 1024;
export const SITE_KM = 5;
const CONSENT_KEY = "fundwork-video-ok";
const WIFI_KEY = "fundwork-video-wifi";
const DB_NAME = "fundwork-videos";
const STORE = "videos";
const REPORTS = "reports";

export type VideoStatus = "waiting" | "sending" | "sent";

export type StoredVideo = {
  id: string;
  ownerId: string;
  projectId: string;
  contributionId: string | null;
  phase: string;
  description: string;
  sha256: string;
  atSite: boolean;
  hidden: boolean;
  pinned: boolean;
  onProfile: boolean;
  createdAt: string;
  bytes: number;
  mime: "video/mp4" | "video/webm";
  status: VideoStatus;
  progress: number;
  blob: Blob;
  poster: Blob;
};

export type ShownVideo = {
  id: string;
  ownerId: string;
  projectId: string;
  contributionId: string | null;
  phase: string;
  description: string;
  sha256: string;
  atSite: boolean;
  hidden: boolean;
  pinned: boolean;
  onProfile: boolean;
  createdAt: string;
  bytes: number;
  mime: "video/mp4" | "video/webm";
  status: VideoStatus;
  progress: number;
  posterUrl: string;
  videoUrl: string;
};

type ReportRow = {
  id: string;
  videoId: string;
  reporterId: string;
  createdAt: string;
};

type Point = { lat: number; lng: number };

type SaveInput = {
  ownerId: string;
  projectId: string;
  contributionId: string | null;
  phase: string;
  description: string;
  atSite: boolean;
  mime: "video/mp4" | "video/webm";
  blob: Blob;
  poster: Blob;
  sha256: string;
};

export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; reason: "duplicate" | "cap" | "description" | "size" };

const cache = new Map<string, ShownVideo>();
const listeners = new Set<() => void>();
const sending = new Set<string>();

export function subscribeVideos(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function cachedVideos(): ShownVideo[] {
  return [...cache.values()];
}

function emit(): void {
  for (const listener of listeners) listener();
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(REPORTS)) {
        const reports = db.createObjectStore(REPORTS, { keyPath: "id" });
        reports.createIndex("byVideo", "videoId");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function readAll(): Promise<StoredVideo[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => resolve((request.result as StoredVideo[]) ?? []);
    request.onerror = () => reject(request.error);
  });
}

async function readOne(id: string): Promise<StoredVideo | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(id);
    request.onsuccess = () => resolve((request.result as StoredVideo | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function writeRow(row: StoredVideo): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put(row);
  await txDone(tx);
}

function showOf(row: StoredVideo, previous?: ShownVideo): ShownVideo {
  const posterUrl = previous?.posterUrl ?? URL.createObjectURL(row.poster);
  const videoUrl = previous?.videoUrl ?? URL.createObjectURL(row.blob);
  return {
    id: row.id,
    ownerId: row.ownerId,
    projectId: row.projectId,
    contributionId: row.contributionId,
    phase: row.phase,
    description: row.description,
    sha256: row.sha256,
    atSite: row.atSite,
    hidden: row.hidden,
    pinned: row.pinned,
    onProfile: row.onProfile,
    createdAt: row.createdAt,
    bytes: row.bytes,
    mime: row.mime,
    status: row.status,
    progress: row.progress,
    posterUrl,
    videoUrl,
  };
}

function remember(row: StoredVideo): void {
  const previous = cache.get(row.id);
  cache.set(row.id, showOf(row, previous));
  emit();
}

export function fileSizeLabel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const mb = Math.round((bytes / (1024 * 1024)) * 10) / 10;
  return `${mb.toFixed(1)} MB`;
}

export function queueLabel(status: VideoStatus, progress: number): string {
  if (status === "waiting") return "Waiting for Wi-Fi";
  if (status === "sending") return `Sending ${progress}%`;
  return "Sent";
}

export function recorderMime(): "video/mp4" | "video/webm" | "" {
  if (typeof MediaRecorder === "undefined") return "";
  if (MediaRecorder.isTypeSupported("video/mp4")) return "video/mp4";
  if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) return "video/webm";
  if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8")) return "video/webm";
  if (MediaRecorder.isTypeSupported("video/webm")) return "video/webm";
  return "";
}

export function recorderOptions(mime: "video/mp4" | "video/webm"): MediaRecorderOptions {
  const withCodec =
    mime === "video/mp4"
      ? "video/mp4"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
          ? "video/webm;codecs=vp8"
          : "video/webm";
  return { mimeType: withCodec, bitsPerSecond: VIDEO_BITS, videoBitsPerSecond: VIDEO_BITS };
}

export function videoConsent(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(CONSENT_KEY) === "1";
}

export function rememberVideoConsent(): void {
  window.localStorage.setItem(CONSENT_KEY, "1");
}

type Net = { saveData?: boolean; type?: string; effectiveType?: string };

function connection(): Net | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & { connection?: Net };
  return nav.connection ?? null;
}

export function wifiOnlyEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const stored = window.localStorage.getItem(WIFI_KEY);
  if (stored === "1") return true;
  if (stored === "0") return false;
  return Boolean(connection()?.saveData);
}

export function setWifiOnly(on: boolean): void {
  window.localStorage.setItem(WIFI_KEY, on ? "1" : "0");
  emit();
  kickQueue();
}

export function waitingForWifi(): boolean {
  if (!wifiOnlyEnabled()) return false;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const net = connection();
  if (!net) return false;
  if (net.type === "wifi" || net.type === "ethernet") return false;
  if (net.type === "cellular" || net.saveData) return true;
  if (net.effectiveType === "slow-2g" || net.effectiveType === "2g" || net.effectiveType === "3g") return true;
  return false;
}

function kmBetween(from: Point, to: Point): number {
  const rad = (value: number) => (value * Math.PI) / 180;
  const dLat = rad(to.lat - from.lat);
  const dLng = rad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function townPoint(place: {
  countryId: string;
  parishId: string | null;
  townId: string;
}): Point | null {
  if (place.parishId) {
    const town = getTown(place.parishId, place.townId);
    if (town && Number.isFinite(town.lat) && Number.isFinite(town.lng)) return { lat: town.lat, lng: town.lng };
  }
  const city = getCity(place.countryId, place.townId);
  if (city && Number.isFinite(city.lat) && Number.isFinite(city.lng)) return { lat: city.lat, lng: city.lng };
  return null;
}

/** True only when the phone is within 5 km. Coordinates are not stored. */
export function atSiteNow(place: {
  countryId: string;
  parishId: string | null;
  townId: string;
}): Promise<boolean> {
  const point = townPoint(place);
  if (!point || typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(false);
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(false), 4000);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        window.clearTimeout(timer);
        resolve(kmBetween({ lat: position.coords.latitude, lng: position.coords.longitude }, point) <= SITE_KM);
      },
      () => {
        window.clearTimeout(timer);
        resolve(false);
      },
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 60000 },
    );
  });
}

export async function sha256Of(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function once(target: HTMLVideoElement, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ok = () => {
      cleanup();
      resolve();
    };
    const fail = () => {
      cleanup();
      reject(new Error("This video could not be prepared."));
    };
    const cleanup = () => {
      target.removeEventListener(event, ok);
      target.removeEventListener("error", fail);
    };
    target.addEventListener(event, ok);
    target.addEventListener("error", fail);
  });
}

export async function posterFromVideo(blob: Blob): Promise<Blob> {
  const url = URL.createObjectURL(blob);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = url;
  try {
    await once(video, "loadeddata");
    if (video.videoWidth === 0) {
      try {
        await video.play();
        video.pause();
      } catch {
        // A blocked preview can still leave a frame to draw.
      }
    }
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration > 1) {
      try {
        video.currentTime = 1;
        await Promise.race([
          once(video, "seeked"),
          new Promise<void>((_, reject) => {
            window.setTimeout(() => reject(new Error("seek")), 1500);
          }),
        ]);
      } catch {
        try {
          video.currentTime = 0;
        } catch {
          // Draw the frame that is already ready.
        }
      }
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 180;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This video could not be prepared.");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frame = await new Promise<Blob | null>((resolve) => canvas.toBlob((value) => resolve(value), "image/png"));
    if (!frame) throw new Error("This video could not be prepared.");
    return compressPhoto(new File([frame], "frame.png", { type: "image/png" }));
  } finally {
    video.src = "";
    URL.revokeObjectURL(url);
  }
}

export function currentPhaseName(project: {
  sector: Sector;
  kind?: string | null;
  phases?: string[] | null;
  openPhase?: number;
}): string {
  const names = phasesFor(project);
  const open = Math.min(Math.max(project.openPhase ?? 0, 0), Math.max(names.length - 1, 0));
  return names[open] ?? "Start";
}

export async function refreshVideos(): Promise<void> {
  const rows = await readAll();
  const seen = new Set(rows.map((row) => row.id));
  for (const [id, shown] of cache) {
    if (seen.has(id)) continue;
    URL.revokeObjectURL(shown.posterUrl);
    URL.revokeObjectURL(shown.videoUrl);
    cache.delete(id);
  }
  for (const row of rows) remember(row);
  if (isLive()) await mergeLive(rows);
  emit();
  kickQueue();
}

async function mergeLive(local: StoredVideo[]): Promise<void> {
  const supabase = browserSupabase();
  const { data, error } = await supabase.from("videos").select("*");
  if (error || !data) return;
  const localIds = new Set(local.map((row) => row.id));
  for (const row of data) {
    if (typeof row.id !== "string" || localIds.has(row.id)) continue;
    const ext = "webm";
    const ownerId = typeof row.owner_id === "string" ? row.owner_id : "";
    const videoPath = `${ownerId}/${row.id}.${ext}`;
    const mp4Path = `${ownerId}/${row.id}.mp4`;
    const signed = await supabase.storage.from("videos").createSignedUrl(videoPath, 60 * 60);
    const signedMp4 = signed.data?.signedUrl
      ? signed
      : await supabase.storage.from("videos").createSignedUrl(mp4Path, 60 * 60);
    const poster = await supabase.storage.from("photos").createSignedUrl(`${ownerId}/${row.id}.webp`, 60 * 60);
    const videoUrl = signed.data?.signedUrl ?? signedMp4.data?.signedUrl ?? "";
    if (!videoUrl) continue;
    cache.set(row.id, {
      id: row.id,
      ownerId,
      projectId: typeof row.project_id === "string" ? row.project_id : "",
      contributionId: typeof row.contribution_id === "string" ? row.contribution_id : null,
      phase: typeof row.phase === "string" ? row.phase : "",
      description: typeof row.description === "string" ? row.description : "",
      sha256: typeof row.sha256 === "string" ? row.sha256 : "",
      atSite: row.at_site === true,
      hidden: row.hidden === true,
      pinned: row.pinned === true,
      onProfile: row.on_profile === true,
      createdAt: typeof row.created_at === "string" ? row.created_at : "",
      bytes: typeof row.bytes === "number" ? row.bytes : 0,
      mime: signed.data?.signedUrl ? "video/webm" : "video/mp4",
      status: "sent",
      progress: 100,
      posterUrl: poster.data?.signedUrl ?? "",
      videoUrl,
    });
  }
}

export async function saveVideo(input: SaveInput): Promise<SaveResult> {
  const description = input.description.trim().slice(0, 120);
  if (!description) return { ok: false, reason: "description" };
  if (input.blob.size < 1 || input.blob.size > VIDEO_BYTES) return { ok: false, reason: "size" };
  const rows = await readAll();
  if (!isLive() && rows.length >= VIDEO_CAP) return { ok: false, reason: "cap" };
  if (rows.some((row) => row.sha256 === input.sha256)) return { ok: false, reason: "duplicate" };
  if (isLive()) {
    const supabase = browserSupabase();
    const existing = await supabase.from("videos").select("id").eq("sha256", input.sha256).limit(1);
    if (existing.data && existing.data.length > 0) return { ok: false, reason: "duplicate" };
  }
  const row: StoredVideo = {
    id: crypto.randomUUID(),
    ownerId: input.ownerId,
    projectId: input.projectId,
    contributionId: input.contributionId,
    phase: input.phase,
    description,
    sha256: input.sha256,
    atSite: input.atSite,
    hidden: false,
    pinned: false,
    onProfile: false,
    createdAt: new Date().toISOString(),
    bytes: input.blob.size,
    mime: input.mime,
    status: waitingForWifi() ? "waiting" : "sending",
    progress: 0,
    blob: input.blob,
    poster: input.poster,
  };
  await writeRow(row);
  remember(row);
  kickQueue();
  return { ok: true, id: row.id };
}

export async function attachVideo(id: string, contributionId: string): Promise<void> {
  const row = await readOne(id);
  if (!row) return;
  const next = { ...row, contributionId };
  await writeRow(next);
  remember(next);
  if (isLive() && row.status === "sent") {
    await browserSupabase().from("videos").update({ contribution_id: contributionId }).eq("id", id);
  }
}

async function patch(id: string, change: Partial<StoredVideo>): Promise<void> {
  const row = await readOne(id);
  if (!row) return;
  const next = { ...row, ...change, id: row.id, blob: change.blob ?? row.blob, poster: change.poster ?? row.poster };
  await writeRow(next);
  remember(next);
}

export function kickQueue(): void {
  void pump();
}

async function pump(): Promise<void> {
  const rows = await readAll();
  for (const row of rows) {
    if (row.status === "sent" || sending.has(row.id)) continue;
    if (waitingForWifi()) {
      if (row.status !== "waiting") await patch(row.id, { status: "waiting", progress: 0 });
      continue;
    }
    sending.add(row.id);
    void sendOne(row.id).finally(() => {
      sending.delete(row.id);
    });
  }
}

async function sendOne(id: string): Promise<void> {
  const row = await readOne(id);
  if (!row || row.status === "sent") return;
  if (!isLive()) {
    for (const progress of [20, 40, 60, 80, 100]) {
      await patch(id, { status: "sending", progress });
      await new Promise((resolve) => window.setTimeout(resolve, 400));
    }
    await patch(id, { status: "sent", progress: 100 });
    return;
  }
  try {
    await patch(id, { status: "sending", progress: 0 });
    await uploadLive(row, (progress) => {
      void patch(id, { status: "sending", progress });
    });
    await patch(id, { status: "sent", progress: 100 });
  } catch {
    const waiting = waitingForWifi() || (typeof navigator !== "undefined" && navigator.onLine === false);
    await patch(id, { status: waiting ? "waiting" : "sending" });
    window.setTimeout(() => kickQueue(), 5000);
  }
}

async function uploadLive(row: StoredVideo, onProgress: (progress: number) => void): Promise<void> {
  const supabase = browserSupabase();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!token || !base) throw new Error("Live mode is off.");
  const ext = row.mime === "video/mp4" ? "mp4" : "webm";
  const objectName = `${row.ownerId}/${row.id}.${ext}`;
  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(row.blob, {
      endpoint: `${base}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 5000, 10000],
      headers: {
        authorization: `Bearer ${token}`,
        apikey: anon,
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: "videos",
        objectName,
        contentType: row.mime,
        cacheControl: "3600",
      },
      // About 1 MB, so a lost connection retries a small piece.
      chunkSize: VIDEO_CHUNK,
      onError: (error) => reject(error),
      onProgress: (sent, total) => {
        onProgress(total > 0 ? Math.min(99, Math.round((sent / total) * 100)) : 0);
      },
      onSuccess: () => resolve(),
    });
    upload.findPreviousUploads().then((previous) => {
      if (previous.length > 0) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    }).catch(reject);
  });
  const latest = await readOne(row.id);
  const inserted = await supabase.from("videos").insert({
    id: row.id,
    owner_id: row.ownerId,
    project_id: row.projectId,
    contribution_id: latest?.contributionId ?? row.contributionId,
    phase: row.phase,
    description: row.description,
    sha256: row.sha256,
    at_site: row.atSite,
    hidden: false,
    pinned: false,
    on_profile: row.onProfile,
    bytes: row.bytes,
  });
  if (inserted.error) {
    if (/duplicate|unique/i.test(inserted.error.message)) {
      throw new Error("duplicate");
    }
    throw new Error(inserted.error.message);
  }
  if (row.poster.size > 0 && row.poster.size <= 400 * 1024) {
    await supabase.storage.from("photos").upload(`${row.ownerId}/${row.id}.webp`, row.poster, {
      contentType: "image/webp",
      upsert: true,
    });
  }
}

export async function removeVideo(id: string): Promise<void> {
  const row = await readOne(id);
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).delete(id);
  await txDone(tx);
  const shown = cache.get(id);
  if (shown) {
    URL.revokeObjectURL(shown.posterUrl);
    URL.revokeObjectURL(shown.videoUrl);
    cache.delete(id);
  }
  emit();
  if (isLive() && row) {
    const ext = row.mime === "video/mp4" ? "mp4" : "webm";
    const supabase = browserSupabase();
    await supabase.from("videos").delete().eq("id", id);
    await supabase.storage.from("videos").remove([`${row.ownerId}/${id}.${ext}`]);
  }
}

export async function setVideoHidden(id: string, hidden: boolean): Promise<void> {
  await patch(id, hidden ? { hidden: true, onProfile: false } : { hidden: false });
  if (isLive()) {
    await browserSupabase()
      .from("videos")
      .update(hidden ? { hidden: true, on_profile: false } : { hidden: false })
      .eq("id", id);
  }
}

export async function setVideoPinned(id: string): Promise<void> {
  const row = await readOne(id);
  if (!row) return;
  const rows = await readAll();
  for (const other of rows) {
    if (other.id !== id && other.projectId === row.projectId && other.phase === row.phase && other.pinned) {
      await patch(other.id, { pinned: false });
      if (isLive()) await browserSupabase().from("videos").update({ pinned: false }).eq("id", other.id);
    }
  }
  await patch(id, { pinned: true });
  if (isLive()) await browserSupabase().from("videos").update({ pinned: true }).eq("id", id);
}

export async function setVideoOnProfile(id: string, on: boolean): Promise<boolean> {
  const row = await readOne(id);
  if (!row || row.hidden) return false;
  const rows = await readAll();
  const chosen = rows.filter((item) => item.ownerId === row.ownerId && item.onProfile && !item.hidden && item.id !== id);
  if (on && chosen.length >= 4) return false;
  await patch(id, { onProfile: on });
  if (isLive()) {
    const updated = await browserSupabase().from("videos").update({ on_profile: on }).eq("id", id);
    if (updated.error) {
      await patch(id, { onProfile: !on });
      return false;
    }
  }
  return true;
}

export async function reportVideo(videoId: string, reporterId: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(REPORTS, "readwrite");
  tx.objectStore(REPORTS).put({
    id: `${videoId}:${reporterId}`,
    videoId,
    reporterId,
    createdAt: new Date().toISOString(),
  } satisfies ReportRow);
  await txDone(tx);
  if (isLive()) {
    await browserSupabase().from("video_reports").insert({ video_id: videoId, reporter_id: reporterId });
  }
  emit();
}

export async function clearVideoStore(): Promise<void> {
  for (const shown of cache.values()) {
    URL.revokeObjectURL(shown.posterUrl);
    URL.revokeObjectURL(shown.videoUrl);
  }
  cache.clear();
  emit();
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(CONSENT_KEY);
    window.localStorage.removeItem(WIFI_KEY);
  }
  const db = await openDb();
  const tx = db.transaction([STORE, REPORTS], "readwrite");
  tx.objectStore(STORE).clear();
  tx.objectStore(REPORTS).clear();
  await txDone(tx);
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => kickQueue());
  const net = connection() as (Net & EventTarget) | null;
  net?.addEventListener?.("change", () => kickQueue());
}
