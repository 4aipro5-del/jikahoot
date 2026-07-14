import type { PlayerWithId } from "@/lib/firestore/games";

const PODIUM_STYLES = [
  "bg-[linear-gradient(180deg,#ffe481,#ffc83d)] text-[#442700] shadow-[0_14px_0_rgba(130,89,0,0.22)]",
  "bg-[linear-gradient(180deg,#eff4ff,#cfd7ef)] text-[#27314f] shadow-[0_14px_0_rgba(63,78,113,0.2)]",
  "bg-[linear-gradient(180deg,#ffd7c4,#ffb288)] text-[#542616] shadow-[0_14px_0_rgba(109,54,31,0.18)]",
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
                  isHighlighted ? "ring-4 ring-white/90" : ""
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
                    ? "border-white/70 bg-white/18 text-white"
                    : "border-white/12 bg-white/8 text-white/86"
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
