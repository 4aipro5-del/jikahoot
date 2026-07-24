"use client";

import type { QuestionWithId } from "@/lib/firestore/questions";
import type { Room } from "@/types/firestore";
import RecentQuestionsPreview from "./RecentQuestionsPreview";

// Inline SVGs keep the dashboard self-contained (no icon dependency) while
// giving each summary card a distinct illustration, per the reference design.
const BellIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

const BookIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 5.5A2.5 2.5 0 0 1 4.5 3H10a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4.5A2.5 2.5 0 0 1 2 14.5z" />
    <path d="M22 5.5A2.5 2.5 0 0 0 19.5 3H14a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h5.5a2.5 2.5 0 0 0 2.5-2.5z" />
  </svg>
);

const ChecklistArt = (
  <svg width="128" height="128" viewBox="0 0 128 128" fill="none" aria-hidden="true">
    <rect x="22" y="20" width="84" height="88" rx="18" fill="rgba(255,255,255,0.05)" />
    <rect x="38" y="40" width="11" height="11" rx="3.5" fill="rgba(255,255,255,0.16)" />
    <rect x="57" y="42" width="36" height="7" rx="3.5" fill="rgba(255,255,255,0.12)" />
    <rect x="38" y="61" width="11" height="11" rx="3.5" fill="rgba(255,255,255,0.16)" />
    <rect x="57" y="63" width="36" height="7" rx="3.5" fill="rgba(255,255,255,0.12)" />
    <rect x="38" y="82" width="11" height="11" rx="3.5" fill="rgba(255,255,255,0.16)" />
    <rect x="57" y="84" width="26" height="7" rx="3.5" fill="rgba(255,255,255,0.12)" />
    <circle cx="98" cy="98" r="15" fill="var(--warning)" />
    <path d="M91 98l4.5 4.5L104 93" stroke="#1c1300" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const BooksArt = (
  <svg width="128" height="128" viewBox="0 0 128 128" fill="none" aria-hidden="true">
    <rect x="34" y="76" width="66" height="17" rx="5" fill="var(--primary)" opacity="0.92" />
    <rect x="30" y="56" width="66" height="17" rx="5" fill="var(--primary)" opacity="0.66" transform="rotate(-4 63 64)" />
    <rect x="38" y="36" width="60" height="17" rx="5" fill="var(--primary)" opacity="0.48" transform="rotate(4 68 44)" />
    <path d="M100 30l2.4 6.2L109 39l-6.6 2.4L100 48l-2.4-6.6L91 39l6.6-2.4z" fill="rgba(255,255,255,0.55)" />
  </svg>
);

const ExternalIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </svg>
);

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

  return (
    <div className="flex flex-col gap-8">
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

      <div className="grid gap-5 lg:grid-cols-2">
        {/* 승인 대기 — 앰버 강조, 클릭 시 승인 화면으로 이동 */}
        <button
          type="button"
          onClick={onViewApprovals}
          className="group relative flex items-center justify-between gap-4 overflow-hidden rounded-[26px] border border-white/10 bg-[var(--surface)] p-6 text-left transition-transform duration-150 hover:-translate-y-0.5 sm:p-7"
        >
          <div className="relative z-10 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-[var(--warning)] text-[#1c1300]">
                {BellIcon}
              </span>
              <span className="text-lg font-black text-white">승인 대기</span>
              {pendingCount > 0 && (
                <span className="rounded-full bg-[var(--warning-soft)] px-2.5 py-1 text-xs font-black text-[var(--warning)]">
                  확인 필요
                </span>
              )}
            </div>
            <p className="display-font text-5xl text-white">{pendingCount}개</p>
            <p className="text-sm font-semibold text-white/55">학생이 제출한 문제</p>
          </div>
          <div className="relative z-0 hidden flex-none sm:block">{ChecklistArt}</div>
        </button>

        {/* 사용 가능 문제 — 브랜드 블루 */}
        <div className="relative flex items-center justify-between gap-4 overflow-hidden rounded-[26px] border border-white/10 bg-[var(--surface)] p-6 transition-transform duration-150 hover:-translate-y-0.5 sm:p-7">
          <div className="relative z-10 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-[var(--primary)] text-white">
                {BookIcon}
              </span>
              <span className="text-lg font-black text-white">사용 가능 문제</span>
            </div>
            <p className="display-font text-5xl text-white">{approvedCount}개</p>
            <p className="text-sm font-semibold text-white/55">게임에 사용할 수 있는 문제</p>
          </div>
          <div className="relative z-0 hidden flex-none sm:block">{BooksArt}</div>
        </div>
      </div>

      <RecentQuestionsPreview questions={questions} onViewAll={onViewApprovals} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[var(--surface)] px-5 py-4">
        <p className="flex min-w-0 items-center gap-2.5 text-sm text-white/70">
          <span className="flex-none rounded-full bg-[var(--warning-soft)] px-2.5 py-1 text-xs font-black text-[var(--warning)]">
            💡 TIP
          </span>
          <span className="min-w-0">제출된 문제는 승인 후 게임에서 사용할 수 있어요!</span>
        </p>
        <span className="inline-flex flex-none items-center gap-1 text-sm font-bold text-white/45">
          도움말 보기 {ExternalIcon}
        </span>
      </div>
    </div>
  );
}
