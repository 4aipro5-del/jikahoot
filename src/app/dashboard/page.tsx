"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import {
  signOutUser,
  subscribeToAuthState,
  updateTeacherDisplayName,
} from "@/lib/firebase/auth";
import {
  createRoom,
  deleteRoom,
  ensurePrimaryRoom,
  renameRoom,
  subscribeToRooms,
  updateRoomSettings,
} from "@/lib/firestore/rooms";
import {
  getRoomQuestionStats,
  subscribeToQuestionBank,
  type QuestionWithId,
  type RoomQuestionStats,
} from "@/lib/firestore/questions";
import type { RoomWithId } from "@/types/firestore";
import AccountMenu from "./AccountMenu";
import DashboardHome from "./DashboardHome";
import Drawer from "./Drawer";
import GameTab from "./GameTab";
import RoomsPanel from "./RoomsPanel";
import SettingsPanel from "./SettingsPanel";
import QuestionForm from "./QuestionForm";
import QuestionList from "./QuestionList";
import Sidebar, { type DashboardTab } from "./Sidebar";
import StageSkeleton from "@/components/StageSkeleton";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [rooms, setRooms] = useState<RoomWithId[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [statsByRoom, setStatsByRoom] = useState<Record<string, RoomQuestionStats>>({});
  const [showRooms, setShowRooms] = useState(false);
  // bumped after a display-name change to re-render children that read the
  // (mutated-in-place) Firebase Auth user.displayName; also re-runs room load
  const [profileTick, bumpProfile] = useState(0);
  const [checkedProfile, setCheckedProfile] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionWithId[]>([]);
  const [tab, setTab] = useState<DashboardTab>("dashboard");
  const [isNewQuestionOpen, setIsNewQuestionOpen] = useState(false);
  const ensuredRef = useRef(false);

  // the room the dashboard is currently managing (all tabs act on it)
  const room = rooms.find((r) => r.roomId === selectedRoomId) ?? null;
  const isGuest = Boolean(user?.isAnonymous);
  // a signed-in teacher with no display name (fresh guest) must set one first —
  // derived from Auth so the prompt clears the moment updateProfile lands
  const needsDisplayName = Boolean(user && !user.displayName?.trim());

  function selectTab(next: DashboardTab) {
    setShowRooms(false);
    setTab(next);
  }

  // 학생 문제 받기: 선택된 방 기준으로 전용 화면을 새 창으로 연다.
  function openSubmissionsWindow() {
    if (!room) return;
    const submissionsWindow = window.open(
      `/dashboard/submissions?room=${room.roomId}`,
      "jikahoot-submissions",
    );
    submissionsWindow?.focus();
  }

  useEffect(() => subscribeToAuthState(setUser), []);

  useEffect(() => {
    if (!selectedRoomId) return;
    return subscribeToQuestionBank(selectedRoomId, setQuestions);
  }, [selectedRoomId]);

  // one-shot aggregate stats per room for the room cards (refreshes when the
  // room list changes)
  useEffect(() => {
    if (rooms.length === 0) return;
    let cancelled = false;
    Promise.all(
      rooms.map(async (r) => [r.roomId, await getRoomQuestionStats(r.roomId)] as const),
    )
      .then((entries) => {
        if (!cancelled) setStatsByRoom(Object.fromEntries(entries));
      })
      .catch(() => {
        /* stats are best-effort; ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [rooms]);

  useEffect(() => {
    if (user === null) {
      router.replace("/");
      return;
    }
    if (!user) return;

    // no display name yet (fresh guest) → the derived `needsDisplayName` renders
    // the name prompt; don't load rooms until it's set.
    if (!user.displayName?.trim()) return;

    const uid = user.uid;
    ensuredRef.current = false;
    let cancelled = false;

    const unsub = subscribeToRooms(uid, (list) => {
      if (cancelled) return;
      if (list.length === 0) {
        // no room yet (new teacher) OR a legacy room not yet migrated — ensure
        // the primary room once; the subscription then picks it up.
        if (!ensuredRef.current) {
          ensuredRef.current = true;
          ensurePrimaryRoom(uid).catch((err) =>
            setError(err instanceof Error ? err.message : "방을 준비하지 못했습니다."),
          );
        }
        return;
      }
      setRooms(list);
      setSelectedRoomId((prev) =>
        prev && list.some((r) => r.roomId === prev) ? prev : list[0].roomId,
      );
      setCheckedProfile(true);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [user, router, profileTick]);

  async function handleDisplayNameSubmit(e: FormEvent) {
    e.preventDefault();
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
      // name now exists → derived needsDisplayName clears and the load effect
      // re-runs (profileTick) → rooms subscription starts
      bumpProfile((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "이름을 저장하지 못했습니다.");
    } finally {
      setSavingDisplayName(false);
    }
  }

  // Settings writes go straight to the room doc; the rooms subscription reflects
  // the change back into `room` (no local mirror needed).
  async function handleUpdateSettings(patch: Partial<RoomWithId>) {
    if (!room) return;
    await updateRoomSettings(room.roomId, patch);
  }

  async function handleUpdateDisplayName(name: string) {
    if (!user) return;
    // display name lives in Firebase Auth now; updateProfile mutates the current
    // user in place, so bump a tick to re-render children that read it.
    await updateTeacherDisplayName(user, name);
    bumpProfile((v) => v + 1);
  }

  function handleSelectRoom(roomId: string) {
    setSelectedRoomId(roomId);
    setShowRooms(false);
    setTab("dashboard");
  }

  async function handleCreateRoom(name: string) {
    if (!user) return;
    const created = await createRoom(user.uid, name);
    setSelectedRoomId(created.roomId); // switch to the new room (list updates live)
  }

  async function handleRenameRoom(roomId: string, name: string) {
    await renameRoom(roomId, name);
  }

  async function handleDeleteRoom(target: RoomWithId) {
    await deleteRoom(target.roomId, target.roomCode);
    if (selectedRoomId === target.roomId) {
      const next = rooms.find((r) => r.roomId !== target.roomId);
      setSelectedRoomId(next?.roomId ?? null);
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

  // The one-shot aggregate stats only refetch when the room LIST changes, so
  // they'd go stale as questions are submitted/approved/rejected/deleted. The
  // selected room's questionBank IS live-subscribed here, so derive its card
  // stats from that so its card always reflects the latest counts.
  const statsForCards: Record<string, RoomQuestionStats> = selectedRoomId
    ? {
        ...statsByRoom,
        [selectedRoomId]: {
          total: questions.length,
          pending: pendingCount,
          rejected: questions.filter((q) => q.status === "rejected").length,
        },
      }
    : statsByRoom;

  return (
    <div className="flex min-h-screen w-full flex-col bg-[var(--background)] lg:flex-row">
      <Sidebar active={tab} onSelect={selectTab} pendingCount={pendingCount} />

      <main className="relative min-w-0 flex-1 px-5 pb-6 pt-14 sm:px-8 sm:pb-8 sm:pt-16 lg:px-10">
        {/* 프로필: 레이아웃을 밀지 않도록 우측 상단에 absolute로 띄운다 */}
        <div className="absolute right-5 top-6 z-20 sm:right-8 sm:top-8 lg:right-10">
          <AccountMenu user={user} />
        </div>

        {showRooms ? (
          <RoomsPanel
            rooms={rooms}
            selectedRoomId={selectedRoomId}
            statsByRoom={statsForCards}
            isGuest={isGuest}
            onSelect={handleSelectRoom}
            onCreate={handleCreateRoom}
            onRename={handleRenameRoom}
            onDelete={handleDeleteRoom}
          />
        ) : (
          <>
            {tab === "dashboard" && (
              <DashboardHome
                displayName={user.displayName?.trim() || "선생님"}
                questions={questions}
                rooms={rooms}
                selectedRoomId={selectedRoomId}
                statsByRoom={statsForCards}
                isGuest={isGuest}
                onSelectRoom={handleSelectRoom}
                onManageRooms={() => setShowRooms(true)}
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
          </>
        )}
      </main>

      <Drawer open={isNewQuestionOpen} onClose={() => setIsNewQuestionOpen(false)} title="새 문제 만들기">
        <QuestionForm roomId={room.roomId} />
      </Drawer>
    </div>
  );
}
