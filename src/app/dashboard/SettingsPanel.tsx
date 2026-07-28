"use client";

import { useState } from "react";
import type { User } from "firebase/auth";
import { clearGuestTeacher, linkTeacherWithGoogle } from "@/lib/firebase/auth";
import type { RoomWithId } from "@/types/firestore";

// Teacher-side settings are wired: display name / answer time / auto-advance /
// Google-photo toggle all persist to the Room doc (via the handlers passed from
// page.tsx) and take effect. 학생 제출 여부는 여기서 다루지 않고 Question 탭의
// 학생 문제 제출 관리 화면에서 제출 종료/열기(roomCodes.submissionOpen)로만 제어한다.
const ANSWER_TIMES = [10, 20, 30, 40];

export default function SettingsPanel({
  room,
  user,
  onUpdateSettings,
  onUpdateDisplayName,
}: {
  room: RoomWithId;
  user: User;
  onUpdateSettings: (patch: Partial<RoomWithId>) => Promise<void>;
  onUpdateDisplayName: (name: string) => Promise<void>;
}) {
  const currentName = user.displayName?.trim() ?? "";
  const [nameInput, setNameInput] = useState(currentName);
  const [savingName, setSavingName] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  const isGuest = user.isAnonymous;
  const answerTime = room.defaultQuestionDurationSec ?? 20;
  const autoAdvance = room.autoAdvance ?? true;
  // 프로필(사진/이름/이메일)은 Firebase Auth가 단일 출처 — room이 아니라 user에서 읽는다.
  const showPhoto = Boolean(user.photoURL);
  const initial = (currentName.trim()[0] ?? "?").toUpperCase();

  const nameChanged = nameInput.trim() !== currentName && nameInput.trim().length > 0;

  // 게스트(익명) → 영구 구글 계정. linkWithPopup은 uid를 유지해 방/문제/게임이
  // 그대로 승계된다. 구글 프로필을 방에 동기화하고 게스트 마커를 지운 뒤 새로고침.
  async function handleUpgrade() {
    if (upgrading) return;
    setUpgradeError(null);
    setUpgrading(true);
    try {
      await linkTeacherWithGoogle(user);
      // profile now comes straight from Firebase Auth (the linked Google
      // account), so there's nothing to sync into Firestore — just drop the
      // guest marker and reload to reflect the upgraded account.
      clearGuestTeacher();
      window.location.reload();
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        setUpgradeError(null);
      } else if (code === "auth/credential-already-in-use" || code === "auth/email-already-in-use") {
        // 이 구글 계정은 이미 다른 UID의 소유. 여기서 로그아웃/재로그인하면 게스트
        // UID에 묶인 방·문제·게임에 더는 접근할 수 없어 데이터가 유실된다. 그러니
        // 유실을 유발하는 '로그아웃 후 로그인' 안내는 하지 않고, 게스트 세션을 그대로
        // 유지시킨 채(데이터 보존) 안전한 방법만 안내한다.
        setUpgradeError(
          "이 구글 계정은 이미 다른 방에 사용 중이에요. 지금 만든 내용을 그대로 옮기려면 아직 사용하지 않은 다른 구글 계정으로 저장해 주세요. (이 계정으로 로그인하면 지금 게스트 내용은 함께 옮겨지지 않아요.)",
        );
      } else {
        setUpgradeError(err instanceof Error ? err.message : "구글 계정 연결에 실패했어요.");
      }
      setUpgrading(false);
    }
  }

  async function save(patch: Partial<RoomWithId>) {
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
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21a8 8 0 0 0-16 0" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        }
        title="프로필"
        description="계정 정보를 확인하고 프로필을 관리합니다."
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-6">
            {/* 표시 이름 + 저장 (좌측) */}
            <div className="flex min-w-[240px] max-w-md flex-1 flex-col gap-2">
              <span className="text-base font-bold text-white/70">표시 이름</span>
              <p className="text-sm text-[color:var(--foreground-muted)]">
                학생 화면과 대시보드에 이 이름으로 표시됩니다.
              </p>
              <div className="mt-1 flex">
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  maxLength={24}
                  className="h-14 min-w-0 flex-1 rounded-l-xl border border-r-0 border-white/12 bg-white/5 px-5 text-lg font-semibold text-white outline-none focus:border-white/30"
                />
                <button
                  type="button"
                  onClick={saveName}
                  disabled={!nameChanged || savingName}
                  className="h-14 flex-none rounded-r-xl bg-[var(--primary)] px-6 text-lg font-bold text-white transition-transform duration-150 enabled:hover:scale-[1.02] disabled:opacity-40"
                >
                  {savingName ? "저장 중" : "저장"}
                </button>
              </div>
            </div>

            {/* 프로필 이미지 (구글 로그인) */}
            {!isGuest && (
              <div className="flex flex-col gap-2">
                <span className="text-base font-bold text-white/70">프로필 이미지</span>
                <p className="text-sm text-[color:var(--foreground-muted)]">
                  Google 계정의 프로필 사진을 사용합니다.
                </p>
                <div className="mt-1 flex items-center gap-3">
                  {showPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.photoURL!}
                      alt=""
                      className="h-14 w-14 flex-none rounded-xl object-cover"
                    />
                  ) : (
                    <span className="flex h-14 w-14 flex-none items-center justify-center rounded-xl bg-[var(--primary)] text-xl font-black text-white">
                      {initial}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Google 계정 (구글 로그인) */}
            {!isGuest && (
              <div className="flex flex-col gap-2">
                <span className="text-base font-bold text-white/70">Google 계정</span>
                <p className="text-base text-white/80">{user.email || "연결된 Google 계정"}</p>
                <span className="mt-1 inline-flex w-fit items-center gap-2 rounded-xl border border-white/12 bg-white/[0.06] px-4 py-2.5 text-base font-bold text-white">
                  <GoogleMark />
                  연결된 계정
                </span>
              </div>
            )}

            {/* 게스트: 구글 저장 버튼(우측, 입력창과 상단 정렬) + 그 밑 설명 */}
            {isGuest && (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleUpgrade}
                  disabled={upgrading}
                  className="inline-flex h-14 flex-none items-center justify-center gap-2.5 rounded-xl bg-[var(--primary)] px-6 text-lg font-black text-white shadow-[0_6px_0_var(--primary-dark)] transition-transform duration-150 enabled:hover:-translate-y-0.5 enabled:active:translate-y-1 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <GoogleMark />
                  {upgrading ? "연결 중..." : "구글 계정으로 저장하기"}
                </button>
                <p className="max-w-md text-base leading-7 text-[color:var(--foreground-muted)]">
                  지금은 이 브라우저에서만 유지돼요. 구글 계정으로 저장하면 다른 기기에서도
                  이어서 관리할 수 있고, 방·문제·게임이 그대로 옮겨져요.
                </p>
              </div>
            )}
          </div>

          {isGuest && upgradeError && (
            <p className="text-base leading-7 text-[var(--error)]">{upgradeError}</p>
          )}
        </div>
      </Section>

      {/* ② 게임 기본 설정 */}
      <Section
        number={2}
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 12h4M8 10v4M15 11h.01M18 13h.01" />
            <rect x="2" y="6" width="20" height="12" rx="4" />
          </svg>
        }
        title="게임 기본 설정"
        description="게임 진행 방식과 기본값을 설정합니다."
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2.5">
            <p className="text-lg font-bold text-white">답변 시간</p>
            <div className="flex gap-2">
              {ANSWER_TIMES.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => save({ defaultQuestionDurationSec: sec })}
                  className={`flex-1 rounded-full px-4 py-3.5 text-lg font-black transition-colors duration-150 ${
                    answerTime === sec
                      ? "bg-[var(--primary)] text-white shadow-[0_8px_20px_rgba(50,0,224,0.35)]"
                      : "bg-white/[0.08] text-white/[0.66] hover:text-white"
                  }`}
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
    <section className="rounded-2xl border border-white/10 bg-[var(--surface)] p-7">
      <header className="flex items-center gap-4">
        <span className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-white/5 text-[var(--accent)]">
          {icon}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-black text-black">
              {number}
            </span>
            <h2 className="text-xl font-black text-white">{title}</h2>
          </div>
          <p className="mt-1 truncate text-base text-[color:var(--foreground-muted)]">{description}</p>
        </div>
      </header>
      <div className="mt-6">{children}</div>
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
        <p className="text-lg font-bold text-white">{title}</p>
        <p className="mt-1 truncate text-base text-[color:var(--foreground-muted)]">{description}</p>
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
    <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17Z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7A21.99 21.99 0 0 0 24 46Z" />
      <path fill="#FBBC05" d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7Z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.94 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07Z" />
    </svg>
  );
}
