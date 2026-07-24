"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { User } from "firebase/auth";
import { signInStudentAnonymously, subscribeToAuthState } from "@/lib/firebase/auth";
import { subscribeToGame, subscribeToPlayers, type PlayerWithId } from "@/lib/firestore/games";
import type { Game } from "@/types/firestore";
import { useNow } from "@/lib/useNow";
import Leaderboard from "@/components/Leaderboard";
import GameQRCode from "@/components/GameQRCode";

const ANSWER_THEMES = [
  { bg: "var(--primary)", shape: "▲", light: false },
  { bg: "var(--warning)", shape: "●", light: false },
  { bg: "var(--error)", shape: "◆", light: false },
  { bg: "#ffffff", shape: "■", light: true },
];

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
    // lobby/finished views still work standalone.
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
    // until we know the game itself actually loaded.
    if (!user || !game) return;
    return subscribeToPlayers(gameCode, setPlayers);
  }, [gameCode, user, game]);

  if (user === undefined || game === undefined) {
    return null;
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
            <Leaderboard players={players} />
          </div>
        </div>
      </FullscreenStage>
    );
  }

  if (game.status === "active") {
    return <ActiveDisplay game={game} playerCount={players.length} />;
  }

  // lobby — waiting for players to join
  return <LobbyDisplay gameCode={gameCode} players={players} />;
}

// Full-bleed Blooket-style waiting room: a compact top info band (QR / code /
// headcount) and a participant grid that claims essentially all remaining
// space — this is a projector/electronic-whiteboard screen, not a normal
// centered web page, so it deliberately doesn't reuse FullscreenStage's
// max-width centering.
function LobbyDisplay({ gameCode, players }: { gameCode: string; players: PlayerWithId[] }) {
  return (
    <div className="flex min-h-screen w-full justify-center bg-[var(--background)] px-6 py-8 sm:px-10 sm:py-10">
      <div className="flex w-full flex-col gap-8" style={{ width: "min(92vw, 1600px)" }}>
        <div className="flex flex-col gap-6 rounded-[28px] border border-white/10 bg-[var(--surface)] p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            <div className="flex-none rounded-2xl bg-white p-3">
              <GameQRCode gameCode={gameCode} size={168} />
            </div>
            <div>
              <p className="inline-flex items-center justify-center rounded-full bg-white px-[0.9rem] py-[0.55rem] text-xs font-extrabold uppercase tracking-[0.24em] text-[var(--primary-dark)]">
                Join the Game
              </p>
              <p className="mt-3 max-w-sm text-base leading-6 text-[color:var(--foreground-muted)] sm:text-lg">
                휴대폰으로 QR코드를 스캔하거나, jikahoot 사이트에서 아래 코드를 입력하세요.
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-6 sm:flex-row lg:flex-none">
            <div className="text-center lg:text-right">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-white/50">Game Code</p>
              <p className="display-font mt-1 text-[clamp(4.5rem,10vw,10rem)] leading-none text-white">
                {gameCode}
              </p>
            </div>
            <div className="flex-none rounded-2xl bg-white/5 px-8 py-5 text-center">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/50">참가자</p>
              <p className="display-font mt-1 text-[clamp(2.5rem,5vw,4.5rem)] leading-none text-white">
                {players.length}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1">
          {players.length === 0 ? (
            <div className="flex min-h-[20rem] items-center justify-center rounded-[28px] border border-dashed border-white/12 bg-white/[0.03]">
              <p className="text-2xl font-bold text-white/50">학생들이 들어오기를 기다리는 중이에요...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:[grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
              {players.map((player) => (
                <div
                  key={player.id}
                  className="tile-enter relative flex min-h-[76px] items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[var(--surface)] px-4 py-4 before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-[var(--primary)] sm:min-h-[84px]"
                >
                  <span className="truncate text-center text-xl font-black text-white sm:text-2xl">
                    {player.nickname}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActiveDisplay({ game, playerCount }: { game: Game; playerCount: number }) {
  const questionIndex = game.currentQuestionIndex;
  const question = game.questions[questionIndex];
  const now = useNow(250);

  const deadline = game.currentQuestionStartedAt
    ? game.currentQuestionStartedAt.toMillis() + game.questionDurationSec * 1000
    : null;
  const remainingSec = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;
  const remainingRatio = deadline
    ? Math.max(0, Math.min(1, (deadline - now) / (game.questionDurationSec * 1000)))
    : 0;

  if (!question) {
    return (
      <FullscreenStage>
        <p className="text-xl font-bold text-white/60">다음 문제를 준비하는 중이에요...</p>
      </FullscreenStage>
    );
  }

  return (
    <FullscreenStage wide>
      <div className="flex w-full max-w-6xl flex-col gap-8">
        <div className="flex items-center justify-between gap-4">
          <span className="rounded-full bg-[var(--surface)] px-5 py-2 text-lg font-black text-white">
            {questionIndex + 1} / {game.questions.length}
          </span>
          <span className="rounded-full bg-[var(--surface)] px-5 py-2 text-lg font-black text-white">
            참여 {playerCount}명
          </span>
          <span
            className={`flex h-16 w-16 items-center justify-center rounded-full border-4 text-2xl font-black ${
              remainingSec <= 5 ? "border-[var(--error)] text-[var(--error)]" : "border-[var(--primary)] text-white"
            }`}
          >
            {remainingSec}
          </span>
        </div>

        <div className="progress-track">
          <div className="progress-bar" style={{ width: `${remainingRatio * 100}%` } as CSSProperties} />
        </div>

        <section className="paper-panel p-10">
          <h2 className="display-font text-center text-4xl leading-tight text-[var(--panel-text)] lg:text-5xl">
            {question.text}
          </h2>
        </section>

        <div className="grid grid-cols-2 gap-5">
          {question.choices.map((choice, index) => {
            const theme = ANSWER_THEMES[index % ANSWER_THEMES.length];
            return (
              <div
                key={choice.id}
                className="flex min-h-[7rem] items-center gap-4 rounded-[26px] px-7 py-6"
                style={
                  {
                    background: theme.bg,
                    color: theme.light ? "var(--panel-text)" : "#ffffff",
                  } as CSSProperties
                }
              >
                <span className="text-3xl">{theme.shape}</span>
                <span className="text-2xl font-black leading-tight">{choice.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    </FullscreenStage>
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
