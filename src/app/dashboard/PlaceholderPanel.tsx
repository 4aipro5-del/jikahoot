export default function PlaceholderPanel({ tag, label }: { tag: string; label: string }) {
  return (
    <div className="flex min-h-[24rem] flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-[var(--surface)] p-10 text-center">
      <p className="hero-chip">{tag}</p>
      <p className="display-font text-2xl text-white">준비 중입니다.</p>
      <p className="text-sm text-[color:var(--foreground-muted)]">
        곧 이 화면에서 {label} 기능을 사용할 수 있게 될 예정이에요.
      </p>
    </div>
  );
}
