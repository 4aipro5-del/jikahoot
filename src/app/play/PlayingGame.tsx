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
import FinalLeaderboard from "@/components/FinalLeaderboard";
import StageSkeleton from "@/components/StageSkeleton";
import { IconPeople, StudentHeader, StudentMascots, StudentShapes } from "@/components/student-ui";
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
  onForcedOut,
  onLeave,
}: {
  gameCode: string;
  authorUid: string;
  onForcedOut: () => void;
  onLeave: () => void;
}) {
  const [game, setGame] = useState<Game | null | undefined>(undefined);
  const [players, setPlayers] = useState<PlayerWithId[]>([]);
  const [myPlayer, setMyPlayer] = useState<Player | null | undefined>(undefined);
  const [wasRegistered, setWasRegistered] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

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

  // 로비/진행 중에만 가드를 켠다(종료 후엔 뒤로가기 정상 동작). dep가 boolean이라
  // 로비→진행 상태 전환으로 이펙트가 다시 돌지 않아 히스토리 항목이 누적되지 않는다.
  const leaveGuardActive = !!game && game.status !== "finished";

  // 게임 진행 중 브라우저 뒤로가기를 가로채 확인 모달을 띄운다. 새로고침/탭 닫기는
  // beforeunload 기본 경고로 처리. 가드가 켜질 때 마킹된 히스토리 항목을 딱 하나
  // 심고, 가드가 꺼질 때(종료/이탈) 그 항목을 소비(뒤로가기)해 잔여물이 히스토리에
  // 쌓이지 않게 한다. (제출/타이머/점수 로직은 건드리지 않음)
  useEffect(() => {
    if (!leaveGuardActive) return;

    // Next 라우터 state는 보존하고 우리 마커만 얹는다.
    const armGuardEntry = () => {
      window.history.pushState(
        { ...window.history.state, __leaveGuard: true },
        "",
        window.location.href,
      );
    };

    const onPopState = () => {
      // 뒤로가기 소비됨 → 가드 항목을 다시 심어 화면에 머무르게 하고 모달 표시
      armGuardEntry();
      setShowLeaveModal(true);
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    // 아직 가드 항목이 없을 때만 하나 심는다(중복 방지).
    if (!window.history.state?.__leaveGuard) {
      armGuardEntry();
    }
    window.addEventListener("popstate", onPopState);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("beforeunload", onBeforeUnload);
      // 가드 항목이 아직 맨 위면 소비해 히스토리에 남기지 않는다(리스너 제거 후라
      // 이 back은 모달을 다시 띄우지 않는다).
      if (window.history.state?.__leaveGuard) {
        window.history.back();
      }
    };
  }, [leaveGuardActive]);

  function cancelLeave() {
    setShowLeaveModal(false);
  }
  function confirmLeave() {
    setShowLeaveModal(false);
    onLeave();
  }

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
            <FinalLeaderboard players={players} highlightPlayerId={authorUid} />

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
      <>
        <ActiveView
          game={game}
          gameCode={gameCode}
          authorUid={authorUid}
          myScore={myPlayer?.totalScore ?? 0}
        />
        <LeaveGuardModal open={showLeaveModal} onCancel={cancelLeave} onConfirm={confirmLeave} />
      </>
    );
  }

  return (
    <>
      <LobbyView gameCode={gameCode} players={players} />
      <LeaveGuardModal open={showLeaveModal} onCancel={cancelLeave} onConfirm={confirmLeave} />
    </>
  );
}

function LobbyView({
  gameCode,
  players,
}: {
  gameCode: string;
  players: PlayerWithId[];
}) {
  return (
    <div className="stage-shell">
      <StudentShapes />

      <div className="stage-content flex min-h-screen flex-col gap-8 px-5 py-6 sm:px-8">
        <StudentHeader />

        <div className="flex flex-1 items-center justify-center">
          <div className="grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
            {/* left: waiting intro */}
            <div className="flex flex-col justify-center gap-5">
              <span className="inline-flex items-center gap-2 self-start text-sm font-black uppercase tracking-[0.2em] text-[var(--success)]">
                <IconPeople />
                Waiting
              </span>
              <h1 className="display-font text-5xl leading-[1.05] text-white sm:text-6xl lg:text-7xl">
                게임이 곧
                <br />
                <span className="text-[var(--success)]">시작돼요!</span>
              </h1>
              <p className="max-w-md text-base leading-7 text-[color:var(--foreground-muted)] sm:text-lg">
                친구들이 모두 모이면 시작합니다.
              </p>
            </div>

            {/* right: game code + mascots + headcount */}
            <div className="w-full">
              <section className="rounded-[28px] border border-white/10 bg-[var(--surface)] p-7 text-center shadow-[var(--shadow-soft)] sm:p-9">
                <p className="text-base font-black uppercase tracking-[0.2em] text-[var(--success)]">
                  방 코드
                </p>
                <p className="display-font mt-2 break-all text-6xl leading-none text-white sm:text-7xl">
                  {gameCode}
                </p>

                <div className="my-6 border-t border-dashed border-white/12" />

                <StudentMascots />

                <p className="mt-6 text-xl font-bold text-white">
                  <span className="text-3xl font-black text-[var(--success)]">{players.length}</span>{" "}
                  명 참여 중
                </p>
              </section>
            </div>
          </div>
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

  const paused = game.paused ?? false;
  // 일시정지 중에는 시계를 pausedAt 시점에 고정해 타이머를 멈춘다
  const nowMs = paused && game.pausedAt ? game.pausedAt.toMillis() : now;
  const deadline = game.currentQuestionStartedAt
    ? game.currentQuestionStartedAt.toMillis() + game.questionDurationSec * 1000
    : null;
  const remainingSec = deadline ? Math.max(0, Math.ceil((deadline - nowMs) / 1000)) : 0;
  const timeUp = deadline !== null && remainingSec <= 0;
  const hasAnswered = Boolean(answer);

  async function handleChoose(choiceId: string) {
    if (hasAnswered || timeUp || submitting || paused) return;
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

  // 진행 바 색 = 남은 시간에 따라 기본 파랑 → 노랑 → 빨강
  const barColor =
    timeUp || remainingSec <= 5
      ? "var(--error)"
      : remainingSec <= 10
        ? "var(--warning)"
        : "var(--primary)";
  // 진행 바 = 남은 시간 비율 (시간이 줄수록 바가 줄어듦)
  const timeRatio = deadline
    ? Math.max(0, Math.min(1, (deadline - nowMs) / (game.questionDurationSec * 1000)))
    : 0;

  return (
    <div className="stage-shell">
      <div className="stage-content flex min-h-screen flex-col justify-center gap-5 py-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
          {/* 상단: 진행 바(남은 시간에 따라 색 변화), 그 아래 문제 번호 */}
          <div className="flex flex-col gap-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/12">
              <div
                className="h-full rounded-full transition-[width,background-color] duration-300"
                style={{ width: `${timeRatio * 100}%`, backgroundColor: barColor }}
              />
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

          {paused && (
            <p className="status-banner flex items-center justify-center gap-2" data-tone="warning">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
              일시정지됨 · 선생님을 기다려 주세요
            </p>
          )}

          {/* 보기 2×2 (A/B/C/D 라벨 없음, 도형 + 텍스트) */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {question.choices.map((choice, index) => {
              const theme = ANSWER_THEMES[index % ANSWER_THEMES.length];
              const isMyChoice = answer?.choiceId === choice.id;

              return (
                <button
                  key={choice.id}
                  onClick={() => handleChoose(choice.id)}
                  disabled={hasAnswered || timeUp || submitting || paused}
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

// 게임 이탈 확인 모달. 오버레이 클릭·ESC는 '아니오'(취소)와 동일. 기존 게임
// 화면과 같은 짙은 배경/테두리/그림자, 버튼은 Primary(아니오)·Error(예).
function LeaveGuardModal({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-modal-title"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="leave-modal-title" className="display-font text-xl text-white">
          게임을 중단하시겠습니까?
        </h2>
        <p className="mt-3 text-sm leading-6 text-white/60">
          지금 나가면 현재 게임 참여가 종료될 수 있습니다.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            autoFocus
            className="flex-1 rounded-xl px-4 py-3 text-base font-black text-white transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0.5"
            style={{ background: "var(--primary)", boxShadow: "0 5px 0 var(--primary-dark)" }}
          >
            아니오
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-xl px-4 py-3 text-base font-black text-white transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0.5"
            style={{ background: "var(--error)", boxShadow: "0 5px 0 var(--error-dark)" }}
          >
            예
          </button>
        </div>
      </div>
    </div>
  );
}
