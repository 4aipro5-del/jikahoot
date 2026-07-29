import type { PlayerWithId } from "@/lib/firestore/games";

// 최종 순위(게임 종료) 전용 포디엄. 상위 3명은 2·1·3위 카드(1위 가운데 강조),
// 4위 이하는 아래 리스트. 진행 중 실시간 순위(Leaderboard, 플랫 리스트)와는 다른
// 컴포넌트다. highlightPlayerId를 주면 그 참가자를 강조(학생 본인).
export default function FinalLeaderboard({
  players,
  highlightPlayerId,
}: {
  players: PlayerWithId[];
  highlightPlayerId?: string;
}) {
  const ranked = [...players].sort((a, b) => b.totalScore - a.totalScore);

  if (ranked.length === 0) {
    return (
      <div className="flex w-full items-center justify-center rounded-2xl border border-dashed border-white/12 py-16">
        <p className="text-lg font-bold text-white/45">참가자가 없어요.</p>
      </div>
    );
  }

  const [champion, second, third] = ranked;
  const rest = ranked.slice(3);

  return (
    <div className="flex w-full flex-col gap-5">
      {/* 포디엄: 2위(좌) · 1위(가운데, 강조) · 3위(우) */}
      <div className="grid grid-cols-3 items-end gap-2.5 sm:gap-4">
        <PodiumCard rank={2} player={second} highlight={second?.id === highlightPlayerId} />
        <PodiumCard rank={1} player={champion} highlight={champion?.id === highlightPlayerId} />
        <PodiumCard rank={3} player={third} highlight={third?.id === highlightPlayerId} />
      </div>

      {/* 4위 이하 */}
      {rest.length > 0 && (
        <ol className="flex flex-col rounded-[20px] border border-white/10 bg-[var(--surface)] px-2">
          {rest.map((player, index) => {
            const rank = index + 4;
            const isMe = player.id === highlightPlayerId;
            return (
              <li
                key={player.id}
                className={`flex items-center gap-4 border-b border-white/[0.06] px-4 py-3.5 last:border-0 ${
                  isMe ? "rounded-2xl bg-[var(--primary-soft)]" : ""
                }`}
              >
                <span className="w-6 flex-none text-center text-lg font-black text-white/45 tabular-nums">
                  {rank}
                </span>
                <span className="min-w-0 flex-1 truncate text-lg font-bold text-white">
                  {player.nickname}
                  {isMe ? " (나)" : ""}
                </span>
                <span className="display-font text-xl leading-none text-white tabular-nums">
                  {player.totalScore.toLocaleString()}
                </span>
                <span className="text-sm font-bold text-white/40">점</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

// 랭크별 색: 1위 gold(경고색), 2위 은색(중립), 3위 coral(오류색) — 핵심 4색 안에서.
function podiumTheme(rank: number) {
  if (rank === 1)
    return { badge: "var(--warning)", badgeText: "#3a2a00", score: "var(--warning)" };
  if (rank === 2)
    return { badge: "rgba(255,255,255,0.82)", badgeText: "#1a1626", score: "rgba(255,255,255,0.9)" };
  return { badge: "var(--error)", badgeText: "#ffffff", score: "var(--error)" };
}

function PodiumCard({
  rank,
  player,
  highlight,
}: {
  rank: number;
  player: PlayerWithId | undefined;
  highlight: boolean;
}) {
  const isChampion = rank === 1;
  const theme = podiumTheme(rank);

  // 참가자가 그 순위에 없으면(인원 < 3) 자리 유지용 빈 칸
  if (!player) {
    return <div aria-hidden className="min-h-[8rem]" />;
  }

  return (
    <div
      className={`flex flex-col items-center gap-2.5 rounded-[22px] border p-4 text-center transition-transform sm:p-5 ${
        isChampion
          ? "-translate-y-2 border-[var(--warning)] bg-[color:rgba(255,183,30,0.06)] shadow-[0_0_40px_rgba(255,183,30,0.14)]"
          : "border-white/10 bg-[var(--surface)]"
      } ${highlight ? "ring-2 ring-[var(--primary)]" : ""}`}
    >
      <span
        className={`flex flex-none items-center justify-center rounded-full font-black tabular-nums ${
          isChampion ? "h-12 w-12 text-xl" : "h-9 w-9 text-base sm:h-10 sm:w-10 sm:text-lg"
        }`}
        style={{ background: theme.badge, color: theme.badgeText }}
      >
        {rank}
      </span>

      <p
        className={`display-font min-w-0 max-w-full truncate text-white ${
          isChampion ? "text-xl sm:text-2xl" : "text-base sm:text-xl"
        }`}
      >
        {player.nickname}
      </p>

      <span className="h-px w-full bg-white/10" aria-hidden="true" />

      <p className="flex items-baseline gap-1">
        <span
          className={`display-font tabular-nums ${isChampion ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"}`}
          style={{ color: theme.score }}
        >
          {player.totalScore.toLocaleString()}
        </span>
        <span className="text-sm font-bold text-white/45">점</span>
      </p>

      {isChampion && (
        <span className="rounded-full bg-[var(--warning-soft)] px-3 py-1 text-xs font-black text-[var(--warning)]">
          최고 점수!
        </span>
      )}
    </div>
  );
}
