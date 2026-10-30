"use client";

// Gallery uploads need GPS metadata removal on the server first.
// Server-side transcoding and multiple quality levels can come later.
// Automatic face blurring can come later.

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDemo } from "@/lib/demo-store";
import {
  VIDEO_MAX_SECONDS,
  atSiteNow,
  posterFromVideo,
  recorderMime,
  recorderOptions,
  rememberVideoConsent,
  saveVideo,
  sha256Of,
  videoConsent,
} from "@/lib/videos";

const DUPLICATE = "This video was already used. Record a new one.";
const CAP = "This phone can keep 5 videos. Remove one first.";
const SIZE = "This video is too large. Record a shorter one.";
const NO_SOUND = "No sound. The microphone is blocked or busy.";
const AUDIO_MS = 5000;

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

async function requestMic(): Promise<MediaStream | null> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return null;
  let drop = false;
  const pending = navigator.mediaDevices.getUserMedia({ audio: true });
  pending.then(
    (stream) => {
      if (drop) stopStream(stream);
    },
    () => undefined,
  );
  try {
    return await new Promise<MediaStream>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("timeout")), AUDIO_MS);
      pending.then(
        (stream) => {
          window.clearTimeout(timer);
          resolve(stream);
        },
        (error) => {
          window.clearTimeout(timer);
          reject(error);
        },
      );
    });
  } catch {
    drop = true;
    return null;
  }
}

type Stage = "consent" | "ready" | "recording" | "preparing" | "review";

export function VideoRecorder({
  project,
  phase,
  onSaved,
}: {
  project: { id: string; countryId: string; parishId: string | null; townId: string };
  phase: string;
  onSaved?: (id: string) => void;
}) {
  const demo = useDemo();
  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopRef = useRef<() => void>(() => undefined);
  const siteRef = useRef<Promise<boolean>>(Promise.resolve(false));
  const skipPrepareRef = useRef(false);
  const [stage, setStage] = useState<Stage>(videoConsent() ? "ready" : "consent");
  const [left, setLeft] = useState(VIDEO_MAX_SECONDS);
  const [muted, setMuted] = useState(false);
  const [noSound, setNoSound] = useState(false);
  const [note, setNote] = useState("");
  const [description, setDescription] = useState("");
  const [clip, setClip] = useState<{ blob: Blob; poster: Blob; mime: "video/mp4" | "video/webm"; sha256: string } | null>(null);
  const [posterUrl, setPosterUrl] = useState("");

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (posterUrl) URL.revokeObjectURL(posterUrl);
    };
  }, [posterUrl]);

  function stopTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function finishRecording() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
  }

  useEffect(() => {
    stopRef.current = finishRecording;
  });

  useEffect(() => {
    const preview = previewRef.current;
    const stream = streamRef.current;
    if (stage !== "recording" || !preview || !stream) return;
    preview.srcObject = stream;
    void preview.play().catch(() => undefined);
  }, [stage]);

  useEffect(() => {
    if (stage !== "recording") return;
    const timer = window.setInterval(() => {
      setLeft((value) => {
        if (value <= 1) {
          stopRef.current();
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [stage]);

  async function start(heldMic?: MediaStream | null) {
    skipPrepareRef.current = false;
    setNote("");
    const mime = recorderMime();
    if (!mime || typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setNote("This browser cannot record video.");
      return;
    }
    const video = {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
    };
    try {
      const picture = await navigator.mediaDevices.getUserMedia({ video, audio: false });
      const mic = heldMic === undefined ? await requestMic() : heldMic;
      const audible = Boolean(mic && mic.getAudioTracks().length > 0);
      if (!audible) stopStream(mic);
      const stream = new MediaStream([
        ...picture.getVideoTracks(),
        ...(audible && mic ? mic.getAudioTracks() : []),
      ]);
      streamRef.current = stream;
      siteRef.current = atSiteNow(project);
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, recorderOptions(mime));
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const heard = (streamRef.current?.getAudioTracks().length ?? 0) > 0;
        const blob = new Blob(chunksRef.current, { type: mime });
        stopTracks();
        if (skipPrepareRef.current) return;
        setNoSound(!heard);
        setStage("preparing");
        void prepare(blob, mime);
      };
      recorder.start(1000);
      setLeft(VIDEO_MAX_SECONDS);
      setMuted(false);
      setNoSound(!audible);
      setStage("recording");
    } catch {
      stopTracks();
      stopStream(heldMic ?? null);
      setNote("The camera did not start. Try again.");
      setStage("ready");
    }
  }

  async function trySoundAgain() {
    const mic = await requestMic();
    if (!mic) return;
    if (stage === "recording") {
      skipPrepareRef.current = true;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        await new Promise<void>((resolve) => {
          recorder.addEventListener("stop", () => resolve(), { once: true });
          recorder.stop();
        });
      }
      skipPrepareRef.current = false;
      stopTracks();
    }
    setClip(null);
    await start(mic);
  }

  async function prepare(blob: Blob, mime: "video/mp4" | "video/webm") {
    try {
      const [poster, sha256] = await Promise.all([posterFromVideo(blob), sha256Of(blob)]);
      if (posterUrl) URL.revokeObjectURL(posterUrl);
      setPosterUrl(URL.createObjectURL(poster));
      setClip({ blob, poster, mime, sha256 });
      setStage("review");
    } catch {
      setNote("This video could not be prepared.");
      setStage("ready");
    }
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
  }

  function retake() {
    setClip(null);
    setDescription("");
    setNote("");
    setNoSound(false);
    setStage("ready");
  }

  async function keepClip() {
    if (!clip || demo.saving) return;
    const result = await saveVideo({
      ownerId: demo.userId,
      projectId: project.id,
      contributionId: null,
      phase,
      description,
      atSite: await siteRef.current,
      silent: noSound,
      mime: clip.mime,
      blob: clip.blob,
      poster: clip.poster,
      sha256: clip.sha256,
    });
    if (!result.ok) {
      setNote(result.reason === "duplicate" ? DUPLICATE : result.reason === "cap" ? CAP : result.reason === "size" ? SIZE : "Add a short description.");
      return;
    }
    onSaved?.(result.id);
  }

  const radius = 18;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - left / VIDEO_MAX_SECONDS);

  return (
    <div className="space-y-3">
      {stage === "consent" ? (
        <div className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-lg leading-relaxed">Only film people who said yes. Stop if it is not safe to film.</p>
          <Button
            type="button"
            size="lg"
            className="w-full"
            onClick={() => {
              rememberVideoConsent();
              setStage("ready");
            }}
          >
            Got it
          </Button>
        </div>
      ) : null}
      {stage === "ready" ? (
        <Button type="button" size="lg" variant="work" className="w-full" onClick={() => void start()}>
          Record
        </Button>
      ) : null}
      {stage === "recording" ? (
        <div className="space-y-3">
          <video ref={previewRef} muted playsInline className="aspect-video w-full rounded-2xl bg-muted" />
          {noSound ? <NoSoundNote onRetry={() => void trySoundAgain()} /> : null}
          <div className="flex items-center gap-3">
            <div role="timer" aria-label={`${left} seconds left`} className="relative grid size-14 place-items-center">
              <svg viewBox="0 0 44 44" className="size-14" aria-hidden>
                <circle cx="22" cy="22" r={radius} fill="none" stroke="currentColor" strokeWidth="4" opacity="0.2" />
                <circle
                  cx="22"
                  cy="22"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeDasharray={circ}
                  strokeDashoffset={offset}
                  transform="rotate(-90 22 22)"
                />
              </svg>
              <span className="absolute text-sm font-semibold">{left}</span>
            </div>
            {noSound ? null : (
              <Button type="button" size="lg" variant="outline" onClick={toggleMute}>
                {muted ? "Sound on" : "Mute"}
              </Button>
            )}
            <Button type="button" size="lg" variant="work" onClick={finishRecording}>
              Stop
            </Button>
          </div>
        </div>
      ) : null}
      {stage === "preparing" ? <p className="text-lg">Preparing the video.</p> : null}
      {stage === "review" && clip ? (
        <div className="space-y-3">
          {posterUrl ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={posterUrl} alt={description || "Recorded video"} className="aspect-video w-full rounded-2xl object-cover" />
              {noSound ? (
                <span className="absolute top-3 left-3 rounded-full bg-background/95 px-2 py-1 text-sm font-semibold">
                  No sound
                </span>
              ) : null}
            </div>
          ) : null}
          {noSound ? <NoSoundNote onRetry={() => void trySoundAgain()} /> : null}
          <p className="text-base">{fileSizeText(clip.blob.size)}</p>
          <div className="space-y-2">
            <Label htmlFor="video-description">What does this show?</Label>
            <Input
              id="video-description"
              value={description}
              maxLength={120}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-3">
            <Button type="button" size="lg" variant="work" className="w-full" disabled={!description.trim()} onClick={() => void keepClip()}>
              Use this
            </Button>
            <Button type="button" size="lg" variant="outline" className="w-full" onClick={retake}>
              Retake
            </Button>
          </div>
        </div>
      ) : null}
      {note ? <p className="text-base">{note}</p> : null}
    </div>
  );
}

function NoSoundNote({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="space-y-2">
      <p className="text-base">{NO_SOUND}</p>
      <Button type="button" size="lg" variant="outline" className="w-full" onClick={onRetry}>
        Try sound again
      </Button>
    </div>
  );
}

function fileSizeText(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(Math.round((bytes / (1024 * 1024)) * 10) / 10).toFixed(1)} MB`;
}


