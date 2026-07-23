"use client";

export type DashboardTab = "dashboard" | "approval" | "game" | "settings";

const NAV_ITEMS: {
  key: DashboardTab;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11 12 4l9 7" />
        <path d="M5 9.5V20h14V9.5" />
      </svg>
    ),
  },
  {
    key: "approval",
    label: "Question",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    key: "game",
    label: "Game",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="8" width="20" height="10" rx="5" />
        <path d="M7 11v4M5 13h4" />
        <circle cx="16" cy="12" r="0.5" fill="currentColor" />
        <circle cx="18" cy="14" r="0.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    key: "settings",
    label: "Settings",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
      </svg>
    ),
  },
];

export default function Sidebar({
  active,
  onSelect,
  pendingCount,
}: {
  active: DashboardTab;
  onSelect: (tab: DashboardTab) => void;
  pendingCount: number;
}) {
  return (
    <aside className="flex w-full flex-col gap-1 border-white/10 bg-[var(--surface)] p-4 lg:h-screen lg:w-64 lg:flex-none lg:border-r lg:p-5">
      <div className="mb-4 flex items-center gap-2 px-2 lg:mb-8">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--primary)] to-[#7b5cff] text-white">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2c.7 3.9 2.4 6.4 6 8-3.6 1.6-5.3 4.1-6 8-.7-3.9-2.4-6.4-6-8 3.6-1.6 5.3-4.1 6-8Z" />
          </svg>
        </span>
        <span className="display-font text-lg text-white">Jikahoot</span>
      </div>

      <nav className="flex flex-row gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              className={`flex flex-none items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors duration-150 ${
                isActive
                  ? "bg-[var(--primary)] text-white"
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="flex h-5 w-5 flex-none items-center justify-center">{item.icon}</span>
              <span className="whitespace-nowrap lg:flex-1 lg:text-left">{item.label}</span>
              {item.key === "approval" && pendingCount > 0 && (
                <span
                  className={`flex-none rounded-full px-2 py-0.5 text-xs font-black ${
                    isActive ? "bg-white/20 text-white" : "bg-[var(--primary)] text-white"
                  }`}
                >
                  {pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
