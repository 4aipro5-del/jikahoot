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
      <LobbyView nickname={nickname} players={players} />
      <LeaveGuardModal open={showLeaveModal} onCancel={cancelLeave} onConfirm={confirmLeave} />
    </>
  );
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
        <p className="inline-flex items-center gap-3 text-sm font-black uppercase tracking-[0.32em] text-[var(--warning)]">
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
          <span className="text-[var(--warning)]">
            <IconPeople />
          </span>
          참가자 <span className="text-[var(--warning)]">{players.length}</span>명
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
