"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { User } from "firebase/auth";
import {
  signInStudentAnonymously,
  signInTeacherWithGoogle,
  subscribeToAuthState,
} from "@/lib/firebase/auth";
import { gameExists } from "@/lib/firestore/games";
import { resolveRoomCode } from "@/lib/firestore/roomCodes";

export default function Home() {
  return (
    <Suspense fallback={<PortalFallback />}>
      <HomePortal />
    </Suspense>
  );
}

function PortalFallback() {
  return (
    <div className="stage-shell">
        <div className="stage-content portal-stage flex min-h-screen items-center justify-center">
          <div className="quiz-panel px-6 py-5 text-center">
            <p className="paper-muted">퀴즈를 준비하는 중...</p>
          </div>
        </div>
    </div>
  );
}

function HomePortal() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [user, setUser] = useState<User | null>(null);
  const [code, setCode] = useState(() => searchParams.get("room")?.trim().toUpperCase() ?? "");
  const [nickname, setNickname] = useState("");
  const [joining, setJoining] = useState(false);
  const [studentError, setStudentError] = useState<string | null>(null);
  const [teacherError, setTeacherError] = useState<string | null>(null);

  useEffect(() => subscribeToAuthState(setUser), []);

  useEffect(() => {
    if (user && !user.isAnonymous) router.replace("/dashboard");
  }, [user, router]);

  async function handleTeacherSignIn() {
    setTeacherError(null);
    try {
      await signInTeacherWithGoogle();
    } catch (err) {
      const authError = err as { code?: string; message?: string };
      if (authError.code === "auth/unauthorized-domain") {
        setTeacherError(
          "Firebase 인증 허용 도메인에 현재 주소를 추가해야 해요. Firebase Console > Authentication > Settings > Authorized domains에서 localhost와 배포 도메인을 등록해 주세요.",
        );
        return;
      }
      setTeacherError(err instanceof Error ? err.message : "로그인에 실패했습니다.");
    }
  }

  async function handleStudentJoin(e: FormEvent) {
    e.preventDefault();
    setStudentError(null);

    const trimmedCode = code.trim().toUpperCase();
    const trimmedNickname = nickname.trim();
    if (!trimmedCode) {
      setStudentError("방/게임 코드를 입력해 주세요.");
      return;
    }
    if (!trimmedNickname) {
      setStudentError("이름(닉네임)을 입력해 주세요.");
      return;
    }

    setJoining(true);
    try {
      await signInStudentAnonymously();

      const [teacherUid, hasGame] = await Promise.all([
        resolveRoomCode(trimmedCode),
        gameExists(trimmedCode),
      ]);

      const q = `code=${encodeURIComponent(trimmedCode)}&nickname=${encodeURIComponent(trimmedNickname)}`;

      if (hasGame) {
        router.push(`/play?${q}`);
        return;
      }
      if (teacherUid) {
        router.push(`/submit?${q}`);
        return;
      }

      setStudentError("코드를 찾을 수 없어요. 선생님께 다시 확인해 주세요.");
      setJoining(false);
    } catch (err) {
      setStudentError(err instanceof Error ? err.message : "입장하지 못했습니다.");
      setJoining(false);
    }
  }

  if (user && !user.isAnonymous) {
    return (
      <div className="stage-shell">
        <div className="stage-content portal-stage flex min-h-screen items-center justify-center">
          <div className="quiz-panel px-6 py-5 text-center">
            <p className="paper-muted">교사용 대시보드로 이동 중...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stage-shell">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <span className="absolute left-[11%] top-[26%] h-5 w-5 rotate-45 rounded-sm bg-[var(--primary)]" />
        <span className="absolute left-[7%] top-[54%] h-6 w-6 rotate-12 rounded-sm bg-[var(--warning)]" />
        <span className="absolute left-[2%] top-[70%] h-5 w-5 -rotate-12 rounded-sm bg-[var(--primary)]/60" />
        <span className="absolute right-[7%] top-[52%] h-6 w-6 -rotate-12 rounded-sm bg-[var(--error)]" />
        <span className="absolute right-[15%] top-[16%] text-2xl text-[var(--warning)]">✦</span>
        <span className="absolute right-[5%] top-[8%] h-2 w-2 rounded-full bg-white/50" />
        <span className="absolute bottom-[6%] right-[5%] text-6xl text-[var(--primary)]">✦</span>
      </div>

      <div className="stage-content portal-stage relative flex min-h-screen flex-col justify-center gap-10 py-8 sm:py-12">
        <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--primary)] to-[#7b5cff] text-white">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2c.7 3.9 2.4 6.4 6 8-3.6 1.6-5.3 4.1-6 8-.7-3.9-2.4-6.4-6-8 3.6-1.6 5.3-4.1 6-8Z" />
                </svg>
              </span>
              <span className="display-font text-2xl text-white">Jikahoot</span>
            </div>

            <div className="flex flex-col items-end gap-2">
              <button
                onClick={handleTeacherSignIn}
                className="secondary-button secondary-button-compact inline-flex items-center gap-2"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
                </svg>
                교사 로그인
              </button>
              {teacherError && (
                <p className="status-banner max-w-[18rem] text-xs" data-tone="error">
                  {teacherError}
                </p>
              )}
            </div>
          </div>

          <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
            <h1 className="display-font text-4xl leading-[1.15] text-white sm:text-[2.9rem] lg:text-[3.4rem]">
              지금,
              <br />
              우리 반 <span className="text-[var(--primary)]">퀴즈</span>를 시작해요!
            </h1>
            <p className="text-base text-[color:var(--foreground-muted)] sm:text-lg">
              학생이 만들고, 함께 푸는 참여형 퀴즈
            </p>
          </div>

          <div className="mx-auto w-full max-w-xl rounded-[28px] border border-white/10 bg-[var(--surface)] p-6 sm:p-8">
            <form onSubmit={handleStudentJoin} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-bold text-white/80">방 코드</span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-white/60">
                    #
                  </span>
                  <input
                    value={code}
                    // room codes are A-Z/0-9 only — uppercase as the user types and
                    // strip anything else (한글·공백·기호), so Korean IME input never lands
                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                    placeholder="예: ABC123"
                    maxLength={6}
                    autoCapitalize="characters"
                    className="h-14 w-full rounded-2xl border border-white/20 bg-white/[0.08] pl-11 pr-4 text-lg font-bold text-white transition-colors placeholder:font-normal placeholder:text-white/60 hover:border-white/30 focus-visible:border-[var(--primary)] focus-visible:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(50,0,224,0.25)]"
                  />
                </div>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-bold text-white/80">이름</span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/60">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
                    </svg>
                  </span>
                  <input
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="이름을 입력하세요"
                    className="h-14 w-full rounded-2xl border border-white/20 bg-white/[0.08] pl-11 pr-4 text-lg font-bold text-white transition-colors placeholder:font-normal placeholder:text-white/60 hover:border-white/30 focus-visible:border-[var(--primary)] focus-visible:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(50,0,224,0.25)]"
                  />
                </div>
              </label>

              {studentError && (
                <p className="status-banner" data-tone="error">
                  {studentError}
                </p>
              )}

              <button
                type="submit"
                disabled={joining}
                className="primary-button w-full items-center justify-center gap-2"
              >
                {joining ? "코드 확인 중..." : "입장하기"}
                {!joining && (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                )}
              </button>
            </form>
          </div>

          <div className="mx-auto grid w-full max-w-3xl gap-4 sm:grid-cols-3">
            {[
              {
                title: "직접 문제 만들기",
                desc: "내가 만드는 우리 반 퀴즈",
                bg: "bg-white/10",
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                ),
              },
              {
                title: "실시간으로 함께 풀기",
                desc: "친구들과 바로바로 참여해요",
                bg: "bg-[var(--primary)]",
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7Z" />
                  </svg>
                ),
              },
              {
                title: "랭킹으로 더 재미있게",
                desc: "실시간 순위를 확인해요",
                bg: "bg-[var(--warning)] text-[#4a2c00]",
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 21h8" />
                    <path d="M12 17v4" />
                    <path d="M7 4h10v5a5 5 0 0 1-10 0Z" />
                    <path d="M17 5h3a3 3 0 0 1-3 4" />
                    <path d="M7 5H4a3 3 0 0 0 3 4" />
                  </svg>
                ),
              },
            ].map(({ title, desc, bg, icon }) => (
              <div
                key={title}
                className="flex flex-col items-center gap-3 rounded-[24px] bg-[var(--surface)] p-6 text-center"
              >
                <span
                  className={`inline-flex h-14 w-14 items-center justify-center rounded-full text-white ${bg}`}
                >
                  {icon}
                </span>
                <p className="display-font text-lg text-white">{title}</p>
                <p className="text-sm leading-6 text-[color:var(--foreground-muted)]">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
