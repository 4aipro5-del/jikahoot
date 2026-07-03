"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { buildChoices } from "@/lib/firestore/questions";
import type { Choice } from "@/types/firestore";

const MIN_CHOICES = 2;
const MAX_CHOICES = 4;

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
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-lg border border-black/[.08] p-5 dark:border-white/[.145]"
    >
      <h2 className="text-lg font-semibold">{title}</h2>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">문제</span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="예: 대한민국의 수도는 어디일까요?"
          className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          선택지 (정답에 체크)
        </span>
        {choiceTexts.map((choice, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="radio"
              name="correctChoice"
              checked={correctIndex === index}
              onChange={() => setCorrectIndex(index)}
              aria-label={`선택지 ${index + 1}을 정답으로 선택`}
            />
            <input
              value={choice}
              onChange={(e) => updateChoice(index, e.target.value)}
              placeholder={`선택지 ${index + 1}`}
              className="flex-1 rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
            />
            {choiceTexts.length > MIN_CHOICES && (
              <button
                type="button"
                onClick={() => removeChoice(index)}
                className="text-sm text-zinc-500 hover:text-red-600"
              >
                삭제
              </button>
            )}
          </div>
        ))}
        {choiceTexts.length < MAX_CHOICES && (
          <button
            type="button"
            onClick={addChoice}
            className="self-start text-sm font-medium text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white"
          >
            + 선택지 추가
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-700 dark:text-green-400">{successMessage}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
      >
        {submitting ? "저장 중..." : submitLabel}
      </button>
    </form>
  );
}
