"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { addPhoto, listPhotos } from "@/app/actions/photos";
import { isLive } from "@/lib/mode";
import {
  cachedPhotos,
  compressPhoto,
  photoKey,
  refreshPhotos,
  rememberLive,
  saveDemoPhoto,
  subscribePhotos,
  type PhotoSubject,
  type ShownPhoto,
} from "@/lib/photos";

const EMPTY: ShownPhoto[] = [];

export function usePhotos(subject: PhotoSubject, subjectId: string): ShownPhoto[] {
  const key = photoKey(subject, subjectId);
  const rows = useSyncExternalStore(
    subscribePhotos,
    () => cachedPhotos(subject, subjectId),
    () => EMPTY,
  );
  useEffect(() => {
    let live = true;
    async function load() {
      if (isLive()) {
        const next = await listPhotos(subject, subjectId);
        if (!live) return;
        rememberLive(subject, subjectId, next);
        return;
      }
      await refreshPhotos(subject, subjectId);
    }
    void load();
    return () => {
      live = false;
    };
  }, [subject, subjectId, key]);
  return rows;
}

export function PhotoAdder({
  subject,
  subjectId,
  ownerId,
  onSaved,
}: {
  subject: PhotoSubject;
  subjectId: string;
  ownerId: string;
  onSaved?: () => void;
}) {
  const photos = usePhotos(subject, subjectId);
  const [alt, setAlt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const full = photos.length >= 4;

  async function save() {
    if (!file || !alt.trim() || full || busy) return;
    setBusy(true);
    setNote("");
    try {
      const blob = await compressPhoto(file);
      const ok = isLive()
        ? await addPhoto(liveForm(subject, subjectId, alt.trim(), blob))
        : await saveDemoPhoto({ ownerId, subject, subjectId, alt, blob });
      if (!ok) {
        setNote(full ? "4 photos is the limit." : "That photo was not added.");
        return;
      }
      if (isLive()) {
        const next = await listPhotos(subject, subjectId);
        rememberLive(subject, subjectId, next);
      }
      setAlt("");
      setFile(null);
      onSaved?.();
    } catch {
      setNote("That photo was not added.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      {photos.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2">
          {photos.map((photo) => (
            <li key={photo.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={photo.alt} className="h-24 w-full rounded-xl object-cover" />
            </li>
          ))}
        </ul>
      ) : null}
      {full ? <p className="text-base">4 photos is the limit.</p> : null}
      {full ? null : (
        <div className="space-y-2">
          <p className="text-base">Only add photos of people who said yes.</p>
          <label className="block text-base font-semibold" htmlFor={`photo-file-${subject}-${subjectId}`}>
            Add a photo
          </label>
          <input
            id={`photo-file-${subject}-${subjectId}`}
            type="file"
            accept="image/*"
            className="block w-full text-sm"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <label className="block text-base font-semibold" htmlFor={`photo-alt-${subject}-${subjectId}`}>
            What is in this photo?
          </label>
          <input
            id={`photo-alt-${subject}-${subjectId}`}
            value={alt}
            onChange={(event) => setAlt(event.target.value)}
            className="h-11 w-full rounded-xl border border-input bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            disabled={busy || !file || !alt.trim()}
            onClick={() => void save()}
          >
            Add photo
          </button>
          {note ? <p className="text-base">{note}</p> : null}
        </div>
      )}
    </section>
  );
}

export function PageHero({
  sectorTile,
  photo,
}: {
  sectorTile: React.ReactNode;
  photo: ShownPhoto | null;
}) {
  if (!photo) return sectorTile;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo.url}
      alt={photo.alt}
      className="h-24 w-full rounded-2xl object-cover min-[840px]:h-40"
    />
  );
}

function liveForm(subject: PhotoSubject, subjectId: string, alt: string, blob: Blob): FormData {
  const form = new FormData();
  form.set("subject", subject);
  form.set("subjectId", subjectId);
  form.set("alt", alt);
  form.set("file", new File([blob], "photo.webp", { type: "image/webp" }));
  return form;
}
