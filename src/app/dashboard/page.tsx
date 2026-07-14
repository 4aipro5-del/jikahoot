"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import {
  signOutUser,
  subscribeToAuthState,
  updateTeacherDisplayName,
} from "@/lib/firebase/auth";
import { getRoomByTeacherUid, syncRoomProfile } from "@/lib/firestore/rooms";
import type { Room } from "@/types/firestore";
import QuestionForm from "./QuestionForm";
import QuestionList from "./QuestionList";
import StartGameButton from "./StartGameButton";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [room, setRoom] = useState<Room | null>(null);
  const [checkedProfile, setCheckedProfile] = useState(false);
  const [needsDisplayName, setNeedsDisplayName] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeToAuthState(setUser), []);

  useEffect(() => {
    if (user === null) {
      router.replace("/");
      return;
    }
    if (!user) return;

    let active = true;

    async function loadTeacherRoom() {
      setError(null);
      setCheckedProfile(false);
      setNeedsDisplayName(false);
      setRoom(null);

      try {
        const existingRoom = await getRoomByTeacherUid(user.uid);
        if (!active) return;

        if (existingRoom?.displayName.trim()) {
          setRoom(existingRoom);
          return;
        }

        setDisplayNameInput("");
        setNeedsDisplayName(true);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "방 정보를 불러오지 못했습니다.");
      } finally {
        if (active) setCheckedProfile(true);
      }
    }

    void loadTeacherRoom();

    return () => {
      active = false;
    };
  }, [user, router]);

  async function handleDisplayNameSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || user.isAnonymous) return;

    const trimmedName = displayNameInput.trim();
    if (!trimmedName) {
      setError("사용할 이름을 입력해 주세요.");
      return;
    }

    setSavingDisplayName(true);
    setError(null);

    try {
      await updateTeacherDisplayName(user, trimmedName);
      const nextRoom = await syncRoomProfile(user);
      setRoom(nextRoom);
      setNeedsDisplayName(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "이름을 저장하지 못했습니다.");
    } finally {
      setSavingDisplayName(false);
    }
  }

  if (user && needsDisplayName) {
    return (
      <div className="stage-shell">
        <div className="stage-content flex min-h-screen items-center justify-center py-8">
          <div className="paper-panel w-full max-w-xl p-6 sm:p-8">
            <div className="flex flex-col gap-5">
              <div className="space-y-3">
                <p className="hero-chip hero-chip-paper">Teacher Profile</p>
                <h1 className="display-font text-[2.3rem] leading-none text-[var(--panel-text)] sm:text-5xl">
                  교사용 이름 설정
                </h1>
                <p className="paper-muted text-sm leading-6 sm:text-base">
                  처음 한 번만, 학생들에게 보여질 선생님 이름을 정해 주세요.
                </p>
              </div>

              <form onSubmit={handleDisplayNameSubmit} className="flex flex-col gap-4">
                <label className="flex flex-col gap-2">
                  <span className="paper-subtle text-sm font-black uppercase tracking-[0.18em]">
                    Display Name
                  </span>
                  <input
                    value={displayNameInput}
                    onChange={(e) => setDisplayNameInput(e.target.value)}
                    placeholder="예: 홍길동"
                    className="text-input"
                    maxLength={24}
                  />
                </label>

                {error && (
                  <p className="status-banner" data-tone="error">
                    {error}
                  </p>
                )}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="submit"
                    disabled={savingDisplayName}
                    className="primary-button w-full"
                  >
                    {savingDisplayName ? "이름 저장 중..." : "이 이름으로 시작"}
                  </button>
                  <button
                    type="button"
                    onClick={() => signOutUser()}
                    className="secondary-button w-full"
                  >
                    다시 로그인
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user || !checkedProfile || !room) {
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
