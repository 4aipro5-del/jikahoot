"use client";

import { useEffect, useState } from "react";
import {
  approveQuestion,
  buildChoices,
  deleteQuestion,
  rejectQuestion,
  subscribeToQuestionBank,
  updateQuestion,
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
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [draftChoices, setDraftChoices] = useState<string[]>([]);
  const [draftCorrectIndex, setDraftCorrectIndex] = useState<number | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => subscribeToQuestionBank(teacherUid, setQuestions), [teacherUid]);

  const visible = questions.filter((q) => q.status === tab);

  function startEditing(question: QuestionWithId) {
    setEditingQuestionId(question.id);
    setDraftText(question.text);
    setDraftChoices(question.choices.map((choice) => choice.text));
    setDraftCorrectIndex(
      question.choices.findIndex((choice) => choice.id === question.correctChoiceId),
    );
    setActionError(null);
  }

  function cancelEditing() {
    setEditingQuestionId(null);
    setDraftText("");
    setDraftChoices([]);
    setDraftCorrectIndex(null);
    setActionError(null);
  }

  async function handleApproveWithEdit(question: QuestionWithId) {
    const trimmedText = draftText.trim();
    const trimmedChoices = draftChoices.map((choice) => choice.trim());

    if (!trimmedText) {
      setActionError("문제 내용을 입력해 주세요.");
      return;
    }
    if (trimmedChoices.some((choice) => !choice)) {
      setActionError("모든 선택지를 채워 주세요.");
      return;
    }
    if (draftCorrectIndex === null || draftCorrectIndex < 0 || draftCorrectIndex >= draftChoices.length) {
      setActionError("정답을 선택해 주세요.");
      return;
    }

    setPendingActionId(question.id);
    setActionError(null);

    try {
      await updateQuestion(teacherUid, question.id, {
        text: trimmedText,
        choices: buildChoices(trimmedChoices),
        correctChoiceId: `c${draftCorrectIndex}`,
      });
      await approveQuestion(teacherUid, question.id);
      cancelEditing();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "문제를 수정 후 승인하지 못했습니다.");
    } finally {
      setPendingActionId(null);
    }
  }

  return (
    <section className="paper-panel dashboard-bank-card flex flex-col gap-5 p-8">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-3">
          <p className="dashboard-bank-kicker text-sm font-black uppercase tracking-[0.2em]">
            Question Bank
          </p>
          <h2 className="display-font dashboard-bank-title text-[1.75rem] leading-none sm:text-[2rem]">
            문제 현황
          </h2>
        </div>

        <div className="dashboard-bank-tabs flex flex-wrap gap-2">
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
        <div className="rounded-[24px] border border-dashed border-[rgba(88,204,2,0.18)] bg-[rgba(88,204,2,0.05)] px-5 py-7 text-center text-sm font-semibold text-[rgba(36,51,17,0.68)]">
          이 상태의 문제가 아직 없어요.
        </div>
      )}

      <ul className="flex flex-col gap-4">
        {visible.map((question) => {
          const isEditing = editingQuestionId === question.id;

          return (
            <li key={question.id} className="paper-panel dashboard-bank-item p-5 sm:p-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="hero-chip-paper rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.18em]">
                        {question.status}
                      </span>
                      <span className="rounded-full bg-[rgba(38,18,87,0.08)] px-3 py-1 text-xs font-black text-[rgba(38,18,87,0.7)]">
                        {question.createdBy === "student" ? "학생 제출" : "교사 작성"}
                      </span>
                    </div>
                    {isEditing ? (
                      <textarea
                        value={draftText}
                        onChange={(e) => setDraftText(e.target.value)}
                        className="text-area mt-3 min-h-24"
                        rows={3}
                      />
                    ) : (
                      <p className="mt-3 text-[1.65rem] leading-[1.1] font-black text-[var(--panel-text)]">
                        {question.text}
                      </p>
                    )}
                    {question.createdBy === "student" && (
                      <p className="paper-subtle mt-2 text-sm font-semibold">
                        제출자: {question.authorNickname ?? "익명 학생"}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => deleteQuestion(teacherUid, question.id)}
                    className="self-start rounded-full border border-[rgba(38,18,87,0.1)] bg-white/55 px-4 py-2 text-sm font-black text-[rgba(38,18,87,0.62)] shadow-[inset_0_1px_0_rgba(255,255,255,0.38)] hover:bg-[rgba(38,18,87,0.08)] hover:text-[var(--panel-text)] sm:shrink-0"
                  >
                    삭제
                  </button>
                </div>

                <ul className="grid grid-cols-2 gap-2">
                  {(isEditing ? draftChoices : question.choices.map((choice) => choice.text)).map(
                    (choiceText, index) => {
                      const isCorrect = isEditing
                        ? draftCorrectIndex === index
                        : question.choices[index]?.id === question.correctChoiceId;

                      return (
                        <li
                          key={isEditing ? `draft-${question.id}-${index}` : question.choices[index]?.id}
                          className={`flex items-center gap-3 rounded-[20px] px-4 py-3 ${
                            isCorrect
                              ? "bg-[rgba(38,137,12,0.12)] text-[var(--kahoot-green)]"
                              : "bg-[rgba(38,18,87,0.06)] text-[rgba(38,18,87,0.72)]"
                          }`}
                        >
                          <span className={`choice-swatch ${CHOICE_COLORS[index % CHOICE_COLORS.length]}`} />
                          {isEditing ? (
                            <input
                              value={choiceText}
                              onChange={(e) =>
                                setDraftChoices((prev) =>
                                  prev.map((choice, choiceIndex) =>
                                    choiceIndex === index ? e.target.value : choice,
                                  ),
                                )
                              }
                              className="min-w-0 flex-1 rounded-full border border-[rgba(38,18,87,0.08)] bg-white/70 px-4 py-2 text-sm font-black text-[var(--panel-text)] outline-none"
                            />
                          ) : (
                            <span className="text-sm font-black">{choiceText}</span>
                          )}
                          {isEditing ? (
                            <button
                              type="button"
                              onClick={() => setDraftCorrectIndex(index)}
                              className={`ml-auto rounded-full px-3 py-1.5 text-xs font-black ${
                                isCorrect
                                  ? "bg-[var(--kahoot-green)] text-white"
                                  : "bg-white text-[var(--kahoot-purple)]"
                              }`}
                            >
                              {isCorrect ? "정답" : "정답 지정"}
                            </button>
                          ) : (
                            isCorrect && <span className="ml-auto text-xs font-black">정답</span>
                          )}
                        </li>
                      );
                    },
                  )}
                </ul>

                {question.status === "pending" && (
                  <div className="flex flex-wrap gap-3">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => handleApproveWithEdit(question)}
                          disabled={pendingActionId === question.id}
                          className="rounded-full bg-[var(--kahoot-green)] px-4 py-2 text-sm font-black text-white disabled:opacity-60"
                        >
                          {pendingActionId === question.id ? "승인 중..." : "수정 후 승인"}
                        </button>
                        <button
                          onClick={cancelEditing}
                          disabled={pendingActionId === question.id}
                          className="rounded-full bg-white px-4 py-2 text-sm font-black text-[var(--kahoot-purple)] disabled:opacity-60"
                        >
                          취소
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => approveQuestion(teacherUid, question.id)}
                          className="rounded-full bg-[var(--kahoot-green)] px-4 py-2 text-sm font-black text-white"
                        >
                          승인
                        </button>
                        {question.createdBy === "student" && (
                          <button
                            onClick={() => startEditing(question)}
                            className="rounded-full bg-white px-4 py-2 text-sm font-black text-[var(--kahoot-purple)]"
                          >
                            수정 후 승인
                          </button>
                        )}
                        <button
                          onClick={() => rejectQuestion(teacherUid, question.id)}
                          className="rounded-full bg-[var(--kahoot-red)] px-4 py-2 text-sm font-black text-white"
                        >
                          반려
                        </button>
                      </>
                    )}
                  </div>
                )}

                {isEditing && actionError && (
                  <p className="status-banner" data-tone="error">
                    {actionError}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
