"use client";

import { useEffect, useSyncExternalStore } from "react";
import { loadResidenceRules, residenceReady, subscribeResidence } from "@/lib/residence";

export function useResidenceReady(): boolean {
  const ready = useSyncExternalStore(subscribeResidence, residenceReady, () => false);
  useEffect(() => {
    void loadResidenceRules();
  }, []);
  return ready;
}
