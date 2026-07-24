// Text-free loading shell used as the Suspense fallback / data-readiness
// placeholder for full-page entry points. It matches the dark stage background
// (no white flash) and keeps the same centered stage layout the real screens
// use (no layout jump), showing only a gently pulsing brand mark instead of a
// "…불러오는 중…" message.
export default function StageSkeleton() {
  return (
    <div className="stage-shell" aria-hidden="true">
      <div className="stage-content flex min-h-screen items-center justify-center">
        <span className="flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[#7b5cff] text-white">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2c.7 3.9 2.4 6.4 6 8-3.6 1.6-5.3 4.1-6 8-.7-3.9-2.4-6.4-6-8 3.6-1.6 5.3-4.1 6-8Z" />
          </svg>
        </span>
      </div>
    </div>
  );
}
