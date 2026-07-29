"use client";

import type { QuestionWithId, RoomQuestionStats } from "@/lib/firestore/questions";
import type { RoomWithId } from "@/types/firestore";
import RecentQuestionsPreview from "./RecentQuestionsPreview";

function roomStatus(stats: RoomQuestionStats | undefined) {
  if (!stats) return { color: "var(--success)", label: "—" };
  if (stats.pending > 0) return { color: "var(--warning)", label: `승인 대기 ${stats.pending}개` };
  if (stats.rejected > 0) return { color: "var(--error)", label: `검토 필요 ${stats.rejected}개` };
  return { color: "var(--success)", label: "모두 승인" };
}

// Inline SVGs keep the dashboard self-contained (no icon dependency) while
// giving each summary card a distinct illustration, per the reference design.
const BellIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

const BookIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 5.5A2.5 2.5 0 0 1 4.5 3H10a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4.5A2.5 2.5 0 0 1 2 14.5z" />
    <path d="M22 5.5A2.5 2.5 0 0 0 19.5 3H14a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h5.5a2.5 2.5 0 0 0 2.5-2.5z" />
  </svg>
);

const ChecklistArt = (
  <svg width="92" height="92" viewBox="0 0 128 128" fill="none" aria-hidden="true">
    <rect x="22" y="20" width="84" height="88" rx="18" fill="rgba(255,255,255,0.05)" />
    <rect x="38" y="40" width="11" height="11" rx="3.5" fill="rgba(255,255,255,0.16)" />
    <rect x="57" y="42" width="36" height="7" rx="3.5" fill="rgba(255,255,255,0.12)" />
    <rect x="38" y="61" width="11" height="11" rx="3.5" fill="rgba(255,255,255,0.16)" />
    <rect x="57" y="63" width="36" height="7" rx="3.5" fill="rgba(255,255,255,0.12)" />
    <rect x="38" y="82" width="11" height="11" rx="3.5" fill="rgba(255,255,255,0.16)" />
    <rect x="57" y="84" width="26" height="7" rx="3.5" fill="rgba(255,255,255,0.12)" />
    <circle cx="98" cy="98" r="15" fill="var(--warning)" />
    <path d="M91 98l4.5 4.5L104 93" stroke="#1c1300" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const BooksArt = (
  <svg width="92" height="92" viewBox="0 0 128 128" fill="none" aria-hidden="true">
    <rect x="34" y="76" width="66" height="17" rx="5" fill="var(--primary)" opacity="0.92" />
    <rect x="30" y="56" width="66" height="17" rx="5" fill="var(--primary)" opacity="0.66" transform="rotate(-4 63 64)" />
    <rect x="38" y="36" width="60" height="17" rx="5" fill="var(--primary)" opacity="0.48" transform="rotate(4 68 44)" />
    <path d="M100 30l2.4 6.2L109 39l-6.6 2.4L100 48l-2.4-6.6L91 39l6.6-2.4z" fill="rgba(255,255,255,0.55)" />
  </svg>
);

const ExternalIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </svg>
);

export default function DashboardHome({
  displayName,
  questions,
  rooms,
  selectedRoomId,
  statsByRoom,
  isGuest,
  onSelectRoom,
  onManageRooms,
  onViewApprovals,
  onStartGame,
}: {
  displayName: string;
  questions: QuestionWithId[];
  rooms: RoomWithId[];
  selectedRoomId: string | null;
  statsByRoom: Record<string, RoomQuestionStats>;
  isGuest: boolean;
  onSelectRoom: (roomId: string) => void;
  onManageRooms: () => void;
  onViewApprovals: () => void;
  onStartGame: () => void;
}) {
  const pendingCount = questions.filter((q) => q.status === "pending").length;
  const approvedCount = questions.filter((q) => q.status === "approved").length;

  const selectedRoom = rooms.find((r) => r.roomId === selectedRoomId) ?? rooms[0] ?? null;
  const selectedTotal =
    (selectedRoom ? statsByRoom[selectedRoom.roomId]?.total : undefined) ?? questions.length;
  const otherRooms = rooms.filter((r) => r.roomId !== selectedRoom?.roomId);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="hero-chip">Dashboard</p>
          <h1 className="display-font text-3xl text-white sm:text-4xl">
            안녕하세요,
            <br className="sm:hidden" /> {displayName} 선생님 👋
          </h1>
          <p className="text-sm text-[color:var(--foreground-muted)]">
            오늘도 멋진 퀴즈를 만들어보세요.
          </p>
        </div>
      </header>

      {/* 내 방 — 현재 방 카드 + 새 방 만들기 */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-white">내 방</h2>
          <button
            type="button"
            onClick={onManageRooms}
            className="inline-flex items-center gap-1 text-sm font-bold text-white/60 transition-colors hover:text-white"
          >
            방 관리로 이동 <span aria-hidden="true">→</span>
          </button>
        </div>

        <div className="flex flex-wrap items-stretch gap-4">
          {/* 현재 사용 중인 방 (내용 크기에 맞춰 w-fit, 게임패드 이미지 없음) */}
          {selectedRoom && (
            <div className="flex min-h-[9rem] w-full flex-col justify-center gap-3 rounded-[22px] border-2 border-[var(--primary)] bg-[color:rgba(50,0,224,0.08)] p-6 sm:w-80">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[var(--primary)] px-3 py-1 text-[0.7rem] font-black uppercase tracking-wide text-white">
                  현재 사용 중
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1 text-xs font-bold text-white/70">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                  </svg>
                  문제 <span className="text-white">{selectedTotal}</span>개
                </span>
              </div>
              <div className="flex items-center gap-3">
                <h3 className="display-font min-w-0 truncate text-2xl text-white sm:text-3xl">
                  {selectedRoom.name}
                </h3>
                <button
                  type="button"
                  onClick={onStartGame}
                  aria-label="게임 시작"
                  title="게임 시작"
                  className="ml-auto flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[var(--error)] text-white shadow-[0_4px_0_var(--error-dark)] transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0.5"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ marginLeft: "2px" }}>
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* 새 방 만들기 (게스트는 방 1개 고정이라 숨김) */}
          {!isGuest && (
            <button
              type="button"
              onClick={onManageRooms}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-[22px] border-2 border-dashed border-white/15 p-5 text-center transition-colors hover:border-white/30 sm:w-64"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--primary)] text-xl font-black text-white">
                +
              </span>
              <span className="text-base font-black text-white">새 방 만들기</span>
              <span className="text-xs text-white/50">새로운 퀴즈 방을 만들어보세요.</span>
            </button>
          )}
        </div>

        {/* 방이 여러 개면 다른 방으로 빠르게 전환 (단일 방/게스트면 표시 안 됨) */}
        {otherRooms.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-bold text-white/40">다른 방:</span>
            {otherRooms.map((r) => {
              const status = roomStatus(statsByRoom[r.roomId]);
              return (
                <button
                  key={r.roomId}
                  type="button"
                  onClick={() => onSelectRoom(r.roomId)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[var(--surface)] px-3.5 py-1.5 text-sm font-bold text-white/75 transition-colors hover:border-white/30 hover:text-white"
                >
                  <span className="h-2 w-2 flex-none rounded-full" style={{ background: status.color }} />
                  {r.name}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 승인 대기 — 앰버 강조, 클릭 시 승인 화면으로 이동 */}
        <button
          type="button"
          onClick={onViewApprovals}
          className="group relative flex items-center justify-between gap-4 overflow-hidden rounded-[26px] border border-white/10 bg-[var(--surface)] p-5 text-left transition-transform duration-150 hover:-translate-y-0.5"
        >
          <div className="relative z-10 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-[var(--warning)] text-[#1c1300]">
                {BellIcon}
              </span>
              <span className="text-lg font-black text-white">승인 대기</span>
              {pendingCount > 0 && (
                <span className="rounded-full bg-[var(--warning-soft)] px-2.5 py-1 text-xs font-black text-[var(--warning)]">
                  확인 필요
                </span>
              )}
            </div>
            <p className="display-font text-4xl text-white">{pendingCount}개</p>
            <p className="text-sm font-semibold text-white/55">학생이 제출한 문제</p>
          </div>
          <div className="relative z-0 hidden flex-none sm:block">{ChecklistArt}</div>
        </button>

        {/* 사용 가능 문제 — 브랜드 블루 */}
        <div className="relative flex items-center justify-between gap-4 overflow-hidden rounded-[26px] border border-white/10 bg-[var(--surface)] p-5 transition-transform duration-150 hover:-translate-y-0.5">
          <div className="relative z-10 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-[var(--primary)] text-white">
                {BookIcon}
              </span>
              <span className="text-lg font-black text-white">사용 가능 문제</span>
            </div>
            <p className="display-font text-4xl text-white">{approvedCount}개</p>
            <p className="text-sm font-semibold text-white/55">게임에 사용할 수 있는 문제</p>
          </div>
          <div className="relative z-0 hidden flex-none sm:block">{BooksArt}</div>
        </div>
      </div>

      <RecentQuestionsPreview questions={questions} onViewAll={onViewApprovals} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[var(--surface)] px-5 py-4">
        <p className="flex min-w-0 items-center gap-2.5 text-sm text-white/70">
          <span className="flex-none rounded-full bg-[var(--warning-soft)] px-2.5 py-1 text-xs font-black text-[var(--warning)]">
            💡 TIP
          </span>
          <span className="min-w-0">제출된 문제는 승인 후 게임에서 사용할 수 있어요!</span>
        </p>
        <span className="inline-flex flex-none items-center gap-1 text-sm font-bold text-white/45">
          도움말 보기 {ExternalIcon}
        </span>
      </div>
    </div>
  );
}
