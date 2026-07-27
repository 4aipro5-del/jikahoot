"use client";

import { useEffect, useState } from "react";
import { createGame } from "@/lib/firestore/games";
import { subscribeToRoom } from "@/lib/firestore/rooms";
import type { QuestionWithId } from "@/lib/firestore/questions";
import { QUESTION_DURATION_SEC } from "@/lib/gameConfig";
import type { Room } from "@/types/firestore";

// 게임 운영 창은 고정된 window name을 써서 다시 열어도 같은 창을 재사용한다.
const GAME_WINDOW_NAME = "jikahoot-game";
function gameWindowUrl(code: string) {
  return `/dashboard/game/${code}`;
}

// 다크 배경에서 잘 보이도록 브랜드 primary를 밝게 보정한 강조 퍼플(토큰 유지).
const ACCENT_PURPLE = "color-mix(in srgb, var(--primary) 55%, #ffffff)";

// The Game tab (main window) is a thin status surface only. Starting a game
// pops the full host console out into a dedicated window (GameHostClient at
// /dashboard/game/[code]) where ALL operation happens — lobby/QR/code/roster/
// start/progress/results. The main window never renders the lobby or controls;
// it just shows a "game in progress" placeholder and a re-open button.
export default function GameTab({
  teacherUid,
  questions,
}: {
  teacherUid: string;
  questions: QuestionWithId[];
}) {
  const [currentGameId, setCurrentGameId] = useState<string | null | undefined>(undefined);
  const [room, setRoom] = useState<Room | null>(null);

  useEffect(() => {
    return subscribeToRoom(teacherUid, (nextRoom) => {
      setRoom(nextRoom);
      setCurrentGameId(nextRoom?.currentGameId ?? null);
    });
  }, [teacherUid]);

  if (currentGameId === undefined) {
    return null;
  }

  if (!currentGameId) {
    return <StartGameScreen teacherUid={teacherUid} questions={questions} room={room} />;
  }

  return <GameInProgressScreen gameCode={currentGameId} />;
}

function StartGameScreen({
  teacherUid,
  questions,
  room,
}: {
  teacherUid: string;
  questions: QuestionWithId[];
  room: Room | null;
}) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // fall back to the built-in defaults until the room settings have loaded (or
  // for rooms that never touched the Settings tab)
  const durationSec = room?.defaultQuestionDurationSec ?? QUESTION_DURATION_SEC;
  const autoAdvance = room?.autoAdvance ?? true;

  const approved = questions.filter((q) => q.status === "approved");
  const estimatedMinutes = Math.round((approved.length * durationSec) / 60);

  async function handleStart() {
    setError(null);
    setStarting(true);
    // 팝업 차단을 피하려 클릭 제스처 안에서 운영 창을 먼저 열고, 게임 코드가
    // 나오면 그 창을 게임 라우트로 이동시킨다. 원래 창은 room.currentGameId
    // 구독으로 '게임 진행 중' 상태 화면으로 전환된다(로비로 전환하지 않음).
    const gameWindow = window.open("about:blank", GAME_WINDOW_NAME);
    try {
      const publicQuestions = approved.map((q) => ({ id: q.id, text: q.text, choices: q.choices }));
      const code = await createGame(teacherUid, publicQuestions, durationSec, autoAdvance);
      if (gameWindow) gameWindow.location.href = gameWindowUrl(code);
    } catch (err) {
      gameWindow?.close();
      setError(err instanceof Error ? err.message : "게임을 시작하지 못했습니다.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-9 py-12 text-center">
      <div className="space-y-4">
        <p className="hero-chip">Game</p>
        <h1 className="display-font text-5xl leading-none text-white sm:text-6xl">새로운 게임 시작</h1>
      </div>

      <p className="max-w-md text-lg leading-8 text-[color:var(--foreground-muted)]">
        오늘 사용할 문제를 선택하고
        <br />
        학생들과 <span className="font-bold text-[var(--success)]">실시간 퀴즈</span>를
        시작하세요.
      </p>

      {/* 통계: 사용 가능한 문제 / 예상 플레이 시간 */}
      <div className="flex items-center gap-8">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-white/50">사용 가능한 문제</p>
          <p className="display-font mt-2 text-4xl text-white">{approved.length}개</p>
        </div>
        <span className="h-12 w-px flex-none bg-white/12" />
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-white/50">예상 플레이 시간</p>
          <p className="display-font mt-2 text-4xl text-white">
            {estimatedMinutes > 0 ? `약 ${estimatedMinutes}분` : "-"}
          </p>
        </div>
      </div>

      <button
        onClick={handleStart}
        disabled={approved.length === 0 || starting}
        className="inline-flex min-h-[4.75rem] w-full max-w-md items-center justify-center rounded-2xl border-2 border-white/15 bg-[var(--error)] px-8 text-4xl font-black text-white shadow-[0_8px_0_var(--error-dark)] transition-transform duration-150 enabled:hover:-translate-y-0.5 enabled:active:translate-y-1 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {starting ? "게임 준비 중..." : "새 게임 시작"}
      </button>

      {approved.length === 0 && (
        <p className="text-sm text-white/50">승인된 문제가 있어야 게임을 시작할 수 있어요.</p>
      )}
      {error && (
        <p className="status-banner max-w-md text-sm" data-tone="error">
          {error}
        </p>
      )}
    </div>
  );
}

// 원래 창: 게임이 진행 중임을 알리고, 운영은 새 창에서 이뤄진다는 안내만 제공한다.
// 참가자/QR/코드/게임 시작 등 제어 요소는 여기에 두지 않는다.
function GameInProgressScreen({ gameCode }: { gameCode: string }) {
  function openGameWindow() {
    // 고정 window name → 이미 열린 운영 창이 있으면 재사용/포커스한다.
    const gameWindow = window.open(gameWindowUrl(gameCode), GAME_WINDOW_NAME);
    gameWindow?.focus();
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-9 py-12 text-center">
      <div className="space-y-4">
        <p className="hero-chip">Game Status</p>
        <h1 className="display-font text-5xl leading-none text-white sm:text-6xl">게임 진행 중</h1>
      </div>

      <p className="max-w-md text-lg leading-8 text-[color:var(--foreground-muted)]">
        참가자 관리와 게임 진행은
        <br />
        별도의 <span className="font-bold" style={{ color: ACCENT_PURPLE }}>게임 창</span>에서
        이루어집니다.
      </p>

      <button
        type="button"
        onClick={openGameWindow}
        className="inline-flex min-h-[4.75rem] w-full max-w-md items-center justify-center gap-3 rounded-2xl border border-white/12 bg-[var(--primary)] px-8 text-2xl font-black text-white shadow-[0_12px_44px_rgba(50,0,224,0.5)] transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0.5"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        </svg>
        게임 창 다시 열기
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>

      {/* 구분선 + 가운데 점 */}
      <div className="flex w-full max-w-md items-center gap-3">
        <span className="h-px flex-1 bg-white/12" />
        <span className="h-1 w-1 flex-none rounded-full bg-white/25" />
        <span className="h-px flex-1 bg-white/12" />
      </div>

      {/* 하단 안내 */}
      <div className="flex max-w-md items-start gap-3 text-left">
        <span className="mt-0.5 flex-none text-white/40" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5M12 7.5h.01" />
          </svg>
        </span>
        <div>
          <p className="font-bold text-white">창을 닫았거나 차단된 경우</p>
          <p className="mt-1 text-sm leading-6 text-white/50">
            언제든지 다시 열어 게임을 계속 진행할 수 있어요.
          </p>
        </div>
      </div>
    </div>
  );
}
