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

const CHOICE_COLORS = [
  "bg-[var(--kahoot-red)]",
  "bg-[var(--kahoot-blue)]",
  "bg-[var(--kahoot-yellow)]",
  "bg-[var(--kahoot-green)]",
];

export default function QuestionList({ teacherUid }: { teacherUid: string }) {
  const [questions, setQuestions] = useState<QuestionWithId[]>([]);
  const [tab, setTab] = useState<QuestionStatus>("approved");

  useEffect(() => subscribeToQuestionBank(teacherUid, setQuestions), [teacherUid]);

  const visible = questions.filter((q) => q.status === tab);

  return (
    <section className="quiz-panel flex flex-col gap-5 p-6 sm:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-white/58">
            Question Bank
          </p>
          <h2 className="display-font text-[2rem] leading-none text-white sm:text-[2.4rem]">
            문제 현황
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          {TABS.map(({ key, label }) => {
            const count = questions.filter((q) => q.status === key).length;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="tab-button"
                data-active={tab === key}
              >
                {label} {count}
              </button>
            );
          })}
        </div>
      </div>

      {visible.length === 0 && (
        <div className="rounded-[24px] border border-dashed border-white/20 bg-white/6 px-5 py-7 text-center text-sm font-semibold text-white/72">
          이 상태의 문제가 아직 없어요.
        </div>
      )}

      <ul className="flex flex-col gap-4">
        {visible.map((question) => (
          <li key={question.id} className="paper-panel p-5 sm:p-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="hero-chip-paper rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.18em]">
                      {question.status}
                    </span>
                    <span className="rounded-full bg-[rgba(38,18,87,0.08)] px-3 py-1 text-xs font-black text-[rgba(38,18,87,0.7)]">
                      {question.createdBy === "student" ? "학생 제출" : "교사 작성"}
                    </span>
                  </div>
                  <p className="mt-3 text-xl font-black text-[var(--panel-text)]">
                    {question.text}
                  </p>
                  {question.createdBy === "student" && (
                    <p className="paper-subtle mt-2 text-sm font-semibold">
                      제출자: {question.authorNickname ?? "익명 학생"}
                    </p>
                  )}
                </div>
              </div>

              <ul className="grid gap-2 sm:grid-cols-2">
                {question.choices.map((choice, index) => {
                  const isCorrect = choice.id === question.correctChoiceId;
                  return (
                    <li
                      key={choice.id}
                      className={`flex items-center gap-3 rounded-[20px] px-4 py-3 ${
                        isCorrect
                          ? "bg-[rgba(38,137,12,0.12)] text-[var(--kahoot-green)]"
                          : "bg-[rgba(38,18,87,0.06)] text-[rgba(38,18,87,0.72)]"
                      }`}
                    >
                      <span className={`choice-swatch ${CHOICE_COLORS[index % CHOICE_COLORS.length]}`} />
                      <span className="text-sm font-black">{choice.text}</span>
                      {isCorrect && <span className="ml-auto text-xs font-black">정답</span>}
                    </li>
                  );
                })}
              </ul>

              <div className="flex flex-wrap gap-3">
                {question.status === "pending" && (
                  <>
                    <button
                      onClick={() => approveQuestion(teacherUid, question.id)}
                      className="rounded-full bg-[var(--kahoot-green)] px-4 py-2 text-sm font-black text-white"
                    >
                      승인
                    </button>
                    <button
                      onClick={() => rejectQuestion(teacherUid, question.id)}
                      className="rounded-full bg-[var(--kahoot-red)] px-4 py-2 text-sm font-black text-white"
                    >
                      반려
                    </button>
                  </>
                )}
                <button
                  onClick={() => deleteQuestion(teacherUid, question.id)}
                  className="rounded-full bg-[rgba(226,27,60,0.12)] px-4 py-2 text-sm font-black text-[var(--kahoot-red)]"
                >
                  삭제
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
