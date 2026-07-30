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
import BrandMark from "@/components/BrandMark";
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
      // stage-shell(overflow:hidden) 대신 스크롤 가능한 래퍼. 참가자가 적으면
      // justify-center로 가운데, 많아서 뷰포트보다 길어지면 위로 정렬 + 스크롤돼
      // 제목/버튼이 잘리지 않는다.
      <div className="min-h-screen w-full">
        <div className="stage-content flex min-h-screen flex-col justify-center gap-6 py-8">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 text-center">
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
              START NEW GAME
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
          <div className="grid w-full max-w-6xl items-center gap-8 lg:grid-cols-2 lg:gap-12">
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
                <p className="text-lg font-black uppercase tracking-[0.2em] text-[var(--success)]">
                  방 코드
                </p>
                <p className="display-font mt-2 break-all text-7xl leading-none text-white sm:text-8xl">
                  {gameCode}
                </p>

                <div className="my-6 border-t border-dashed border-white/12" />

                <StudentMascots width={72} />

                <p className="mt-8 text-2xl font-bold text-white">
                  <span className="text-4xl font-black text-[var(--success)]">{players.length}</span>{" "}
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
  // 정답 공개 단계: 방장이 정답 보기 id를 게임 문서에 기록하면 정답을 강조한다.
  const revealedChoiceId = game.revealedChoiceId ?? null;
  const revealed = !!revealedChoiceId;

  // 남은 시간 바: 남은 시간에 따라 파랑 → 노랑 → 빨강, 시간이 줄수록 바가 줄어든다.
  const barColor =
    timeUp || remainingSec <= 5
      ? "var(--error)"
      : remainingSec <= 10
        ? "var(--warning)"
        : "var(--primary)";
  const timeRatio = deadline
    ? Math.max(0, Math.min(1, (deadline - nowMs) / (game.questionDurationSec * 1000)))
    : 0;

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

  const starIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--warning)" aria-hidden="true">
      <path d="m12 2 2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77 5.82 21l1.18-6.86-5-4.87 7.1-1.01z" />
    </svg>
  );
  const pauseIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-5 py-6 sm:px-8">
        {/* 상단 바: 로고 / (일시정지 상태) + 점수 */}
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BrandMark className="h-9 w-9 flex-none" />
            <span className="brand-wordmark text-2xl text-white">JIHOOT</span>
          </div>
          <div className="flex items-center gap-2.5">
            {paused && (
              <span className="inline-flex items-center gap-2 rounded-full bg-white/8 px-4 py-2 text-sm font-bold text-white/80">
                {pauseIcon}
                일시정지
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-4 py-2 text-sm font-black text-white">
              {starIcon}
              {myScore}점
            </span>
          </div>
        </header>

        {/* 본문: 남은 공간 세로 중앙 정렬 */}
        <div className="flex flex-1 flex-col justify-center gap-5">
          {/* 일시정지 안내 배너 */}
          {paused && (
            <p className="mx-auto inline-flex items-center gap-2 rounded-2xl bg-[var(--surface)] px-6 py-3.5 text-base font-bold text-[var(--warning)]">
              {pauseIcon}
              선생님을 기다리고 있어요.
            </p>
          )}

          {/* 남은 시간 바 (문제 카드 위, 다크 배경) */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/12">
            <div
              className="h-full rounded-full transition-[width,background-color] duration-300"
              style={{ width: `${timeRatio * 100}%`, backgroundColor: barColor }}
            />
          </div>

          {/* 문제 카드 (화이트): 문제 번호 / 질문 / 보기 2×2 */}
          <section className="rounded-[28px] border border-black/[0.06] bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.06)] sm:p-8">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.06] px-4 py-2 text-sm font-black">
              <span className="text-[var(--muted)]">문제</span>
              <span style={{ color: "var(--primary)" }}>{questionIndex + 1}</span>
              <span className="text-black/35">/ {game.questions.length}</span>
            </span>

            <div className="mt-6 flex min-h-[5.5rem] items-center gap-4 sm:min-h-[7rem]">
              <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-[var(--primary)] text-xl font-black text-white">
                Q
              </span>
              <h2 className="display-font text-2xl leading-tight text-[var(--panel-text)] sm:text-3xl">
                {question.text}
              </h2>
            </div>

            {/* 보기 2×2 — 폰에서도 2열 유지(세로로 쌓지 않아 4개가 한 화면에 들어옴).
                좁은 화면에서 칸이 넘치지 않도록 모바일에선 크기를 컴팩트하게 낮춘다. */}
            <div className="mt-8 grid grid-cols-2 gap-3 sm:mt-10 sm:gap-4">
              {question.choices.map((choice, index) => {
                const theme = ANSWER_THEMES[index % ANSWER_THEMES.length];
                const isMyChoice = answer?.choiceId === choice.id;
                const isCorrectChoice = revealed && choice.id === revealedChoiceId;
                const myWrongChoice = revealed && isMyChoice && !isCorrectChoice;
                // 공개 단계에서 정답도 내 선택도 아닌 보기는 흐리게
                const dim = revealed && !isCorrectChoice && !isMyChoice;

                return (
                  <button
                    key={choice.id}
                    onClick={() => handleChoose(choice.id)}
                    disabled={hasAnswered || timeUp || submitting || paused || revealed}
                    className="relative flex min-h-[6.5rem] items-center gap-3 rounded-2xl px-4 py-4 text-left transition-[transform,opacity] duration-150 ease-out enabled:hover:-translate-y-0.5 enabled:active:translate-y-0.5 disabled:cursor-not-allowed sm:min-h-[10rem] sm:gap-4 sm:px-6 sm:py-5"
                    style={{
                      background: theme.bg,
                      color: theme.light ? "var(--panel-text)" : "#ffffff",
                      boxShadow: `0 5px 0 ${theme.shadow}`,
                      opacity: dim ? 0.4 : 1,
                      // 공개 시 정답=초록 테두리, 아니면 내 선택=흰 테두리. 5px 안쪽 + 1.03배.
                      outline: isCorrectChoice
                        ? "5px solid var(--success)"
                        : isMyChoice
                          ? "5px solid #ffffff"
                          : "none",
                      outlineOffset: "-5px",
                      transform: isCorrectChoice || isMyChoice ? "scale(1.03)" : undefined,
                      zIndex: isCorrectChoice || isMyChoice ? 1 : undefined,
                    }}
                  >
                    <span
                      className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-lg font-black sm:h-14 sm:w-14 sm:text-2xl"
                      style={{ background: theme.light ? "rgba(23,21,31,0.08)" : "rgba(255,255,255,0.22)" }}
                    >
                      {theme.shape}
                    </span>
                    <span className="min-w-0 flex-1 text-base font-black leading-snug sm:text-2xl">
                      {choice.text}
                    </span>
                    {isCorrectChoice ? (
                      <span
                        className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[var(--success)] text-white shadow-[0_2px_10px_rgba(0,0,0,0.25)] sm:h-12 sm:w-12"
                        aria-label="정답"
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      </span>
                    ) : myWrongChoice ? (
                      <span
                        className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[var(--error)] text-white shadow-[0_2px_10px_rgba(0,0,0,0.25)] sm:h-12 sm:w-12"
                        aria-label="내가 고른 오답"
                      >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </span>
                    ) : isMyChoice ? (
                      <span
                        className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[#1a1626] text-white shadow-[0_2px_10px_rgba(0,0,0,0.25)] sm:h-12 sm:w-12"
                        aria-label="선택함"
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>

          {/* 제출 오류만 배너로 (채점 결과는 하단 바 우측에 표시) */}
          {submitError && (
            <p className="status-banner" data-tone="error">
              {submitError}
            </p>
          )}

          {/* 하단: 보너스 안내(좌) + 채점 결과(우) */}
          <div className="flex items-center gap-4 rounded-2xl bg-[var(--surface)] px-5 py-4 text-sm text-white/70 sm:text-base">
            <span className="flex-none">{starIcon}</span>
            <span className="min-w-0 flex-1">
              정답을 빠르게, 연속으로 맞히면{" "}
              <span className="font-bold text-[var(--warning)]">보너스 점수</span>를 얻어요!
            </span>

            {answer && answer.isCorrect !== null ? (
              <>
                <span className="h-9 w-px flex-none bg-white/12" />
                <span className="flex flex-none items-baseline gap-2 whitespace-nowrap">
                  {answer.isCorrect ? (
                    <>
                      <span className="display-font text-lg text-white sm:text-2xl">정답!</span>
                      <span className="display-font text-lg text-[var(--success)] sm:text-2xl">
                        +{answer.pointsEarned}점
                      </span>
                    </>
                  ) : (
                    <span className="display-font text-lg text-white/70 sm:text-2xl">오답</span>
                  )}
                </span>
              </>
            ) : answer ? (
              <>
                <span className="h-9 w-px flex-none bg-white/12" />
                <span className="flex-none whitespace-nowrap text-lg font-black text-white">
                  제출 완료
                </span>
              </>
            ) : null}
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
