"use client";

import { useState, type FormEvent } from "react";
import { joinGame } from "@/lib/firestore/games";
import PlayingGame from "./PlayingGame";

type Step =
  | { kind: "join" }
  | { kind: "playing"; gameCode: string; nickname: string; authorUid: string };

export default function PlayPage() {
  const [step, setStep] = useState<Step>({ kind: "join" });
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    setError(null);

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

  if (step.kind === "playing") {
    return (
      <PlayingGame gameCode={step.gameCode} nickname={step.nickname} authorUid={step.authorUid} />
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 p-8 font-sans dark:bg-black">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">게임 입장하기</h1>

      <form onSubmit={handleJoin} className="flex w-full max-w-sm flex-col gap-3">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="선생님이 알려준 게임 코드 6자리"
          className="rounded-md border border-black/[.08] px-3 py-2 text-center font-mono uppercase tracking-widest dark:border-white/[.145] dark:bg-black"
          maxLength={6}
        />
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="이름(닉네임)"
          className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={joining}
          className="rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          {joining ? "입장 중..." : "입장하기"}
        </button>
      </form>
    </div>
  );
}
