"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
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
import GameQRCode from "@/components/GameQRCode";
import { useNow } from "@/lib/useNow";
import { useGrading } from "./useGrading";

const CHOICE_THEMES = [
  { bg: "var(--primary)", shadow: "rgba(34, 1, 158, 0.42)", shape: "▲", light: false },
  { bg: "var(--warning)", shadow: "rgba(138, 90, 0, 0.4)", shape: "●", light: false },
  { bg: "var(--error)", shadow: "rgba(151, 27, 20, 0.42)", shape: "◆", light: false },
  { bg: "#ffffff", shadow: "rgba(0, 0, 0, 0.25)", shape: "■", light: true },
];

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

  // Auto-advance once a question's timer runs out, without waiting for the
  // teacher to click "다음 문제" — mirrors clicking it manually, just
  // triggered by the clock instead of a click. Guarded by
  // autoAdvancedIndexRef so it only fires once per question even though the
  // clock effect below re-checks on every tick.
  const now = useNow(500);
  const autoAdvancedIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (!game || game.status !== "active" || advancing) return;
    // respect the teacher's 자동 진행 setting (snapshotted onto the game at
    // creation); undefined on older games means "on", preserving prior behavior
    if (game.autoAdvance === false) return;
    if (!game.currentQuestionStartedAt) return;
    const deadline = game.currentQuestionStartedAt.toMillis() + game.questionDurationSec * 1000;
    if (now < deadline) return;
    if (autoAdvancedIndexRef.current === game.currentQuestionIndex) return;
    autoAdvancedIndexRef.current = game.currentQuestionIndex;
    handleAdvance();
    // handleAdvance is defined above and only depends on state already
    // covered by this effect's own deps + component state, not worth
    // memoizing separately for this dev-tool-only lint concern
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, now, advancing]);

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
      <div className="stage-content dashboard-stage flex min-h-screen flex-col gap-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/dashboard" className="subtle-link self-start">
            ← 대시보드로
          </Link>
        </div>

        {game.status === "lobby" && (
          <LobbyView
            gameCode={gameCode}
            canStart={players.length > 0}
            onStart={handleAdvance}
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
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 text-center">
            <div className="space-y-3">
              <p className="hero-chip self-center">Game Finished</p>
              <h1 className="display-font text-5xl text-white sm:text-6xl">최종 순위</h1>
              <p className="text-sm leading-6 text-[color:var(--foreground-muted)] sm:text-base">
                전체 라운드가 끝났어요. 최종 리더보드를 확인해 보세요.
              </p>
            </div>
            <Leaderboard players={players} />
          </div>
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
  canStart,
  onStart,
  starting,
}: {
  gameCode: string;
  canStart: boolean;
  onStart: () => void;
  starting: boolean;
}) {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col items-center gap-8 text-center">
      <div>
        <p className="hero-chip">Host Stage</p>
        <h1 className="display-font balance-wrap mt-4 text-4xl text-white sm:text-5xl">
          퀴즈 준비 완료
        </h1>
        <p className="pretty-wrap mt-2 text-sm leading-[1.45] text-[color:var(--foreground-muted)] sm:text-base">
          <span className="block">학생들에게 게임 코드를 공유하고</span>
          <span className="block">모두 참여하면 게임을 시작하세요.</span>
        </p>
      </div>

      <div className="grid w-full gap-5 sm:grid-cols-2">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-[var(--surface)] px-6 py-10">
          <p className="text-sm font-semibold text-white/60">게임 코드</p>
          <p className="display-font text-6xl text-white sm:text-7xl">{gameCode}</p>
        </div>
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-[var(--surface)] px-6 py-10">
          <p className="text-sm font-semibold text-white/60">참가 QR 코드</p>
          <GameQRCode gameCode={gameCode} size={180} />
        </div>
      </div>

      <div className="w-full">
        <button
          onClick={onStart}
          disabled={!canStart || starting}
          className="primary-button primary-button-stage flex w-full items-center justify-center gap-2"
        >
          <span aria-hidden="true">▶</span>
          {starting ? "시작하는 중..." : "게임 시작하기"}
        </button>
        {!canStart && (
          <p className="mt-2 text-sm text-white/50">아직 참여한 학생이 없어요.</p>
        )}
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
            <span className="rounded-full bg-[var(--primary-soft)] px-4 py-2 text-sm font-black text-[var(--primary-dark)]">
              문제 {game.currentQuestionIndex + 1} / {game.questions.length}
            </span>
            <span className="rounded-full bg-[var(--warning-soft)] px-4 py-2 text-sm font-black text-[#8a6100]">
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
          <div className="progress-track bg-[rgba(17,15,26,0.08)]">
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
                    color: theme.light ? "var(--panel-text)" : "#ffffff",
                  } as CSSProperties
                }
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className="answer-shape"
                    style={{ background: theme.light ? "rgba(23,21,31,0.08)" : "rgba(255,255,255,0.16)" }}
                  >
                    {theme.shape}
                  </span>
                  <span className="answer-kicker">Choice {index + 1}</span>
                </div>
                <span className="text-base font-black leading-6 sm:text-lg">{choice.text}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <div className="rounded-[24px] bg-[var(--surface)] p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">Answered</p>
            <p className="display-font mt-2 text-5xl text-white">{answeredCount}</p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--foreground-muted)]">
              지금까지 제출한 학생 수
            </p>
          </div>
          <div className="rounded-[24px] bg-[var(--surface)] p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">Players</p>
            <p className="display-font mt-2 text-5xl text-white">{players.length}</p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--foreground-muted)]">
              현재 게임에 참가 중인 학생 수
            </p>
          </div>
        </div>

        <button onClick={onAdvance} disabled={advancing} className="primary-button self-start">
          {advancing ? "처리 중..." : isLastQuestion ? "게임 종료" : "다음 문제"}
        </button>

        <PlayerRoster players={players} />
      </div>
    </section>
  );
}
