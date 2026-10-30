"use client";

import { useState } from "react";
import { nearestTown, type PlacePick } from "@/lib/profile";

export function UseMyLocation({
  onTown,
  className,
}: {
  onTown: (place: PlacePick) => void;
  className: string;
}) {
  const [note, setNote] = useState("");

  function ask() {
    setNote("");
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setNote("No problem. Pick your town instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const place = nearestTown(position.coords.latitude, position.coords.longitude);
        if (!place) {
          setNote("No problem. Pick your town instead.");
          return;
        }
        onTown(place);
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
