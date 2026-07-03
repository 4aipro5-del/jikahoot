import type { PlayerWithId } from "@/lib/firestore/games";

export default function Leaderboard({
  players,
  highlightPlayerId,
}: {
  players: PlayerWithId[];
  highlightPlayerId?: string;
}) {
  const ranked = [...players].sort((a, b) => b.totalScore - a.totalScore);

  return (
    <ol className="w-full flex flex-col gap-2">
      {ranked.map((player, index) => (
        <li
          key={player.id}
          className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
            player.id === highlightPlayerId
              ? "border-foreground bg-black/[.04] dark:bg-white/[.08]"
              : "border-black/[.08] dark:border-white/[.145]"
          }`}
        >
          <span className="font-medium">
            {index + 1}. {player.nickname}
            {player.id === highlightPlayerId ? " (나)" : ""}
          </span>
          <span className="font-mono">{player.totalScore}점</span>
        </li>
      ))}
    </ol>
  );
}
