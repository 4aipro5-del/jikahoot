"use client";

import { useState } from "react";

// ---- shared icons (inline SVG, no icon dependency) ----

export function IconSparkle({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l1.9 6.6a2 2 0 0 0 1.5 1.5L22 12l-6.6 1.9a2 2 0 0 0-1.5 1.5L12 22l-1.9-6.6a2 2 0 0 0-1.5-1.5L2 12l6.6-1.9a2 2 0 0 0 1.5-1.5z" />
    </svg>
  );
}

export function IconHash() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <line x1="4.5" y1="9" x2="19.5" y2="9" />
      <line x1="4" y1="15" x2="19" y2="15" />
      <line x1="10.5" y1="3.5" x2="8" y2="20.5" />
      <line x1="16" y1="3.5" x2="13.5" y2="20.5" />
    </svg>
  );
}

export function IconPerson() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-1.5a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5V21" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function IconShield() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function IconGamepad() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 12h4M8 10v4M15 11h.01M18 13h.01" />
      <rect x="2" y="6" width="20" height="12" rx="4" />
    </svg>
  );
}

export function IconPeople() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
      <circle cx="9" cy="7" r="3.5" />
      <path d="M22 20v-1.5a4 4 0 0 0-3-3.85" />
      <path d="M16 3.6a4 4 0 0 1 0 6.8" />
    </svg>
  );
}

// ---- brand header: JIKAHOOT wordmark + 도움말 (help) ----

export function StudentHeader() {
  const [helpOpen, setHelpOpen] = useState(false);
  return (
    <>
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--primary)] to-[#7b5cff] text-white">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2c.7 3.9 2.4 6.4 6 8-3.6 1.6-5.3 4.1-6 8-.7-3.9-2.4-6.4-6-8 3.6-1.6 5.3-4.1 6-8Z" />
            </svg>
          </span>
          <span className="display-font text-xl tracking-wide text-white">JIKAHOOT</span>
        </div>
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-3.5 py-2 text-sm font-bold text-white/80 transition-colors hover:bg-white/15 hover:text-white"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M9.5 9a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2 2-2 3M12 16.5h.01" />
          </svg>
          도움말
        </button>
      </header>

      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="닫기"
            onClick={() => setHelpOpen(false)}
            className="absolute inset-0 cursor-default bg-black/70"
          />
          <div className="relative w-full max-w-sm rounded-[24px] border border-white/10 bg-[var(--surface)] p-6 text-center shadow-2xl">
            <h2 className="display-font text-2xl text-white">도움말</h2>
            <p className="mt-3 text-sm leading-6 text-[color:var(--foreground-muted)]">
              선생님이 알려준 <span className="font-bold text-white">코드</span>와{" "}
              <span className="font-bold text-white">이름</span>을 입력하면 참여할 수 있어요.
              <br />
              코드가 없으면 선생님께 물어보세요.
            </p>
            <button
              type="button"
              onClick={() => setHelpOpen(false)}
              className="mt-5 w-full rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-black text-white"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ---- decorative floating shapes (all four brand colors), click-through ----

const SHAPES = [
  { top: "14%", left: "10%", kind: "diamond", color: "var(--primary)", size: 20 },
  { top: "70%", left: "6%", kind: "square", color: "var(--warning)", size: 22 },
  { top: "84%", left: "16%", kind: "square", color: "var(--success)", size: 18 },
  { top: "18%", left: "88%", kind: "square", color: "var(--warning)", size: 20 },
  { top: "40%", left: "94%", kind: "diamond", color: "var(--error)", size: 18 },
  { top: "80%", left: "90%", kind: "square", color: "var(--error)", size: 18 },
];

export function StudentShapes() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 select-none overflow-hidden">
      {SHAPES.map((s, i) => (
        <span
          key={i}
          className="absolute"
          style={{
            top: s.top,
            left: s.left,
            width: s.size,
            height: s.size,
            background: s.color,
            borderRadius: 6,
            transform: s.kind === "diamond" ? "rotate(45deg)" : "rotate(12deg)",
          }}
        />
      ))}
      <span className="absolute left-[6%] top-[30%] text-[var(--primary)]">
        <IconSparkle size={22} />
      </span>
      <span className="absolute bottom-[16%] left-[26%] text-[var(--warning)]">
        <IconSparkle size={18} />
      </span>
      <span className="absolute right-[14%] top-[10%] text-[var(--warning)]">
        <IconSparkle size={20} />
      </span>
    </div>
  );
}

// ---- lobby mascots: the four answer-shapes as friendly characters ----

function MascotFace() {
  return (
    <>
      <circle cx="9" cy="13" r="1.6" fill="#1a1626" />
      <circle cx="19" cy="13" r="1.6" fill="#1a1626" />
      <path d="M9.5 17c1.6 1.8 5.4 1.8 7 0" stroke="#1a1626" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </>
  );
}

export function StudentMascots() {
  return (
    <div className="flex items-end justify-center gap-3 sm:gap-5">
      {/* blue circle */}
      <svg width="60" height="72" viewBox="0 0 28 34" aria-hidden="true">
        <path d="M6 30 L6 26 M22 30 L22 26" stroke="var(--primary)" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="14" cy="14" r="13" fill="var(--primary)" />
        <MascotFace />
      </svg>
      {/* yellow triangle */}
      <svg width="60" height="72" viewBox="0 0 28 34" aria-hidden="true">
        <path d="M8 31 L8 27 M20 31 L20 27" stroke="var(--warning)" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M14 1 L27 26 L1 26 Z" fill="var(--warning)" />
        <circle cx="10.5" cy="17" r="1.5" fill="#3a2a00" />
        <circle cx="17.5" cy="17" r="1.5" fill="#3a2a00" />
        <path d="M11 20.5c1.4 1.4 4.6 1.4 6 0" stroke="#3a2a00" strokeWidth="1.7" fill="none" strokeLinecap="round" />
      </svg>
      {/* green square */}
      <svg width="60" height="72" viewBox="0 0 28 34" aria-hidden="true">
        <path d="M8 31 L8 27 M20 31 L20 27" stroke="var(--success)" strokeWidth="2.4" strokeLinecap="round" />
        <rect x="2" y="3" width="24" height="24" rx="6" fill="var(--success)" />
        <circle cx="10" cy="13" r="1.6" fill="#0c2c14" />
        <circle cx="18" cy="13" r="1.6" fill="#0c2c14" />
        <path d="M10.5 17c1.6 1.8 5.4 1.8 7 0" stroke="#0c2c14" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      </svg>
      {/* red diamond */}
      <svg width="60" height="72" viewBox="0 0 28 34" aria-hidden="true">
        <path d="M9 31 L9 28 M19 31 L19 28" stroke="var(--error)" strokeWidth="2.4" strokeLinecap="round" />
        <rect x="5" y="5" width="18" height="18" rx="4" transform="rotate(45 14 14)" fill="var(--error)" />
        <circle cx="10.5" cy="13" r="1.5" fill="#3a0d0a" />
        <circle cx="17.5" cy="13" r="1.5" fill="#3a0d0a" />
        <path d="M11 16.5c1.3 1.4 4.7 1.4 6 0" stroke="#3a0d0a" strokeWidth="1.7" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  );
}
