"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  subscribeToAnswer,
  subscribeToGame,
  subscribeToPlayer,
  subscribeToPlayers,
  submitAnswer,
  type PlayerWithId,
} from "@/lib/firestore/games";
import type { Answer, Game, Player } from "@/types/firestore";
import PlayerRoster from "@/components/PlayerRoster";
import Leaderboard from "@/components/Leaderboard";
import { useNow } from "@/lib/useNow";

const ANSWER_THEMES = [
  { bg: "var(--primary)", shadow: "rgba(34, 1, 158, 0.42)", shape: "▲", label: "A", light: false },
  { bg: "var(--warning)", shadow: "rgba(138, 90, 0, 0.4)", shape: "●", label: "B", light: false },
  { bg: "var(--error)", shadow: "rgba(151, 27, 20, 0.42)", shape: "◆", label: "C", light: false },
  { bg: "#ffffff", shadow: "rgba(0, 0, 0, 0.25)", shape: "■", label: "D", light: true },
];

export default function PlayingGame({
  gameCode,
  authorUid,
  nickname,
  onForcedOut,
}: {
  gameCode: string;
  authorUid: string;
  nickname: string;
  onForcedOut: () => void;
}) {
  const [game, setGame] = useState<Game | null | undefined>(undefined);
  const [players, setPlayers] = useState<PlayerWithId[]>([]);
  const [myPlayer, setMyPlayer] = useState<Player | null | undefined>(undefined);
  const [wasRegistered, setWasRegistered] = useState(false);

  useEffect(() => subscribeToGame(gameCode, setGame), [gameCode]);

  useEffect(() => {
    // The players list is intentionally locked down to the host-only during
    // active play (so a student can't see everyone else's live scores/streaks
    // mid-round) — subscribing here anyway throws an uncaught permission-
    // denied, so this pauses the listener rather than trying to read data the
    // rules correctly refuse to hand out.
    if (game?.status === "active") return;
    return subscribeToPlayers(gameCode, setPlayers);
  }, [gameCode, game?.status]);

  useEffect(() => {
    // A single-document read of the player's own doc is allowed in every
    // game status (unlike the full list above), so this doubles as the
    // source for "my score" during active play as well as forced-out detection.
    return subscribeToPlayer(gameCode, authorUid, (player) => {
      setMyPlayer(player);
      if (player) {
        setWasRegistered(true);
        return;
      }
      if (wasRegistered) {
        onForcedOut();
      }
    });
  }, [authorUid, gameCode, onForcedOut, wasRegistered]);

  if (!game) {
    return (
      <div className="stage-shell">
        <div className="stage-content flex min-h-screen items-center justify-center">
          <div className="quiz-panel px-6 py-5 text-center">
            <p className="paper-muted">게임 상태를 불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  if (game.status === "finished") {
    return (
      <div className="stage-shell">
        <div className="stage-content flex min-h-screen flex-col justify-center gap-6 py-8">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 text-center">
            <div className="space-y-3">
              <p className="hero-chip self-center">Final Leaderboard</p>
              <h1 className="display-font text-5xl text-white sm:text-6xl">최종 순위</h1>
              <p className="text-sm leading-6 text-[color:var(--foreground-muted)] sm:text-base">
                마지막 문제까지 모두 끝났어요. 내 점수와 전체 순위를 확인해 보세요.
              </p>
            </div>
            <Leaderboard players={players} highlightPlayerId={authorUid} />
          </div>
        </div>
      </div>
    );
  }

  if (game.status === "active") {
    return (
      <ActiveView
        game={game}
        gameCode={gameCode}
        authorUid={authorUid}
        nickname={nickname}
        myScore={myPlayer?.totalScore ?? 0}
      />
    );
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
    <div className="stage-shell">
      <div className="stage-content flex min-h-screen flex-col justify-center gap-8 py-8">
        <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <p className="hero-chip">Waiting Lobby</p>
              <h1 className="display-font text-4xl text-white sm:text-5xl">
                {nickname}님,
                <br />
                곧 시작돼요!
              </h1>
              <p className="text-sm leading-6 text-[color:var(--foreground-muted)] sm:text-base">
                선생님이 시작 버튼을 누르면 바로 첫 문제가 펼쳐져요. 지금은 친구들이
                들어오는 중입니다.
              </p>
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/50">
                Game Code
              </p>
              <p className="display-font mt-2 text-6xl text-white sm:text-7xl">{gameCode}</p>
            </div>
          </div>

          <PlayerRoster players={players} />
        </div>
      </div>
    </div>
  );
}

function ActiveView({
  game,
  gameCode,
  authorUid,
  nickname,
  myScore,
}: {
  game: Game;
  gameCode: string;
  authorUid: string;
  nickname: string;
  myScore: number;
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
  const remainingRatio = deadline
    ? Math.max(0, Math.min(1, (deadline - now) / (game.questionDurationSec * 1000)))
    : 0;
  const timeUp = deadline !== null && remainingSec <= 0;
  const hasAnswered = Boolean(answer);
  const timeLow = !timeUp && remainingSec <= 5;

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
    <div className="stage-shell">
      <div className="stage-content flex min-h-screen flex-col justify-center gap-5 py-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
          <div className="flex items-center justify-between gap-4">
            <p className="min-w-0 truncate text-sm font-bold text-[color:var(--foreground-muted)]">
              방 코드 {gameCode}
            </p>
            <div className="flex flex-none items-center gap-3">
              <span className="rounded-full bg-[var(--surface)] px-4 py-1.5 text-sm font-black text-white">
                {questionIndex + 1}/{game.questions.length}
              </span>
              <span
                className={`flex h-14 w-14 flex-none items-center justify-center rounded-full border-2 text-xl font-black ${
                  timeUp || timeLow
                    ? "border-[var(--error)] text-[var(--error)]"
                    : "border-[var(--primary)] text-white"
                }`}
              >
                {timeUp ? "0" : remainingSec}
              </span>
            </div>
          </div>

          <div className="progress-track">
            <div
              className="progress-bar"
              style={{ width: `${remainingRatio * 100}%` } as CSSProperties}
            />
          </div>

          <section className="paper-panel p-6 sm:p-8">
            <p className="paper-ghost text-sm font-black uppercase tracking-[0.18em]">Question</p>
            <h2 className="display-font mt-3 text-3xl leading-tight text-[var(--panel-text)] sm:text-4xl lg:text-5xl">
              {question.text}
            </h2>
          </section>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {question.choices.map((choice, index) => {
              const theme = ANSWER_THEMES[index % ANSWER_THEMES.length];
              const isMyChoice = answer?.choiceId === choice.id;

              return (
                <button
                  key={choice.id}
                  onClick={() => handleChoose(choice.id)}
                  disabled={hasAnswered || timeUp || submitting}
                  className={`answer-tile ${isMyChoice ? "is-selected" : ""}`}
                  style={
                    {
                      "--tile-bg": theme.bg,
                      "--tile-shadow": theme.shadow,
                      "--tile-outline": theme.light ? "var(--panel-text)" : "rgba(255,255,255,0.92)",
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
                    <span className="answer-kicker">{theme.label}</span>
                  </div>
                  <span className="text-base font-black leading-6 sm:text-lg">{choice.text}</span>
                </button>
              );
            })}
          </div>

          {submitError && (
            <p className="status-banner" data-tone="error">
              {submitError}
            </p>
          )}
          {answer && answer.isCorrect === null && (
            <p className="status-banner" data-tone="warning">
              제출 완료! 채점을 기다리는 중이에요.
            </p>
          )}
          {answer && answer.isCorrect !== null && (
            <p className="status-banner" data-tone={answer.isCorrect ? "success" : "error"}>
              {answer.isCorrect ? `정답! +${answer.pointsEarned}점` : "아쉬워요, 이번 문제는 오답이에요."}
            </p>
          )}
          {!answer && timeUp && (
            <p className="status-banner" data-tone="warning">
              시간이 끝났어요. 다음 문제를 기다려 주세요.
            </p>
          )}

          <div className="mt-1 flex items-center justify-between gap-4 rounded-full bg-[var(--surface)] px-5 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--primary)] text-sm font-black text-white">
                {nickname.slice(0, 1).toUpperCase()}
              </span>
              <span className="truncate text-base font-black text-white">{nickname}</span>
            </div>
            <span className="display-font flex-none text-xl text-white">{myScore} pt</span>
          </div>
        </div>
      </div>
    </div>
  );
}
