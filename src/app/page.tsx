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
      <div className="stage-content portal-stage flex min-h-screen flex-col justify-center py-8 sm:py-12">
        <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-6">
          <div className="flex justify-center lg:justify-start">
            <span className="hero-chip">Classroom Quiz Show</span>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr] xl:gap-8">
            <div className="flex flex-col gap-4 lg:h-full">
              <section className="quiz-panel kahoot-spectrum-panel flex flex-col gap-8 p-6 sm:p-8 lg:flex-1 lg:p-10">
                <div className="space-y-3">
                  <h1 className="display-font text-4xl leading-[1.08] text-[var(--panel-text)] sm:text-[2.8rem] lg:text-[3.6rem] xl:text-[3.85rem]">
                    교실을 바로
                    <br />
                    퀴즈 쇼로.
                  </h1>
                  <p className="paper-muted max-w-2xl text-base leading-7 sm:text-lg">
                    학생은 코드만 입력하면 바로 참여하고, 선생님은 문제 은행으로 게임을
                    시작할 수 있어요. 첫 화면부터 에너지 있는 무대감이 느껴지도록
                    리디자인했어요.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    [
                      "빠른 입장",
                      "코드와 닉네임만 넣으면 바로 입장해요.",
                      "kahoot-accent-card",
                      "blue",
                    ],
                    [
                      "학생 퀴즈",
                      "학생도 문제를 만들고 바로 참여할 수 있어요.",
                      "kahoot-accent-card",
                      "red",
                    ],
                    [
                      "교사용 진행",
                      "코드, 응답 수, 다음 문제를 한눈에 확인해요.",
                      "kahoot-accent-card",
                      "yellow",
                    ],
                    [
                      "정답 보너스",
                      "연속으로 빠르게 정답을 맞히면 보너스를 얻어요.",
                      "kahoot-accent-card",
                      "purple",
                    ],
                  ].map(([title, desc, toneClass, tone], index) => (
                    <div
                      key={title}
                      data-tone={tone}
                      className={`rounded-[26px] border p-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] ${
                        index === 1 ? `floaty ${toneClass}` : toneClass
                      }`}
                    >
                      <p className="display-font text-2xl text-[var(--panel-text)]">{title}</p>
                      <p className="paper-muted mt-2 text-sm leading-6">{desc}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="quiz-panel kahoot-spectrum-panel flex flex-col gap-4 p-5 sm:grid sm:grid-cols-[minmax(0,1fr)_14.5rem] sm:items-start sm:gap-5 sm:p-6">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black uppercase tracking-[0.22em] text-[color:rgba(70,163,2,0.78)]">
                    Teacher Zone
                  </p>
                  <h3 className="display-font mt-2 text-3xl text-[var(--panel-text)]">교사용 페이지</h3>
                  <p className="paper-muted mt-2 text-sm leading-6 sm:whitespace-nowrap sm:text-[0.95rem]">
                    Google 로그인 후 방 코드, 승인된 문제, 현재 게임 진행 상황을 관리할 수
                    있어요.
                  </p>
                </div>

                <div className="flex min-w-0 flex-col items-start gap-3 sm:self-start sm:pt-1">
                  <button
                    onClick={handleTeacherSignIn}
                    className="secondary-button secondary-button-soft-green w-full sm:w-[14.5rem]"
                  >
                    Google 로그인
                  </button>
                  {teacherError && (
                    <p className="status-banner w-full" data-tone="error">
                      {teacherError}
                    </p>
                  )}
                </div>
              </section>
            </div>

            <section className="paper-panel kahoot-spectrum-paper student-entry-panel p-6 sm:p-8 lg:h-full">
              <div className="grid h-full grid-rows-[auto_1fr_auto] gap-6">
                <div>
                  <p className="hero-chip hero-chip-paper">Student Entry</p>
                  <h2 className="display-font mt-4 text-4xl text-[var(--panel-text)] sm:text-5xl">
                    게임 코드 입력
                  </h2>
                  <p className="paper-muted mt-2 max-w-[32rem] text-sm leading-6 sm:text-base">
                    선생님이 알려준 코드를 넣으면 문제 제출 또는 플레이 화면으로 자동
                    연결돼요.
                  </p>
                </div>

                <div className="flex flex-col justify-center">
                  <form onSubmit={handleStudentJoin} className="flex flex-col gap-4">
                    <input
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="방/게임 코드 6자리"
                      className="text-input code-input student-entry-input"
                      maxLength={6}
                    />
                    <input
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="이름(닉네임)"
                      className="text-input student-entry-input student-entry-name-input"
                    />

                    {studentError && (
                      <p className="status-banner" data-tone="error">
                        {studentError}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={joining}
                      className="primary-button w-full"
                    >
                      {joining ? "코드 확인 중..." : "바로 입장하기"}
                    </button>
                  </form>
                </div>

                <div className="kahoot-soft-note flex items-center gap-4 rounded-[24px] p-4 text-sm font-bold sm:p-5">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--kahoot-yellow)] text-xl text-[#432700]">
                    !
                  </span>
                  <p className="paper-muted text-base leading-7">
                    학생은 한 번 코드와 이름을 넣으면, 방 상태에 따라 제출 화면 또는 게임
                    화면으로 자연스럽게 이어집니다.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
