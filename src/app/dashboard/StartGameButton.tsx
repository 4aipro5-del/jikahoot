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
    <section className="paper-panel flex flex-col gap-5 p-6 sm:p-8">
      <div className="flex flex-col gap-3">
        <p className="hero-chip hero-chip-paper">Launch Game</p>
        <h2 className="display-font text-4xl text-[var(--panel-text)] sm:text-5xl">
          무대 열기
        </h2>
        <p className="paper-muted text-sm leading-6 sm:text-base">
          승인된 문제를 바탕으로 바로 새 게임을 생성해요. 게임이 시작되면 참가 코드가
          발급되고 학생들은 곧바로 입장할 수 있습니다.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="paper-purple-bg rounded-[24px] p-5">
          <p className="paper-subtle text-sm font-black uppercase tracking-[0.18em]">
            Approved
          </p>
          <p className="display-font mt-2 text-5xl text-[var(--panel-text)]">{approved.length}</p>
          <p className="paper-subtle mt-1 text-sm font-semibold">사용 가능 문제</p>
        </div>
        <div className="paper-yellow-bg rounded-[24px] p-5">
          <p className="paper-subtle text-sm font-black uppercase tracking-[0.18em]">
            Round Time
          </p>
          <p className="display-font mt-2 text-5xl text-[var(--panel-text)]">
            {QUESTION_DURATION_SEC}s
          </p>
          <p className="paper-subtle mt-1 text-sm font-semibold">문제당 제한 시간</p>
        </div>
      </div>

      <div className="flex flex-col items-start gap-3">
        <button
          onClick={handleStart}
          disabled={approved.length === 0 || starting}
          className="primary-button"
        >
          {starting ? "게임 준비 중..." : "새 게임 시작"}
        </button>
        {approved.length === 0 && (
          <p className="rounded-[20px] bg-[rgba(216,158,0,0.12)] px-4 py-3 text-sm font-black text-[#8a6100]">
            승인된 문제가 있어야 게임을 시작할 수 있어요.
          </p>
        )}
        {error && (
          <p className="status-banner w-full" data-tone="error">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
