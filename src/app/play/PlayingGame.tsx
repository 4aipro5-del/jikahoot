"use client";

import { useEffect, useState } from "react";
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
import StageSkeleton from "@/components/StageSkeleton";
import { useNow } from "@/lib/useNow";

const ANSWER_THEMES = [
  { bg: "var(--primary)", shadow: "rgba(34, 1, 158, 0.42)", shape: "▲", label: "A", light: false },
  { bg: "var(--warning)", shadow: "rgba(138, 90, 0, 0.4)", shape: "●", label: "B", light: false },
  { bg: "var(--error)", shadow: "rgba(151, 27, 20, 0.42)", shape: "◆", label: "C", light: false },
  { bg: "var(--success)", shadow: "rgba(20, 83, 45, 0.42)", shape: "■", label: "D", light: false },
];

export default function PlayingGame({
  gameCode,
  authorUid,
  nickname,
  onForcedOut,
  onLeave,
}: {
  gameCode: string;
  authorUid: string;
  nickname: string;
  onForcedOut: () => void;
  onLeave: () => void;
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

            <button
              type="button"
              onClick={onLeave}
              className="primary-button mx-auto w-full max-w-xs"
            >
              다른 게임 시작하기
            </button>
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
  myScore,
}: {
  game: Game;
  gameCode: string;
  authorUid: string;
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

  const timeColor =
    timeUp || remainingSec <= 5
      ? "var(--error)"
      : remainingSec <= 10
        ? "var(--warning)"
        : "#ffffff";
  // 진행 바 = 남은 시간 비율 (시간이 줄수록 바가 줄어듦)
  const timeRatio = deadline
    ? Math.max(0, Math.min(1, (deadline - now) / (game.questionDurationSec * 1000)))
    : 0;

  return (
    <div className="stage-shell">
      <div className="stage-content flex min-h-screen flex-col justify-center gap-5 py-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
          {/* 상단: 진행 바 + 남은 시간 타이머, 그 아래 문제 번호 */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-4">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/12">
                <div
                  className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-300"
                  style={{ width: `${timeRatio * 100}%` }}
                />
              </div>
              <span
                className="flex h-14 w-14 flex-none items-center justify-center rounded-full border-[3px] text-xl font-black"
                style={{ borderColor: timeColor, color: timeColor }}
              >
                {timeUp ? "0" : remainingSec}
              </span>
            </div>
            <p className="text-sm font-black">
              <span style={{ color: "var(--primary)" }}>{questionIndex + 1}</span>
              <span className="text-white/40"> / {game.questions.length}</span>
            </p>
          </div>

          {/* 문제 카드 */}
          <section className="rounded-2xl bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.35)] sm:p-7">
            <p className="paper-ghost text-xs font-black uppercase tracking-[0.18em]">Question</p>
            <h2 className="display-font mt-2 text-2xl leading-tight text-[var(--panel-text)] sm:text-3xl">
              {question.text}
            </h2>
          </section>

          {/* 보기 2×2 (A/B/C/D 라벨 없음, 도형 + 텍스트) */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {question.choices.map((choice, index) => {
              const theme = ANSWER_THEMES[index % ANSWER_THEMES.length];
              const isMyChoice = answer?.choiceId === choice.id;

              return (
                <button
                  key={choice.id}
                  onClick={() => handleChoose(choice.id)}
                  disabled={hasAnswered || timeUp || submitting}
                  className="relative flex min-h-[5.25rem] items-center gap-4 rounded-2xl px-5 py-4 text-left transition-transform duration-150 ease-out enabled:hover:-translate-y-0.5 enabled:active:translate-y-0.5 disabled:cursor-not-allowed"
                  style={{
                    background: theme.bg,
                    color: theme.light ? "var(--panel-text)" : "#ffffff",
                    boxShadow: `0 5px 0 ${theme.shadow}`,
                    // 선택 강조: 흰색 5px 테두리(안쪽) + 1.03배 확대. 다른 보기는
                    // 색/투명도 변화 없음(흐리게 처리하지 않음).
                    outline: isMyChoice ? "5px solid #ffffff" : "none",
                    outlineOffset: "-5px",
                    transform: isMyChoice ? "scale(1.03)" : undefined,
                    zIndex: isMyChoice ? 1 : undefined,
                  }}
                >
                  <span
                    className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-lg font-black"
                    style={{ background: theme.light ? "rgba(23,21,31,0.08)" : "rgba(255,255,255,0.18)" }}
                  >
                    {theme.shape}
                  </span>
                  <span className="min-w-0 flex-1 text-base font-bold leading-snug sm:text-lg">
                    {choice.text}
                  </span>
                  {isMyChoice && (
                    <span
                      className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.3)]"
                      style={{
                        background: theme.light ? "var(--panel-text)" : "#ffffff",
                        color: theme.light ? "#ffffff" : "var(--panel-text)",
                      }}
                      aria-label="선택함"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                  )}
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

          {/* 하단 우측: 별 아이콘 + 점수 (이름 없음) */}
          <div className="flex justify-end">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-4 py-2 text-sm font-black text-white">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="var(--warning)" aria-hidden="true">
                <path d="m12 2 2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77 5.82 21l1.18-6.86-5-4.87 7.1-1.01z" />
              </svg>
              {myScore} pt
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
