import type { PlayerWithId } from "@/lib/firestore/games";

const BADGE_STYLES = [
  "border border-[rgba(88,204,2,0.16)] bg-[rgba(232,249,216,0.96)] text-[var(--panel-text)] shadow-[0_8px_0_rgba(88,204,2,0.16)]",
  "border border-[rgba(28,176,246,0.16)] bg-[rgba(231,245,255,0.96)] text-[var(--panel-text)] shadow-[0_8px_0_rgba(28,176,246,0.12)]",
  "border border-[rgba(255,200,0,0.18)] bg-[rgba(255,248,224,0.96)] text-[#5a4600] shadow-[0_8px_0_rgba(216,158,0,0.14)]",
  "border border-[rgba(88,204,2,0.14)] bg-white text-[var(--panel-text)] shadow-[0_8px_0_rgba(88,204,2,0.1)]",
  "border border-[rgba(88,204,2,0.16)] bg-[rgba(245,255,236,0.98)] text-[var(--duo-green-dark)] shadow-[0_8px_0_rgba(88,204,2,0.14)]",
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
          <p className="paper-faint text-sm font-black uppercase tracking-[0.2em]">Players</p>
          <h2 className="display-font balance-wrap text-3xl text-[var(--panel-text)] sm:text-4xl">
            참가자 {players.length}명
          </h2>
        </div>
      </div>

      {players.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-[rgba(88,204,2,0.18)] bg-[rgba(88,204,2,0.05)] px-5 py-6 text-center text-base font-semibold text-[rgba(36,51,17,0.68)] sm:text-lg">
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
                  className="absolute -right-1.5 -top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--duo-green-dark)] text-sm leading-none text-white opacity-0 shadow-[0_6px_14px_rgba(70,163,2,0.28)] transition group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-[var(--duo-green)] disabled:opacity-40"
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
