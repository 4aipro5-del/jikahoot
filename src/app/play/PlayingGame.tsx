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
import type { Answer, Game } from "@/types/firestore";
import PlayerRoster from "@/components/PlayerRoster";
import Leaderboard from "@/components/Leaderboard";

const ANSWER_THEMES = [
  { bg: "var(--kahoot-red)", shadow: "rgba(105, 11, 28, 0.42)", shape: "▲", label: "Red" },
  { bg: "var(--kahoot-blue)", shadow: "rgba(8, 45, 89, 0.42)", shape: "◆", label: "Blue" },
  { bg: "var(--kahoot-yellow)", shadow: "rgba(132, 92, 0, 0.34)", shape: "●", label: "Yellow" },
  { bg: "var(--kahoot-green)", shadow: "rgba(18, 73, 8, 0.4)", shape: "■", label: "Green" },
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
  const [wasRegistered, setWasRegistered] = useState(false);

  useEffect(() => subscribeToGame(gameCode, setGame), [gameCode]);

  useEffect(() => subscribeToPlayers(gameCode, setPlayers), [gameCode, game?.status]);

  useEffect(() => {
    return subscribeToPlayer(gameCode, authorUid, (player) => {
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
            <p className="text-white/70">게임 상태를 불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  if (game.status === "finished") {
    return (
      <div className="stage-shell">
        <div className="stage-content flex min-h-screen flex-col justify-center gap-6 py-8">
          <section className="quiz-panel mx-auto flex w-full max-w-5xl flex-col gap-6 p-6 text-center sm:p-8">
            <div className="space-y-3">
              <p className="hero-chip">Final Leaderboard</p>
              <h1 className="display-font text-5xl text-white sm:text-6xl">최종 순위</h1>
              <p className="text-sm leading-6 text-white/74 sm:text-base">
                마지막 문제까지 모두 끝났어요. 내 점수와 전체 순위를 확인해 보세요.
              </p>
            </div>
            <Leaderboard players={players} highlightPlayerId={authorUid} />
          </section>
        </div>
      </div>
    );
  }

  if (game.status === "active") {
    return <ActiveView game={game} gameCode={gameCode} authorUid={authorUid} nickname={nickname} />;
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
      <div className="stage-content flex min-h-screen flex-col justify-center gap-6 py-8">
        <section className="quiz-panel mx-auto grid w-full max-w-5xl gap-6 p-6 sm:p-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="flex flex-col justify-between gap-5">
            <div className="space-y-4">
              <p className="hero-chip">Waiting Lobby</p>
              <h1 className="display-font text-4xl text-white sm:text-5xl">
                {nickname}님,
                <br />
                곧 시작돼요!
              </h1>
              <p className="text-sm leading-6 text-white/74 sm:text-base">
                선생님이 시작 버튼을 누르면 바로 첫 문제가 펼쳐져요. 지금은 친구들이
                들어오는 중입니다.
              </p>
            </div>

            <div className="rounded-[28px] bg-white px-5 py-5 text-[var(--panel-text)] shadow-[0_16px_0_rgba(38,18,87,0.18)]">
              <p className="paper-ghost text-xs font-black uppercase tracking-[0.2em]">
                Game Code
              </p>
              <p className="display-font mt-2 text-5xl sm:text-6xl">{gameCode}</p>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/6 p-5 sm:p-6">
            <PlayerRoster players={players} />
          </div>
        </section>
      </div>
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
  nickname,
}: {
  game: Game;
  gameCode: string;
  authorUid: string;
  nickname: string;
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
      <div className="stage-content flex min-h-screen flex-col justify-center gap-6 py-6">
        <section className="quiz-panel mx-auto flex w-full max-w-6xl flex-col gap-6 p-5 sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-white/58">
                Live Question
              </p>
              <h1 className="display-font mt-2 text-3xl text-white sm:text-4xl">{nickname}의 문제 화면</h1>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="metric-card">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/58">
                  Round
                </p>
                <p className="display-font mt-2 text-4xl text-white">
                  {questionIndex + 1}/{game.questions.length}
                </p>
              </div>
              <div className="metric-card">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/58">
                  Time Left
                </p>
                <p className="display-font mt-2 text-4xl text-white">
                  {timeUp ? "0" : remainingSec}
                </p>
              </div>
              <div className="metric-card">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/58">
                  Game Code
                </p>
                <p className="display-font mt-2 text-4xl text-white">{gameCode}</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-black text-white/72">
              <span>타이머</span>
              <span>{timeUp ? "시간 종료" : `${remainingSec}초 남음`}</span>
            </div>
            <div className="progress-track">
              <div
                className="progress-bar"
                style={{ width: `${remainingRatio * 100}%` } as CSSProperties}
              />
            </div>
          </div>

          <section className="paper-panel p-6 sm:p-8">
            <div className="space-y-5">
              <div>
                <p className="paper-ghost text-sm font-black uppercase tracking-[0.18em]">
                  Question
                </p>
                <h2 className="display-font mt-3 text-4xl leading-tight text-[var(--panel-text)] sm:text-5xl">
                  {question.text}
                </h2>
              </div>

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
                        } as CSSProperties
                      }
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="answer-shape">{theme.shape}</span>
                        <span className="answer-kicker">{theme.label}</span>
                      </div>
                      <span className="text-base font-black leading-6 sm:text-lg">{choice.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

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
        </section>
      </div>
    </div>
  );
}
