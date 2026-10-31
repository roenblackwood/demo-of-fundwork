"use client";

import { useEffect, useSyncExternalStore } from "react";
import { listPhotos } from "@/app/actions/photos";
import { isLive } from "@/lib/mode";
import {
  cachedPhotos,
  photoKey,
  refreshPhotos,
  rememberLive,
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

