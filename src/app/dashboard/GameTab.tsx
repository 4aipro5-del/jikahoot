"use client";

import { useEffect, useState } from "react";
import { createGame, subscribeToGame } from "@/lib/firestore/games";
import { clearCurrentGame, subscribeToRoom } from "@/lib/firestore/rooms";
import type { QuestionWithId } from "@/lib/firestore/questions";
import { QUESTION_DURATION_SEC } from "@/lib/gameConfig";
import type { Game } from "@/types/firestore";
import GameHostClient from "./game/[gameCode]/GameHostClient";

// The Game tab is the teacher's one real "run the lesson" surface — Dashboard
// no longer controls games at all. This is a thin router around the room's
// currentGameId: no game yet → the big "start" screen below; a game already
// exists → hand off entirely to the existing, unmodified GameHostClient
// (Lobby/Active/Finished + auto-advance + the players/active-status fix all
// live there untouched).
export default function GameTab({
  teacherUid,
  questions,
}: {
  teacherUid: string;
  questions: QuestionWithId[];
}) {
  const [currentGameId, setCurrentGameId] = useState<string | null | undefined>(undefined);
  const [game, setGame] = useState<Game | null | undefined>(undefined);

  useEffect(() => {
    return subscribeToRoom(teacherUid, (room) => {
      setCurrentGameId(room?.currentGameId ?? null);
    });
  }, [teacherUid]);

  useEffect(() => {
    // only used here to decide whether to show the "새 게임 시작하기" restart
    // affordance once a game is finished — GameHostClient below does its own,
    // independent subscribeToGame internally and is unaffected by this one
    if (!currentGameId) return;
    return subscribeToGame(currentGameId, setGame);
  }, [currentGameId]);

  async function handleRestart() {
    try {
      await clearCurrentGame(teacherUid);
    } catch (err) {
      console.error("게임 초기화에 실패했습니다.", err);
    }
  }

  if (currentGameId === undefined) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-white/50">게임 상태를 확인하는 중이에요...</p>
      </div>
    );
  }

  if (!currentGameId) {
    return <StartGameScreen teacherUid={teacherUid} questions={questions} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {game?.status === "finished" && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleRestart}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
          >
            새 게임 시작하기
          </button>
        </div>
      )}
      <GameHostClient gameCode={currentGameId} />
    </div>
  );
}

function StartGameScreen({
  teacherUid,
  questions,
}: {
  teacherUid: string;
  questions: QuestionWithId[];
}) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approved = questions.filter((q) => q.status === "approved");
  const estimatedMinutes = Math.round((approved.length * QUESTION_DURATION_SEC) / 60);

  async function handleStart() {
    setError(null);
    setStarting(true);
    try {
      const publicQuestions = approved.map((q) => ({ id: q.id, text: q.text, choices: q.choices }));
      // the room's currentGameId subscription above picks up the result and
      // swaps this screen for GameHostClient automatically
      await createGame(teacherUid, publicQuestions, QUESTION_DURATION_SEC);
    } catch (err) {
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
