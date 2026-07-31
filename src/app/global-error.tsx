"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import "./globals.css";

// Last-resort boundary for errors thrown during React rendering. Next.js swaps
// out the root layout when this renders, so it has to bring its own <html>,
// <body> and stylesheet. Fonts come from the globals.css fallback stack rather
// than next/font, since layout.tsx never runs here.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full">
        <div className="stage-shell">
          <div className="stage-content flex min-h-screen items-center justify-center">
            <div className="quiz-panel w-full max-w-md px-7 py-8 text-center">
              <p className="text-5xl" aria-hidden="true">
                🎈
              </p>
              <h1
                className="mt-4 text-2xl font-black"
                style={{ color: "var(--panel-text)" }}
              >
                화면을 불러오지 못했어요
              </h1>
              <p className="paper-muted mt-3 text-sm leading-relaxed">
                예상치 못한 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.
                <br />
                문제는 자동으로 개발자에게 전달됩니다.
              </p>

              <div className="mt-7 flex flex-col items-stretch gap-3">
                <button type="button" className="primary-button" onClick={reset}>
                  다시 시도
                </button>
                {/* Deliberately a plain anchor, not next/link: the render tree
                    already failed here, so a full document load is the more
                    reliable way back than a client-side navigation. */}
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a href="/" className="secondary-button">
                  처음으로 돌아가기
                </a>
              </div>

              {error.digest ? (
                <p className="paper-faint mt-5 text-xs">오류 코드 {error.digest}</p>
              ) : null}
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
