"use client";

import dynamic from "next/dynamic";

export const MapView = dynamic(() => import("./fundwork-map").then((mod) => mod.FundworkMap), {
  ssr: false,
});
