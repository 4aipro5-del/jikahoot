import type { PlayerWithId } from "@/lib/firestore/games";

export default function PlayerRoster({ players }: { players: PlayerWithId[] }) {
  return (
    <div className="w-full">
      <h2 className="mb-3 text-lg font-semibold">참가자 ({players.length}명)</h2>
      {players.length === 0 ? (
        <p className="text-sm text-zinc-500">아직 아무도 입장하지 않았어요.</p>
      ) : (
        <ul className="flex flex-wrap justify-center gap-2">
          {players.map((player) => (
            <li
              key={player.id}
              className="rounded-full bg-black/[.04] px-4 py-2 text-sm font-medium dark:bg-white/[.08]"
            >
              {player.nickname}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
