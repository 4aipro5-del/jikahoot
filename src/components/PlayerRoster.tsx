import type { PlayerWithId } from "@/lib/firestore/games";

const BADGE_STYLES = [
  "bg-[var(--kahoot-red)] text-white shadow-[0_8px_0_rgba(105,11,28,0.32)]",
  "bg-[var(--kahoot-blue)] text-white shadow-[0_8px_0_rgba(8,45,89,0.32)]",
  "bg-[var(--kahoot-yellow)] text-[#4a2c00] shadow-[0_8px_0_rgba(126,87,0,0.26)]",
  "bg-[var(--kahoot-green)] text-white shadow-[0_8px_0_rgba(18,73,8,0.28)]",
  "bg-[var(--kahoot-purple)] text-white shadow-[0_8px_0_rgba(39,12,80,0.3)]",
];

export default function PlayerRoster({ players }: { players: PlayerWithId[] }) {
  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-white/58">Players</p>
          <h2 className="display-font text-3xl text-white">참가자 {players.length}명</h2>
        </div>
      </div>

      {players.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-white/20 bg-white/6 px-5 py-6 text-center text-sm font-semibold text-white/72">
          아직 아무도 입장하지 않았어요. 코드가 공유되면 이 자리가 금방 채워질 거예요.
        </div>
      ) : (
        <ul className="flex flex-wrap justify-center gap-3">
          {players.map((player, index) => (
            <li
              key={player.id}
              className={`rounded-full px-4 py-2.5 text-sm font-black ${
                BADGE_STYLES[index % BADGE_STYLES.length]
              }`}
            >
              {player.nickname}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
