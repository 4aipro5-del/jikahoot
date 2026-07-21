import type { PlayerWithId } from "@/lib/firestore/games";

const PODIUM_STYLES = [
  "border border-[rgba(88,204,2,0.16)] bg-[#e8f9d8] text-[var(--panel-text)] shadow-[0_14px_0_rgba(88,204,2,0.18)]",
  "border border-[rgba(28,176,246,0.14)] bg-[#edf6ff] text-[var(--panel-text)] shadow-[0_14px_0_rgba(28,176,246,0.12)]",
  "border border-[rgba(255,200,0,0.16)] bg-[#fff5dd] text-[#5a4600] shadow-[0_14px_0_rgba(216,158,0,0.12)]",
];

export default function Leaderboard({
  players,
  highlightPlayerId,
}: {
  players: PlayerWithId[];
  highlightPlayerId?: string;
}) {
  const ranked = [...players].sort((a, b) => b.totalScore - a.totalScore);
  const topThree = ranked.slice(0, 3);
  const rest = ranked.slice(3);

  return (
    <div className="flex w-full flex-col gap-5">
      {topThree.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {topThree.map((player, index) => {
            const isHighlighted = player.id === highlightPlayerId;
            return (
              <div
                key={player.id}
                className={`rounded-[30px] p-5 ${PODIUM_STYLES[index]} ${
                  isHighlighted ? "ring-4 ring-[rgba(88,204,2,0.36)]" : ""
                }`}
              >
                <p className="text-sm font-black uppercase tracking-[0.22em]">
                  {index + 1} Place
                </p>
                <p className="display-font mt-3 text-3xl leading-none">{player.nickname}</p>
                <p className="mt-4 text-5xl font-black leading-none">{player.totalScore}</p>
                <p className="mt-2 text-sm font-bold">
                  points{isHighlighted ? " · 나" : ""}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {rest.length > 0 && (
        <ol className="flex flex-col gap-3">
          {rest.map((player, index) => {
            const isHighlighted = player.id === highlightPlayerId;
            return (
              <li
                key={player.id}
                className={`flex items-center justify-between rounded-[24px] border px-4 py-4 ${
                  isHighlighted
                    ? "border-[rgba(88,204,2,0.26)] bg-[rgba(232,249,216,0.94)] text-[var(--panel-text)]"
                    : "border-[rgba(88,204,2,0.12)] bg-white/90 text-[rgba(36,51,17,0.86)]"
                }`}
              >
                <span className="text-base font-black">
                  {index + 4}. {player.nickname}
                  {isHighlighted ? " (나)" : ""}
                </span>
                <span className="display-font text-2xl">{player.totalScore}점</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
