"use client";

import { useEffect, useState } from "react";
import { createGame } from "@/lib/firestore/games";
import { subscribeToRoom } from "@/lib/firestore/rooms";
import type { QuestionWithId } from "@/lib/firestore/questions";
import { QUESTION_DURATION_SEC } from "@/lib/gameConfig";
import type { RoomWithId } from "@/types/firestore";
import GameHostClient from "./GameHostClient";

// 학생용 전광판 창은 고정된 window name을 써서 다시 열어도 같은 창을 재사용한다.
const DISPLAY_WINDOW_NAME = "jikahoot-display";
function displayUrl(code: string) {
  return `/display/${code}`;
}

// 교사는 대시보드 Game 탭 안에서 게임을 직접 운영한다 — 로비/문제/제출 현황/
// 다음 문제/일시정지/종료 등 모든 컨트롤은 임베드된 GameHostClient에 있다.
// 게임을 시작하면 학생용 전광판(/display/[code])이 별도 창으로 열려 교실 화면
// 역할만 한다(QR·게임 코드·진행 상황·참가자 수·실시간 순위만 표시, 제어 없음).
export default function GameTab({
  roomId,
  ownerUid,
  questions,
}: {
  roomId: string;
  ownerUid: string;
  questions: QuestionWithId[];
}) {
  const [currentGameId, setCurrentGameId] = useState<string | null | undefined>(undefined);
  const [room, setRoom] = useState<RoomWithId | null>(null);

  useEffect(() => {
    return subscribeToRoom(roomId, (nextRoom) => {
      setRoom(nextRoom);
      setCurrentGameId(nextRoom?.currentGameId ?? null);
    });
  }, [roomId]);

  if (currentGameId === undefined) {
    return null;
  }

  if (!currentGameId) {
    return (
      <StartGameScreen roomId={roomId} ownerUid={ownerUid} questions={questions} room={room} />
    );
  }

  return <GameInProgressScreen gameCode={currentGameId} />;
}

function StartGameScreen({
  roomId,
  ownerUid,
  questions,
  room,
}: {
  roomId: string;
  ownerUid: string;
  questions: QuestionWithId[];
  room: RoomWithId | null;
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
    // 팝업 차단을 피하려 클릭 제스처 안에서 전광판 창을 먼저 열고, 게임 코드가
    // 나오면 그 창을 전광판(/display/[code])으로 이동시킨다. 대시보드(이 창)는
    // room.currentGameId 구독으로 게임 운영 콘솔(GameHostClient)로 전환된다.
    const displayWindow = window.open("about:blank", DISPLAY_WINDOW_NAME);
    try {
      const publicQuestions = approved.map((q) => ({ id: q.id, text: q.text, choices: q.choices }));
      const code = await createGame(roomId, ownerUid, publicQuestions, durationSec, autoAdvance);
      if (displayWindow) displayWindow.location.href = displayUrl(code);
    } catch (err) {
      displayWindow?.close();
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
        className="inline-flex min-h-[4.75rem] w-full max-w-md items-center justify-center rounded-2xl border-2 border-white/15 bg-[var(--error)] px-8 text-3xl font-black text-white shadow-[0_8px_0_var(--error-dark)] transition-transform duration-150 enabled:hover:-translate-y-0.5 enabled:active:translate-y-1 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {starting ? "STARTING..." : "START"}
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

// 대시보드(원래 창): 게임 운영 콘솔(GameHostClient)을 임베드해 교사가 여기서
// 직접 진행한다. 상단에는 학생용 전광판을 (다시) 여는 버튼만 둔다.
function GameInProgressScreen({ gameCode }: { gameCode: string }) {
  function openDisplayWindow() {
    // 고정 window name → 이미 열린 전광판 창이 있으면 재사용/포커스한다.
    const displayWindow = window.open(displayUrl(gameCode), DISPLAY_WINDOW_NAME);
    displayWindow?.focus();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openDisplayWindow}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/12 bg-[var(--surface)] px-5 py-3 text-base font-bold text-white transition-colors duration-150 hover:bg-white/[0.06]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </svg>
          학생 화면(전광판) 열기
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 17 17 7M9 7h8v8" />
          </svg>
        </button>
      </div>

      <GameHostClient gameCode={gameCode} embedded />
    </div>
  );
}
