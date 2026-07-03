"use client";

import { useEffect, useState } from "react";
import {
  approveQuestion,
  deleteQuestion,
  rejectQuestion,
  subscribeToQuestionBank,
  type QuestionWithId,
} from "@/lib/firestore/questions";
import type { QuestionStatus } from "@/types/firestore";

const TABS: { key: QuestionStatus; label: string }[] = [
  { key: "approved", label: "승인됨" },
  { key: "pending", label: "대기중" },
  { key: "rejected", label: "반려됨" },
];

export default function QuestionList({ teacherUid }: { teacherUid: string }) {
  const [questions, setQuestions] = useState<QuestionWithId[]>([]);
  const [tab, setTab] = useState<QuestionStatus>("approved");

  useEffect(() => subscribeToQuestionBank(teacherUid, setQuestions), [teacherUid]);

  const visible = questions.filter((q) => q.status === tab);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {TABS.map(({ key, label }) => {
          const count = questions.filter((q) => q.status === key).length;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === key
                  ? "bg-foreground text-background"
                  : "border border-black/[.08] text-zinc-600 hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-300 dark:hover:bg-[#1a1a1a]"
              }`}
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      {visible.length === 0 && (
        <p className="text-sm text-zinc-500">이 상태의 문제가 없습니다.</p>
      )}

      <ul className="flex flex-col gap-3">
        {visible.map((question) => (
          <li
            key={question.id}
            className="rounded-lg border border-black/[.08] p-4 dark:border-white/[.145]"
          >
            <p className="font-medium">{question.text}</p>
            {question.createdBy === "student" && (
              <p className="mt-1 text-xs text-zinc-500">
                제출: {question.authorNickname ?? "익명 학생"}
              </p>
            )}
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {question.choices.map((choice) => (
                <li
                  key={choice.id}
                  className={
                    choice.id === question.correctChoiceId
                      ? "font-semibold text-green-700 dark:text-green-400"
                      : "text-zinc-600 dark:text-zinc-400"
                  }
                >
                  {choice.id === question.correctChoiceId ? "✓ " : "· "}
                  {choice.text}
                </li>
              ))}
            </ul>

            <div className="mt-3 flex gap-3">
              {question.status === "pending" && (
                <>
                  <button
                    onClick={() => approveQuestion(teacherUid, question.id)}
                    className="text-sm font-medium text-green-700 hover:underline dark:text-green-400"
                  >
                    승인
                  </button>
                  <button
                    onClick={() => rejectQuestion(teacherUid, question.id)}
                    className="text-sm font-medium text-red-600 hover:underline"
                  >
                    반려
                  </button>
                </>
              )}
              <button
                onClick={() => deleteQuestion(teacherUid, question.id)}
                className="text-sm text-zinc-500 hover:text-red-600"
              >
                삭제
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
