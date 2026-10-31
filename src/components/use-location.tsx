"use client";

import { useState } from "react";
import { useDemo } from "@/lib/demo-store";
import { readPhonePlace } from "@/lib/locate";
import type { PlacePick } from "@/lib/profile";

export function UseMyLocation({
  onTown,
  className,
  who,
}: {
  onTown: (place: PlacePick) => void;
  className: string;
  who?: "investor" | "worker";
}) {
  const demo = useDemo();
  const role = who ?? (demo.role === "worker" ? "worker" : "investor");
  const [note, setNote] = useState("");

  function ask() {
    setNote("");
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setNote("No problem. Pick your town instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const found = readPhonePlace(position.coords.latitude, position.coords.longitude, role);
        if (!found.place) {
          setNote(found.note || "No problem. Pick your town instead.");
          return;
        }
        onTown(found.place);
      },
      () => setNote("No problem. Pick your town instead."),
      { enableHighAccuracy: false },
    );
  }

  return (
    <div>
      <button type="button" className={className} onClick={ask}>
        Use my location
      </button>
      {note ? <p className="mt-1 text-sm leading-5">{note}</p> : null}
    </div>
  );
}
