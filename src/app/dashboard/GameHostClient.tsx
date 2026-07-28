"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import { subscribeToAuthState } from "@/lib/firebase/auth";
import {
  advanceQuestion,
  finalizeQuestion,
  finishGame,
  pauseGame,
  removePlayerFromGame,
  resumeGame,
  subscribeToGame,
  subscribeToPlayers,
  type PlayerWithId,
} from "@/lib/firestore/games";
import { getCorrectChoiceMap } from "@/lib/firestore/questions";
import { clearCurrentGame } from "@/lib/firestore/rooms";
import type { Game } from "@/types/firestore";
import Leaderboard from "@/components/Leaderboard";
import GameQRCode from "@/components/GameQRCode";
import StageSkeleton from "@/components/StageSkeleton";
import { useNow } from "@/lib/useNow";
import { useGrading } from "./useGrading";

const CHOICE_THEMES = [
  { bg: "var(--primary)", shadow: "rgba(34, 1, 158, 0.42)", shape: "▲", label: "A", light: false },
  { bg: "var(--warning)", shadow: "rgba(138, 90, 0, 0.4)", shape: "●", label: "B", light: false },
  { bg: "var(--error)", shadow: "rgba(151, 27, 20, 0.42)", shape: "◆", label: "C", light: false },
  { bg: "var(--success)", shadow: "rgba(20, 83, 45, 0.42)", shape: "■", label: "D", light: false },
];

export default function GameHostClient({
  gameCode,
  embedded = false,
}: {
  gameCode: string;
  // embedded=true renders inside the dashboard Game tab (no fullscreen stage
  // wrapper, no popup close/navigation on end — the parent GameTab detects the
  // room's currentGameId clearing and returns to the start screen on its own).
  embedded?: boolean;
}) {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [game, setGame] = useState<Game | null | undefined>(undefined);
  const [players, setPlayers] = useState<PlayerWithId[]>([]);
  const [correctChoiceMap, setCorrectChoiceMap] = useState<Record<string, string>>({});
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Synchronous re-entrancy lock: the `advancing` state flips a render later, so
  // a second click (or auto-advance firing at the same instant) can slip in
  // before the button disables. This ref blocks that window so advance/end run
  // at most once at a time.
  const busyRef = useRef(false);
  const [showEndGameModal, setShowEndGameModal] = useState(false);
  const [ending, setEnding] = useState(false);

  useEffect(() => subscribeToAuthState(setUser), []);
  // 이 컴포넌트는 게임 운영 창(팝업)에서도 렌더된다. 팝업은 Firebase 세션을
  // 비동기로 복원하는데, 그 전에 game/players를 구독하면 미인증 상태로 읽어
  // 스냅샷 리스너에서 permission-denied가 터진다. 그래서 user가 준비된 뒤 구독한다.
  useEffect(() => {
    if (!user) return;
    return subscribeToGame(gameCode, setGame);
  }, [gameCode, user]);
  useEffect(() => {
    if (!user) return;
    return subscribeToPlayers(gameCode, setPlayers);
  }, [gameCode, user]);

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
    // questionBank lives under the room (roomId); legacy games fall back to
    // teacherUid, which equals the roomId for a primary room.
    getCorrectChoiceMap(
      game.roomId ?? game.teacherUid,
      game.questions.map((q) => q.id),
    ).then(setCorrectChoiceMap);
  }, [game, user]);

  const answers = useGrading(gameCode, game, players);

  // Host-only moderation: remove a player who joined by mistake while still in
  // the lobby. Rules already allow the game owner to delete the player +
  // nickname docs during 'lobby'; the kicked student's own subscription
  // (PlayingGame) sees its doc vanish and drops back to the join screen.
  async function handleKick(player: PlayerWithId) {
    setError(null);
    try {
      await removePlayerFromGame(gameCode, player.id, player.nickname);
    } catch (err) {
      setError(err instanceof Error ? err.message : "참가자를 내보내지 못했습니다.");
    }
  }

  // Grade the current question (scores + streaks) before leaving it. Must run
  // on every path that exits an active question — advancing AND ending early —
  // or those answers stay ungraded and their points never reach the leaderboard.
  async function finalizeCurrentQuestion() {
    if (!game || game.status !== "active") return;
    const question = game.questions[game.currentQuestionIndex];
    const correctChoiceId = correctChoiceMap[question.id];
    if (!correctChoiceId) return;
    await finalizeQuestion(
      gameCode,
      players.map((p) => p.id),
      game.currentQuestionIndex,
      correctChoiceId,
    );
  }

  async function handleAdvance() {
    if (!game || busyRef.current) return;
    busyRef.current = true;
    setError(null);
    setAdvancing(true);
    try {
      await finalizeCurrentQuestion();

      const nextIndex = game.currentQuestionIndex + 1;
      if (nextIndex >= game.questions.length) {
        await finishGame(gameCode);
      } else {
        await advanceQuestion(gameCode, nextIndex);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "진행하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      busyRef.current = false;
      setAdvancing(false);
    }
  }

  async function handlePauseToggle() {
    if (!game) return;
    setError(null);
    try {
      if (game.paused) {
        await resumeGame(gameCode);
      } else {
        await pauseGame(gameCode);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "일시정지 상태를 변경하지 못했습니다.");
    }
  }

  async function handleEndNow() {
    if (!game || busyRef.current) return;
    busyRef.current = true;
    setError(null);
    setAdvancing(true);
    try {
      // 종료 전에 현재 문제를 채점해야 점수/연속정답이 리더보드에 반영된다
      await finalizeCurrentQuestion();
      await finishGame(gameCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "게임을 종료하지 못했습니다.");
    } finally {
      busyRef.current = false;
      setAdvancing(false);
    }
  }

  // 게임을 종료하고 게임 창을 닫는다. 게임을 finished 처리해 참가자 화면을
  // 정리하고, 방의 게임 연결(currentGameId)을 해제한다. 그러면 원래 창(GameTab)이
  // 이를 감지해 '새 게임 시작' 첫 화면으로 돌아간다(재로그인/재진입 시에도 첫 화면).
  // 팝업으로 열린 게임 창이면 정리 후 스스로 닫는다. 진행 중 게임 복구는
  // currentGameId를 그대로 두는 정상 경로에서 유지되고, 여기서만 명시적으로 정리한다.
  async function handleConfirmEndGame() {
    if (!game || ending) return;
    setEnding(true);
    setError(null);
    try {
      await finishGame(gameCode);
      await clearCurrentGame(game.roomId ?? game.teacherUid, gameCode);
      // 대시보드 임베드 모드에서는 여기서 아무것도 하지 않는다 — currentGameId가
      // 해제되면 부모 GameTab이 '새 게임 시작' 화면으로 돌아간다. 팝업(독립 창)으로
      // 열린 경우엔 정리 후 스스로 닫는다. 직접 접근한 경우 opener가 없어 무시된다.
      if (!embedded && typeof window !== "undefined" && window.opener && !window.opener.closed) {
        window.close();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "게임을 종료하지 못했습니다.");
      setShowEndGameModal(false);
      setEnding(false);
    }
  }

  // 결과 확인 후 방의 게임 연결(currentGameId)을 해제해 '새 게임 시작' 첫 화면으로
  // 돌아간다. 게임이 자연 종료되면 clearCurrentGame이 호출되지 않아 방이 finished
  // 게임에 계속 묶이는데, finished 화면의 이 버튼이 그 유일한 정리 경로다.
  async function handleResetGame() {
    if (!game || ending) return;
    setEnding(true);
    setError(null);
    try {
      await clearCurrentGame(game.roomId ?? game.teacherUid, gameCode);
      // 임베드 모드: currentGameId 해제만으로 부모 GameTab이 '새 게임 시작'으로
      // 돌아가므로 별도 이동/닫기를 하지 않는다. 팝업 창이면 닫고, 직접 접근한
      // 독립 창이면 대시보드로 이동한다.
      if (embedded) {
        // no-op — parent re-renders once currentGameId clears
      } else if (typeof window !== "undefined" && window.opener && !window.opener.closed) {
        window.close();
      } else {
        router.replace("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "게임을 정리하지 못했습니다.");
      setEnding(false);
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
    // 임베드(대시보드) 모드에서는 자동 진행을 하지 않는다 — 탭/방을 옮기면 이
    // 컴포넌트가 언마운트돼 타이머가 죽기 때문. 대신 대시보드 루트에 항상 떠 있는
    // GameAutoAdvancer가 자동 진행을 담당한다. 여기(임베드)는 수동 '다음 문제'만.
    // 독립 라우트(/dashboard/game/[code])는 팝업처럼 상시 마운트라 자체 처리.
    if (embedded) return;
    if (!game || game.status !== "active" || advancing) return;
    // 일시정지 중에는 자동 진행하지 않음
    if (game.paused) return;
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
    if (embedded) {
      return (
        <div className="flex min-h-[40vh] items-center justify-center">
          <span className="h-14 w-14 animate-pulse rounded-2xl bg-white/10" aria-hidden="true" />
        </div>
      );
    }
    return <StageSkeleton />;
  }

  // 로딩 이후의 안내 상태(게임 없음 / 권한 없음)는 임베드 여부에 따라 전체화면
  // stage 래퍼를 쓸지, 대시보드 안 카드로 보일지 결정한다.
  const panelMessage = (message: string) =>
    embedded ? (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="quiz-panel px-6 py-5 text-center">
          <p className="paper-muted">{message}</p>
        </div>
      </div>
    ) : (
      <div className="stage-shell">
        <div className="stage-content flex min-h-screen items-center justify-center">
          <div className="quiz-panel px-6 py-5 text-center">
            <p className="paper-muted">{message}</p>
          </div>
        </div>
      </div>
    );

  if (game === null) {
    return panelMessage("게임을 찾을 수 없어요.");
  }

  if (game.teacherUid !== user.uid) {
    return panelMessage("권한이 없어요.");
  }

  // Time-based escape hatch: once the question timer expires the host can
  // advance even if not everyone answered (and auto-advance fires if enabled).
  const activeDeadline =
    game.status === "active" && game.currentQuestionStartedAt
      ? game.currentQuestionStartedAt.toMillis() + game.questionDurationSec * 1000
      : null;
  // 일시정지 중에는 시계를 pausedAt에 고정해 '시간 종료' 판정도 멈춘다
  const effectiveNow = game.paused && game.pausedAt ? game.pausedAt.toMillis() : now;
  const activeTimeUp = activeDeadline !== null && effectiveNow >= activeDeadline;

  const consoleBody = (
    <div
      className={
        embedded
          ? "dashboard-stage mx-auto flex w-full flex-col gap-6"
          : "stage-content dashboard-stage flex min-h-screen flex-col gap-6 py-8"
      }
    >
        {game.status === "lobby" &&
          (embedded ? (
            // 대시보드 임베드(교사 화면 ②): QR/코드/참가자 그리드는 학생 전광판
            // 창이 담당하므로, 여기서는 대기 안내 + 참가자 수 + 시작/종료만 둔다.
            <WaitingHostView
              playerCount={players.length}
              canStart={players.length > 0}
              onStart={handleAdvance}
              onEndGame={() => setShowEndGameModal(true)}
              starting={advancing}
            />
          ) : (
            // 독립 라우트(보조): 예전처럼 콘솔 전체(QR/코드/참가자/시작)를 렌더
            <LobbyView
              gameCode={gameCode}
              players={players}
              canStart={players.length > 0}
              onStart={handleAdvance}
              onKick={handleKick}
              onEndGame={() => setShowEndGameModal(true)}
              starting={advancing}
            />
          ))}

        {game.status === "active" && (
          <ActiveView
            game={game}
            players={players}
            answeredIds={new Set(Object.keys(answers))}
            timeUp={activeTimeUp}
            paused={game.paused ?? false}
            onAdvance={handleAdvance}
            onPauseToggle={handlePauseToggle}
            onEndNow={handleEndNow}
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
            <button
              type="button"
              onClick={handleResetGame}
              disabled={ending}
              className="primary-button primary-button-stage mx-auto w-full max-w-md disabled:cursor-not-allowed disabled:opacity-60"
            >
              {ending ? "정리 중..." : "새 게임 준비하기"}
            </button>
          </div>
        )}

        {error && (
          <p className="status-banner" data-tone="error">
            {error}
          </p>
        )}
      </div>
  );

  return (
    <>
      {embedded ? consoleBody : <div className="stage-shell">{consoleBody}</div>}

      <EndGameConfirmModal
        open={showEndGameModal}
        busy={ending}
        onCancel={() => {
          if (!ending) setShowEndGameModal(false);
        }}
        onConfirm={handleConfirmEndGame}
        embedded={embedded}
      />
    </>
  );
}

// 교사 화면 ②(애들 들어오는 중). 학생 전광판 창이 QR/코드/참가자 명단을 보여주므로
// 대시보드에는 대기 안내 + 참가자 수 + 게임 시작/종료만 둔다. '학생 화면 다시 열기'는
// 상위 GameTab이 상단에 항상 제공한다.
function WaitingHostView({
  playerCount,
  canStart,
  onStart,
  onEndGame,
  starting,
}: {
  playerCount: number;
  canStart: boolean;
  onStart: () => void;
  onEndGame: () => void;
  starting: boolean;
}) {
  return (
    <div className="mx-auto flex min-h-[58vh] w-full max-w-xl flex-col items-center justify-center gap-9 py-10 text-center">
      <div className="space-y-3">
        <p className="hero-chip">Game</p>
        <h1 className="display-font text-5xl leading-none text-white sm:text-6xl">게임 진행 중</h1>
      </div>

      <div>
        <p className="text-sm font-black uppercase tracking-[0.2em] text-white/50">현재 참가자</p>
        <p className="display-font mt-2 leading-none text-white">
          <span className="text-6xl">{playerCount}</span>
          <span className="ml-1.5 text-2xl">명</span>
        </p>
      </div>

      <div className="flex w-full max-w-md flex-col gap-2.5">
        <button
          onClick={onStart}
          disabled={!canStart || starting}
          className="inline-flex min-h-[4.5rem] items-center justify-center gap-3 rounded-2xl border-2 border-white/15 bg-[var(--error)] px-6 text-3xl font-black text-white shadow-[0_8px_0_var(--error-dark)] transition-transform duration-150 enabled:hover:-translate-y-0.5 enabled:active:translate-y-1 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span aria-hidden="true">▶</span>
          {starting ? "시작하는 중..." : "게임 시작하기"}
        </button>
        <button
          type="button"
          onClick={onEndGame}
          className="inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-xl px-4 text-lg font-bold text-white/55 transition-colors duration-150 hover:bg-[var(--error-soft)] hover:text-[var(--error)]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
          게임 종료
        </button>
      </div>

      {!canStart && (
        <p className="text-sm text-white/45">학생이 입장하면 게임을 시작할 수 있어요.</p>
      )}
    </div>
  );
}

// 참가자 번호 색은 핵심 4색을 index 기준으로 순환 배정한다. 순환이라 바로 옆
// 참가자와는 절대 같은 색이 되지 않는다(연속 중복 방지).
const LOBBY_NUMBER_COLORS = ["var(--primary)", "var(--warning)", "var(--error)", "var(--success)"];

function LobbyView({
  gameCode,
  players,
  canStart,
  onStart,
  onKick,
  onEndGame,
  starting,
}: {
  gameCode: string;
  players: PlayerWithId[];
  canStart: boolean;
  onStart: () => void;
  onKick: (player: PlayerWithId) => void;
  onEndGame: () => void;
  starting: boolean;
}) {
  const joinHost = typeof window !== "undefined" ? window.location.host : "";

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      {/* top bar — 3열 고정(QR+안내 / 게임 코드 / 시작·종료). 데스크톱·전체화면에서는
          grid로 절대 줄바꿈되지 않고, lg 미만(태블릿 이하)에서만 세로로 스택된다. */}
      <div className="grid grid-cols-1 items-center gap-6 rounded-[24px] border border-white/10 bg-[var(--surface)] px-6 py-6 sm:px-8 lg:grid-cols-[auto_1fr_auto] lg:gap-10">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex-none rounded-xl bg-white p-2">
            <GameQRCode gameCode={gameCode} size={132} />
          </div>
          <p className="text-sm font-bold leading-relaxed text-white/90 sm:text-base">
            웹 브라우저에서
            <br />
            <span className="text-[var(--accent)]">{joinHost}</span> 접속 후
            <br />
            아래 Game ID 입력
          </p>
        </div>

        {/* 게임 코드 — 카드 중앙 영역, 시각적으로 가장 크게 */}
        <div className="min-w-0 lg:text-center">
          <p className="text-sm font-bold text-white/50">게임 코드</p>
          <p className="display-font mt-1 break-all text-[clamp(2.5rem,5vw,4.5rem)] leading-none text-white">
            {gameCode}
          </p>
        </div>

        {/* 우측 열: 게임 시작하기(Primary CTA) 위, 게임 종료(작은 보조) 아래 — 세로 유지 */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={onStart}
            disabled={!canStart || starting}
            className="inline-flex min-h-[4.5rem] items-center justify-center gap-3 whitespace-nowrap rounded-2xl border-2 border-white/15 bg-[var(--error)] px-6 text-3xl font-black text-white shadow-[0_8px_0_var(--error-dark)] transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-1 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span aria-hidden="true">▶</span>
            {starting ? "시작하는 중..." : "게임 시작하기"}
          </button>
          <button
            type="button"
            onClick={onEndGame}
            className="inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-xl px-4 text-lg font-bold text-white/55 transition-colors duration-150 hover:bg-[var(--error-soft)] hover:text-[var(--error)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            게임 종료
          </button>
        </div>
      </div>

      {/* headline — only while nobody has joined yet */}
      {players.length === 0 && (
        <div className="flex flex-col items-center text-center">
          <p className="hero-chip">Waiting for Players</p>
          <h1 className="display-font mt-3 text-4xl text-white sm:text-5xl">
            참가자를 기다리고 있어요!
          </h1>
        </div>
      )}

      {/* headcount + participant grid */}
      <div className="flex flex-col items-center gap-6">
        <div className="inline-flex items-center gap-2.5 rounded-full bg-[var(--surface)] px-5 py-2.5 text-lg font-black text-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
            <circle cx="9" cy="7" r="3.5" />
            <path d="M22 20v-1.5a4 4 0 0 0-3-3.85" />
            <path d="M16 3.6a4 4 0 0 1 0 6.8" />
          </svg>
          참가자 {players.length}명
        </div>

        {players.length > 0 && (
          <div className="w-full">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
              {players.map((player, index) => (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => onKick(player)}
                  title={`${player.nickname} 내보내기`}
                  aria-label={`${player.nickname} 내보내기`}
                  className="group tile-enter relative flex min-h-[104px] items-center justify-center rounded-2xl border border-white/10 bg-[var(--surface)] px-6 py-6 text-center transition hover:border-[color:var(--error)] hover:bg-[var(--error-soft)]"
                >
                  <span
                    className="absolute left-4 top-3 text-xl font-black tabular-nums"
                    style={{ color: LOBBY_NUMBER_COLORS[index % LOBBY_NUMBER_COLORS.length] }}
                  >
                    {index + 1}
                  </span>
                  <span className="max-w-full truncate text-2xl font-black text-white transition-colors group-hover:text-[var(--error)] group-hover:line-through sm:text-3xl">
                    {player.nickname}
                  </span>
                  <span className="absolute right-3 top-3 text-[var(--error)] opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-6 text-center text-sm text-white/40">
              참가자 이름을 누르면 내보낼 수 있어요. 더 많은 참가자가 입장하면 여기에 표시됩니다.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function ActiveView({
  game,
  players,
  answeredIds,
  timeUp,
  paused,
  onAdvance,
  onPauseToggle,
  onEndNow,
  advancing,
}: {
  game: Game;
  players: PlayerWithId[];
  answeredIds: Set<string>;
  timeUp: boolean;
  paused: boolean;
  onAdvance: () => void;
  onPauseToggle: () => void;
  onEndNow: () => void;
  advancing: boolean;
}) {
  const question = game.questions[game.currentQuestionIndex];
  const isLastQuestion = game.currentQuestionIndex >= game.questions.length - 1;
  const answeredCount = answeredIds.size;
  // 즉시 종료는 실수 방지를 위해 두 번 눌러 확정. 문제가 바뀌면 확정 상태 초기화.
  const [endConfirm, setEndConfirm] = useState(false);
  const [trackedIndex, setTrackedIndex] = useState(game.currentQuestionIndex);
  if (game.currentQuestionIndex !== trackedIndex) {
    setTrackedIndex(game.currentQuestionIndex);
    setEndConfirm(false);
  }
  const answerRatio = players.length > 0 ? answeredCount / players.length : 0;
  // Gate manual advance on everyone having answered; the timer is the escape
  // hatch so a non-answering student can't stall the whole class.
  const allAnswered = answeredCount >= players.length;
  const canAdvance = allAnswered || timeUp;

  return (
    <section className="grid gap-6 lg:grid-cols-[1.7fr_1fr] lg:items-stretch">
      {/* 현재 문제 — 가장 큰 영역: 문제번호 / 제목 / 제출 현황 / 보기 4개 */}
      <div className="paper-panel flex flex-col gap-6 p-6 sm:p-8">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full bg-[var(--primary-soft)] px-4 py-2 text-sm font-black text-[var(--primary-dark)]">
              문제 {game.currentQuestionIndex + 1} / {game.questions.length}
            </span>
            {paused && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--warning-soft)] px-3 py-2 text-sm font-black text-[var(--warning-dark)]">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
                일시정지됨
              </span>
            )}
          </div>
          <h1 className="display-font text-4xl leading-tight text-[var(--panel-text)] sm:text-5xl">
            {question.text}
          </h1>
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
                  <span className="answer-kicker">{theme.label}</span>
                </div>
                <span className="text-base font-black leading-6 sm:text-lg">{choice.text}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* 오른쪽: 제출 현황 + 게임 제어 (위계: 다음 문제 > 일시정지/종료) */}
      <div className="flex flex-col gap-4">
        {/* 제출 현황 */}
        <div className="rounded-2xl border border-white/10 bg-[var(--surface)] p-6">
          <p className="text-base font-black text-white">제출 현황</p>
          <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-white transition-[width] duration-300"
              style={{ width: `${answerRatio * 100}%` }}
            />
          </div>
          <p className="mt-3 text-sm font-bold text-white/70">
            {answeredCount} / {players.length}명 제출
          </p>
        </div>

        {/* 주요 액션: 다음 문제 */}
        <button
          onClick={onAdvance}
          disabled={advancing || !canAdvance}
          className="w-full rounded-2xl bg-[var(--primary)] px-6 py-6 shadow-[0_6px_0_var(--primary-dark)] transition-transform duration-150 enabled:hover:-translate-y-0.5 enabled:active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="flex items-center justify-center gap-3">
            {!advancing && !isLastQuestion && (
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-white/20 text-white">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </span>
            )}
            <span className="text-2xl font-black text-white">
              {advancing ? "처리 중..." : isLastQuestion ? "게임 종료" : "다음 문제"}
            </span>
          </span>
          {!advancing && !isLastQuestion && (
            <span className="mt-1 block text-sm font-bold text-white/70">
              {game.currentQuestionIndex + 2} / {game.questions.length}
            </span>
          )}
        </button>

        {/* 보조 액션: 일시정지/재개 · 지금 종료 */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onPauseToggle}
            disabled={advancing}
            className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-white/10 bg-[var(--surface)] py-6 text-lg font-black text-white transition-colors duration-150 enabled:hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {paused ? (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" style={{ color: "var(--warning)" }} aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" style={{ color: "var(--warning)" }} aria-hidden="true">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            )}
            {paused ? "재개" : "일시정지"}
          </button>

          <button
            type="button"
            onClick={() => (endConfirm ? onEndNow() : setEndConfirm(true))}
            disabled={advancing}
            className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border py-6 text-lg font-black transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
            style={
              endConfirm
                ? { background: "var(--error-soft)", borderColor: "var(--error)", color: "var(--error)" }
                : { borderColor: "rgba(255,255,255,0.1)", color: "#ffffff" }
            }
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" style={{ color: "var(--error)" }} aria-hidden="true">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            {endConfirm ? "한 번 더" : "지금 종료"}
          </button>
        </div>

        {!canAdvance && !advancing && (
          <p className="text-sm leading-6 text-white/45">
            모든 학생이 제출하면 넘어갈 수 있어요.
            <br />
            시간이 끝나면 자동으로 넘어가요.
          </p>
        )}
      </div>
    </section>
  );
}

// 게임 종료 확인 모달. 오버레이 클릭·ESC는 '아니오'와 동일(처리 중엔 무시).
function EndGameConfirmModal({
  open,
  busy,
  onCancel,
  onConfirm,
  embedded = false,
}: {
  open: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  embedded?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="end-game-modal-title"
      onClick={() => !busy && onCancel()}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="end-game-modal-title" className="display-font text-xl text-white">
          게임을 종료하시겠습니까?
        </h2>
        <p className="mt-3 text-sm leading-6 text-white/60">
          {embedded
            ? "현재 게임방과 참가자 정보가 종료됩니다."
            : "현재 게임방과 참가자 정보가 종료되고 게임 창이 닫힙니다."}
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            autoFocus
            className="flex-1 rounded-xl px-4 py-3 text-base font-black text-white transition-transform duration-150 enabled:hover:-translate-y-0.5 enabled:active:translate-y-0.5 disabled:opacity-60"
            style={{ background: "var(--primary)", boxShadow: "0 5px 0 var(--primary-dark)" }}
          >
            아니오
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 rounded-xl px-4 py-3 text-base font-black text-white transition-transform duration-150 enabled:hover:-translate-y-0.5 enabled:active:translate-y-0.5 disabled:opacity-60"
            style={{ background: "var(--error)", boxShadow: "0 5px 0 var(--error-dark)" }}
          >
            {busy ? "처리 중..." : "예"}
          </button>
        </div>
      </div>
    </div>
  );
}
