"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { User } from "firebase/auth";
import { subscribeToAuthState } from "@/lib/firebase/auth";
import {
  advanceQuestion,
  finalizeQuestion,
  finishGame,
  removePlayerFromGame,
  subscribeToGame,
  subscribeToPlayers,
  type PlayerWithId,
} from "@/lib/firestore/games";
import { getCorrectChoiceMap } from "@/lib/firestore/questions";
import type { Game } from "@/types/firestore";
import PlayerRoster from "@/components/PlayerRoster";
import Leaderboard from "@/components/Leaderboard";
import { useGrading } from "./useGrading";

const CHOICE_THEMES = [
  { bg: "var(--kahoot-red)", shadow: "rgba(105, 11, 28, 0.42)", shape: "▲" },
  { bg: "var(--kahoot-blue)", shadow: "rgba(8, 45, 89, 0.42)", shape: "◆" },
  { bg: "var(--kahoot-yellow)", shadow: "rgba(132, 92, 0, 0.34)", shape: "●" },
  { bg: "var(--kahoot-green)", shadow: "rgba(18, 73, 8, 0.4)", shape: "■" },
];

export default function GameHostClient({ gameCode }: { gameCode: string }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [game, setGame] = useState<Game | null | undefined>(undefined);
  const [players, setPlayers] = useState<PlayerWithId[]>([]);
  const [correctChoiceMap, setCorrectChoiceMap] = useState<Record<string, string>>({});
  const [advancing, setAdvancing] = useState(false);
  const [removingPlayerId, setRemovingPlayerId] = useState<string | null>(null);
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

  const answers = useGrading(gameCode, game, players);

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

  async function handleRemovePlayer(player: PlayerWithId) {
    setError(null);
    setRemovingPlayerId(player.id);
    try {
      await removePlayerFromGame(gameCode, player.id, player.nickname);
    } catch (err) {
      setError(err instanceof Error ? err.message : "참가자를 내보내지 못했습니다.");
    } finally {
      setRemovingPlayerId(null);
    }
  }

  if (!user || game === undefined) {
    return (
      <div className="stage-shell">
        <div className="stage-content flex min-h-screen items-center justify-center">
          <div className="quiz-panel px-6 py-5 text-center">
            <p className="paper-muted">게임 진행 화면을 불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  if (game === null) {
    return (
      <div className="stage-shell">
        <div className="stage-content flex min-h-screen items-center justify-center">
          <div className="quiz-panel px-6 py-5 text-center">
            <p className="paper-muted">게임을 찾을 수 없어요.</p>
          </div>
        </div>
      </div>
    );
  }

  if (game.teacherUid !== user.uid) {
    return (
      <div className="stage-shell">
        <div className="stage-content flex min-h-screen items-center justify-center">
          <div className="quiz-panel px-6 py-5 text-center">
            <p className="paper-muted">권한이 없어요.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stage-shell">
      <div className="stage-content flex min-h-screen flex-col gap-6 py-8">
        <Link href="/dashboard" className="subtle-link self-start">
          ← 대시보드로
        </Link>

        {game.status === "lobby" && (
          <LobbyView
            gameCode={gameCode}
            players={players}
            onStart={handleAdvance}
            onRemovePlayer={handleRemovePlayer}
            removingPlayerId={removingPlayerId}
            starting={advancing}
          />
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
          <section className="quiz-panel flex flex-col gap-6 p-6 text-center sm:p-8">
            <div className="space-y-3">
              <p className="hero-chip">Game Finished</p>
              <h1 className="display-font text-5xl text-[var(--panel-text)] sm:text-6xl">최종 순위</h1>
              <p className="paper-muted text-sm leading-6 sm:text-base">
                전체 라운드가 끝났어요. 최종 리더보드를 확인해 보세요.
              </p>
            </div>
            <Leaderboard players={players} />
          </section>
        )}

        {error && (
          <p className="status-banner" data-tone="error">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function LobbyView({
  gameCode,
  players,
  onStart,
  onRemovePlayer,
  removingPlayerId,
  starting,
}: {
  gameCode: string;
  players: PlayerWithId[];
  onStart: () => void;
  onRemovePlayer: (player: PlayerWithId) => void;
  removingPlayerId: string | null;
  starting: boolean;
}) {
  return (
    <section className="flex flex-col gap-6">
      <div className="paper-panel p-6 sm:p-8">
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr] xl:items-center">
          <div>
            <p className="hero-chip hero-chip-paper">Host Stage</p>
            <h1 className="display-font balance-wrap mt-4 text-4xl text-[var(--panel-text)] sm:text-5xl">
              퀴즈 준비 완료
            </h1>
            <p className="paper-muted pretty-wrap mt-2 flex w-fit max-w-full flex-col gap-2 text-sm leading-[1.45] sm:text-base">
              <span className="block whitespace-nowrap">참가 코드를 공유하고 학생들이 들어오는 동안 명단을 확인하세요.</span>
              <span className="block whitespace-nowrap">준비가 되면 바로 시작할 수 있습니다.</span>
            </p>
          </div>

          <div className="flex flex-col gap-4 xl:items-end">
            <div className="w-full rounded-[28px] border border-[rgba(88,204,2,0.14)] bg-[rgba(232,249,216,0.94)] px-5 py-5 xl:max-w-[32rem]">
              <p className="paper-ghost text-xs font-black uppercase tracking-[0.2em]">
                Join Code
              </p>
              <p className="display-font balance-wrap mt-2 text-6xl text-[var(--panel-text)] sm:text-7xl">
                {gameCode}
              </p>
            </div>

            <button
              onClick={onStart}
              disabled={players.length === 0 || starting}
              className="primary-button primary-button-stage w-full xl:max-w-[32rem]"
            >
              {starting ? "시작하는 중..." : "게임 시작"}
            </button>
          </div>
        </div>
      </div>

      <div className="paper-panel min-h-[26rem] p-6 sm:p-8">
        <PlayerRoster
          players={players}
          onRemovePlayer={onRemovePlayer}
          removingPlayerId={removingPlayerId}
        />
      </div>
    </section>
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
  const answerRatio = players.length > 0 ? answeredCount / players.length : 0;

  return (
    <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="paper-panel flex flex-col gap-5 p-6 sm:p-8">
        <div className="space-y-3">
          <p className="paper-faint text-sm font-black uppercase tracking-[0.2em]">
            Current Question
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-[rgba(88,204,2,0.12)] px-4 py-2 text-sm font-black text-[var(--duo-green-dark)]">
              문제 {game.currentQuestionIndex + 1} / {game.questions.length}
            </span>
            <span className="rounded-full bg-[rgba(216,158,0,0.12)] px-4 py-2 text-sm font-black text-[#8a6100]">
              응답 {answeredCount} / {players.length}
            </span>
          </div>
          <h1 className="display-font text-4xl leading-tight text-[var(--panel-text)] sm:text-5xl">
            {question.text}
          </h1>
        </div>

        <div className="space-y-2">
          <div className="paper-subtle flex items-center justify-between text-sm font-black">
            <span>응답 진행도</span>
            <span>{Math.round(answerRatio * 100)}%</span>
          </div>
          <div className="progress-track bg-[rgba(88,204,2,0.08)]">
            <div
              className="progress-bar"
              style={{ width: `${answerRatio * 100}%` } as CSSProperties}
            />
          </div>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2">
          {question.choices.map((choice, index) => {
            const theme = CHOICE_THEMES[index % CHOICE_THEMES.length];
            return (
              <li
                key={choice.id}
                className="answer-tile"
                style={
                  {
                    "--tile-bg": theme.bg,
                    "--tile-shadow": theme.shadow,
                  } as CSSProperties
                }
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="answer-shape">{theme.shape}</span>
                  <span className="answer-kicker">Choice {index + 1}</span>
                </div>
                <span className="text-base font-black leading-6 sm:text-lg">{choice.text}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="quiz-panel flex flex-col gap-5 p-6 sm:p-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <div className="metric-card">
            <p className="paper-faint text-xs font-black uppercase tracking-[0.18em]">Answered</p>
            <p className="display-font mt-2 text-5xl text-[var(--panel-text)]">{answeredCount}</p>
            <p className="paper-subtle mt-1 text-sm font-semibold">지금까지 제출한 학생 수</p>
          </div>
          <div className="metric-card">
            <p className="paper-faint text-xs font-black uppercase tracking-[0.18em]">Players</p>
            <p className="display-font mt-2 text-5xl text-[var(--panel-text)]">{players.length}</p>
            <p className="paper-subtle mt-1 text-sm font-semibold">현재 게임에 참가 중인 학생 수</p>
          </div>
        </div>

        <button onClick={onAdvance} disabled={advancing} className="primary-button self-start">
          {advancing ? "처리 중..." : isLastQuestion ? "게임 종료" : "다음 문제"}
        </button>

        <div className="rounded-[28px] border border-[rgba(88,204,2,0.14)] bg-[rgba(255,255,255,0.72)] p-5">
          <PlayerRoster players={players} />
        </div>
      </div>
    </section>
  );
}
