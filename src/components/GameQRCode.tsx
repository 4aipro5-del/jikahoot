"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

// the landing page's join form (src/app/page.tsx) reads this exact `room`
// query param to pre-fill the code input, so this URL shape is load-bearing
export function buildJoinUrl(gameCode: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/?room=${gameCode}`;
}

export default function GameQRCode({ gameCode, size = 240 }: { gameCode: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const joinUrl = buildJoinUrl(gameCode);

  useEffect(() => {
    if (!joinUrl) return;
    let cancelled = false;
    QRCode.toDataURL(joinUrl, {
      width: size,
      margin: 1,
      color: { dark: "#18161f", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch((err) => console.error("QR 코드를 생성하지 못했습니다.", err));
    return () => {
      cancelled = true;
    };
  }, [joinUrl, size]);

  if (!dataUrl) {
    return (
      <div
        className="animate-pulse rounded-2xl bg-white/10"
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={dataUrl} alt="참가 QR 코드" width={size} height={size} className="rounded-2xl" />;
}
