"use client";

import { useEffect, useState } from "react";
import {
  subscribeToAnswer,
  subscribeToGame,
  subscribeToPlayers,
  submitAnswer,
  type PlayerWithId,
} from "@/lib/firestore/games";
import type { Answer, Game } from "@/types/firestore";
import PlayerRoster from "@/components/PlayerRoster";
import Leaderboard from "@/components/Leaderboard";

export default function PlayingGame({
  gameCode,
  authorUid,
  nickname,
}: {
  gameCode: string;
  authorUid: string;
  nickname: string;
}) {
  const [game, setGame] = useState<Game | null | undefined>(undefined);
  const [players, setPlayers] = useState<PlayerWithId[]>([]);

  useEffect(() => subscribeToGame(gameCode, setGame), [gameCode]);
  useEffect(() => subscribeToPlayers(gameCode, setPlayers), [gameCode]);

  if (!game) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-zinc-500">불러오는 중...</p>
      </div>
    );
  }

  if (game.status === "finished") {
    return (
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center gap-6 p-8 text-center">
        <h1 className="text-2xl font-semibold">최종 순위</h1>
        <Leaderboard players={players} highlightPlayerId={authorUid} />
      </div>
    );
  }

  if (game.status === "active") {
    return <ActiveView game={game} gameCode={gameCode} authorUid={authorUid} />;
  }

  return <LobbyView gameCode={gameCode} nickname={nickname} players={players} />;
}

function LobbyView({
  gameCode,
  nickname,
  players,
}: {
  gameCode: string;
  nickname: string;
  players: PlayerWithId[];
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center gap-6 p-8 text-center">
      <h1 className="text-xl font-semibold">{nickname}님, 대기 중이에요</h1>
      <p className="text-sm text-zinc-500">
        코드: <span className="font-mono font-semibold">{gameCode}</span>
      </p>
      <p className="text-zinc-600 dark:text-zinc-400">선생님이 시작하면 자동으로 시작돼요.</p>

      <PlayerRoster players={players} />
    </div>
  );
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function ActiveView({
  game,
  gameCode,
  authorUid,
}: {
  game: Game;
  gameCode: string;
  authorUid: string;
}) {
  const questionIndex = game.currentQuestionIndex;
  const question = game.questions[questionIndex];
  const [trackedIndex, setTrackedIndex] = useState(questionIndex);
  const [answer, setAnswer] = useState<Answer | null | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const now = useNow(250);

  if (questionIndex !== trackedIndex) {
    setTrackedIndex(questionIndex);
    setAnswer(undefined);
    setSubmitError(null);
  }

  useEffect(() => {
    return subscribeToAnswer(gameCode, authorUid, questionIndex, setAnswer);
  }, [gameCode, authorUid, questionIndex]);

  const deadline = game.currentQuestionStartedAt
    ? game.currentQuestionStartedAt.toMillis() + game.questionDurationSec * 1000
    : null;
  const remainingSec = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;
  const timeUp = deadline !== null && remainingSec <= 0;
  const hasAnswered = Boolean(answer);

  async function handleChoose(choiceId: string) {
    if (hasAnswered || timeUp || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitAnswer(gameCode, authorUid, questionIndex, choiceId);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "제출하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center gap-6 p-8 text-center">
      <p className="text-sm text-zinc-500">
        문제 {questionIndex + 1} / {game.questions.length}
      </p>
      <p className="font-mono text-3xl font-bold">{timeUp ? "시간 종료" : `${remainingSec}초`}</p>
      <h1 className="text-2xl font-semibold">{question.text}</h1>

      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        {question.choices.map((choice) => {
          const isMyChoice = answer?.choiceId === choice.id;
          return (
            <button
              key={choice.id}
              onClick={() => handleChoose(choice.id)}
              disabled={hasAnswered || timeUp || submitting}
              className={`rounded-lg border px-4 py-4 text-left transition-colors disabled:cursor-not-allowed ${
                isMyChoice
                  ? "border-foreground bg-black/[.04] dark:bg-white/[.08]"
                  : "border-black/[.08] hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-white/[.08]"
              }`}
            >
              {choice.text}
            </button>
          );
        })}
      </div>

      {submitError && <p className="text-sm text-red-600">{submitError}</p>}
      {answer && answer.isCorrect === null && (
        <p className="text-zinc-500">제출 완료! 채점을 기다리는 중...</p>
      )}
      {answer && answer.isCorrect !== null && (
        <p
          className={
            answer.isCorrect
              ? "text-lg font-semibold text-green-700 dark:text-green-400"
              : "text-lg font-semibold text-red-600"
          }
        >
          {answer.isCorrect ? `정답! +${answer.pointsEarned}점` : "아쉬워요, 오답이에요"}
        </p>
      )}
      {!answer && timeUp && <p className="text-zinc-500">시간이 끝났어요. 다음 문제를 기다려 주세요.</p>}
    </div>
  );
}
