"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import QuestionEditorForm from "@/components/QuestionEditorForm";
import { signInStudentAnonymously } from "@/lib/firebase/auth";
import { getRoomCodeInfo, subscribeToRoomCode } from "@/lib/firestore/roomCodes";
import { submitStudentQuestion } from "@/lib/firestore/questions";
import StageSkeleton from "@/components/StageSkeleton";
import StudentJoinScreen from "@/components/StudentJoinScreen";
import { IconShield } from "@/components/student-ui";

type Step =
  | { kind: "join" }
  | { kind: "submit"; roomId: string; code: string; authorUid: string; nickname: string };

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
        roomId: info.roomId,
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
              className="w-full"
              twoColumnChoices
              hideTitle
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
                  await submitStudentQuestion(step.roomId, {
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
    <StudentJoinScreen
      accent="create"
      eyebrow="Create"
      eyebrowIcon={
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      }
      titleTop="우리 반 퀴즈"
      titleAccent="만들기"
      description="방 코드를 입력하고 우리 반 퀴즈를 만들어보세요."
      codeLabel="방 코드"
      codePlaceholder="선생님이 알려주신 방 코드 6자리를 입력하세요."
      code={code}
      onCodeChange={setCode}
      nickname={nickname}
      onNicknameChange={setNickname}
      onSubmit={handleJoin}
      submitting={joining}
      submitLabel="GO"
      submitTextClassName="text-4xl"
      error={error}
      noteIcon={<IconShield />}
      noteTitle="제출한 퀴즈는 선생님 확인 후 사용됩니다."
      noteMuted
    />
  );
}
