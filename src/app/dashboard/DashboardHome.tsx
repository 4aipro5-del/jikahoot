"use client";

import type { QuestionWithId } from "@/lib/firestore/questions";
import type { Room } from "@/types/firestore";
import RecentQuestionsPreview from "./RecentQuestionsPreview";

export default function DashboardHome({
  room,
  questions,
  onViewApprovals,
}: {
  room: Room;
  questions: QuestionWithId[];
  onViewApprovals: () => void;
}) {
  const pendingCount = questions.filter((q) => q.status === "pending").length;
  const approvedCount = questions.filter((q) => q.status === "approved").length;
  const studentCount = questions.filter((q) => q.createdBy === "student").length;

  const cardClass =
    "rounded-2xl border border-white/10 bg-[var(--surface)] p-5 transition-transform duration-150 hover:-translate-y-0.5";

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-center justify-between gap-6">
        <div className="min-w-0 space-y-2">
          <p className="hero-chip">Dashboard</p>
          <h1 className="display-font text-4xl text-white sm:text-[2.75rem]">
            안녕하세요,
            <br className="sm:hidden" /> {room.displayName} 선생님 👋
          </h1>
          <p className="text-base text-[color:var(--foreground-muted)]">
            오늘도 멋진 퀴즈를 만들어보세요.
          </p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className={cardClass}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--warning)]">
            승인 대기
          </p>
          <p className="display-font mt-3 text-4xl text-white">{pendingCount}개</p>
          <button
            onClick={onViewApprovals}
            className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-[#B3B3B3] transition-colors duration-150 hover:text-white"
          >
            바로가기
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
        <div className={cardClass}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
            사용 가능 문제
          </p>
          <p className="display-font mt-3 text-4xl text-white">{approvedCount}개</p>
        </div>
        <div className={cardClass}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">학생 제출</p>
          <p className="display-font mt-3 text-4xl text-white">{studentCount}개</p>
        </div>
      </div>

      <RecentQuestionsPreview questions={questions} onViewAll={onViewApprovals} />
    </div>
  );
}
