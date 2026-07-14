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
    <Suspense fallback={<PlayPageFallback />}>
      <PlayPageContent />
    </Suspense>
  );
}

function PlayPageFallback() {
  return (
    <div className="stage-shell">
      <div className="stage-content flex min-h-screen items-center justify-center">
        <div className="quiz-panel px-6 py-5 text-center">
          <p className="text-white/70">게임 입장 준비 중...</p>
        </div>
      </div>
    </div>
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
      <PlayingGame gameCode={step.gameCode} nickname={step.nickname} authorUid={step.authorUid} />
    );
  }

  return (
    <div className="stage-shell">
      <div className="stage-content flex min-h-screen items-center justify-center py-8">
        <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="quiz-panel flex flex-col justify-between gap-6 p-6 sm:p-8">
            <div className="space-y-4">
              <span className="hero-chip">Game Entry</span>
              <h1 className="display-font text-5xl leading-none text-white sm:text-6xl">
                지금 바로
                <br />
                플레이 시작.
              </h1>
              <p className="max-w-xl text-base leading-7 text-white/78 sm:text-lg">
                큰 코드, 큰 버튼, 즉시 반응하는 4색 문제 화면으로 학생이 망설이지 않고
                참여할 수 있게 구성했어요.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ["2x2 답안", "정답 선택이 눈에 확 들어오는 컬러 타일"],
                ["큰 타이머", "남은 시간을 직관적으로 보여주는 진행 막대"],
                ["즉시 피드백", "정답/오답을 강한 색으로 바로 안내"],
              ].map(([title, desc], index) => (
                <div
                  key={title}
                  className={`rounded-[24px] p-4 ${
                    index === 0 ? "bg-white/14" : "bg-white/8"
                  }`}
                >
                  <p className="display-font text-2xl text-white">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-white/70">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="paper-panel p-6 sm:p-8">
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

                <button type="submit" disabled={joining} className="primary-button w-full">
                  {joining ? "입장 중..." : "퀴즈 무대로 입장"}
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
