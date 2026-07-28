"use client";

import { useState } from "react";
import type { User } from "firebase/auth";
import { signOutUser } from "@/lib/firebase/auth";

export default function AccountMenu({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const isGuest = user.isAnonymous;
  const displayName = user.displayName?.trim() || "선생님";
  const initial = displayName.slice(0, 1) || "T";
  const showPhoto = Boolean(user.photoURL);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full bg-white/5 py-1.5 pl-1.5 pr-3 text-white hover:bg-white/10"
      >
        {showPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.photoURL!} alt="" className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--primary)] text-sm font-black">
            {initial}
          </span>
        )}
        <span className="text-sm font-bold">{displayName} 선생님</span>
        {isGuest && (
          <span className="rounded-full bg-[var(--warning)] px-2 py-0.5 text-[0.7rem] font-black text-[#4a2c00]">
            게스트
          </span>
        )}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="메뉴 닫기"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute right-0 z-20 mt-2 w-40 overflow-hidden rounded-2xl border border-white/10 bg-[var(--surface)] shadow-xl">
            <button
              type="button"
              onClick={() => signOutUser()}
              className="block w-full px-4 py-3 text-left text-sm font-bold text-white hover:bg-white/10"
            >
              로그아웃
            </button>
          </div>
        </>
      )}
    </div>
  );
}
