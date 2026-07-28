"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import {
  signOutUser,
  subscribeToAuthState,
  updateTeacherDisplayName,
} from "@/lib/firebase/auth";
import { ensurePrimaryRoom, updateRoomSettings } from "@/lib/firestore/rooms";
import { subscribeToQuestionBank, type QuestionWithId } from "@/lib/firestore/questions";
import type { RoomWithId } from "@/types/firestore";
import AccountMenu from "./AccountMenu";
import DashboardHome from "./DashboardHome";
import Drawer from "./Drawer";
import GameTab from "./GameTab";
import SettingsPanel from "./SettingsPanel";
import QuestionForm from "./QuestionForm";
import QuestionList from "./QuestionList";
import Sidebar, { type DashboardTab } from "./Sidebar";
import StageSkeleton from "@/components/StageSkeleton";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [room, setRoom] = useState<RoomWithId | null>(null);
  // bumped after a display-name change to re-render children that read the
  // (mutated-in-place) Firebase Auth user.displayName
  const [, bumpProfile] = useState(0);
  const [checkedProfile, setCheckedProfile] = useState(false);
  const [needsDisplayName, setNeedsDisplayName] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionWithId[]>([]);
  const [tab, setTab] = useState<DashboardTab>("dashboard");
  const [isNewQuestionOpen, setIsNewQuestionOpen] = useState(false);

  function selectTab(next: DashboardTab) {
    setTab(next);
  }

  // 학생 문제 받기: 전용 화면을 새 창으로 연다(고정 window name으로 재사용/포커스).
  // 교사는 원래 문제 관리 창을 그대로 유지하고, 새 창은 학생용 QR·제출 코드·현황
  // 표시(프로젝션) 용도로 쓴다.
  function openSubmissionsWindow() {
    const submissionsWindow = window.open("/dashboard/submissions", "jikahoot-submissions");
    submissionsWindow?.focus();
  }

  useEffect(() => subscribeToAuthState(setUser), []);

  useEffect(() => {
    if (!room) return;
    return subscribeToQuestionBank(room.roomId, setQuestions);
  }, [room]);

  useEffect(() => {
    if (user === null) {
      router.replace("/");
      return;
    }
    if (!user) return;

    const currentUser = user;

    let active = true;

    async function loadTeacherRoom() {
      setError(null);
      setCheckedProfile(false);
      setNeedsDisplayName(false);
      setRoom(null);

      try {
        // profile (name) now lives in Firebase Auth — a teacher without a
        // display name (fresh guest) sets it first, then we ensure their room.
        if (!currentUser.displayName?.trim()) {
          setDisplayNameInput("");
          setNeedsDisplayName(true);
          return;
        }

        const room = await ensurePrimaryRoom(currentUser.uid);
        if (!active) return;
        setRoom(room);
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
    // guest (anonymous) teachers must be able to set their name too — the room
    // is created off their uid just like a Google teacher's
    if (!user) return;

    const trimmedName = displayNameInput.trim();
    if (!trimmedName) {
      setError("사용할 이름을 입력해 주세요.");
      return;
    }

    setSavingDisplayName(true);
    setError(null);

    try {
      await updateTeacherDisplayName(user, trimmedName);
      const nextRoom = await ensurePrimaryRoom(user.uid);
      setRoom(nextRoom);
      setNeedsDisplayName(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "이름을 저장하지 못했습니다.");
    } finally {
      setSavingDisplayName(false);
    }
  }

  // Settings tab writes: persist to the Room doc, then optimistically fold the
  // change into local state so the greeting/account-menu/game defaults reflect
  // it immediately (the room is loaded once, not subscribed).
  async function handleUpdateSettings(patch: Partial<RoomWithId>) {
    if (!room) return;
    await updateRoomSettings(room.roomId, patch);
    setRoom({ ...room, ...patch });
  }

  async function handleUpdateDisplayName(name: string) {
    if (!user) return;
    // display name lives in Firebase Auth now; updateProfile mutates the current
    // user in place, so bump a tick to re-render children that read it.
    await updateTeacherDisplayName(user, name);
    bumpProfile((v) => v + 1);
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
                    className="primary-button primary-button-neutral w-full"
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
    // no loading message while auth/room restore — show the neutral shell, and
    // only surface a real error if one occurred
    if (!error) return <StageSkeleton />;
    return (
      <div className="stage-shell">
        <div className="stage-content flex min-h-screen items-center justify-center">
          <div className="quiz-panel px-6 py-5 text-center">
            <p className="status-banner" data-tone="error">
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const pendingCount = questions.filter((q) => q.status === "pending").length;

  return (
    <div className="flex min-h-screen w-full flex-col bg-[var(--background)] lg:flex-row">
      <Sidebar active={tab} onSelect={selectTab} pendingCount={pendingCount} />

      <main className="min-w-0 flex-1 px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
        <div className="mb-6 flex justify-end">
          <AccountMenu user={user} />
        </div>

        {tab === "dashboard" && (
          <DashboardHome
            displayName={user.displayName?.trim() || "선생님"}
            questions={questions}
            onViewApprovals={() => setTab("approval")}
          />
        )}

        {tab === "approval" && (
          <QuestionList
            roomId={room.roomId}
            questions={questions}
            onNewQuestion={() => setIsNewQuestionOpen(true)}
            onReceiveStudentQuestions={openSubmissionsWindow}
          />
        )}

        {tab === "game" && (
          <GameTab roomId={room.roomId} ownerUid={room.ownerUid} questions={questions} />
        )}
        {tab === "settings" && (
          <SettingsPanel
            room={room}
            user={user}
            onUpdateSettings={handleUpdateSettings}
            onUpdateDisplayName={handleUpdateDisplayName}
          />
        )}
      </main>

      <Drawer open={isNewQuestionOpen} onClose={() => setIsNewQuestionOpen(false)} title="새 문제 만들기">
        <QuestionForm roomId={room.roomId} />
      </Drawer>
    </div>
  );
}
