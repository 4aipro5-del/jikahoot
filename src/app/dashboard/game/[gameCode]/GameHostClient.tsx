"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { User } from "firebase/auth";
import { subscribeToAuthState } from "@/lib/firebase/auth";
import {
  advanceQuestion,
  finalizeQuestion,
  finishGame,
  subscribeToGame,
  subscribeToPlayers,
  type PlayerWithId,
} from "@/lib/firestore/games";
import { getCorrectChoiceMap } from "@/lib/firestore/questions";
import type { Game } from "@/types/firestore";
import PlayerRoster from "@/components/PlayerRoster";
import Leaderboard from "@/components/Leaderboard";
import { useGrading } from "./useGrading";

export default function GameHostClient({ gameCode }: { gameCode: string }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [game, setGame] = useState<Game | null | undefined>(undefined);
  const [players, setPlayers] = useState<PlayerWithId[]>([]);
  const [correctChoiceMap, setCorrectChoiceMap] = useState<Record<string, string>>({});
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeToAuthState(setUser), []);
  useEffect(() => subscribeToGame(gameCode, setGame), [gameCode]);
  useEffect(() => subscribeToPlayers(gameCode, setPlayers), [gameCode]);

  useEffect(() => {
    if (user === null) router.replace("/");
  }, [user, router]);

  useEffect(() => {
    if (user && game && game.teacherUid !== user.uid) {
      router.replace("/dashboard");
    }
  }, [user, game, router]);

  useEffect(() => {
    if (!game || !user || game.teacherUid !== user.uid) return;
    getCorrectChoiceMap(
      user.uid,
      game.questions.map((q) => q.id),
    ).then(setCorrectChoiceMap);
  }, [game, user]);

  const answers = useGrading(gameCode, game, players, correctChoiceMap);

  async function handleAdvance() {
    if (!game) return;
    setError(null);
    setAdvancing(true);
    try {
      if (game.status === "active") {
        const question = game.questions[game.currentQuestionIndex];
        const correctChoiceId = correctChoiceMap[question.id];
        if (correctChoiceId) {
          await finalizeQuestion(
            gameCode,
            players.map((p) => p.id),
            game.currentQuestionIndex,
            correctChoiceId,
          );
        }
      }

      const nextIndex = game.currentQuestionIndex + 1;
      if (nextIndex >= game.questions.length) {
        await finishGame(gameCode);
      } else {
        await advanceQuestion(gameCode, nextIndex);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "진행하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setAdvancing(false);
    }
  }

  if (!user || game === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-zinc-500">불러오는 중...</p>
      </div>
    );
  }

  if (game === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-zinc-500">게임을 찾을 수 없어요.</p>
      </div>
    );
  }

  if (game.teacherUid !== user.uid) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-zinc-500">권한이 없어요.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center gap-8 p-8 text-center">
      <Link
        href="/dashboard"
        className="self-start text-sm text-zinc-500 hover:text-black dark:hover:text-white"
      >
        ← 대시보드로
      </Link>

      {game.status === "lobby" && (
        <LobbyView gameCode={gameCode} players={players} onStart={handleAdvance} starting={advancing} />
      )}

      {game.status === "active" && (
        <ActiveView
          game={game}
          players={players}
          answeredCount={Object.keys(answers).length}
          onAdvance={handleAdvance}
          advancing={advancing}
        />
      )}

      {game.status === "finished" && (
        <>
          <h1 className="text-2xl font-semibold">최종 순위</h1>
          <Leaderboard players={players} />
        </>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function LobbyView({
  gameCode,
  players,
  onStart,
  starting,
}: {
  gameCode: string;
  players: PlayerWithId[];
  onStart: () => void;
  starting: boolean;
}) {
  return (
    <>
      <div>
        <p className="text-sm text-zinc-500">참가 코드</p>
        <p className="font-mono text-6xl font-bold tracking-widest">{gameCode}</p>
      </div>

      <p className="text-zinc-600 dark:text-zinc-400">친구들이 들어오기를 기다리고 있어요...</p>

      <PlayerRoster players={players} />

      <button
        onClick={onStart}
        disabled={players.length === 0 || starting}
        className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
      >
        {starting ? "시작하는 중..." : "게임 시작"}
      </button>
    </>
  );
}

function ActiveView({
  game,
  players,
  answeredCount,
  onAdvance,
  advancing,
}: {
  game: Game;
  players: PlayerWithId[];
  answeredCount: number;
  onAdvance: () => void;
  advancing: boolean;
}) {
  const question = game.questions[game.currentQuestionIndex];
  const isLastQuestion = game.currentQuestionIndex >= game.questions.length - 1;

  return (
    <>
      <p className="text-sm text-zinc-500">
        문제 {game.currentQuestionIndex + 1} / {game.questions.length}
      </p>
      <h1 className="text-2xl font-semibold">{question.text}</h1>

      <ul className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
        {question.choices.map((choice) => (
          <li
            key={choice.id}
            className="rounded-lg border border-black/[.08] px-4 py-3 text-left dark:border-white/[.145]"
          >
            {choice.text}
          </li>
        ))}
      </ul>

      <p className="text-zinc-600 dark:text-zinc-400">
        응답 {answeredCount} / {players.length}명
      </p>

      <button
        onClick={onAdvance}
        disabled={advancing}
        className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
      >
        {advancing ? "처리 중..." : isLastQuestion ? "게임 종료" : "다음 문제"}
      </button>
    </>
  );
}
