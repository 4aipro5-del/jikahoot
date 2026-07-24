"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { joinGame } from "@/lib/firestore/games";
import PlayingGame from "./PlayingGame";

type Step =
  | { kind: "join" }
  | { kind: "playing"; gameCode: string; nickname: string; authorUid: string };

export default function PlayPage() {
  return (
    <Suspense fallback={null}>
      <PlayPageContent />
    </Suspense>
  );
}

function PlayPageContent() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>({ kind: "join" });
  const [code, setCode] = useState(() => searchParams.get("code")?.trim().toUpperCase() ?? "");
  const [nickname, setNickname] = useState(() => searchParams.get("nickname")?.trim() ?? "");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoJoinTried = useRef(false);

  async function join(trimmedCode: string, trimmedNickname: string) {
    setError(null);
    setJoining(true);
    try {
      const { authorUid } = await joinGame(trimmedCode, trimmedNickname);
      setStep({ kind: "playing", gameCode: trimmedCode, nickname: trimmedNickname, authorUid });
    } catch (err) {
      setError(err instanceof Error ? err.message : "입장하지 못했습니다.");
    } finally {
      setJoining(false);
    }
  }

  function handleForcedOut() {
    setStep({ kind: "join" });
    setError("다시 입장해주세요.");
  }

  useEffect(() => {
    if (autoJoinTried.current) return;
    if (code && nickname) {
      autoJoinTried.current = true;
      queueMicrotask(() => join(code, nickname));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleJoin(e: FormEvent) {
    e.preventDefault();

    const trimmedCode = code.trim().toUpperCase();
    const trimmedNickname = nickname.trim();
    if (!trimmedCode) {
      setError("게임 코드를 입력해 주세요.");
      return;
    }
    if (!trimmedNickname) {
      setError("이름(닉네임)을 입력해 주세요.");
      return;
    }

    join(trimmedCode, trimmedNickname);
  }

  if (step.kind === "playing") {
    return (
      <PlayingGame
        gameCode={step.gameCode}
        nickname={step.nickname}
        authorUid={step.authorUid}
        onForcedOut={handleForcedOut}
      />
    );
  }

  return (
    <div className="stage-shell">
      <div className="stage-content flex min-h-screen items-center justify-center py-8">
        <div className="flex w-full max-w-[52rem] flex-col gap-6">
          <div className="flex flex-col gap-3">
            <span className="hero-chip self-start">Game Entry</span>
            <h1 className="display-font text-4xl leading-none text-white sm:text-5xl lg:text-6xl">
              지금 바로
              <br />
              플레이 시작.
            </h1>
          </div>

          <section className="paper-panel kahoot-spectrum-paper p-6 sm:p-8">
            <div className="flex flex-col gap-5">
              <div>
                <p className="hero-chip hero-chip-paper">Join Game</p>
                <h2 className="display-font mt-4 text-4xl text-[var(--panel-text)] sm:text-5xl">
                  코드 입력
                </h2>
                <p className="paper-muted mt-2 text-sm leading-6 sm:text-base">
                  선생님이 알려준 게임 코드와 이름을 입력하면 바로 무대에 입장해요.
                </p>
              </div>

              <form onSubmit={handleJoin} className="flex flex-col gap-4">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="게임 코드 6자리"
                  className="text-input code-input"
                  maxLength={6}
                />
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="이름(닉네임)"
                  className="text-input"
                />

                {error && (
                  <p className="status-banner" data-tone="error">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={joining}
                  className="primary-button primary-button-hero w-full"
                >
                  {joining ? "입장 중..." : "퀴즈 시작"}
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
