// Short video can come later. This stores still photos only.

export type PhotoSubject = "request" | "project" | "profile";

export type StoredPhoto = {
  id: string;
  ownerId: string;
  subject: PhotoSubject;
  subjectId: string;
  alt: string;
  createdAt: string;
  blob: Blob;
};

export type ShownPhoto = {
  id: string;
  alt: string;
  url: string;
};

const DB_NAME = "fundwork-photos";
const STORE = "photos";
const MAX_EDGE = 1600;
const TARGET_BYTES = 200 * 1024;
const EMPTY: ShownPhoto[] = [];

const cache = new Map<string, ShownPhoto[]>();
const listeners = new Set<() => void>();

export function photoKey(subject: PhotoSubject, subjectId: string): string {
  return `${subject}:${subjectId}`;
}

export function subscribePhotos(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function cachedPhotos(subject: PhotoSubject, subjectId: string): ShownPhoto[] {
  return cache.get(photoKey(subject, subjectId)) ?? EMPTY;
}

export function rememberLive(subject: PhotoSubject, subjectId: string, rows: ShownPhoto[]): void {
  cache.set(photoKey(subject, subjectId), rows);
  emit();
}

function emit(): void {
  for (const listener of listeners) listener();
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("bySubject", ["subject", "subjectId"]);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function blobOf(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

export async function compressPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  let width = bitmap.width;
  let height = bitmap.height;
  const edge = Math.max(width, height);
  if (edge > MAX_EDGE) {
    const scale = MAX_EDGE / edge;
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("This photo could not be prepared.");
  }
  let quality = 0.82;
  let blob: Blob | null = null;
  for (let pass = 0; pass < 4; pass += 1) {
    canvas.width = width;
    canvas.height = height;
    context.drawImage(bitmap, 0, 0, width, height);
    quality = 0.82;
    blob = await blobOf(canvas, "image/webp", quality);
    while (blob && blob.size > TARGET_BYTES && quality > 0.45) {
      quality = Math.round((quality - 0.08) * 100) / 100;
      blob = await blobOf(canvas, "image/webp", quality);
    }
    if (blob && blob.size <= TARGET_BYTES * 1.15) break;
    width = Math.max(1, Math.round(width * 0.8));
    height = Math.max(1, Math.round(height * 0.8));
  }
  bitmap.close();
  if (!blob) throw new Error("This photo could not be prepared.");
  return blob;
}

export async function readPhotos(subject: PhotoSubject, subjectId: string): Promise<StoredPhoto[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const index = tx.objectStore(STORE).index("bySubject");
    const request = index.getAll([subject, subjectId]);
    request.onsuccess = () => {
      const rows = (request.result as StoredPhoto[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      resolve(rows);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function refreshPhotos(subject: PhotoSubject, subjectId: string): Promise<void> {
  const key = photoKey(subject, subjectId);
  const previous = cache.get(key) ?? [];
  for (const row of previous) URL.revokeObjectURL(row.url);
  const rows = await readPhotos(subject, subjectId);
  cache.set(
    key,
    rows.map((row) => ({ id: row.id, alt: row.alt, url: URL.createObjectURL(row.blob) })),
  );
  emit();
}

export async function saveDemoPhoto(input: {
  ownerId: string;
  subject: PhotoSubject;
  subjectId: string;
  alt: string;
  blob: Blob;
}): Promise<boolean> {
  const alt = input.alt.trim().slice(0, 200);
  if (!alt || !input.subjectId) return false;
  const existing = await readPhotos(input.subject, input.subjectId);
  if (existing.length >= 4) return false;
  const row: StoredPhoto = {
    id: crypto.randomUUID(),
    ownerId: input.ownerId,
    subject: input.subject,
    subjectId: input.subjectId,
    alt,
    createdAt: new Date().toISOString(),
    blob: input.blob,
  };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  await refreshPhotos(input.subject, input.subjectId);
  return true;
}

export async function clearPhotoStore(): Promise<void> {
  for (const rows of cache.values()) {
    for (const row of rows) URL.revokeObjectURL(row.url);
  }
  cache.clear();
  emit();
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
