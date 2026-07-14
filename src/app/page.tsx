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
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <p className="text-zinc-500">불러오는 중...</p>
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

  // students carry an anonymous session from /submit or /play, so only a
  // real (non-anonymous) teacher session should bounce to the dashboard
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
      // roomCodes/games 조회 모두 인증이 필요하므로 먼저 익명 로그인부터 한다.
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
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-zinc-500">대시보드로 이동 중...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-zinc-50 p-8 font-sans dark:bg-black">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
        초등 카훗 퀴즈 빌더
      </h1>

      <div className="flex w-full max-w-sm flex-col gap-3 rounded-lg border border-black/[.08] p-6 dark:border-white/[.145]">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">학생 입장하기</h2>
        <p className="text-xs text-zinc-500">
          선생님이 알려준 코드를 입력하면 문제 제출과 게임 참여 중 알맞은 곳으로 자동으로
          연결돼요.
        </p>

        <form onSubmit={handleStudentJoin} className="flex flex-col gap-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="방/게임 코드 6자리"
            className="rounded-md border border-black/[.08] px-3 py-2 text-center font-mono uppercase tracking-widest dark:border-white/[.145] dark:bg-black"
            maxLength={6}
          />
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="이름(닉네임)"
            className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
          />

          {studentError && <p className="text-sm text-red-600">{studentError}</p>}

          <button
            type="submit"
            disabled={joining}
            className="rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
          >
            {joining ? "확인 중..." : "입장하기"}
          </button>
        </form>
      </div>

      <div className="flex flex-col items-center gap-2">
        <button
          onClick={handleTeacherSignIn}
          className="rounded-full border border-black/[.08] px-4 py-2 text-sm font-medium hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
        >
          Google로 로그인 (교사)
        </button>
        {teacherError && <p className="text-sm text-red-600">{teacherError}</p>}
      </div>
    </div>
  );
}
