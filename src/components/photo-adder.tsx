"use client";

import dynamic from "next/dynamic";

export const PhotoAdder = dynamic(() => import("@/components/photo-adder-form").then((mod) => mod.PhotoAdderForm), {
  ssr: false,
});
