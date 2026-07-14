"use client";

import { useState, type FormEvent } from "react";
import QuestionEditorForm from "@/components/QuestionEditorForm";
import { signInStudentAnonymously } from "@/lib/firebase/auth";
import { resolveRoomCode } from "@/lib/firestore/roomCodes";
import { submitStudentQuestion } from "@/lib/firestore/questions";

type Step =
  | { kind: "join" }
  | { kind: "submit"; teacherUid: string; authorUid: string; nickname: string };

export default function SubmitPage() {
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
      setError("방 코드를 입력해 주세요.");
      return;
    }
    if (!trimmedNickname) {
      setError("이름(닉네임)을 입력해 주세요.");
      return;
    }

    setJoining(true);
    try {
      // roomCodes 조회에는 Firestore 규칙상 인증이 필요하므로, 방 코드를
      // 확인하기 전에 먼저 익명 로그인을 완료해야 한다.
      const cred = await signInStudentAnonymously();
      const teacherUid = await resolveRoomCode(trimmedCode);
      if (!teacherUid) {
        setError("방 코드를 찾을 수 없어요. 선생님께 다시 확인해 주세요.");
        return;
      }
      setStep({ kind: "submit", teacherUid, authorUid: cred.user.uid, nickname: trimmedNickname });
    } catch (err) {
      setError(err instanceof Error ? err.message : "입장하지 못했습니다.");
    } finally {
      setJoining(false);
    }
  }

  if (step.kind === "submit") {
    return (
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
        <header>
          <h1 className="text-xl font-semibold">{step.nickname}님, 문제를 만들어 보세요!</h1>
          <p className="text-sm text-zinc-500">
            제출한 문제는 선생님이 확인한 뒤 반영돼요.
          </p>
        </header>

        <QuestionEditorForm
          title="문제 만들기"
          submitLabel="선생님께 제출하기"
          successMessage="제출했어요! 선생님 확인을 기다려 주세요."
          onSubmit={(input) =>
            submitStudentQuestion(step.teacherUid, {
              ...input,
              authorUid: step.authorUid,
              authorNickname: step.nickname,
            })
          }
        />

        <button
          onClick={() => setStep({ kind: "join" })}
          className="self-start text-sm text-zinc-500 hover:text-black dark:hover:text-white"
        >
          다른 방으로 이동
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 p-8 font-sans dark:bg-black">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">문제 제출하기</h1>

      <form onSubmit={handleJoin} className="flex w-full max-w-sm flex-col gap-3">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="선생님이 알려준 방 코드 6자리"
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
