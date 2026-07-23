"use client";

import { useState } from "react";
import type { Room } from "@/types/firestore";

// Teacher-side settings are wired: display name / answer time / auto-advance /
// Google-photo toggle all persist to the Room doc (via the handlers passed from
// page.tsx) and take effect. The 학생 제출 toggles below also persist, but are
// not yet enforced server-side (that needs firestore.rules changes) — they hold
// the teacher's intent for a later enforcement pass.
const ANSWER_TIMES = [10, 20, 30, 40];

export default function SettingsPanel({
  room,
  onUpdateSettings,
  onUpdateDisplayName,
}: {
  room: Room;
  onUpdateSettings: (patch: Partial<Room>) => Promise<void>;
  onUpdateDisplayName: (name: string) => Promise<void>;
}) {
  const [nameInput, setNameInput] = useState(room.displayName);
  const [savingName, setSavingName] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // controlled from the room, so an optimistic parent update re-syncs these
  const useGooglePhoto = room.useGooglePhoto !== false;
  const answerTime = room.defaultQuestionDurationSec ?? 20;
  const autoAdvance = room.autoAdvance ?? true;
  const allowSubmit = room.allowStudentSubmission !== false;
  const allowEdit = room.allowStudentEdit !== false;
  const submitLimit = room.submissionLimit == null ? "none" : String(room.submissionLimit);

  const nameChanged = nameInput.trim() !== room.displayName && nameInput.trim().length > 0;
  const showPhoto = useGooglePhoto && room.photoUrl;
  const initial = room.displayName.trim().slice(0, 1) || "T";

  async function save(patch: Partial<Room>) {
    setError(null);
    try {
      await onUpdateSettings(patch);
    } catch {
      setError("설정을 저장하지 못했어요. 다시 시도해 주세요.");
    }
  }

  async function saveName() {
    if (!nameChanged) return;
    setError(null);
    setSavingName(true);
    try {
      await onUpdateDisplayName(nameInput.trim());
    } catch {
      setError("이름을 저장하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setSavingName(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="space-y-2">
        <p className="hero-chip">Settings</p>
        <h1 className="display-font text-4xl text-white sm:text-[2.75rem]">설정</h1>
        <p className="text-base text-[color:var(--foreground-muted)]">
          게임과 학생 제출, 계정 관련 설정을 관리하세요.
        </p>
      </header>

      {error && (
        <p className="status-banner text-sm" data-tone="error">
          {error}
        </p>
      )}

      {/* ① 프로필 */}
      <Section
        number={1}
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21a8 8 0 0 0-16 0" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        }
        title="프로필"
        description="계정 정보를 확인하고 프로필을 관리합니다."
      >
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr_1fr]">
          <Field title="표시 이름" description="학생 화면과 대시보드에 이 이름으로 표시됩니다.">
            <div className="flex gap-2">
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={24}
                className="min-w-0 flex-1 rounded-xl border border-white/12 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white outline-none focus:border-white/30"
              />
              <button
                type="button"
                onClick={saveName}
                disabled={!nameChanged || savingName}
                className="flex-none rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-bold text-white transition-transform duration-150 enabled:hover:scale-[1.02] disabled:opacity-40"
              >
                {savingName ? "저장 중" : "저장"}
              </button>
            </div>
          </Field>

          <Field title="프로필 이미지" description="Google 계정의 프로필 사진을 사용합니다.">
            <div className="flex items-center gap-3">
              {showPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={room.photoUrl!} alt="" className="h-11 w-11 flex-none rounded-xl object-cover" />
              ) : (
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-[var(--primary)] text-lg font-black text-white">
                  {initial}
                </span>
              )}
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  checked={useGooglePhoto}
                  onChange={(e) => save({ useGooglePhoto: e.target.checked })}
                  className="mt-0.5 h-4 w-4 flex-none accent-[var(--primary)]"
                />
                <span className="text-sm">
                  <span className="font-semibold text-white">Google 프로필 사진 사용</span>
                  <span className="mt-0.5 block text-xs text-[color:var(--foreground-muted)]">
                    체크 해제 시 기본 이미지가 사용됩니다.
                  </span>
                </span>
              </label>
            </div>
          </Field>

          <Field title="Google 계정" description={room.email || "연결된 Google 계정"}>
            <span className="inline-flex w-fit items-center gap-2 rounded-xl border border-white/12 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white">
              <GoogleMark />
              연결된 계정
            </span>
          </Field>
        </div>
      </Section>

      {/* ② 게임 기본 설정 */}
      <Section
        number={2}
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 12h4M8 10v4M15 11h.01M18 13h.01" />
            <rect x="2" y="6" width="20" height="12" rx="4" />
          </svg>
        }
        title="게임 기본 설정"
        description="게임 진행 방식과 기본값을 설정합니다."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <Field title="답변 시간" description="각 문제의 기본 답변 시간을 설정합니다.">
            <div className="flex flex-wrap gap-2">
              {ANSWER_TIMES.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => save({ defaultQuestionDurationSec: sec })}
                  className="tab-button flex-1"
                  data-active={answerTime === sec}
                >
                  {sec}초
                </button>
              ))}
            </div>
          </Field>

          <Field title="자동 진행" description="답변 시간이 끝나면 다음 문제로 자동 이동합니다.">
            <Toggle checked={autoAdvance} onChange={(v) => save({ autoAdvance: v })} label="자동 진행" />
          </Field>
        </div>
      </Section>

      {/* ③ 학생 제출 설정 */}
      <Section
        number={3}
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 3v5h5M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
          </svg>
        }
        title="학생 제출 설정"
        description="학생들이 문제를 제출하는 방식을 설정합니다."
      >
        <div className="grid gap-6 lg:grid-cols-3">
          <Field title="학생 제출 허용" description="학생들이 문제를 제출할 수 있습니다.">
            <Toggle
              checked={allowSubmit}
              onChange={(v) => save({ allowStudentSubmission: v })}
              label="학생 제출 허용"
            />
          </Field>

          <Field title="제출 후 수정 허용" description="제출한 문제를 수정할 수 있습니다.">
            <Toggle
              checked={allowEdit}
              onChange={(v) => save({ allowStudentEdit: v })}
              label="제출 후 수정 허용"
            />
          </Field>

          <Field title="제출 제한" description="학생이 제출할 수 있는 문제 수를 제한합니다.">
            <div className="relative">
              <select
                value={submitLimit}
                onChange={(e) =>
                  save({ submissionLimit: e.target.value === "none" ? null : Number(e.target.value) })
                }
                className="w-full appearance-none rounded-xl border border-white/12 bg-white/5 px-4 py-2.5 pr-9 text-sm font-semibold text-white outline-none focus:border-white/30"
              >
                <option value="none">제한 없음</option>
                <option value="3">3개</option>
                <option value="5">5개</option>
                <option value="10">10개</option>
              </select>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/50"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
          </Field>
        </div>
      </Section>
    </div>
  );
}

function Section({
  number,
  icon,
  title,
  description,
  children,
}: {
  number: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-[var(--surface)] p-6 sm:p-8">
      <header className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-white/5 text-[var(--accent)]">
          {icon}
        </span>
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] font-black text-black">
              {number}
            </span>
            <h2 className="text-lg font-black text-white">{title}</h2>
          </div>
          <p className="mt-0.5 text-sm text-[color:var(--foreground-muted)]">{description}</p>
        </div>
      </header>
      <div className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 sm:p-6">
        {children}
      </div>
    </section>
  );
}

function Field({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-base font-bold text-white">{title}</p>
        <p className="mt-0.5 truncate text-sm text-[color:var(--foreground-muted)]">{description}</p>
      </div>
      <div className="mt-auto">{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-none items-center rounded-full transition-colors duration-150 ${
        checked ? "bg-[var(--primary)]" : "bg-white/15"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-150 ${
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17Z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7A21.99 21.99 0 0 0 24 46Z" />
      <path fill="#FBBC05" d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7Z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.94 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07Z" />
    </svg>
  );
}
