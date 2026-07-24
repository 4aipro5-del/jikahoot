"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

// Points students straight at the submission join screen (/submit prefills the
// code from ?code=). Separate from GameQRCode, whose /?room= URL is load-bearing
// for the landing-page join flow.
export function buildSubmitUrl(roomCode: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/submit?code=${roomCode}`;
}

export default function SubmissionQRCode({ roomCode, size = 200 }: { roomCode: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const submitUrl = buildSubmitUrl(roomCode);

  useEffect(() => {
    if (!submitUrl) return;
    let cancelled = false;
    QRCode.toDataURL(submitUrl, {
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
  }, [submitUrl, size]);

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
  return <img src={dataUrl} alt="문제 제출 QR 코드" width={size} height={size} className="rounded-2xl" />;
}
