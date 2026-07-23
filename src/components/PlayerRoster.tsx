import type { PlayerWithId } from "@/lib/firestore/games";

const BADGE_STYLES = [
  "bg-[#E7DFFB] text-[var(--panel-text)]",
  "bg-[#FFE1DE] text-[var(--panel-text)]",
  "bg-[#FFEFD1] text-[var(--panel-text)]",
  "bg-white text-[var(--panel-text)]",
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
    <div className="w-full rounded-[28px] bg-[var(--surface)] p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-white/55">Players</p>
          <h2 className="display-font balance-wrap text-3xl text-white sm:text-4xl">
            참가자 {players.length}명
          </h2>
        </div>
      </div>

      {players.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-white/12 bg-white/[0.04] px-5 py-6 text-center text-base font-semibold text-white/60 sm:text-lg">
          <p className="pretty-wrap mx-auto w-fit max-w-full leading-[1.45]">아직 아무도 입장하지 않았어요.</p>
        </div>
      ) : (
        <ul className="flex flex-wrap justify-start gap-3 sm:gap-4">
          {players.map((player, index) => (
            <li
              key={player.id}
              className={`group relative flex items-center gap-3 rounded-full px-4 py-2.5 text-base font-black shadow-[0_8px_0_rgba(0,0,0,0.14)] sm:px-5 sm:py-3 sm:text-xl ${
                BADGE_STYLES[index % BADGE_STYLES.length]
              }`}
            >
              <span>{player.nickname}</span>
              {onRemovePlayer && (
                <button
                  type="button"
                  onClick={() => onRemovePlayer(player)}
                  disabled={removingPlayerId === player.id}
                  className="absolute -right-1.5 -top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary-dark)] text-sm leading-none text-white opacity-0 shadow-[0_6px_14px_rgba(34,1,158,0.4)] transition group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-[var(--primary)] disabled:opacity-40"
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
