import { formatRelativeTime } from "@/lib/formatRelativeTime";
import type { QuestionWithId } from "@/lib/firestore/questions";
import type { QuestionStatus } from "@/types/firestore";

const STATUS_BADGE: Record<QuestionStatus, string> = {
  approved: "bg-[var(--success-soft)] text-[var(--success)]",
  pending: "bg-[var(--warning-soft)] text-[var(--warning)]",
  rejected: "bg-[var(--error-soft)] text-[var(--error)]",
};

export default function RecentQuestionsPreview({
  questions,
  onViewAll,
}: {
  questions: QuestionWithId[];
  onViewAll: () => void;
}) {
  const recent = questions.slice(0, 5);

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-[var(--surface)] p-6 sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="display-font text-2xl text-white">최근 제출된 문제</h2>
        <button
          type="button"
          onClick={onViewAll}
          className="inline-flex items-center gap-1 text-sm font-bold text-[#B3B3B3] transition-colors duration-150 hover:text-white"
        >
          전체 보기
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>

      {recent.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.04] px-5 py-7 text-center text-sm font-semibold text-white/60">
          아직 제출된 문제가 없어요.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {recent.map((question, index) => (
            <li
              key={question.id}
              onClick={onViewAll}
              className="flex cursor-pointer flex-wrap items-center gap-3 rounded-2xl px-4 py-3 transition-colors duration-150 hover:bg-white/[0.06] sm:gap-4 sm:px-5"
            >
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-white/10 text-sm font-black text-white">
                {index + 1}
              </span>
              <span
                className={`flex-none rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${STATUS_BADGE[question.status]}`}
              >
                {question.status}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold text-white">{question.text}</p>
                <p className="text-xs text-white/50">
                  {question.createdBy === "student" ? (question.authorNickname ?? "익명 학생") : "교사 작성"} ·{" "}
                  {formatRelativeTime(question.createdAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
