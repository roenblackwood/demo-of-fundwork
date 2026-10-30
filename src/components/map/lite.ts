"use client";

import { useEffect, useState } from "react";

type NetworkInfo = {
  saveData?: boolean;
  effectiveType?: string;
};

export type MapPhase = "list" | "loading" | "map";

function connectionIsSlow(): boolean {
  const connection = (navigator as Navigator & { connection?: NetworkInfo }).connection;
  if (!connection) return false;
  if (connection.saveData) return true;
  return connection.effectiveType === "slow-2g" || connection.effectiveType === "2g" || connection.effectiveType === "3g";
}

function webglMissing(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !canvas.getContext("webgl2") && !canvas.getContext("webgl");
  } catch {
    return true;
  }
}

export function useMapPhase(): {
  phase: MapPhase;
  lite: boolean;
  failed: boolean;
  showMap: () => void;
  mapReady: () => void;
  mapFailed: () => void;
} {
  const [phase, setPhase] = useState<MapPhase>("list");
  const [lite, setLite] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const slow = connectionIsSlow() || webglMissing();
    // The network and WebGL checks only exist in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLite(slow);
    if (!slow) setPhase("loading");
  }, []);

  return {
    phase,
    lite,
    failed,
    showMap: () => {
      setFailed(false);
      setPhase("loading");
    },
    mapReady: () => {
      setFailed(false);
      setPhase("map");
    },
    mapFailed: () => {
      setLite(true);
      setFailed(true);
      setPhase("list");
    },
  };
}
