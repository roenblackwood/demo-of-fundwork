"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function AddressQr({ value }: { value: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void QRCode.toDataURL(value, { margin: 1, width: 240 })
      .then((url) => {
        if (live) setSrc(url);
      })
      .catch(() => {
        if (live) setSrc(null);
      });
    return () => {
      live = false;
    };
  }, [value]);

  if (!src) return null;
  return (
    // The address is drawn from text the page already shows. next/image does not take this data URL.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="QR code for the project address" className="size-60 rounded-xl bg-white p-2" />
  );
}
