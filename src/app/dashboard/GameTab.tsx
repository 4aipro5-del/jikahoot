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
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-8 rounded-[28px] border border-white/10 bg-[var(--surface)] px-8 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-2xl">🎮</span>
      <div className="space-y-3">
        <p className="hero-chip">Game</p>
        <h1 className="display-font text-4xl text-white sm:text-5xl">새로운 게임 시작</h1>
        <p className="max-w-md text-base leading-7 text-[color:var(--foreground-muted)]">
          오늘 사용할 문제를 선택하고
          <br />
          학생들과 실시간 퀴즈를 시작하세요.
        </p>
      </div>

      <div className="flex gap-10">
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-white/50">사용 가능한 문제</p>
          <p className="display-font mt-2 text-4xl text-white">{approved.length}개</p>
        </div>
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-white/50">예상 플레이 시간</p>
          <p className="display-font mt-2 text-4xl text-white">
            {estimatedMinutes > 0 ? `약 ${estimatedMinutes}분` : "-"}
          </p>
        </div>
      </div>

      <button
        onClick={handleStart}
        disabled={approved.length === 0 || starting}
        className="primary-button primary-button-stage w-full max-w-md"
      >
        {starting ? "게임 준비 중..." : "새 게임 시작"}
      </button>
      {approved.length === 0 && (
        <p className="text-sm text-white/50">승인된 문제가 있어야 게임을 시작할 수 있어요.</p>
      )}
      {error && (
        <p className="status-banner text-sm" data-tone="error">
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
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-8 rounded-[28px] border border-white/10 bg-[var(--surface)] px-8 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-2xl">🖥️</span>
      <div className="space-y-3">
        <p className="hero-chip">Game In Progress</p>
        <h1 className="display-font text-4xl text-white sm:text-5xl">게임 진행 중</h1>
        <p className="max-w-md text-base leading-7 text-[color:var(--foreground-muted)]">
          참가자 관리·게임 시작·진행은 <span className="font-bold text-white">게임 창</span>에서
          이루어집니다.
          <br />
          창이 닫혔다면 아래 버튼으로 다시 열 수 있어요.
        </p>
      </div>

      <button
        type="button"
        onClick={openGameWindow}
        className="inline-flex min-h-[5.25rem] w-full max-w-md items-center justify-center gap-3 rounded-2xl border-2 border-white/15 bg-[var(--primary)] px-8 text-4xl font-black text-white shadow-[0_8px_0_var(--primary-dark)] transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-1"
      >
        게임 창 열기
      </button>
    </div>
  );
}
