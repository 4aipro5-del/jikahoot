"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import QuestionEditorForm from "@/components/QuestionEditorForm";
import { signInStudentAnonymously } from "@/lib/firebase/auth";
import { getRoomCodeInfo, subscribeToRoomCode } from "@/lib/firestore/roomCodes";
import { submitStudentQuestion } from "@/lib/firestore/questions";
import StageSkeleton from "@/components/StageSkeleton";

// Small line/solid icons used only by the submission entry screen below.
function IconSparkle({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l1.9 6.6a2 2 0 0 0 1.5 1.5L22 12l-6.6 1.9a2 2 0 0 0-1.5 1.5L12 22l-1.9-6.6a2 2 0 0 0-1.5-1.5L2 12l6.6-1.9a2 2 0 0 0 1.5-1.5z" />
    </svg>
  );
}

function IconHash() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <line x1="4.5" y1="9" x2="19.5" y2="9" />
      <line x1="4" y1="15" x2="19" y2="15" />
      <line x1="10.5" y1="3.5" x2="8" y2="20.5" />
      <line x1="16" y1="3.5" x2="13.5" y2="20.5" />
    </svg>
  );
}

function IconPerson() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-1.5a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5V21" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

type Step =
  | { kind: "join" }
  | { kind: "submit"; teacherUid: string; code: string; authorUid: string; nickname: string };

export default function SubmitPage() {
  return (
    <Suspense fallback={<StageSkeleton />}>
      <SubmitPageContent />
    </Suspense>
  );
}

function SubmitPageContent() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>({ kind: "join" });
  const [code, setCode] = useState(() => searchParams.get("code")?.trim().toUpperCase() ?? "");
  const [nickname, setNickname] = useState(() => searchParams.get("nickname")?.trim() ?? "");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submissionClosed, setSubmissionClosed] = useState(false);
  const autoJoinTried = useRef(false);

  // While the student is on the writing screen, watch the (student-readable)
  // roomCodes mirror live: the moment the teacher presses 제출 종료, flip to the
  // "제출이 종료되었어요" screen — no need to wait for a submit attempt.
  const submitCode = step.kind === "submit" ? step.code : null;
  useEffect(() => {
    if (!submitCode) return;
    return subscribeToRoomCode(submitCode, (info) => {
      setSubmissionClosed(!!info && !info.submissionOpen);
    });
  }, [submitCode]);

  async function join(trimmedCode: string, trimmedNickname: string) {
    setError(null);
    setJoining(true);
    try {
      const cred = await signInStudentAnonymously();
      const info = await getRoomCodeInfo(trimmedCode);
      if (!info) {
        setError("방 코드를 찾을 수 없어요. 선생님께 다시 확인해 주세요.");
        return;
      }
      if (!info.submissionOpen) {
        setError("문제 제출이 종료되었어요. 선생님께 확인해 주세요.");
        return;
      }
      // start the writing session fresh; the live subscription (effect) takes
      // over from here and flips this true the instant the teacher closes it
      setSubmissionClosed(false);
      setStep({
        kind: "submit",
        teacherUid: info.teacherUid,
        code: trimmedCode,
        authorUid: cred.user.uid,
        nickname: trimmedNickname,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "입장하지 못했습니다.");
    } finally {
      setJoining(false);
    }
  }

  useEffect(() => {
    if (autoJoinTried.current) return;
    if (code && nickname) {
      autoJoinTried.current = true;
      queueMicrotask(() => join(code, nickname));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleJoin(e: FormEvent) {
    e.preventDefault();

    const trimmedCode = code.trim().toUpperCase();
    const trimmedNickname = nickname.trim();
    if (!trimmedCode) {
      setError("방 코드를 입력해 주세요.");
      return;
    }
    if (!trimmedNickname) {
      setError("이름(닉네임)을 입력해 주세요.");
      return;
    }

    join(trimmedCode, trimmedNickname);
  }

  if (step.kind === "submit" && submissionClosed) {
    return (
      <div className="stage-shell">
        <div className="stage-content flex min-h-screen items-center justify-center py-8">
          <div className="paper-panel w-full max-w-xl p-6 text-center sm:p-8">
            <div className="flex flex-col items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--error-soft)] text-[var(--error)]">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M15 9l-6 6M9 9l6 6" />
                </svg>
              </span>
              <h1 className="display-font text-3xl text-[var(--panel-text)] sm:text-4xl">
                문제 제출이 종료되었어요
              </h1>
              <p className="paper-muted text-sm leading-6 sm:text-base">
                선생님이 제출을 종료했어요. 더 이상 문제를 제출할 수 없어요.
              </p>
              <button
                onClick={() => setStep({ kind: "join" })}
                className="secondary-button secondary-button-compact mt-1"
              >
                다른 방 코드로 이동
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step.kind === "submit") {
    return (
      <div className="stage-shell">
        <div className="stage-content flex min-h-screen flex-col justify-center gap-6 py-8">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="hero-chip">Question Lab</p>
                <h1 className="display-font mt-4 text-4xl text-white sm:text-5xl">
                  {step.nickname}님, 문제를 내 볼까요?
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--foreground-muted)] sm:text-base lg:max-w-4xl">
                  제출한 문제는 선생님 확인 후 게임에 반영돼요. 질문과 선택지를 분명하게
                  쓰면 더 재미있는 퀴즈가 돼요.
                </p>
              </div>

              <button
                onClick={() => setStep({ kind: "join" })}
                className="secondary-button secondary-button-compact"
              >
                다른 방 코드로 이동
              </button>
            </div>

            <QuestionEditorForm
              variant="light"
              className="mx-auto max-w-3xl"
              title="문제 만들기"
              submitLabel="선생님께 제출하기"
              successMessage="제출했어요! 선생님 확인을 기다려 주세요."
              onSubmit={async (input) => {
                // Client pre-check (nice UX): re-read the mirror in case the
                // teacher ended the session while the student was writing.
                const info = await getRoomCodeInfo(step.code);
                if (!info || !info.submissionOpen) {
                  throw new Error("문제 제출이 종료되었어요. 선생님께 확인해 주세요.");
                }
                // Firestore Rules are the real gate. If 제출 종료 lands between
                // the pre-check and the write, the create is rejected server-side
                // — translate that permission error into the same friendly text.
                try {
                  await submitStudentQuestion(step.teacherUid, {
                    ...input,
                    authorUid: step.authorUid,
                    authorNickname: step.nickname,
                  });
                } catch (err) {
                  if ((err as { code?: string }).code === "permission-denied") {
                    throw new Error("문제 제출이 종료되었어요. 선생님께 확인해 주세요.");
                  }
                  throw err;
                }
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stage-shell">
      {/* playful floating shapes — purely decorative, never intercept clicks */}
      <div aria-hidden className="pointer-events-none absolute inset-0 select-none overflow-hidden">
        <span className="absolute right-[8%] top-[12%] text-[var(--accent)]">
          <IconSparkle size={26} />
        </span>
        <span className="absolute right-[19%] top-[17%] hidden h-5 w-5 rotate-45 rounded-[6px] bg-[var(--primary)] sm:block" />
        <span className="absolute bottom-[26%] left-[9%] hidden h-6 w-6 rotate-12 rounded-[8px] bg-[var(--warning)] sm:block" />
        <span className="absolute bottom-[13%] left-[27%] text-[var(--primary)]">
          <IconSparkle size={20} />
        </span>
        <span className="absolute bottom-[11%] right-[10%] hidden h-5 w-5 -rotate-12 rounded-[6px] bg-[var(--error)] sm:block" />
      </div>

      <div className="stage-content flex min-h-screen items-center justify-center py-8">
        <div className="grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {/* left: concise intro only */}
          <div className="flex flex-col justify-center gap-5">
            <span className="hero-chip inline-flex items-center gap-2 self-start">
              <IconSparkle size={16} />
              Student Submission
            </span>
            <h1 className="display-font text-5xl leading-[1.05] text-white sm:text-6xl lg:text-7xl">
              우리 반 퀴즈
              <br />
              직접 <span className="text-[var(--accent)]">출제하기</span>
            </h1>
            <p className="max-w-md text-base leading-7 text-[color:var(--foreground-muted)] sm:text-lg">
              선생님이 알려준 방 코드를 입력하고
              <br className="hidden sm:block" /> 문제를 제출해보세요.
            </p>
          </div>

          {/* right: input card only */}
          <div className="w-full">
            <section className="rounded-[28px] border border-white/10 bg-[var(--surface)] p-7 shadow-[var(--shadow-soft)] sm:p-9">
              <form onSubmit={handleJoin} className="flex flex-col gap-6">
                <label className="flex flex-col gap-2.5">
                  <span className="text-[0.95rem] font-bold text-white/90">방 코드</span>
                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 transition focus-within:border-[rgba(244,186,71,0.55)] focus-within:ring-4 focus-within:ring-[rgba(244,186,71,0.16)]">
                    <span className="shrink-0 text-white/35">
                      <IconHash />
                    </span>
                    <input
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="예) ABC123"
                      maxLength={6}
                      className="min-h-[3.6rem] w-full bg-transparent text-base font-bold uppercase tracking-wide text-white placeholder:font-medium placeholder:normal-case placeholder:tracking-normal placeholder:text-white/35 focus:outline-none"
                    />
                  </div>
                </label>

                <label className="flex flex-col gap-2.5">
                  <span className="text-[0.95rem] font-bold text-white/90">이름</span>
                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 transition focus-within:border-[rgba(244,186,71,0.55)] focus-within:ring-4 focus-within:ring-[rgba(244,186,71,0.16)]">
                    <span className="shrink-0 text-white/35">
                      <IconPerson />
                    </span>
                    <input
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="이름을 입력하세요"
                      className="min-h-[3.6rem] w-full bg-transparent text-base font-bold text-white placeholder:font-medium placeholder:text-white/35 focus:outline-none"
                    />
                  </div>
                </label>

                {error && (
                  <p className="status-banner" data-tone="error">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={joining}
                  className="mt-1 inline-flex min-h-[3.9rem] w-full items-center justify-center gap-3 rounded-2xl bg-[var(--warning)] px-6 text-xl font-black text-[var(--panel-text)] shadow-[0_8px_0_var(--warning-dark)] transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-1 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {joining ? (
                    "입장 중..."
                  ) : (
                    <>
                      시작하기
                      <span aria-hidden="true">→</span>
                    </>
                  )}
                </button>
              </form>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
