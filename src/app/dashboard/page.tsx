"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import { signOutUser, subscribeToAuthState } from "@/lib/firebase/auth";
import { ensureRoom } from "@/lib/firestore/rooms";
import type { Room } from "@/types/firestore";
import QuestionForm from "./QuestionForm";
import QuestionList from "./QuestionList";
import StartGameButton from "./StartGameButton";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeToAuthState(setUser), []);

  useEffect(() => {
    if (user === null) {
      router.replace("/");
      return;
    }
    if (!user) return;

    ensureRoom(user)
      .then(setRoom)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "방 정보를 불러오지 못했습니다."),
      );
  }, [user, router]);

  if (!user || !room) {
    return (
      <div className="stage-shell">
        <div className="stage-content flex min-h-screen items-center justify-center">
          <div className="quiz-panel px-6 py-5 text-center">
            <p className="text-white/70">{error ?? "교사용 무대를 준비하는 중..."}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stage-shell">
      <div className="stage-content dashboard-stage flex min-h-screen flex-col gap-8 py-8">
        <header className="quiz-panel p-6 sm:p-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-3">
              <p className="text-sm font-black uppercase tracking-[0.22em] text-white/58">
                Teacher Stage
              </p>
              <h1 className="display-font text-4xl text-white sm:text-5xl">
                {room.displayName} 선생님의 퀴즈 무대
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-white/74 sm:text-base">
                문제를 승인하고, 바로 새 게임을 열고, 참가 코드를 학생에게 공유할 수 있는
                교사용 진행 화면이에요.
              </p>
            </div>

            <div className="flex flex-col items-start gap-3 sm:items-end">
              <div className="rounded-[26px] bg-white px-5 py-4 text-[var(--panel-text)] shadow-[0_14px_0_rgba(38,18,87,0.18)]">
                <p className="paper-ghost text-xs font-black uppercase tracking-[0.2em]">
                  Room Code
                </p>
                <p className="display-font mt-2 text-5xl sm:text-6xl">{room.roomCode}</p>
              </div>
              <button onClick={() => signOutUser()} className="secondary-button">
                로그아웃
              </button>
            </div>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1fr_1.15fr_1fr] lg:items-start 2xl:grid-cols-[1fr_1.22fr_1fr]">
          <div className="flex flex-col gap-6">
            <StartGameButton teacherUid={room.teacherUid} />
          </div>

          <div className="flex flex-col gap-6">
            <QuestionList teacherUid={room.teacherUid} />
          </div>

          <div className="flex flex-col gap-6">
            <QuestionForm teacherUid={room.teacherUid} />
          </div>
        </div>
      </div>
    </div>
  );
}
