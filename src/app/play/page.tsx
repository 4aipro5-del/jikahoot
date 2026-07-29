"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { joinGame } from "@/lib/firestore/games";
import StageSkeleton from "@/components/StageSkeleton";
import StudentJoinScreen from "@/components/StudentJoinScreen";
import { IconGamepad } from "@/components/student-ui";
import PlayingGame from "./PlayingGame";

type Step =
  | { kind: "join" }
  | { kind: "playing"; gameCode: string; nickname: string; authorUid: string };

export default function PlayPage() {
  return (
    <Suspense fallback={<StageSkeleton />}>
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

  // Return to the code-entry screen after a game ends so the student can join a
  // different game. Clear the (now-finished) code but keep the nickname for
  // convenience; the auto-join effect already ran once and won't re-fire.
  function handleLeave() {
    setStep({ kind: "join" });
    setCode("");
    setError(null);
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
        authorUid={step.authorUid}
        onForcedOut={handleForcedOut}
        onLeave={handleLeave}
      />
    );
  }

  return (
    <StudentJoinScreen
      accent="play"
      eyebrow="Play"
      eyebrowIcon={<IconGamepad />}
      titleTop="우리 반 퀴즈"
      titleAccent="시작하기"
      description="게임 코드와 이름을 입력하고 퀴즈를 시작하세요."
      codeLabel="게임 코드"
      codePlaceholder="선생님이 알려주신 게임 코드 6자리를 입력하세요."
      code={code}
      onCodeChange={setCode}
      nickname={nickname}
      onNicknameChange={setNickname}
      onSubmit={handleJoin}
      submitting={joining}
      submitLabel="START"
      submitTextClassName="text-4xl"
      error={error}
      noteIcon={<IconGamepad />}
      noteTitle="준비되면 자동으로 시작합니다."
      noteMuted
    />
  );
}
