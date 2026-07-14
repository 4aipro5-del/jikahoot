"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { buildChoices } from "@/lib/firestore/questions";
import type { Choice } from "@/types/firestore";

const MIN_CHOICES = 2;
const MAX_CHOICES = 4;
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
}: {
  title: string;
  submitLabel: string;
  successMessage: string;
  onSubmit: (input: { text: string; choices: Choice[]; correctChoiceId: string }) => Promise<unknown>;
}) {
  const [text, setText] = useState("");
  const [choiceTexts, setChoiceTexts] = useState(["", ""]);
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
    setChoiceTexts(["", ""]);
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
      setError("정답을 선택해 주세요.");
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
    <form onSubmit={handleSubmit} className="paper-panel flex flex-col gap-6 p-6 sm:p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="hero-chip hero-chip-paper w-full">Quiz Builder</p>
        <h2 className="display-font text-[2rem] leading-none text-[var(--panel-text)] sm:text-[2.4rem]">
          {title}
        </h2>
        <p className="paper-muted w-full text-left text-sm leading-6 sm:text-base">
          질문은 짧고 선명하게, 선택지는 헷갈리지 않게 써 주면 실제 게임 화면에서도 더
          잘 보여요.
        </p>
      </div>

      <label className="flex flex-col gap-2">
        <span className="paper-subtle text-sm font-black uppercase tracking-[0.18em]">
          Question
        </span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="예: 대한민국의 수도는 어디일까요?"
          className="text-area min-h-28"
          rows={3}
        />
      </label>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="paper-subtle text-sm font-black uppercase tracking-[0.18em]">
              Choices
            </span>
            <p className="paper-muted mt-1 text-sm font-semibold">
              정답 버튼을 눌러 정답 선택지를 지정하세요.
            </p>
          </div>

          {choiceTexts.length < MAX_CHOICES && (
            <button
              type="button"
              onClick={addChoice}
              className="rounded-full bg-[var(--kahoot-purple)] px-4 py-2 text-sm font-black text-white shadow-[0_8px_0_rgba(39,12,80,0.22)]"
            >
              + 선택지 추가
            </button>
          )}
        </div>

        <div className="grid gap-3">
          {choiceTexts.map((choice, index) => {
            const theme = CHOICE_THEMES[index % CHOICE_THEMES.length];
            const isCorrect = correctIndex === index;

            return (
              <div
                key={index}
                className={`rounded-[24px] border border-[rgba(38,18,87,0.1)] p-4 ${theme.panel}`}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-sm font-black ${theme.badge}`}
                    >
                      {index + 1}
                    </span>
                    <p className="paper-muted text-sm font-black">
                      선택지 {index + 1}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCorrectIndex(index)}
                      className={`rounded-full px-4 py-2 text-sm font-black ${
                        isCorrect
                          ? "bg-[var(--kahoot-green)] text-white"
                          : "bg-white text-[var(--kahoot-purple)]"
                      }`}
                    >
                      {isCorrect ? "정답" : "정답으로 지정"}
                    </button>

                    {choiceTexts.length > MIN_CHOICES && (
                      <button
                        type="button"
                        onClick={() => removeChoice(index)}
                        className="rounded-full bg-[rgba(226,27,60,0.12)] px-3 py-2 text-sm font-black text-[var(--kahoot-red)]"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </div>

                <input
                  value={choice}
                  onChange={(e) => updateChoice(index, e.target.value)}
                  placeholder={`선택지 ${index + 1}`}
                  className="text-input"
                />
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
        <p className="rounded-[20px] bg-[rgba(38,137,12,0.12)] px-4 py-3 text-sm font-black text-[var(--kahoot-green)]">
          {successMessage}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={submitting} className="primary-button">
          {submitting ? "저장 중..." : submitLabel}
        </button>
        <p className="paper-subtle text-sm font-semibold">
          최대 4개의 선택지를 만들 수 있어요.
        </p>
      </div>
    </form>
  );
}
