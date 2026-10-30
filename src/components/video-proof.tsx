"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { VideoRecorder } from "@/components/video-recorder";
import { sectionTitle } from "@/components/parts";
import { Button } from "@/components/ui/button";
import { isLive } from "@/lib/mode";
import { townName } from "@/lib/profile";
import { useDemo } from "@/lib/demo-store";
import {
  cachedVideos,
  currentPhaseName,
  fileSizeLabel,
  queueLabel,
  refreshVideos,
  removeVideo,
  reportVideo,
  setVideoHidden,
  setVideoOnProfile,
  setVideoPinned,
  setWifiOnly,
  subscribeVideos,
  wifiOnlyEnabled,
  type ShownVideo,
} from "@/lib/videos";
import type { Project } from "@/lib/types";

function NoSoundTag() {
  return (
    <span className="absolute top-3 left-3 rounded-full bg-background/95 px-2 py-1 text-sm font-semibold">
      No sound
    </span>
  );
}

export function useVideos(): ShownVideo[] {
  const [rows, setRows] = useState<ShownVideo[]>(() => cachedVideos());
  useEffect(() => subscribeVideos(() => setRows(cachedVideos())), []);
  useEffect(() => {
    void refreshVideos();
  }, []);
  return rows;
}

export function VideoProof({
  id,
  allowPin = false,
  allowHide = false,
}: {
  id: string;
  allowPin?: boolean;
  allowHide?: boolean;
}) {
  const demo = useDemo();
  const video = useVideos().find((item) => item.id === id);
  const [playing, setPlaying] = useState(false);
  const [reported, setReported] = useState(false);
  const [profileNote, setProfileNote] = useState("");
  if (!video) return null;
  const mine = video.ownerId === demo.userId;
  const project = demo.projects.find((item) => item.id === video.projectId);
  const town = project ? townName(project.countryId, project.parishId, project.townId) : "";
  return (
    <figure className="space-y-2">
      <div className="relative">
        {!playing && video.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.posterUrl} alt={video.description} className="aspect-video w-full rounded-2xl object-cover" />
        ) : null}
        {video.silent ? <NoSoundTag /> : null}
        <video
          src={video.videoUrl}
          poster={video.posterUrl || undefined}
          preload="none"
          playsInline
          controls={playing}
          aria-label={video.description}
          className={playing ? "aspect-video w-full rounded-2xl bg-muted" : "sr-only"}
          onPlay={() => setPlaying(true)}
        />
        {!playing ? (
          <button
            type="button"
            className="absolute bottom-3 left-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-background/95 px-4 text-base font-semibold"
            onClick={(event) => {
              const node = event.currentTarget.parentElement?.querySelector("video");
              if (!(node instanceof HTMLVideoElement)) return;
              setPlaying(true);
              void node.play();
            }}
          >
            Play
            <span>{fileSizeLabel(video.bytes)}</span>
          </button>
        ) : (
          <p className="text-base">{fileSizeLabel(video.bytes)}</p>
        )}
      </div>
      <figcaption className="space-y-1">
        <p className="text-base">{video.description}</p>
        <p className="text-sm text-muted-foreground">Recorded in the app</p>
        {video.atSite ? (
          // A signal only. It never changes acceptance and never counts toward readiness.
          <div>
            <p className="text-sm text-muted-foreground">Phone was near the site</p>
            <p className="text-sm text-muted-foreground">
              {`The phone's location was within 5 km of ${town || "the town"} when this was filmed. Fundwork does not keep the location.`}
            </p>
          </div>
        ) : null}
        <p className="text-base font-semibold">{queueLabel(video.status, video.progress)}</p>
        {video.pinned ? <p className="text-sm font-semibold">Pinned</p> : null}
      </figcaption>
      <div className="flex flex-wrap gap-2">
        {!isLive() && mine ? (
          <Button type="button" size="sm" variant="outline" onClick={() => void removeVideo(video.id)}>
            Remove
          </Button>
        ) : null}
        {allowHide ? (
          <Button type="button" size="sm" variant="outline" onClick={() => void setVideoHidden(video.id, true)}>
            Hide
          </Button>
        ) : null}
        {allowPin && !video.pinned ? (
          <Button type="button" size="sm" variant="outline" onClick={() => void setVideoPinned(video.id)}>
            Pin
          </Button>
        ) : null}
        {mine ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              void setVideoOnProfile(video.id, !video.onProfile).then((ok) => {
                setProfileNote(ok ? "" : "4 videos is the limit.");
              });
            }}
          >
            {video.onProfile ? "Shown on your profile" : "Show on my profile"}
          </Button>
        ) : null}
        {!mine ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              void reportVideo(video.id, demo.userId);
              setReported(true);
            }}
          >
            {reported ? "Reported." : "Report"}
          </Button>
        ) : null}
      </div>
      {profileNote ? <p className="text-base">{profileNote}</p> : null}
    </figure>
  );
}

export function ProgressStrip({ project }: { project: Project }) {
  const demo = useDemo();
  const [open, setOpen] = useState(false);
  const phase = currentPhaseName(project);
  const onTeam = project.team.includes(demo.userId) || project.organizerId === demo.userId;
  const rows = useVideos()
    .filter((item) => item.projectId === project.id && item.phase === phase && !item.hidden)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <section className="space-y-3">
      <h2 className={sectionTitle}>Progress</h2>
      {rows.length === 0 ? <p className="text-lg">No video yet.</p> : null}
      <div className="flex gap-3 overflow-x-auto">
        {rows.map((item) => (
          <div key={item.id} className="w-64 shrink-0">
            <VideoProof
              id={item.id}
              allowPin={project.organizerId === demo.userId}
              allowHide={item.ownerId === demo.userId || project.organizerId === demo.userId}
            />
          </div>
        ))}
      </div>
      {onTeam ? (
        open ? (
          <VideoRecorder project={project} phase={phase} onSaved={() => setOpen(false)} />
        ) : (
          <Button type="button" size="lg" variant="outline" className="w-full" onClick={() => setOpen(true)}>
            Add a progress video
          </Button>
        )
      ) : null}
    </section>
  );
}

export function LatestProjectVideo({ projectId }: { projectId: string }) {
  const latest = useVideos()
    .filter((item) => item.projectId === projectId && !item.hidden)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!latest) return null;
  return <VideoProof id={latest.id} />;
}

export function WorkVideos() {
  const demo = useDemo();
  const [note, setNote] = useState("");
  const rows = useVideos().filter((item) => item.ownerId === demo.userId && !item.hidden);
  const shown = rows.filter((item) => item.onProfile).slice(0, 4);
  const rest = rows.filter((item) => !item.onProfile);
  return (
    <section className="space-y-3">
      <h2 className={sectionTitle}>Work videos</h2>
      {shown.length === 0 ? <p className="text-lg">None yet.</p> : null}
      <div className="grid gap-3">
        {shown.map((item) => (
          <VideoProof key={item.id} id={item.id} />
        ))}
      </div>
      {rest.map((item) => (
        <Button
          key={item.id}
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            void setVideoOnProfile(item.id, true).then((ok) => {
              setNote(ok ? "" : "4 videos is the limit.");
            });
          }}
        >
          {`Show on my profile: ${item.description}`}
        </Button>
      ))}
      {note ? <p className="text-base">{note}</p> : null}
    </section>
  );
}

export function WifiUploadSetting() {
  const on = useSyncExternalStore(subscribeVideos, wifiOnlyEnabled, () => false);
  return (
    <label className="flex min-h-11 items-center gap-3 text-base font-semibold">
      <input
        type="checkbox"
        className="size-5"
        checked={on}
        onChange={(event) => setWifiOnly(event.target.checked)}
      />
      Upload videos on Wi-Fi only
    </label>
  );
}
