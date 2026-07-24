"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import SubmissionQRCode, { buildSubmitUrl } from "@/components/SubmissionQRCode";
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

const CopyIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="11" height="11" rx="2.5" />
    <path d="M5 15V5a2 2 0 0 1 2-2h8" />
  </svg>
);
const DownloadIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12" />
    <path d="m7 11 5 5 5-5" />
    <path d="M5 21h14" />
  </svg>
);
const PeopleIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const DocIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="M9 13h6M9 17h4" />
  </svg>
);
const StopIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <rect x="9" y="9" width="6" height="6" rx="1.5" />
  </svg>
);
const RefreshIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    <path d="M3 21v-5h5" />
  </svg>
);

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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    return subscribeToRoomCode(roomCode, (info) => {
      setOpen(info ? info.submissionOpen : true);
    });
  }, [roomCode]);

  const submitters = collectSubmitters(questions);
  const submissionCount = questions.filter((q) => q.createdBy === "student").length;

  async function handleSetOpen(next: boolean) {
    if (submissionOpen === null || submissionOpen === next || toggling) return;
    setToggling(true);
    setError(null);
    try {
      await setSubmissionOpen(teacherUid, roomCode, next);
    } catch {
      setError("상태를 변경하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setToggling(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("코드를 복사하지 못했어요.");
    }
  }

  async function handleDownloadQR() {
    const url = buildSubmitUrl(roomCode);
    if (!url) return;
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 640,
        margin: 2,
        color: { dark: "#18161f", light: "#ffffff" },
      });
      const anchor = document.createElement("a");
      anchor.href = dataUrl;
      anchor.download = `제출코드-${roomCode}.png`;
      anchor.click();
    } catch {
      setError("QR 코드를 내려받지 못했어요.");
    }
  }

  return (
    <section className="flex flex-col gap-6">
      {/* 상단: 뒤로가기 */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#B3B3B3] transition-colors duration-150 hover:text-white"
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
          학생들에게 아래 제출 코드 또는 QR 코드를 안내해 주세요.
        </p>
      </div>

      {/* 본문: 제출 코드 / QR / 제출 현황 */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* 제출 코드 */}
        <div className="flex flex-col rounded-2xl border border-white/10 bg-[var(--surface)] p-6 text-center sm:p-7">
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <p className="text-sm font-semibold text-white/60">제출 코드</p>
            <p className="display-font text-5xl tracking-[0.12em] text-white sm:text-6xl">
              {roomCode}
            </p>
            <p className="text-sm text-white/55">이 코드를 학생들에게 안내해 주세요.</p>
          </div>
          <div className="mt-6 border-t border-white/[0.08] pt-5">
            <button
              type="button"
              onClick={handleCopy}
              className="mx-auto inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.06] px-5 py-2.5 text-sm font-bold text-white transition-colors duration-150 hover:bg-white/12"
            >
              {CopyIcon}
              {copied ? "복사됨" : "복사하기"}
            </button>
          </div>
        </div>

        {/* 제출 QR 코드 */}
        <div className="flex flex-col rounded-2xl border border-white/10 bg-[var(--surface)] p-6 text-center sm:p-7">
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <p className="text-sm font-semibold text-white/60">제출 QR 코드</p>
            <SubmissionQRCode roomCode={roomCode} size={168} />
            <p className="text-sm text-white/55">QR 코드를 학생들에게 보여주세요.</p>
          </div>
          <div className="mt-6 pt-5">
            <button
              type="button"
              onClick={handleDownloadQR}
              className="mx-auto inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.06] px-5 py-2.5 text-sm font-bold text-white transition-colors duration-150 hover:bg-white/12"
            >
              {DownloadIcon}
              이미지 다운로드
            </button>
          </div>
        </div>

        {/* 제출 현황 */}
        <div className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-[var(--surface)] p-6 sm:p-7">
          <p className="text-sm font-semibold text-white/60">제출 현황</p>

          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-[var(--primary)] text-white">
              {PeopleIcon}
            </span>
            <div>
              <p className="text-sm text-white/60">제출 학생</p>
              <p className="display-font text-3xl text-white">
                {submitters.length}명
              </p>
            </div>
          </div>

          <div className="border-t border-white/[0.08]" />

          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-[var(--warning)] text-[#4a2c00]">
              {DocIcon}
            </span>
            <div>
              <p className="text-sm text-white/60">총 제출 문제</p>
              <p className="display-font text-3xl text-white">
                {submissionCount}개
              </p>
            </div>
          </div>

          <p className="mt-auto flex items-center gap-2 text-sm text-white/55">
            <span className="h-2 w-2 flex-none rounded-full bg-[var(--success)]" />
            실시간으로 업데이트 중입니다.
          </p>
        </div>
      </div>

      {error && (
        <p className="status-banner" data-tone="error">
          {error}
        </p>
      )}

      {/* 제출 종료 / 다시 열기 */}
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[var(--surface)] px-5 py-4 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => handleSetOpen(false)}
          disabled={submissionOpen === null || submissionOpen === false || toggling}
          className="inline-flex flex-none items-center justify-center gap-2 rounded-xl bg-[var(--error)] px-5 py-2.5 text-sm font-bold text-white transition-transform duration-150 enabled:hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {StopIcon}
          {toggling && submissionOpen !== false ? "처리 중..." : "제출 종료"}
        </button>

        <p className="flex-1 text-sm text-white/55 sm:px-2">
          {submissionOpen === false
            ? "현재 제출이 종료되어 학생들이 문제를 제출할 수 없어요."
            : "제출을 종료하면 더 이상 학생들이 문제를 제출할 수 없어요."}
        </p>

        <button
          type="button"
          onClick={() => handleSetOpen(true)}
          disabled={submissionOpen === null || submissionOpen === true || toggling}
          className="inline-flex flex-none items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.06] px-5 py-2.5 text-sm font-bold text-white transition-colors duration-150 enabled:hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {RefreshIcon}
          {toggling && submissionOpen === false ? "처리 중..." : "제출 다시 열기"}
        </button>
      </div>
    </section>
  );
}
