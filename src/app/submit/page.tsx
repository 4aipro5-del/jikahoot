"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import QuestionEditorForm from "@/components/QuestionEditorForm";
import { signInStudentAnonymously } from "@/lib/firebase/auth";
import { resolveRoomCode } from "@/lib/firestore/roomCodes";
import { submitStudentQuestion } from "@/lib/firestore/questions";

type Step =
  | { kind: "join" }
  | { kind: "submit"; teacherUid: string; authorUid: string; nickname: string };

export default function SubmitPage() {
  return (
    <Suspense fallback={<SubmitPageFallback />}>
      <SubmitPageContent />
    </Suspense>
  );
}

function SubmitPageFallback() {
  return (
    <div className="stage-shell">
        <div className="stage-content flex min-h-screen items-center justify-center">
          <div className="quiz-panel px-6 py-5 text-center">
            <p className="paper-muted">제출 화면 준비 중...</p>
          </div>
        </div>
    </div>
  );
}

function SubmitPageContent() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>({ kind: "join" });
  const [code, setCode] = useState(() => searchParams.get("code")?.trim().toUpperCase() ?? "");
  const [nickname, setNickname] = useState(() => searchParams.get("nickname")?.trim() ?? "");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoJoinTried = useRef(false);

  async function join(trimmedCode: string, trimmedNickname: string) {
    setError(null);
    setJoining(true);
    try {
      const cred = await signInStudentAnonymously();
      const teacherUid = await resolveRoomCode(trimmedCode);
      if (!teacherUid) {
        setError("방 코드를 찾을 수 없어요. 선생님께 다시 확인해 주세요.");
        return;
      }
      setStep({ kind: "submit", teacherUid, authorUid: cred.user.uid, nickname: trimmedNickname });
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
              onSubmit={(input) =>
                submitStudentQuestion(step.teacherUid, {
                  ...input,
                  authorUid: step.authorUid,
                  authorNickname: step.nickname,
                })
              }
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stage-shell">
      <div className="stage-content flex min-h-screen items-center justify-center py-8">
        <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1fr_0.92fr]">
          <div className="flex flex-col justify-between gap-8 py-2">
            <div className="space-y-4">
              <span className="hero-chip">Student Submission</span>
              <h1 className="display-font text-5xl leading-none text-white sm:text-6xl">
                우리 반 퀴즈도
                <br />
                직접 출제.
              </h1>
              <p className="max-w-xl text-base leading-7 text-[color:var(--foreground-muted)] sm:text-lg">
                학생이 직접 낸 문제를 선생님이 승인한 뒤 게임에 포함할 수 있어요.
                참여감이 확 올라가는 흐름으로 구성했습니다.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ["학생 참여", "문제를 만드는 순간부터 수업 몰입도가 높아져요"],
                ["선생님 승인", "제출 후 바로 공개되지 않고 확인 과정을 거쳐요"],
                ["같은 무드", "입장부터 제출까지 한 화면 톤으로 이어집니다"],
              ].map(([title, desc]) => (
                <div key={title} className="rounded-[24px] bg-[var(--surface)] p-4">
                  <p className="display-font text-lg text-white">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--foreground-muted)]">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <section className="paper-panel kahoot-spectrum-paper p-6 sm:p-8">
            <div className="flex flex-col gap-5">
              <div>
                <p className="hero-chip hero-chip-paper">Enter Room</p>
                <h2 className="display-font mt-4 text-4xl text-[var(--panel-text)] sm:text-5xl">
                  방 코드 입력
                </h2>
                <p className="paper-muted mt-2 text-sm leading-6 sm:text-base">
                  선생님 방 코드와 이름을 입력하면 문제 제출 화면으로 들어가요.
                </p>
              </div>

              <form onSubmit={handleJoin} className="flex flex-col gap-4">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="방 코드 6자리"
                  className="text-input code-input"
                  maxLength={6}
                />
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="이름(닉네임)"
                  className="text-input"
                />

                {error && (
                  <p className="status-banner" data-tone="error">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={joining}
                  className="primary-button w-full"
                >
                  {joining ? "입장 중..." : "문제 제출하러 가기"}
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
