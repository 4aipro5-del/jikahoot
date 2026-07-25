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
import Leaderboard from "@/components/Leaderboard";
import StageSkeleton from "@/components/StageSkeleton";
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
    return <StageSkeleton />;
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

  return <LobbyView nickname={nickname} players={players} />;
}

// Scattered decorative particles, drawn only from our four brand colors. Each
// gets its own float duration/delay so they drift independently, never in sync.
const LOBBY_PARTICLES = [
  { top: "16%", left: "14%", size: 12, color: "var(--primary)", dur: "7s", delay: "0s" },
  { top: "26%", left: "86%", size: 9, color: "var(--warning)", dur: "9s", delay: "-2s" },
  { top: "42%", left: "8%", size: 8, color: "var(--success)", dur: "8s", delay: "-4s" },
  { top: "40%", left: "92%", size: 10, color: "var(--error)", dur: "10s", delay: "-1s" },
  { top: "58%", left: "18%", size: 7, color: "var(--warning)", dur: "6.5s", delay: "-3s" },
  { top: "62%", left: "82%", size: 9, color: "var(--primary)", dur: "9.5s", delay: "-5s" },
  { top: "74%", left: "12%", size: 8, color: "var(--error)", dur: "7.5s", delay: "-2.5s" },
  { top: "78%", left: "88%", size: 10, color: "var(--success)", dur: "8.5s", delay: "-1.5s" },
  { top: "20%", left: "70%", size: 6, color: "var(--primary)", dur: "11s", delay: "-6s" },
  { top: "70%", left: "30%", size: 6, color: "var(--warning)", dur: "6s", delay: "-3.5s" },
];

function IconSparkle({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l1.7 6a2 2 0 0 0 1.3 1.3L21 11l-6 1.7A2 2 0 0 0 13.7 14L12 20l-1.7-6A2 2 0 0 0 9 12.7L3 11l6-1.7A2 2 0 0 0 10.3 8z" />
    </svg>
  );
}

function IconPeople() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
      <circle cx="9" cy="7" r="3.5" />
      <path d="M22 20v-1.5a4 4 0 0 0-3-3.85" />
      <path d="M16 3.6a4 4 0 0 1 0 6.8" />
    </svg>
  );
}

function IconBulb() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M8.5 15a6 6 0 1 1 7 0c-.6.5-1 1.1-1 1.8v.2H9.5v-.2c0-.7-.4-1.3-1-1.8Z" />
    </svg>
  );
}

function LobbyView({
  nickname,
  players,
}: {
  nickname: string;
  players: PlayerWithId[];
}) {
  return (
    <div className="stage-shell">
      {/* floating brand-color particles — decorative only */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {LOBBY_PARTICLES.map((p, i) => (
          <span
            key={i}
            className="lobby-particle absolute rounded-full"
            style={
              {
                top: p.top,
                left: p.left,
                width: p.size,
                height: p.size,
                background: p.color,
                boxShadow: `0 0 12px ${p.color}`,
                opacity: 0.85,
                "--float-dur": p.dur,
                "--float-delay": p.delay,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div className="stage-content flex min-h-screen flex-col items-center justify-center gap-6 py-10 text-center">
        <p className="inline-flex items-center gap-3 text-sm font-black uppercase tracking-[0.32em] text-[var(--primary)]">
          <IconSparkle />
          Waiting
          <IconSparkle />
        </p>

        <h1 className="display-font text-4xl leading-tight text-white sm:text-5xl lg:text-6xl">
          퀴즈가 곧 시작돼요!
        </h1>

        {/* avatar inside concentric glow rings */}
        <div className="relative flex h-56 w-56 items-center justify-center">
          <span className="absolute h-56 w-56 rounded-full border border-white/[0.06]" />
          <span className="absolute h-44 w-44 rounded-full border border-white/[0.08]" />
          <div
            className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-2 border-[var(--primary)] bg-[var(--surface)]"
            style={{ boxShadow: "0 0 42px rgba(50,0,224,0.55)" }}
          >
            {/* trophy silhouette recolored via CSS mask; a top-lit yellow
                gradient gives metallic volume, and the drop-shadow lives on the
                wrapper so it follows the trophy shape (not the square box) */}
            <span
              aria-hidden="true"
              className="block"
              style={{ filter: "drop-shadow(0 4px 5px rgba(0,0,0,0.5))" }}
            >
              <span
                className="block h-16 w-16"
                style={{
                  background:
                    "linear-gradient(165deg, color-mix(in srgb, var(--warning) 60%, #ffffff) 0%, var(--warning) 46%, var(--warning-dark) 100%)",
                  WebkitMaskImage: "url(/trophy.png)",
                  maskImage: "url(/trophy.png)",
                  WebkitMaskSize: "contain",
                  maskSize: "contain",
                  WebkitMaskRepeat: "no-repeat",
                  maskRepeat: "no-repeat",
                  WebkitMaskPosition: "center",
                  maskPosition: "center",
                }}
              />
            </span>
          </div>
        </div>

        {/* nickname */}
        <div
          className="rounded-full border-2 border-[var(--primary)] bg-[color:rgba(50,0,224,0.16)] px-10 py-3"
          style={{ boxShadow: "0 0 26px rgba(50,0,224,0.35)" }}
        >
          <span className="display-font text-2xl text-white sm:text-3xl">{nickname}</span>
        </div>

        {/* headcount */}
        <div className="inline-flex items-center gap-2.5 rounded-full bg-[var(--surface)] px-5 py-2.5 text-base font-black text-white">
          <span className="text-[var(--primary)]">
            <IconPeople />
          </span>
          참가자 <span className="text-[var(--primary)]">{players.length}</span>명
        </div>

        {/* hint */}
        <p className="mt-2 flex items-center justify-center gap-2 text-sm text-[color:var(--foreground-muted)] sm:text-base">
          <span className="text-[var(--warning)]">
            <IconBulb />
          </span>
          선생님이 <span className="font-bold text-[var(--warning)]">시작 버튼</span>을 누르면 바로 게임이 시작됩니다.
        </p>
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
