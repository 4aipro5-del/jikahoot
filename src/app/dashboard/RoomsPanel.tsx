"use client";

import { useState } from "react";
import { MAX_ROOMS_PER_TEACHER } from "@/lib/firestore/rooms";
import type { RoomQuestionStats } from "@/lib/firestore/questions";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import type { RoomWithId } from "@/types/firestore";

function roomStatus(stats: RoomQuestionStats | undefined) {
  if (!stats) return { color: "var(--success)", label: "—" };
  if (stats.pending > 0) return { color: "var(--warning)", label: `승인 대기 ${stats.pending}개` };
  if (stats.rejected > 0) return { color: "var(--error)", label: `검토 필요 ${stats.rejected}개` };
  return { color: "var(--success)", label: "모두 승인" };
}

type Modal =
  | { mode: "create" }
  | { mode: "rename"; room: RoomWithId }
  | { mode: "delete"; room: RoomWithId }
  | null;

export default function RoomsPanel({
  rooms,
  selectedRoomId,
  statsByRoom,
  isGuest,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: {
  rooms: RoomWithId[];
  selectedRoomId: string | null;
  statsByRoom: Record<string, RoomQuestionStats>;
  isGuest: boolean;
  onSelect: (roomId: string) => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (roomId: string, name: string) => Promise<void>;
  onDelete: (room: RoomWithId) => Promise<void>;
}) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [nameInput, setNameInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreate = !isGuest && rooms.length < MAX_ROOMS_PER_TEACHER;

  function openCreate() {
    setNameInput("");
    setError(null);
    setModal({ mode: "create" });
  }
  function openRename(room: RoomWithId) {
    setOpenMenu(null);
    setNameInput(room.name);
    setError(null);
    setModal({ mode: "rename", room });
  }
  function openDelete(room: RoomWithId) {
    setOpenMenu(null);
    setError(null);
    setModal({ mode: "delete", room });
  }

  async function confirmModal() {
    if (!modal || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (modal.mode === "create") {
        await onCreate(nameInput.trim() || "새 방");
      } else if (modal.mode === "rename") {
        await onRename(modal.room.roomId, nameInput.trim() || modal.room.name);
      } else {
        await onDelete(modal.room);
      }
      setModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "처리하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="hero-chip">Rooms</p>
          <h1 className="display-font text-3xl text-white sm:text-4xl">방 관리</h1>
          <p className="text-sm text-[color:var(--foreground-muted)]">
            선생님이 만든 모든 방을 관리할 수 있어요.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          disabled={!canCreate}
          title={
            isGuest
              ? "게스트는 방을 1개만 사용할 수 있어요."
              : rooms.length >= MAX_ROOMS_PER_TEACHER
                ? `방은 최대 ${MAX_ROOMS_PER_TEACHER}개까지 만들 수 있어요.`
                : undefined
          }
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-black text-white shadow-[0_6px_0_var(--primary-dark)] transition-transform duration-150 enabled:hover:-translate-y-0.5 enabled:active:translate-y-1 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="text-lg leading-none">+</span> 새 방 만들기
        </button>
      </header>

      <div className="flex flex-col gap-3">
        {rooms.map((room) => {
          const isSelected = room.roomId === selectedRoomId;
          const stats = statsByRoom[room.roomId];
          const status = roomStatus(stats);
          const dotColor = isSelected ? "var(--primary)" : status.color;
          // a lobby/active game still points at this room — deleting it would
          // strand that game (finishGame later can't update a missing room)
          const hasLiveGame = Boolean(room.currentGameId) && room.currentGameStatus !== "finished";
          const deleteDisabled = rooms.length <= 1 || hasLiveGame;
          return (
            <div
              key={room.roomId}
              className={`flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border bg-[var(--surface)] px-5 py-4 transition-colors ${
                isSelected ? "border-[var(--primary)] shadow-[0_0_0_1px_var(--primary)]" : "border-white/10"
              }`}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: dotColor }} />
                <div className="min-w-0">
                  <p className="truncate text-base font-black text-white">{room.name}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/50">
                    방 코드
                    <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono font-bold tracking-wider text-white/80">
                      {room.roomCode}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-5 text-sm">
                <span className="hidden text-white/70 sm:inline">문제 {stats?.total ?? 0}개</span>
                <span className="hidden text-white/50 md:inline">{status.label}</span>
                <span className="hidden text-white/40 lg:inline">{formatRelativeTime(room.createdAt)}</span>
              </div>

              <div className="flex items-center gap-2">
                {isSelected ? (
                  <span className="rounded-lg bg-[var(--primary)] px-3.5 py-2 text-sm font-black text-white">
                    사용 중
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelect(room.roomId)}
                    className="rounded-lg bg-white/8 px-3.5 py-2 text-sm font-bold text-white transition-colors hover:bg-white/15"
                  >
                    이 방 사용
                  </button>
                )}

                <div className="relative">
                    <button
                      type="button"
                      aria-label="방 메뉴"
                      onClick={() => setOpenMenu((v) => (v === room.roomId ? null : room.roomId))}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <circle cx="5" cy="12" r="1.6" />
                        <circle cx="12" cy="12" r="1.6" />
                        <circle cx="19" cy="12" r="1.6" />
                      </svg>
                    </button>
                    {openMenu === room.roomId && (
                      <>
                        <button
                          type="button"
                          aria-label="메뉴 닫기"
                          onClick={() => setOpenMenu(null)}
                          className="fixed inset-0 z-10 cursor-default"
                        />
                        <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-xl border border-white/10 bg-[var(--surface)] shadow-xl">
                          <button
                            type="button"
                            onClick={() => openRename(room)}
                            className="block w-full px-4 py-2.5 text-left text-sm font-bold text-white hover:bg-white/10"
                          >
                            이름 변경
                          </button>
                          <button
                            type="button"
                            onClick={() => openDelete(room)}
                            disabled={deleteDisabled}
                            title={
                              rooms.length <= 1
                                ? "마지막 방은 삭제할 수 없어요."
                                : hasLiveGame
                                  ? "진행 중인 게임이 있는 방은 삭제할 수 없어요."
                                  : undefined
                            }
                            className="block w-full px-4 py-2.5 text-left text-sm font-bold text-[var(--error)] hover:bg-[var(--error-soft)] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            삭제
                          </button>
                        </div>
                      </>
                    )}
                  </div>
              </div>
            </div>
          );
        })}
      </div>

      {isGuest && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[var(--primary)] text-xs font-black text-white">
              i
            </span>
            <div>
              <p className="text-sm font-bold text-white">게스트 계정은 방을 1개만 이용할 수 있어요.</p>
              <p className="mt-0.5 text-xs leading-5 text-[color:var(--foreground-muted)]">
                여러 개의 방을 만들고 관리하려면 설정에서 구글 계정으로 저장하세요.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/50">
        <Legend color="var(--primary)" label="사용 중 (현재 선택된 방)" />
        <Legend color="var(--warning)" label="승인 대기" />
        <Legend color="var(--error)" label="검토 필요" />
        <Legend color="var(--success)" label="모두 승인" />
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="닫기"
            onClick={() => {
              if (!busy) setModal(null);
            }}
            className="absolute inset-0 cursor-default bg-black/70"
          />
          <div className="relative w-full max-w-sm rounded-[24px] border border-white/10 bg-[var(--surface)] p-6 shadow-2xl">
            {modal.mode === "delete" ? (
              <>
                <h2 className="display-font text-xl text-white">방을 삭제할까요?</h2>
                <p className="mt-2 text-sm leading-6 text-[color:var(--foreground-muted)]">
                  <span className="font-bold text-white">{modal.room.name}</span> 방과 그 안의 문제·제출
                  코드가 모두 삭제돼요. 되돌릴 수 없어요.
                </p>
              </>
            ) : (
              <>
                <h2 className="display-font text-xl text-white">
                  {modal.mode === "create" ? "새 방 만들기" : "방 이름 변경"}
                </h2>
                <input
                  autoFocus
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmModal();
                  }}
                  maxLength={30}
                  placeholder="예: 3학년 1반"
                  className="mt-4 h-11 w-full rounded-xl border border-white/12 bg-white/5 px-4 text-sm font-semibold text-white outline-none focus:border-white/30"
                />
              </>
            )}

            {error && <p className="mt-3 text-xs leading-5 text-[var(--error)]">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                disabled={busy}
                className="rounded-xl px-4 py-2.5 text-sm font-bold text-white/70 hover:bg-white/10 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmModal}
                disabled={busy}
                className={`rounded-xl px-4 py-2.5 text-sm font-black text-white disabled:opacity-60 ${
                  modal.mode === "delete" ? "bg-[var(--error)]" : "bg-[var(--primary)]"
                }`}
              >
                {busy ? "처리 중..." : modal.mode === "delete" ? "삭제" : modal.mode === "create" ? "만들기" : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
