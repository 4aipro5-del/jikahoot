"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { subscribeToQuestionBank, type QuestionWithId } from "@/lib/firestore/questions";
import { createGame } from "@/lib/firestore/games";
import { QUESTION_DURATION_SEC } from "@/lib/gameConfig";

export default function StartGameButton({ teacherUid }: { teacherUid: string }) {
  const router = useRouter();
  const [questions, setQuestions] = useState<QuestionWithId[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeToQuestionBank(teacherUid, setQuestions), [teacherUid]);

  const approved = questions.filter((q) => q.status === "approved");

  async function handleStart() {
    setError(null);
    setStarting(true);
    try {
      const publicQuestions = approved.map((q) => ({
        id: q.id,
        text: q.text,
        choices: q.choices,
      }));
      const code = await createGame(teacherUid, publicQuestions, QUESTION_DURATION_SEC);
      router.push(`/dashboard/game/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "게임을 시작하지 못했습니다.");
      setStarting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-black/[.08] p-5 dark:border-white/[.145]">
      <h2 className="text-lg font-semibold">게임 시작하기</h2>
      <button
        onClick={handleStart}
        disabled={approved.length === 0 || starting}
        className="self-start rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
      >
        {starting ? "게임 준비 중..." : `게임 시작 (승인된 문제 ${approved.length}개)`}
      </button>
      {approved.length === 0 && (
        <p className="text-xs text-zinc-500">승인된 문제가 있어야 게임을 시작할 수 있어요.</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
