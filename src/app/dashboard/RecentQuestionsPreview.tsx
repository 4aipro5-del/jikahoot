import { formatRelativeTime } from "@/lib/formatRelativeTime";
import type { QuestionWithId } from "@/lib/firestore/questions";
import type { QuestionStatus } from "@/types/firestore";

const STATUS_META: Record<QuestionStatus, { label: string; className: string }> = {
  approved: { label: "승인됨", className: "bg-[var(--success-soft)] text-[var(--success)]" },
  pending: { label: "대기중", className: "bg-[var(--warning-soft)] text-[var(--warning)]" },
  rejected: { label: "반려됨", className: "bg-[var(--error-soft)] text-[var(--error)]" },
};

// Cycled by list position so consecutive rows read as visually distinct
// avatars — purely decorative, drawn from the brand palette.
const AVATAR_COLORS = ["var(--primary)", "var(--success)", "var(--warning)", "var(--error)"];

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
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <ul className="flex flex-col gap-1">
          {recent.map((question, index) => {
            const meta = STATUS_META[question.status];
            const avatarChar =
              question.text.trim()[0] ?? question.authorNickname?.[0] ?? "?";
            const author =
              question.createdBy === "student"
                ? `${question.authorNickname ?? "익명"} 학생`
                : "교사 작성";

            return (
              <li
                key={question.id}
                onClick={onViewAll}
                className="flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-3 transition-colors duration-150 hover:bg-white/[0.05] sm:gap-4 sm:px-4"
              >
                <span
                  className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-sm font-black text-white"
                  style={{ background: AVATAR_COLORS[index % AVATAR_COLORS.length] }}
                >
                  {avatarChar}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold text-white">{question.text}</p>
                  <p className="truncate text-xs text-white/45">{author}</p>
                </div>
                <span className="hidden flex-none text-xs font-semibold text-white/40 sm:inline">
                  {formatRelativeTime(question.createdAt)}
                </span>
                <span
                  className={`flex-none rounded-full px-3 py-1 text-xs font-black ${meta.className}`}
                >
                  {meta.label}
                </span>
                <svg
                  className="flex-none text-white/30"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
