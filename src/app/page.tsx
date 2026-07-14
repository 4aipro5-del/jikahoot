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
          <p className="text-white/70">무대를 준비하는 중...</p>
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
            <p className="text-white/70">교사용 대시보드로 이동 중...</p>
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
            <section className="quiz-panel flex flex-col gap-8 p-6 sm:p-8 lg:p-10">
              <div className="space-y-3">
                <h1 className="display-font text-4xl leading-[1.08] text-white sm:text-[2.8rem] lg:text-[3.6rem] xl:text-[3.85rem]">
                  교실을 바로
                  <br />
                  퀴즈 쇼로.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-white/80 sm:text-lg">
                  학생은 코드만 입력하면 바로 참여하고, 선생님은 문제 은행으로 게임을
                  시작할 수 있어요. 첫 화면부터 에너지 있는 무대감이 느껴지도록
                  리디자인했어요.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  ["빠른 입장", "코드와 닉네임만 입력하면 자동으로 맞는 화면으로 이동"],
                  ["학생 퀴즈", "학생도 문제를 만들고 바로 풀 수 있어요."],
                  ["교사용 진행", "참가 코드, 응답 수, 다음 문제를 한눈에 보는 진행 화면"],
                ].map(([title, desc], index) => (
                  <div
                    key={title}
                    className={`rounded-[26px] border border-white/12 p-4 text-white/90 ${
                      index === 1 ? "floaty bg-white/12" : "bg-white/8"
                    }`}
                  >
                    <p className="display-font text-2xl">{title}</p>
                    <p className="mt-2 text-sm leading-6 text-white/72">{desc}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="paper-panel p-6 sm:p-8">
              <div className="flex flex-col gap-5">
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

                <form onSubmit={handleStudentJoin} className="flex flex-col gap-4">
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="방/게임 코드 6자리"
                    className="text-input code-input"
                    maxLength={6}
                  />
                  <input
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="이름(닉네임)"
                    className="text-input"
                  />

                  {studentError && (
                    <p className="status-banner" data-tone="error">
                      {studentError}
                    </p>
                  )}

                  <button type="submit" disabled={joining} className="primary-button w-full">
                    {joining ? "코드 확인 중..." : "바로 입장하기"}
                  </button>
                </form>
              </div>
            </section>
          </div>

          <section className="grid gap-4 lg:grid-cols-[1fr_auto]">
            <div className="quiz-panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.22em] text-white/58">
                  Teacher Zone
                </p>
                <h3 className="display-font mt-2 text-3xl text-white">교사용 페이지</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/72">
                  Google 로그인 후 방 코드, 승인된 문제, 현재 게임 진행 상황을 관리할 수
                  있어요.
                </p>
              </div>

              <div className="flex min-w-[230px] flex-col items-start gap-3">
                <button onClick={handleTeacherSignIn} className="secondary-button w-full">
                  Google 로그인
                </button>
                {teacherError && (
                  <p className="status-banner w-full" data-tone="error">
                    {teacherError}
                  </p>
                )}
              </div>
            </div>

            <div className="paper-panel flex items-center gap-4 p-5 text-sm font-bold sm:p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--kahoot-yellow)] text-xl text-[#432700]">
                !
              </span>
              <p className="paper-muted text-base leading-7 sm:text-[1.05rem]">
                <span className="block">학생은 한 번 코드와 이름을 넣으면,</span>
                <span className="block">방 상태에 따라 제출 화면 또는 게임 화면으로 자연스럽게 이어집니다.</span>
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
