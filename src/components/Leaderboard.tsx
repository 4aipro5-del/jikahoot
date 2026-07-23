import type { PlayerWithId } from "@/lib/firestore/games";

export default function Leaderboard({
  players,
  highlightPlayerId,
}: {
  players: PlayerWithId[];
  highlightPlayerId?: string;
}) {
  const ranked = [...players].sort((a, b) => b.totalScore - a.totalScore);
  const champion = ranked[0];
  const runnersUp = ranked.slice(1, 3);
  const rest = ranked.slice(3);

  return (
    <div className="flex w-full flex-col gap-4">
      {champion && (
        <div
          className={`rounded-[30px] bg-[var(--primary)] p-6 text-white sm:p-8 ${
            champion.id === highlightPlayerId ? "ring-4 ring-[rgba(255,183,30,0.7)]" : ""
          }`}
        >
          <p className="text-sm font-black uppercase tracking-[0.22em] text-white/75">1st Place</p>
          <p className="display-font mt-3 text-4xl leading-none sm:text-5xl">{champion.nickname}</p>
          <p className="mt-4 text-6xl font-black leading-none sm:text-7xl">{champion.totalScore}</p>
          <p className="mt-2 text-sm font-bold text-white/75">
            points{champion.id === highlightPlayerId ? " · 나" : ""}
          </p>
        </div>
      )}

      {runnersUp.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {runnersUp.map((player, index) => {
            const isHighlighted = player.id === highlightPlayerId;
            return (
              <div
                key={player.id}
                className={`rounded-[26px] bg-[var(--surface)] p-5 text-white ${
                  isHighlighted ? "ring-4 ring-[var(--primary)]" : ""
                }`}
              >
                <p className="text-xs font-black uppercase tracking-[0.2em] text-white/55">
                  {index + 2} Place
                </p>
                <p className="display-font mt-2 text-2xl leading-none">{player.nickname}</p>
                <p className="mt-3 text-3xl font-black leading-none">{player.totalScore}</p>
                <p className="mt-1 text-xs font-bold text-white/55">
                  points{isHighlighted ? " · 나" : ""}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {rest.length > 0 && (
        <ol className="flex flex-col gap-2 rounded-[24px] bg-[var(--surface)] p-3">
          {rest.map((player, index) => {
            const isHighlighted = player.id === highlightPlayerId;
            return (
              <li
                key={player.id}
                className={`flex items-center justify-between rounded-[16px] px-4 py-3 ${
                  isHighlighted
                    ? "bg-[var(--primary-soft)] text-white"
                    : "bg-white/[0.04] text-white/75"
                }`}
              >
                <span className="text-base font-bold">
                  {index + 4}. {player.nickname}
                  {isHighlighted ? " (나)" : ""}
                </span>
                <span className="display-font text-xl text-white">{player.totalScore}점</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
