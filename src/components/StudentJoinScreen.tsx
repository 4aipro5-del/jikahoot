"use client";

import type { FormEvent, ReactNode } from "react";
import { IconHash, IconPerson, StudentHeader, StudentShapes } from "./student-ui";

// Shared entry screen for the two student join flows — 문제 제출(CREATE, 노랑) and
// 퀴즈 시작(PLAY, 파랑). Same structure, different accent color / copy / icons.
export default function StudentJoinScreen({
  accent,
  eyebrow,
  eyebrowIcon,
  titleTop,
  titleAccent,
  description,
  codeLabel,
  codePlaceholder,
  code,
  onCodeChange,
  nickname,
  onNicknameChange,
  onSubmit,
  submitting,
  submitLabel,
  submitTextColor,
  submitTextClassName,
  error,
  noteIcon,
  noteTitle,
  noteDesc,
  noteMuted = false,
}: {
  accent: "create" | "play";
  eyebrow: string;
  eyebrowIcon: ReactNode;
  titleTop: string;
  titleAccent: string;
  description: ReactNode;
  codeLabel: string;
  codePlaceholder: string;
  code: string;
  onCodeChange: (value: string) => void;
  nickname: string;
  onNicknameChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  submitting: boolean;
  submitLabel: string;
  submitTextColor?: string;
  submitTextClassName?: string;
  error: string | null;
  noteIcon: ReactNode;
  noteTitle: string;
  noteDesc?: string;
  noteMuted?: boolean;
}) {
  const isCreate = accent === "create";
  const accentColor = isCreate ? "var(--warning)" : "var(--primary)";
  // note (icon + title) is accent-colored by default, or muted gray when asked
  const noteColor = noteMuted ? "var(--foreground-muted)" : accentColor;
  const fieldFocus = isCreate
    ? "focus-within:border-[rgba(244,186,71,0.55)] focus-within:ring-[rgba(244,186,71,0.16)]"
    : "focus-within:border-[rgba(50,0,224,0.65)] focus-within:ring-[rgba(50,0,224,0.24)]";
  const buttonClass = isCreate
    ? "bg-[var(--warning)] text-[var(--panel-text)] shadow-[0_8px_0_var(--warning-dark)]"
    : "bg-[var(--primary)] text-white shadow-[0_8px_0_var(--primary-dark)]";

  return (
    <div className="stage-shell">
      <StudentShapes />

      <div className="stage-content flex min-h-screen flex-col gap-8 px-5 py-6 sm:px-8">
        <StudentHeader />

        <div className="flex flex-1 items-center justify-center">
          <div className="grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
            {/* left: concise intro */}
            <div className="flex flex-col justify-center gap-5">
              <span
                className="inline-flex items-center gap-2 self-start text-sm font-black uppercase tracking-[0.2em]"
                style={{ color: accentColor }}
              >
                {eyebrowIcon}
                {eyebrow}
              </span>
              <h1 className="display-font text-5xl leading-[1.05] text-white sm:text-6xl lg:text-7xl">
                {titleTop}
                <br />
                <span style={{ color: accentColor }}>{titleAccent}</span>
              </h1>
              <p className="max-w-md text-base leading-7 text-[color:var(--foreground-muted)] sm:text-lg">
                {description}
              </p>
            </div>

            {/* right: input card */}
            <div className="w-full">
              <section className="rounded-[28px] border border-white/10 bg-[var(--surface)] p-7 shadow-[var(--shadow-soft)] sm:p-9">
                <form onSubmit={onSubmit} className="flex flex-col gap-5">
                  <label className="flex flex-col gap-2.5">
                    <span className="text-lg font-bold text-white/90">{codeLabel}</span>
                    <div
                      className={`flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 transition focus-within:ring-4 ${fieldFocus}`}
                    >
                      <span className="shrink-0 text-white/35">
                        <IconHash />
                      </span>
                      <input
                        value={code}
                        onChange={(e) => onCodeChange(e.target.value)}
                        placeholder={codePlaceholder}
                        maxLength={6}
                        className="min-h-[3.6rem] w-full bg-transparent text-base font-bold uppercase tracking-wide text-white placeholder:font-medium placeholder:normal-case placeholder:tracking-normal placeholder:text-white/35 focus:outline-none"
                      />
                    </div>
                  </label>

                  <label className="flex flex-col gap-2.5">
                    <span className="text-lg font-bold text-white/90">이름(닉네임)</span>
                    <div
                      className={`flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 transition focus-within:ring-4 ${fieldFocus}`}
                    >
                      <span className="shrink-0 text-white/35">
                        <IconPerson />
                      </span>
                      <input
                        value={nickname}
                        onChange={(e) => onNicknameChange(e.target.value)}
                        placeholder="이름을 입력하세요."
                        className="min-h-[3.6rem] w-full bg-transparent text-base font-bold text-white placeholder:font-medium placeholder:text-white/35 focus:outline-none"
                      />
                    </div>
                  </label>

                  {error && (
                    <p
                      className="status-banner"
                      data-tone="error"
                      style={{
                        fontSize: "1.05rem",
                        fontWeight: 400,
                        textAlign: "center",
                        background: "transparent",
                        border: "none",
                        boxShadow: "none",
                        padding: 0,
                      }}
                    >
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className={`mt-1 inline-flex min-h-[3.9rem] w-full items-center justify-center gap-3 rounded-2xl px-6 text-xl font-black transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-1 disabled:cursor-not-allowed disabled:opacity-70 ${buttonClass}`}
                  >
                    {submitting ? (
                      "입장 중..."
                    ) : (
                      <span
                        className={`inline-flex items-center gap-3 ${submitTextClassName ?? ""}`}
                        style={submitTextColor ? { color: submitTextColor } : undefined}
                      >
                        {submitLabel}
                        <span aria-hidden="true">→</span>
                      </span>
                    )}
                  </button>
                </form>

                {/* divider + reassurance note */}
                <div className="mt-5 flex items-start gap-3 border-t border-white/10 pt-5">
                  <span className="mt-0.5 shrink-0" style={{ color: noteColor }}>
                    {noteIcon}
                  </span>
                  <div>
                    <p
                      className={noteMuted ? "text-sm leading-6 sm:text-base" : "text-base font-bold"}
                      style={{ color: noteColor }}
                    >
                      {noteTitle}
                    </p>
                    {noteDesc && (
                      <p className="mt-0.5 text-xs leading-5 text-[color:var(--foreground-muted)]">
                        {noteDesc}
                      </p>
                    )}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
