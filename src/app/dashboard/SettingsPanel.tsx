"use client";

import { useState } from "react";
import type { Room } from "@/types/firestore";

// Teacher-side settings are wired: display name / answer time / auto-advance /
// Google-photo toggle all persist to the Room doc (via the handlers passed from
// page.tsx) and take effect. 학생 제출 여부는 여기서 다루지 않고 Question 탭의
// 학생 문제 제출 관리 화면에서 제출 종료/열기(roomCodes.submissionOpen)로만 제어한다.
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
    <div className="flex flex-col gap-4">
      <header className="space-y-1">
        <p className="hero-chip">Settings</p>
        <h1 className="display-font text-3xl text-white sm:text-4xl">설정</h1>
        <p className="text-sm text-[color:var(--foreground-muted)]">
          게임과 계정 관련 설정을 관리하세요.
        </p>
      </header>

      {error && (
        <p className="status-banner text-sm" data-tone="error">
          {error}
        </p>
      )}

      {/* ① 프로필 — full-width, horizontal */}
      <Section
        number={1}
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21a8 8 0 0 0-16 0" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        }
        title="프로필"
        description="계정 정보를 확인하고 프로필을 관리합니다."
      >
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          {/* 표시 이름 + 저장 (하나의 입력 그룹) */}
          <div className="flex min-w-[240px] flex-1 flex-col gap-1.5">
            <span className="text-xs font-bold text-white/70">표시 이름</span>
            <div className="flex">
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={24}
                className="h-11 min-w-0 flex-1 rounded-l-xl border border-r-0 border-white/12 bg-white/5 px-4 text-sm font-semibold text-white outline-none focus:border-white/30"
              />
              <button
                type="button"
                onClick={saveName}
                disabled={!nameChanged || savingName}
                className="h-11 flex-none rounded-r-xl bg-[var(--primary)] px-4 text-sm font-bold text-white transition-transform duration-150 enabled:hover:scale-[1.02] disabled:opacity-40"
              >
                {savingName ? "저장 중" : "저장"}
              </button>
            </div>
          </div>

          {/* 프로필 이미지 + Google 프로필 사진 사용 */}
          <div className="flex items-center gap-3">
            {showPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={room.photoUrl!} alt="" className="h-11 w-11 flex-none rounded-xl object-cover" />
            ) : (
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-[var(--primary)] text-lg font-black text-white">
                {initial}
              </span>
            )}
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={useGooglePhoto}
                onChange={(e) => save({ useGooglePhoto: e.target.checked })}
                className="h-4 w-4 flex-none accent-[var(--primary)]"
              />
              <span className="text-sm font-semibold text-white">Google 프로필 사진 사용</span>
            </label>
          </div>

          {/* Google 계정 이메일 */}
          <div className="flex items-center gap-2 text-sm">
            <GoogleMark />
            <span className="font-semibold text-[color:var(--foreground-muted)]">
              {room.email || "연결된 Google 계정"}
            </span>
          </div>
        </div>
      </Section>

      {/* ② 게임 기본 설정 */}
      <Section
        number={2}
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 12h4M8 10v4M15 11h.01M18 13h.01" />
            <rect x="2" y="6" width="20" height="12" rx="4" />
          </svg>
        }
        title="게임 기본 설정"
        description="게임 진행 방식과 기본값을 설정합니다."
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-bold text-white">답변 시간</p>
            <div className="flex gap-2">
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
          </div>

          <Row title="자동 진행" description="답변 시간이 끝나면 다음 문제로 자동 이동합니다.">
            <Toggle checked={autoAdvance} onChange={(v) => save({ autoAdvance: v })} label="자동 진행" />
          </Row>
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
    <section className="rounded-2xl border border-white/10 bg-[var(--surface)] p-5">
      <header className="flex items-center gap-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-white/5 text-[var(--accent)]">
          {icon}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] font-black text-black">
              {number}
            </span>
            <h2 className="text-base font-black text-white">{title}</h2>
          </div>
          <p className="mt-0.5 truncate text-xs text-[color:var(--foreground-muted)]">{description}</p>
        </div>
      </header>
      <div className="mt-4">{children}</div>
    </section>
  );
}

// A compact "label (+ desc) on the left, control on the right" row.
function Row({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-bold text-white">{title}</p>
        <p className="mt-0.5 truncate text-xs text-[color:var(--foreground-muted)]">{description}</p>
      </div>
      <div className="flex-none">{children}</div>
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
