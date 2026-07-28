"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { buildChoices } from "@/lib/firestore/questions";
import type { Choice } from "@/types/firestore";

const MIN_CHOICES = 2;
const MAX_CHOICES = 4;
const DEFAULT_CHOICES = Array.from({ length: MAX_CHOICES }, () => "");
const CHOICE_THEMES = [
  {
    badge: "bg-[var(--kahoot-red)] text-white",
    panel: "bg-[rgba(226,27,60,0.08)]",
  },
  {
    badge: "bg-[var(--kahoot-blue)] text-white",
    panel: "bg-[rgba(19,104,206,0.08)]",
  },
  {
    badge: "bg-[var(--kahoot-yellow)] text-[#4a2c00]",
    panel: "bg-[rgba(216,158,0,0.1)]",
  },
  {
    badge: "bg-[var(--kahoot-green)] text-white",
    panel: "bg-[rgba(38,137,12,0.08)]",
  },
];

export default function QuestionEditorForm({
  title,
  submitLabel,
  successMessage,
  onSubmit,
  variant = "light",
  className = "",
  hideTitle = false,
  twoColumnChoices = false,
}: {
  title: string;
  submitLabel: string;
  successMessage: string;
  onSubmit: (input: { text: string; choices: Choice[]; correctChoiceId: string }) => Promise<unknown>;
  variant?: "light" | "dark";
  className?: string;
  hideTitle?: boolean;
  // 넓은 화면에서 선택지를 2×2로 배치(학생 제출 화면용). 좁은 화면에선 세로 스택.
  twoColumnChoices?: boolean;
}) {
  const isDark = variant === "dark";
  // one radio group per form instance so the "정답" radios single-select
  // correctly and never collide with another form on the page
  const answerRadioName = useId();
  const [text, setText] = useState("");
  const [choiceTexts, setChoiceTexts] = useState(DEFAULT_CHOICES);
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const successTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successTimeout.current) clearTimeout(successTimeout.current);
    };
  }, []);

  function updateChoice(index: number, value: string) {
    setChoiceTexts((prev) => prev.map((c, i) => (i === index ? value : c)));
  }

  function addChoice() {
    if (choiceTexts.length >= MAX_CHOICES) return;
    setChoiceTexts((prev) => [...prev, ""]);
  }

  function removeChoice(index: number) {
    if (choiceTexts.length <= MIN_CHOICES) return;
    setChoiceTexts((prev) => prev.filter((_, i) => i !== index));
    setCorrectIndex((prev) => {
      if (prev === null) return prev;
      if (prev === index) return null;
      return prev > index ? prev - 1 : prev;
    });
  }

  function resetForm() {
    setText("");
    setChoiceTexts(DEFAULT_CHOICES);
    setCorrectIndex(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedText = text.trim();
    const trimmedChoices = choiceTexts.map((c) => c.trim());

    if (!trimmedText) {
      setError("문제 내용을 입력해 주세요.");
      return;
    }
    if (trimmedChoices.some((c) => !c)) {
      setError("모든 선택지를 채워 주세요.");
      return;
    }
    if (correctIndex === null) {
      const message = "정답이 될 선택지를 선택해 주세요.";
      setError(message);
      if (isDark && typeof window !== "undefined") {
        window.alert(message);
      }
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        text: trimmedText,
        choices: buildChoices(trimmedChoices),
        correctChoiceId: `c${correctIndex}`,
      });
      resetForm();
      setSuccess(true);
      if (successTimeout.current) clearTimeout(successTimeout.current);
      successTimeout.current = setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`flex w-full flex-col gap-6 p-8 ${
        isDark
          ? "rounded-[30px] border border-white/12 bg-slate-900/60 text-white shadow-[0_28px_60px_rgba(8,15,42,0.34)] backdrop-blur-xl"
          : "paper-panel"
      } ${className}`}
    >
      {!hideTitle && (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className={`w-full ${isDark ? "hero-chip" : "hero-chip hero-chip-paper"}`}>Quiz Builder</p>
          <h2
            className={`display-font text-[2rem] leading-none ${
              isDark ? "text-white" : "text-[var(--panel-text)]"
            }`}
          >
            {title}
          </h2>
        </div>
      )}

      <label className="flex flex-col gap-2">
        <span
          className={`text-sm font-black uppercase tracking-[0.18em] ${
            isDark ? "text-white/78" : "paper-subtle"
          }`}
        >
          Question
        </span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="예: 대한민국의 수도는 어디일까요?"
          className={`min-h-28 ${
            isDark
              ? "w-full resize-vertical rounded-[22px] border border-white/12 bg-slate-950/55 px-4 py-4 text-base font-bold text-white placeholder:text-white/28 focus-visible:outline-none focus-visible:border-cyan-300/75 focus-visible:shadow-[0_0_0_4px_rgba(103,232,249,0.16)]"
              : "text-area"
          }`}
          rows={3}
        />
      </label>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <span
              className={`text-sm font-black uppercase tracking-[0.18em] ${
                isDark ? "text-white/78" : "paper-subtle"
              }`}
            >
              Choices
            </span>
            <p className={`mt-1 text-xs font-semibold ${isDark ? "text-white/55" : "text-[rgba(38,18,87,0.55)]"}`}>
              정답이 될 선택지를 눌러주세요. 휴지통 버튼을 누르면 선택지를 삭제할 수 있어요.
            </p>
          </div>

          {choiceTexts.length < MAX_CHOICES && (
            <button
              type="button"
              onClick={addChoice}
              className={`rounded-full px-4 py-2 text-sm font-black text-white ${
                isDark
                  ? "bg-white/12 shadow-[0_8px_0_rgba(8,15,42,0.26)] hover:bg-white/18"
                  : "bg-[var(--duo-green)] shadow-[0_8px_0_rgba(70,163,2,0.24)]"
              }`}
            >
              + 선택지 추가
            </button>
          )}
        </div>

        <div className={`grid gap-3 ${twoColumnChoices ? "sm:grid-cols-2" : ""}`}>
          {choiceTexts.map((choice, index) => {
            const theme = CHOICE_THEMES[index % CHOICE_THEMES.length];
            const isCorrect = correctIndex === index;

            return (
              // non-interactive visual wrapper — no role/tabIndex/onClick; the
              // selection affordance is the native radio below, so no interactive
              // element is nested inside another
              <div
                key={index}
                className={`rounded-[24px] border p-4 transition-all duration-150 ${
                  isCorrect
                    ? "border-[var(--primary)] bg-[rgba(50,0,224,0.07)] shadow-[0_0_0_2px_var(--primary)]"
                    : isDark
                      ? "border-white/10 bg-white/4"
                      : `border-[rgba(38,18,87,0.1)] ${theme.panel}`
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span
                      className={`inline-flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-sm font-black ${theme.badge}`}
                    >
                      {index + 1}
                    </span>

                    {/* native radio = the accessible, single-select answer control */}
                    <input
                      type="radio"
                      name={answerRadioName}
                      checked={isCorrect}
                      onChange={() => setCorrectIndex(index)}
                      aria-label={
                        choice.trim()
                          ? `"${choice.trim()}"을(를) 정답으로 선택`
                          : `${index + 1}번 선택지를 정답으로 선택`
                      }
                      className="h-5 w-5 flex-none cursor-pointer accent-[var(--primary)]"
                    />

                    <input
                      type="text"
                      value={choice}
                      onChange={(e) => updateChoice(index, e.target.value)}
                      placeholder={`선택지 ${index + 1}`}
                      className={`h-14 flex-1 ${
                        isDark
                          ? "min-w-0 rounded-[20px] border border-white/12 bg-slate-950/55 px-4 text-base font-bold text-white placeholder:text-white/28 focus-visible:outline-none focus-visible:border-cyan-300/75 focus-visible:shadow-[0_0_0_4px_rgba(103,232,249,0.16)]"
                          : "text-input"
                      }`}
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 sm:shrink-0">
                    {isCorrect && (
                      <span className="inline-flex flex-none items-center rounded-full bg-[var(--primary)] px-2.5 py-1 text-xs font-black text-white">
                        정답
                      </span>
                    )}

                    {choiceTexts.length > MIN_CHOICES && (
                      <button
                        type="button"
                        onClick={() => removeChoice(index)}
                        aria-label={`선택지 ${index + 1} 삭제`}
                        className={`inline-flex h-11 w-11 flex-none items-center justify-center rounded-full ${
                          isDark
                            ? "bg-white/10 text-white/72 hover:bg-white/16 hover:text-white"
                            : "bg-white/70 text-[rgba(38,18,87,0.6)] shadow-[inset_0_1px_0_rgba(255,255,255,0.38)] hover:bg-white hover:text-[var(--panel-text)]"
                        }`}
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="status-banner" data-tone="error">
          {error}
        </p>
      )}
      {success && (
        <p
          className={`rounded-[20px] px-4 py-3 text-sm font-black ${
            isDark
              ? "bg-[rgba(38,137,12,0.2)] text-[#d9ffd0]"
              : "bg-[rgba(38,137,12,0.12)] text-[var(--kahoot-green)]"
          }`}
        >
          {successMessage}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <button type="submit" disabled={submitting} className="primary-button">
          {submitting ? "저장 중..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
