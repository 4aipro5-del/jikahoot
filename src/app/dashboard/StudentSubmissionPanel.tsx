"use client";

import { useEffect, useState } from "react";
import SubmissionQRCode from "@/components/SubmissionQRCode";
import { setSubmissionOpen, subscribeToRoomCode } from "@/lib/firestore/roomCodes";
import type { QuestionWithId } from "@/lib/firestore/questions";

type Submitter = { key: string; nickname: string };

// Distinct students who have submitted, most recent first. `questions` arrives
// ordered by createdAt desc, so first-seen order already means recent-first.
function collectSubmitters(questions: QuestionWithId[]): Submitter[] {
  const seen = new Set<string>();
  const submitters: Submitter[] = [];
  for (const q of questions) {
    if (q.createdBy !== "student") continue;
    const key = q.authorUid ?? q.authorNickname ?? q.id;
    if (seen.has(key)) continue;
    seen.add(key);
    submitters.push({ key, nickname: q.authorNickname ?? "익명 학생" });
  }
  return submitters;
}

export default function StudentSubmissionPanel({
  teacherUid,
  roomCode,
  questions,
  onBack,
}: {
  teacherUid: string;
  roomCode: string;
  questions: QuestionWithId[];
  onBack: () => void;
}) {
  // submissionOpen is the source of truth students read before submitting; keep
  // it live so 제출 종료/열기 reflects immediately and survives a reload.
  const [submissionOpen, setOpen] = useState<boolean | null>(null);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return subscribeToRoomCode(roomCode, (info) => {
      setOpen(info ? info.submissionOpen : true);
    });
  }, [roomCode]);

  const submitters = collectSubmitters(questions);
  const submissionCount = questions.filter((q) => q.createdBy === "student").length;
  const shown = submitters.slice(0, 5);
  const overflow = submitters.length - shown.length;

  async function toggleSubmission() {
    if (submissionOpen === null) return;
    setToggling(true);
    setError(null);
    try {
      await setSubmissionOpen(teacherUid, roomCode, !submissionOpen);
    } catch {
      setError("상태를 변경하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setToggling(false);
    }
  }

  return (
    <section className="flex flex-col gap-6">
      {/* 상단: 뒤로가기 + 중앙 타이틀 */}
      <div className="relative flex items-center">
        <button
          type="button"
          onClick={onBack}
          className="subtle-link inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--primary)]"
        >
          ← 문제 관리로 돌아가기
        </button>
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        <p className="hero-chip">Student Submission</p>
        <h1 className="display-font text-[2.2rem] leading-none text-white sm:text-[2.75rem]">
          학생 문제 제출
        </h1>
        <p className="text-sm leading-6 text-[color:var(--foreground-muted)] sm:text-base">
          학생들에게 아래 QR 코드 또는 제출 코드를 안내해 주세요.
        </p>
      </div>

      {/* 본문: 제출 코드 / QR / 제출 현황 */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* 제출 코드 */}
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-[var(--surface)] px-6 py-10 text-center">
          <p className="text-sm font-semibold text-white/60">제출 코드</p>
          <p className="display-font text-5xl tracking-[0.12em] text-[var(--primary)] sm:text-6xl">
            {roomCode}
          </p>
          <p className="text-sm text-white/55">이 코드를 학생들에게 안내해 주세요.</p>
        </div>

        {/* 제출 QR 코드 */}
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-[var(--surface)] px-6 py-10 text-center">
          <p className="text-sm font-semibold text-white/60">제출 QR 코드</p>
          <SubmissionQRCode roomCode={roomCode} size={172} />
          <p className="text-sm text-white/55">QR 코드를 학생에게 보여주세요.</p>
        </div>

        {/* 제출 현황 */}
        <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[var(--surface)] p-6">
          <p className="text-sm font-semibold text-white/60">제출 현황</p>
          <div>
            <p className="display-font text-4xl text-white">{submitters.length}명</p>
            <p className="mt-1 text-sm text-white/55">
              학생이 문제를 제출했어요{submissionCount > 0 ? ` (총 ${submissionCount}문제)` : ""}.
            </p>
          </div>

          {submitters.length === 0 ? (
            <p className="text-sm text-white/40">아직 제출한 학생이 없어요.</p>
          ) : (
            <ul className="flex flex-wrap gap-x-3 gap-y-4">
              {shown.map((s) => (
                <li key={s.key} className="flex w-12 flex-col items-center gap-1" title={s.nickname}>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary)] text-sm font-black text-white">
                    {s.nickname.trim().slice(0, 1) || "?"}
                  </span>
                  <span className="w-full truncate text-center text-[11px] text-white/60">
                    {s.nickname}
                  </span>
                </li>
              ))}
              {overflow > 0 && (
                <li className="flex w-12 flex-col items-center gap-1">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xs font-black text-white/70">
                    +{overflow}
                  </span>
                  <span className="text-[11px] text-white/60">더보기</span>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      {error && (
        <p className="status-banner" data-tone="error">
          {error}
        </p>
      )}

      {/* 제출 종료 / 다시 열기 */}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-[var(--surface)] px-5 py-4">
        <button
          type="button"
          onClick={toggleSubmission}
          disabled={submissionOpen === null || toggling}
          className={`inline-flex flex-none items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-transform duration-150 enabled:hover:scale-[1.02] disabled:opacity-50 ${
            submissionOpen === false ? "bg-[var(--kahoot-green)]" : "bg-[var(--error)]"
          }`}
        >
          <span
            aria-hidden="true"
            className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-current"
          >
            <span className="h-1.5 w-1.5 rounded-[1px] bg-current" />
          </span>
          {toggling
            ? "처리 중..."
            : submissionOpen === false
              ? "제출 다시 열기"
              : "제출 종료"}
        </button>
        <p className="text-sm text-white/55">
          {submissionOpen === false
            ? "현재 제출이 종료되어 학생들이 문제를 제출할 수 없어요."
            : "제출을 종료하면 더 이상 학생들이 문제를 제출할 수 없어요."}
        </p>
      </div>
    </section>
  );
}
