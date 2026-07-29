"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { signInStudentAnonymously, subscribeToAuthState } from "@/lib/firebase/auth";
import { subscribeToGame, subscribeToPlayers, type PlayerWithId } from "@/lib/firestore/games";
import type { Game } from "@/types/firestore";
import Leaderboard from "@/components/Leaderboard";
import FinalLeaderboard from "@/components/FinalLeaderboard";
import GameQRCode from "@/components/GameQRCode";
import { IconSparkle, StudentMascot } from "@/components/student-ui";

// 학생용 전광판(교실 스크린 / 프로젝터) 전용 화면. 게임 제어는 전부 교사
// 대시보드에서 이루어지고, 이 화면은 "게임 코드 + 진행 상황 + 실시간 순위"만
// 보여준다. 학생이 접속이 끊겨도 게임 코드를 계속 볼 수 있게 하는 것이 목적이라
// 문제/보기/타이머 같은 진행 UI는 두지 않는다.
export default function DisplayClient({ gameCode }: { gameCode: string }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [game, setGame] = useState<Game | null | undefined>(undefined);
  const [players, setPlayers] = useState<PlayerWithId[]>([]);

  useEffect(() => subscribeToAuthState(setUser), []);

  useEffect(() => {
    // This page is opened via window.open from the teacher's own signed-in
    // tab, but a brand-new browsing context has to re-restore that session
    // from storage asynchronously — subscribing before that finishes throws
    // an uncaught permission-denied. If it turns out there really is no
    // session (opened directly, not via the button), fall back to an
    // anonymous sign-in — the same mechanism students already use — so the
    // board still works standalone.
    if (user === null) {
      signInStudentAnonymously().catch((err) => console.error("익명 로그인에 실패했습니다.", err));
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeToGame(gameCode, setGame);
  }, [gameCode, user]);

  useEffect(() => {
    // Waiting on `game` (not just `user`) matters: the players security rule
    // reads the parent game doc's status, which errors out as permission-
    // denied if that doc doesn't exist yet/at all — so don't query players
    // until we know the game itself actually loaded. Note the live leaderboard
    // during 'active' is host-only per the rules, so it populates only when the
    // board is opened from the teacher's (owner) session — which is the normal
    // "학생 화면 열기" flow. An anonymous standalone open still shows code/QR.
    if (!user || !game) return;
    return subscribeToPlayers(gameCode, setPlayers);
  }, [gameCode, user, game]);

  if (user === undefined || game === undefined) {
    return (
      <FullscreenStage>
        <span className="h-16 w-16 animate-pulse rounded-2xl bg-white/10" aria-hidden="true" />
      </FullscreenStage>
    );
  }

  if (game === null) {
    return (
      <FullscreenStage>
        <p className="text-xl font-bold text-white/60">게임을 찾을 수 없어요.</p>
      </FullscreenStage>
    );
  }

  if (game.status === "finished") {
    return (
      <FullscreenStage wide>
        <div className="flex w-full flex-col items-center gap-8 text-center">
          <p className="hero-chip">Final Leaderboard</p>
          <h1 className="display-font text-6xl text-white">최종 순위</h1>
          <div className="w-full max-w-4xl">
            <FinalLeaderboard players={players} />
          </div>
        </div>
      </FullscreenStage>
    );
  }

  if (game.status === "active") {
    // Ⓑ 진행 중: 게임 코드 + 진행 상황 + 실시간 순위 보드.
    // 진행 중 전체 명단은 Firestore Rules상 방장(owner)만 읽을 수 있다. 익명으로
    // (직접 URL·별도 프로젝터 브라우저) 연 경우 players 구독이 거부돼 로비 스냅샷
    // (0점·입장순)이 남으므로, 소유자가 아니면 순위를 숨긴다.
    const isOwner = !!user && user.uid === game.teacherUid;
    return <DisplayBoard gameCode={gameCode} game={game} players={players} isOwner={isOwner} />;
  }

  // Ⓐ 시작 전·입장 중: 원래 쓰던 로비 형식(QR/안내/코드 + 참가자) 그대로,
  // 단 제어 버튼(게임 시작하기·게임 종료)은 학생 화면이라 제거한다.
  return <LobbyDisplay gameCode={gameCode} players={players} />;
}

// 참가자 번호 색은 핵심 4색을 순환 배정한다(연속 중복 방지).
const LOBBY_NUMBER_COLORS = ["var(--primary)", "var(--warning)", "var(--error)", "var(--success)"];

function LobbyDisplay({ gameCode, players }: { gameCode: string; players: PlayerWithId[] }) {
  const joinHost = typeof window !== "undefined" ? window.location.host : "";

  return (
    <div className="flex min-h-screen w-full justify-center bg-[var(--background)] px-5 py-8 sm:px-8">
      <section
        className="mx-auto flex w-full flex-col gap-8"
        style={{ width: "min(94vw, 1200px)" }}
      >
        {/* top bar — QR + 접속 안내 / 게임 코드 (제어 버튼 없음) */}
        <div className="relative grid grid-cols-1 items-center gap-6 rounded-[24px] border border-white/10 bg-[var(--surface)] px-6 py-6 sm:px-8 lg:grid-cols-[auto_1fr] lg:gap-10">
          {/* 장식: 게임 진행화면의 4색 캐릭터를 작게 흩뿌린다(텍스트 뒤에 깔려 가독성 유지) */}
          <div aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
            <span className="absolute" style={{ left: "31%", bottom: "-8px" }}>
              <StudentMascot kind="circle" width={46} className="mascot-bob" style={{ animationDelay: "0ms" }} />
            </span>
            <span className="absolute" style={{ right: "13%", top: "8%" }}>
              <StudentMascot kind="triangle" width={38} className="mascot-bob" style={{ animationDelay: "160ms" }} />
            </span>
            <span className="absolute" style={{ right: "3%", top: "40%" }}>
              <StudentMascot kind="diamond" width={40} className="mascot-bob" style={{ animationDelay: "320ms" }} />
            </span>
            <span className="absolute" style={{ right: "8%", bottom: "-6px" }}>
              <StudentMascot kind="square" width={44} className="mascot-bob" style={{ animationDelay: "480ms" }} />
            </span>
            <span className="absolute text-[var(--warning)]" style={{ right: "20%", top: "18%" }}>
              <IconSparkle size={16} />
            </span>
            <span className="absolute text-[var(--primary)]" style={{ right: "6%", top: "12%" }}>
              <IconSparkle size={13} />
            </span>
            <span className="absolute text-[var(--success)]" style={{ left: "27%", top: "28%" }}>
              <IconSparkle size={12} />
            </span>
          </div>

          <div className="relative flex min-w-0 items-center gap-4">
            <div className="flex-none rounded-xl bg-white p-2">
              <GameQRCode gameCode={gameCode} size={140} />
            </div>
            <p className="text-sm font-bold leading-relaxed text-white/90 sm:text-base">
              웹 브라우저에서
              <br />
              <span className="text-[var(--accent)]">{joinHost}</span> 접속 후
              <br />
              아래 Game ID 입력
            </p>
          </div>

          <div className="min-w-0 lg:text-center">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-white/50">GAME CODE</p>
            <p className="display-font mt-1 break-all text-[clamp(3rem,7vw,6.5rem)] leading-none text-white">
              {gameCode}
            </p>
          </div>
        </div>

        {/* headline — 아무도 없을 때만 */}
        {players.length === 0 && (
          <div className="flex flex-col items-center text-center">
            <p className="hero-chip">Waiting for Players</p>
            <h1 className="display-font mt-3 text-4xl text-white sm:text-5xl">
              참가자를 기다리고 있어요!
            </h1>
          </div>
        )}

        {/* 참가자 수 + 그리드 */}
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
            <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
              {players.map((player, index) => (
                <div
                  key={player.id}
                  className="tile-enter relative flex min-h-[104px] items-center justify-center rounded-2xl border border-white/10 bg-[var(--surface)] px-6 py-6 text-center"
                >
                  <span
                    className="absolute left-4 top-3 text-xl font-black tabular-nums"
                    style={{ color: LOBBY_NUMBER_COLORS[index % LOBBY_NUMBER_COLORS.length] }}
                  >
                    {index + 1}
                  </span>
                  <span className="max-w-full truncate text-2xl font-black text-white sm:text-3xl">
                    {player.nickname}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// 전광판 본체: 좌측(게임 코드 + QR + 진행 상황 + 참가자 수) / 우측(실시간 순위).
function DisplayBoard({
  gameCode,
  game,
  players,
  isOwner,
}: {
  gameCode: string;
  game: Game;
  players: PlayerWithId[];
  isOwner: boolean;
}) {
  // DisplayBoard는 active 상태에서만 렌더된다(lobby/finished는 별도 화면).
  const total = game.questions.length;
  const current = game.currentQuestionIndex + 1; // 1-based for display

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[var(--background)] px-5 py-6 sm:px-8 sm:py-8">
      <div
        className="grid w-full gap-6 rounded-[32px] border border-white/10 bg-[var(--surface)] p-6 sm:p-8 lg:grid-cols-[1.35fr_1fr] lg:gap-8 lg:p-10"
        style={{ width: "min(94vw, 1500px)" }}
      >
        {/* ── 좌측: 게임 코드 / QR / 진행 상황 / 참가자 수 ── */}
        <div className="flex flex-col gap-7">
          <div>
            <p className="text-lg font-black uppercase tracking-[0.18em] text-[var(--accent)]">
              GAME CODE
            </p>
            <p className="display-font mt-1 break-all text-[clamp(3.5rem,9vw,9rem)] font-black leading-[0.95] text-white">
              {gameCode}
            </p>
            <span className="mt-2 block h-1.5 w-40 max-w-full rounded-full bg-[var(--primary)]" aria-hidden="true" />
          </div>

          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <div className="flex-none rounded-2xl bg-white p-3">
              <GameQRCode gameCode={gameCode} size={180} />
            </div>

            <div className="flex flex-col gap-3 pt-1 text-center sm:text-left">
              <span className="inline-flex items-center justify-center gap-2.5 sm:justify-start">
                <span
                  className="h-3.5 w-3.5 rounded-full"
                  style={{ background: "var(--success)" }}
                  aria-hidden="true"
                />
                <span className="display-font text-3xl text-[var(--success)] sm:text-4xl">진행 중!</span>
              </span>

              <p className="text-2xl font-black text-white sm:text-3xl">
                문제 {current} / {total}
              </p>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: total }).map((_, i) => (
                  <span
                    key={i}
                    className="h-3 w-9 rounded-full"
                    style={{ background: i < current ? "var(--primary)" : "rgba(255,255,255,0.12)" }}
                    aria-hidden="true"
                  />
                ))}
              </div>
            </div>
          </div>

          {/* 하단: 현재 참가자 수 + 접속 유지 안내 */}
          <div className="grid gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:grid-cols-2">
            <div className="flex items-center gap-4">
              <span className="flex-none text-[var(--primary)]" aria-hidden="true">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
                  <circle cx="9" cy="7" r="3.5" />
                  <path d="M22 20v-1.5a4 4 0 0 0-3-3.85" />
                  <path d="M16 3.6a4 4 0 0 1 0 6.8" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-bold text-white/60">현재 참가자</p>
                <p className="display-font leading-none text-white">
                  <span className="text-5xl">{players.length}</span>
                  <span className="ml-1 text-xl">명</span>
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 sm:border-l sm:border-white/10 sm:pl-6">
              <span className="mt-0.5 flex-none text-[var(--success)]" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.55a11 11 0 0 1 14 0M1.5 8.5a16 16 0 0 1 21 0M8.5 16.4a6 6 0 0 1 7 0M12 20h.01" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-bold text-white">접속 유지</p>
                <p className="mt-1 text-sm leading-6 text-white/55">
                  연결이 끊겨도 게임 코드를 입력하면 다시 참여할 수 있어요.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── 우측: 실시간 순위 ── */}
        <div className="flex min-h-0 flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
          <p className="flex items-center gap-3 text-2xl font-black text-white">
            <span className="text-[var(--warning)]" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 3h12v2h3v3a4 4 0 0 1-4 4h-.5A5.5 5.5 0 0 1 13 15.9V18h3v3H8v-3h3v-2.1A5.5 5.5 0 0 1 7.5 15H7a4 4 0 0 1-4-4V5h3zM5 7v1a2 2 0 0 0 2 2V7zm14 0h-2v3a2 2 0 0 0 2-2z" />
              </svg>
            </span>
            실시간 순위
          </p>
          {isOwner ? (
            <Leaderboard players={players} />
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-white/12 px-6 py-16 text-center">
              <p className="text-base leading-7 text-white/45">
                실시간 순위는 선생님(호스트) 화면에서
                <br />이 화면을 열 때 표시돼요.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FullscreenStage({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[var(--background)] p-8 sm:p-12">
      <div className={`flex w-full items-center justify-center ${wide ? "max-w-none" : "max-w-2xl"}`}>
        {children}
      </div>
    </div>
  );
}
