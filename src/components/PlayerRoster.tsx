import type { PlayerWithId } from "@/lib/firestore/games";

const BADGE_STYLES = [
  "bg-[var(--kahoot-red)] text-white shadow-[0_8px_0_rgba(105,11,28,0.32)]",
  "bg-[var(--kahoot-blue)] text-white shadow-[0_8px_0_rgba(8,45,89,0.32)]",
  "bg-[var(--kahoot-yellow)] text-[#4a2c00] shadow-[0_8px_0_rgba(126,87,0,0.26)]",
  "bg-[var(--kahoot-green)] text-white shadow-[0_8px_0_rgba(18,73,8,0.28)]",
  "bg-[var(--kahoot-purple)] text-white shadow-[0_8px_0_rgba(39,12,80,0.3)]",
];

export default function PlayerRoster({
  players,
  onRemovePlayer,
  removingPlayerId,
}: {
  players: PlayerWithId[];
  onRemovePlayer?: (player: PlayerWithId) => void;
  removingPlayerId?: string | null;
}) {
  return (
    <div className="w-full">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-white/58">Players</p>
          <h2 className="display-font balance-wrap text-3xl text-white sm:text-4xl">
            참가자 {players.length}명
          </h2>
        </div>
      </div>

      {players.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-white/20 bg-white/6 px-5 py-6 text-center text-base font-semibold text-white/72 sm:text-lg">
          <p className="pretty-wrap mx-auto w-fit max-w-full leading-[1.45]">아직 아무도 입장하지 않았어요.</p>
        </div>
      ) : (
        <ul className="flex flex-wrap justify-start gap-3 sm:gap-4">
          {players.map((player, index) => (
            <li
              key={player.id}
              className={`group relative flex items-center gap-3 rounded-full px-4 py-2.5 text-base font-black sm:px-5 sm:py-3 sm:text-xl ${
                BADGE_STYLES[index % BADGE_STYLES.length]
              }`}
            >
              <span>{player.nickname}</span>
              {onRemovePlayer && (
                <button
                  type="button"
                  onClick={() => onRemovePlayer(player)}
                  disabled={removingPlayerId === player.id}
                  className="absolute -right-1.5 -top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(20,16,48,0.88)] text-sm leading-none text-white opacity-0 shadow-[0_6px_14px_rgba(8,10,25,0.28)] transition group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-[rgba(20,16,48,0.98)] disabled:opacity-40"
                  aria-label={`${player.nickname} 추방`}
                >
                  -
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
