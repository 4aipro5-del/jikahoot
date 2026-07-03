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
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-zinc-500">{error ?? "불러오는 중..."}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{room.displayName} 선생님의 방</h1>
          <p className="text-sm text-zinc-500">
            문제 제출 코드: <span className="font-mono font-semibold">{room.roomCode}</span>
          </p>
        </div>
        <button
          onClick={() => signOutUser()}
          className="rounded-full border border-black/[.08] px-4 py-2 text-sm font-medium hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
        >
          로그아웃
        </button>
      </header>

      <StartGameButton teacherUid={room.teacherUid} />
      <QuestionForm teacherUid={room.teacherUid} />
      <QuestionList teacherUid={room.teacherUid} />
    </div>
  );
}
