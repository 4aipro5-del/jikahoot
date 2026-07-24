"use client";

import { useState } from "react";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import {
  approveQuestion,
  buildChoices,
  deleteQuestion,
  rejectQuestion,
  updateQuestion,
  type QuestionWithId,
} from "@/lib/firestore/questions";
import type { QuestionStatus } from "@/types/firestore";

// ---- icons (inline SVG, no icon dependency) --------------------------------
const BellIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);
const CheckCircleIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12 2.5 2.5 4.5-5" />
  </svg>
);
const XCircleIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="m9 9 6 6M15 9l-6 6" />
  </svg>
);
const ChevronRight = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 6l6 6-6 6" />
  </svg>
);
const EmptyBoxArt = (
  <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 8.5 12 5l8 3.5M4 8.5 12 12l8-3.5M4 8.5V16l8 3.5M20 8.5V16l-8 3.5M12 12v7.5" />
    <path d="m18.5 3.5.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8L16 6l1.8-.7z" />
  </svg>
);

// ---- static config ---------------------------------------------------------
const STATUS_TABS: {
  key: QuestionStatus;
  label: string;
  color: string;
  glyph: string;
  icon: React.ReactNode;
}[] = [
  { key: "pending", label: "승인 대기", color: "var(--warning)", glyph: "#1c1300", icon: BellIcon },
  { key: "approved", label: "승인 완료", color: "var(--success)", glyph: "#ffffff", icon: CheckCircleIcon },
  { key: "rejected", label: "반려", color: "var(--error)", glyph: "#ffffff", icon: XCircleIcon },
];

const STATUS_META: Record<QuestionStatus, { label: string; badge: string }> = {
  pending: { label: "승인 대기", badge: "bg-[var(--warning-soft)] text-[var(--warning)]" },
  approved: { label: "승인 완료", badge: "bg-[var(--success-soft)] text-[var(--success)]" },
  rejected: { label: "반려", badge: "bg-[var(--error-soft)] text-[var(--error)]" },
};

const EMPTY_COPY: Record<QuestionStatus, { title: string; sub: string }> = {
  pending: {
    title: "승인 대기 중인 문제가 없어요",
    sub: "학생이 문제를 제출하면 이곳에 표시됩니다.",
  },
  approved: {
    title: "승인 완료된 문제가 없어요",
    sub: "문제를 승인하면 이곳에 표시됩니다.",
  },
  rejected: {
    title: "반려된 문제가 없어요",
    sub: "반려한 문제가 이곳에 표시됩니다.",
  },
};

const CHOICE_COLORS = [
  "bg-[var(--kahoot-red)]",
  "bg-[var(--kahoot-blue)]",
  "bg-[var(--kahoot-yellow)]",
  "bg-[var(--kahoot-green)]",
];

// Decorative avatar palette, cycled by list position (matches the reference).
const AVATAR_COLORS = ["var(--primary)", "var(--success)", "var(--warning)", "var(--error)"];

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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [draftChoices, setDraftChoices] = useState<string[]>([]);
  const [draftCorrectIndex, setDraftCorrectIndex] = useState<number | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const normalizedSearch = search.trim().toLowerCase();
  const filtered = questions.filter((q) => q.status === tab);
  const visible = filtered
    .filter((q) => creatorFilter === "all" || q.createdBy === creatorFilter)
    .filter((q) => {
      if (!normalizedSearch) return true;
      return (
        q.text.toLowerCase().includes(normalizedSearch) ||
        (q.authorNickname ?? "").toLowerCase().includes(normalizedSearch)
      );
    });

  function cancelEditing() {
    setEditingQuestionId(null);
    setDraftText("");
    setDraftChoices([]);
    setDraftCorrectIndex(null);
    setActionError(null);
  }

  function selectTab(next: QuestionStatus) {
    setTab(next);
    setExpandedId(null);
    cancelEditing();
  }

  function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      if (editingQuestionId === id) cancelEditing();
      return;
    }
    setExpandedId(id);
  }

  function startEditing(question: QuestionWithId) {
    setEditingQuestionId(question.id);
    setDraftText(question.text);
    setDraftChoices(question.choices.map((choice) => choice.text));
    setDraftCorrectIndex(
      question.choices.findIndex((choice) => choice.id === question.correctChoiceId),
    );
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

  const isFiltering = Boolean(normalizedSearch) || creatorFilter !== "all";

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-2">
        <p className="hero-chip">Question Bank</p>
        <h1 className="display-font text-4xl text-white sm:text-[2.5rem]">문제 관리</h1>
      </header>

      {/* 상단 액션 카드: 새 문제 만들기(강조) / 학생 문제 받기(중립) */}
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

      {/* 상태 탭 + 검색/필터 + 목록 (붙여서 하나의 그룹으로) */}
      <div className="flex flex-col gap-4">
        {/* 통합 상태 탭 */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {STATUS_TABS.map(({ key, label, color, glyph, icon }) => {
            const count = questions.filter((q) => q.status === key).length;
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => selectTab(key)}
                className="flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-bold transition-colors duration-150 sm:gap-2.5"
                style={{
                  borderColor: active ? color : "rgba(255,255,255,0.10)",
                  color: active ? color : "rgba(255,255,255,0.62)",
                  background: "var(--surface)",
                }}
              >
                <span
                  className="flex h-7 w-7 flex-none items-center justify-center rounded-full"
                  style={{ background: color, color: glyph }}
                >
                  {icon}
                </span>
                <span className="whitespace-nowrap">{label}</span>
                <span className="font-black">{count}</span>
              </button>
            );
          })}
        </div>

        {/* 검색 + 작성자 필터 (한 줄, 좁은 화면에서는 세로 스택) */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
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
              className="w-full rounded-xl border border-white/10 bg-[var(--surface)] py-2.5 pl-10 pr-4 text-sm font-medium text-white placeholder:text-white/35 focus-visible:border-[var(--primary)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(50,0,224,0.16)]"
            />
          </div>

          <div className="flex flex-none gap-1 rounded-xl border border-white/10 bg-[var(--surface)] p-1">
            {CREATOR_FILTERS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setCreatorFilter(key)}
                className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-150 sm:flex-none ${
                  creatorFilter === key
                    ? "bg-[var(--primary)] text-white"
                    : "text-white/55 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 문제 목록 (행 기반) */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
          {visible.length === 0 ? (
            <EmptyState
              title={isFiltering ? "검색 결과가 없어요" : EMPTY_COPY[tab].title}
              sub={
                isFiltering
                  ? "다른 검색어나 필터를 시도해 보세요."
                  : EMPTY_COPY[tab].sub
              }
            />
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {visible.map((question, index) => {
                const isExpanded = expandedId === question.id;
                const isEditing = editingQuestionId === question.id;
                const meta = STATUS_META[question.status];
                const avatarChar =
                  question.text.trim()[0] ?? question.authorNickname?.[0] ?? "?";
                const isStudent = question.createdBy === "student";

                return (
                  <li key={question.id}>
                    {/* 행 헤더 — 전체 클릭 시 상세 펼침/접힘 */}
                    <button
                      type="button"
                      onClick={() => toggleExpand(question.id)}
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-white/[0.04] sm:gap-4 sm:px-5"
                    >
                      <span
                        className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-sm font-black text-white"
                        style={{ background: AVATAR_COLORS[index % AVATAR_COLORS.length] }}
                      >
                        {avatarChar}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-bold text-white">{question.text}</p>
                        <div className="mt-0.5 flex items-center gap-2">
                          {isStudent && (
                            <span className="truncate text-xs text-white/45">
                              {question.authorNickname ?? "익명"} 학생
                            </span>
                          )}
                          <span className="flex-none rounded-md bg-white/[0.08] px-2 py-0.5 text-[11px] font-semibold text-white/55">
                            {isStudent ? "학생 제출" : "교사 작성"}
                          </span>
                        </div>
                      </div>

                      <span className="hidden flex-none text-xs font-semibold text-white/40 sm:inline">
                        {formatRelativeTime(question.createdAt)}
                      </span>
                      <span
                        className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-black ${meta.badge}`}
                      >
                        {meta.label}
                      </span>
                      <span
                        className="flex-none text-white/30 transition-transform duration-150"
                        style={{ transform: isExpanded ? "rotate(90deg)" : "none" }}
                      >
                        {ChevronRight}
                      </span>
                    </button>

                    {/* 상세: 선택지 + 승인/반려/수정/삭제 */}
                    {isExpanded && (
                      <div className="border-t border-white/[0.06] px-4 py-5 sm:px-5">
                        {isEditing && (
                          <textarea
                            value={draftText}
                            onChange={(e) => setDraftText(e.target.value)}
                            className="text-area mb-4 min-h-24"
                            rows={3}
                          />
                        )}

                        <ul className="grid gap-2 sm:grid-cols-2">
                          {(isEditing ? draftChoices : question.choices.map((c) => c.text)).map(
                            (choiceText, choiceIndex) => {
                              const isCorrect = isEditing
                                ? draftCorrectIndex === choiceIndex
                                : question.choices[choiceIndex]?.id === question.correctChoiceId;

                              return (
                                <li
                                  key={
                                    isEditing
                                      ? `draft-${question.id}-${choiceIndex}`
                                      : question.choices[choiceIndex]?.id
                                  }
                                  className={`flex items-center gap-3 rounded-[16px] px-4 py-3 ${
                                    isCorrect
                                      ? "bg-[var(--success-soft)] text-[var(--success)]"
                                      : "bg-white/[0.05] text-white/75"
                                  }`}
                                >
                                  <span className={`choice-swatch ${CHOICE_COLORS[choiceIndex % CHOICE_COLORS.length]}`} />
                                  {isEditing ? (
                                    <input
                                      value={choiceText}
                                      onChange={(e) =>
                                        setDraftChoices((prev) =>
                                          prev.map((choice, ci) =>
                                            ci === choiceIndex ? e.target.value : choice,
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
                                      onClick={() => setDraftCorrectIndex(choiceIndex)}
                                      className={`ml-auto flex-none rounded-full px-3 py-1.5 text-xs font-black ${
                                        isCorrect
                                          ? "bg-[var(--kahoot-green)] text-white"
                                          : "bg-white text-[var(--kahoot-purple)]"
                                      }`}
                                    >
                                      {isCorrect ? "정답" : "정답 지정"}
                                    </button>
                                  ) : (
                                    isCorrect && <span className="ml-auto flex-none text-xs font-black">정답</span>
                                  )}
                                </li>
                              );
                            },
                          )}
                        </ul>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {question.status === "pending" &&
                            (isEditing ? (
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
                                  className="rounded-full border border-white/12 bg-white/10 px-4 py-2 text-sm font-black text-white/80 hover:bg-white/16 disabled:opacity-60"
                                >
                                  취소
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => approveQuestion(teacherUid, question.id)}
                                  className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-black text-white transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
                                >
                                  승인
                                </button>
                                {isStudent && (
                                  <button
                                    onClick={() => startEditing(question)}
                                    className="rounded-full bg-[var(--warning)] px-4 py-2 text-sm font-black text-[#4a2c00] transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
                                  >
                                    수정 후 승인
                                  </button>
                                )}
                                <button
                                  onClick={() => rejectQuestion(teacherUid, question.id)}
                                  className="rounded-full bg-[var(--error)] px-4 py-2 text-sm font-black text-white transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
                                >
                                  반려
                                </button>
                              </>
                            ))}
                          <button
                            onClick={() => deleteQuestion(teacherUid, question.id)}
                            className="ml-auto rounded-full border border-white/12 bg-white/[0.06] px-4 py-2 text-sm font-black text-white/60 hover:bg-white/12 hover:text-white"
                          >
                            삭제
                          </button>
                        </div>

                        {isEditing && actionError && (
                          <p className="status-banner mt-3" data-tone="error">
                            {actionError}
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="text-white/25">{EmptyBoxArt}</span>
      <p className="text-base font-bold text-white/80">{title}</p>
      <p className="text-sm text-white/45">{sub}</p>
    </div>
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
      className={`group flex items-center gap-4 rounded-2xl border px-5 py-4 text-left transition-transform duration-150 hover:-translate-y-0.5 sm:px-6 sm:py-5 ${
        highlighted
          ? "border-[var(--primary)] bg-[var(--primary)]"
          : "border-white/10 bg-[var(--surface)] hover:bg-white/[0.06]"
      }`}
    >
      <span
        className={`flex h-12 w-12 flex-none items-center justify-center rounded-xl text-white ${
          highlighted ? "bg-white/15" : "bg-white/10"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-black text-white">{title}</span>
        <span className={`mt-0.5 block text-sm leading-5 ${highlighted ? "text-white/75" : "text-white/60"}`}>
          {description}
        </span>
      </span>
      <span
        className={`flex-none transition-transform duration-150 group-hover:translate-x-0.5 ${
          highlighted ? "text-white/80" : "text-white/40"
        }`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </span>
    </button>
  );
}
