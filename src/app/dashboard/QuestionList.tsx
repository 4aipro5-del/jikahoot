"use client";

import { useState } from "react";
import {
  approveQuestion,
  buildChoices,
  deleteQuestion,
  rejectQuestion,
  updateQuestion,
  type QuestionWithId,
} from "@/lib/firestore/questions";
import type { QuestionStatus } from "@/types/firestore";

const TABS: { key: QuestionStatus; label: string }[] = [
  { key: "pending", label: "승인 대기" },
  { key: "approved", label: "승인 완료" },
  { key: "rejected", label: "반려" },
];

const STATUS_BADGE: Record<QuestionStatus, string> = {
  approved: "bg-[var(--success-soft)] text-[var(--success)]",
  pending: "bg-[var(--warning-soft)] text-[var(--warning)]",
  rejected: "bg-[var(--error-soft)] text-[var(--error)]",
};

const CHOICE_COLORS = [
  "bg-[var(--kahoot-red)]",
  "bg-[var(--kahoot-blue)]",
  "bg-[var(--kahoot-yellow)]",
  "bg-[var(--kahoot-green)]",
];

const CREATOR_FILTERS: { key: "all" | "student" | "teacher"; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "student", label: "학생 제출" },
  { key: "teacher", label: "교사 작성" },
];

export default function QuestionList({
  teacherUid,
  questions,
  onNewQuestion,
  onReceiveStudentQuestions,
}: {
  teacherUid: string;
  questions: QuestionWithId[];
  onNewQuestion?: () => void;
  onReceiveStudentQuestions?: () => void;
}) {
  const [tab, setTab] = useState<QuestionStatus>("pending");
  const [search, setSearch] = useState("");
  const [creatorFilter, setCreatorFilter] = useState<"all" | "student" | "teacher">("all");
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [draftChoices, setDraftChoices] = useState<string[]>([]);
  const [draftCorrectIndex, setDraftCorrectIndex] = useState<number | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const normalizedSearch = search.trim().toLowerCase();
  const visible = questions
    .filter((q) => q.status === tab)
    .filter((q) => creatorFilter === "all" || q.createdBy === creatorFilter)
    .filter((q) => {
      if (!normalizedSearch) return true;
      return (
        q.text.toLowerCase().includes(normalizedSearch) ||
        (q.authorNickname ?? "").toLowerCase().includes(normalizedSearch)
      );
    });

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
    <section className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-[var(--surface)] p-6 sm:p-8">
      <div className="flex flex-col gap-2">
        <p className="hero-chip">Question Bank</p>
        <h2 className="display-font text-[1.75rem] leading-none text-white sm:text-[2rem]">
          문제 관리
        </h2>
        <p className="text-sm text-[color:var(--foreground-muted)]">
          교사가 만든 문제와 학생이 제출한 문제를 관리하고 승인합니다.
        </p>
      </div>

      {/* 두 개의 큰 Action Card: 새 문제 만들기 / 학생 문제 받기 */}
      {(onNewQuestion || onReceiveStudentQuestions) && (
        <div className="grid gap-4 md:grid-cols-2">
          {onNewQuestion && (
            <ActionCard
              onClick={onNewQuestion}
              highlighted
              title="새 문제 만들기"
              description="직접 새로운 퀴즈 문제를 만들어 게임에 추가하세요."
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              }
            />
          )}
          {onReceiveStudentQuestions && (
            <ActionCard
              onClick={onReceiveStudentQuestions}
              title="학생 문제 받기"
              description="QR 코드 또는 제출 코드를 공유하고 학생들이 만든 문제를 받아보세요."
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              }
            />
          )}
        </div>
      )}

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

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[14rem] flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="문제 내용이나 제출자로 검색"
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm font-medium text-white placeholder:text-white/35 focus-visible:border-[var(--primary)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(50,0,224,0.16)]"
          />
        </div>

        <div className="flex flex-none gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
          {CREATOR_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setCreatorFilter(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
                creatorFilter === key ? "bg-[var(--primary)] text-white" : "text-white/55 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.04] px-5 py-7 text-center text-sm font-semibold text-white/60">
          {normalizedSearch || creatorFilter !== "all"
            ? "검색 결과가 없어요."
            : "이 상태의 문제가 아직 없어요."}
        </div>
      )}

      <ul className="flex flex-col gap-4">
        {visible.map((question) => {
          const isEditing = editingQuestionId === question.id;

          return (
            <li
              key={question.id}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition-transform duration-150 hover:-translate-y-0.5 sm:p-6"
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.18em] ${STATUS_BADGE[question.status]}`}
                      >
                        {question.status}
                      </span>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white/70">
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
                      <p className="mt-3 text-[1.65rem] leading-[1.1] font-black text-white">
                        {question.text}
                      </p>
                    )}
                    {question.createdBy === "student" && (
                      <p className="mt-2 text-sm font-semibold text-white/60">
                        제출자: {question.authorNickname ?? "익명 학생"}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => deleteQuestion(teacherUid, question.id)}
                    className="self-start rounded-full border border-white/12 bg-white/10 px-4 py-2 text-sm font-black text-white/70 hover:bg-white/16 hover:text-white sm:shrink-0"
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
                              ? "bg-[var(--success-soft)] text-[var(--success)]"
                              : "bg-white/[0.05] text-white/75"
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
                              className="min-w-0 flex-1 rounded-full border border-white/12 bg-white/90 px-4 py-2 text-sm font-black text-[var(--panel-text)] outline-none"
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
                          className="rounded-full bg-[var(--kahoot-purple)] px-4 py-2 text-sm font-black text-white transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
                        >
                          승인
                        </button>
                        {question.createdBy === "student" && (
                          <button
                            onClick={() => startEditing(question)}
                            className="rounded-full bg-[var(--warning)] px-4 py-2 text-sm font-black text-[#4a2c00] transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
                          >
                            수정 후 승인
                          </button>
                        )}
                        <button
                          onClick={() => rejectQuestion(teacherUid, question.id)}
                          className="rounded-full bg-[var(--kahoot-red)] px-4 py-2 text-sm font-black text-white transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
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

function ActionCard({
  onClick,
  title,
  description,
  icon,
  highlighted = false,
}: {
  onClick: () => void;
  title: string;
  description: string;
  icon: React.ReactNode;
  highlighted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-center gap-4 rounded-2xl border p-5 text-left transition-transform duration-150 hover:-translate-y-0.5 sm:p-6 ${
        highlighted
          ? "border-[var(--primary)]/50 bg-[var(--primary-soft)]"
          : "border-white/10 bg-white/[0.04] hover:bg-white/[0.06]"
      }`}
    >
      <span
        className={`flex h-14 w-14 flex-none items-center justify-center rounded-2xl ${
          highlighted ? "bg-[var(--primary)] text-white" : "bg-white/10 text-white"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-black text-white">{title}</span>
        <span className="mt-1 block text-sm leading-5 text-white/60">{description}</span>
      </span>
      <span className="flex-none text-white/40 transition-transform duration-150 group-hover:translate-x-0.5">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </span>
    </button>
  );
}
