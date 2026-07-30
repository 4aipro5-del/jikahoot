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
      {/* 포디엄: sm 미만은 세로 스택(1·2·3), sm 이상은 3열 포디엄(2·1·3, CSS order).
          좁은 폰 폭에서 3열을 유지하면 넘쳐서 stage-shell의 overflow:hidden에 잘린다. */}
      <div className="flex flex-col gap-2.5 sm:grid sm:grid-cols-3 sm:items-end sm:gap-4">
        <PodiumCard rank={1} player={champion} highlight={champion?.id === highlightPlayerId} />
        <PodiumCard rank={2} player={second} highlight={second?.id === highlightPlayerId} />
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

// 금·은·동 메달 색(브랜드 4색과 무관). 배지 원 = 금속색, 점수 글씨는 어두운 배경에서
// 읽히도록 살짝 밝은 톤으로.
function podiumTheme(rank: number) {
  if (rank === 1)
    return { badge: "#ffc93c", badgeText: "#3a2a00", score: "#ffc93c" }; // gold
  if (rank === 2)
    return { badge: "#c9d1dc", badgeText: "#1a1626", score: "#dde3ea" }; // silver
  return { badge: "#cd7f32", badgeText: "#ffffff", score: "#e19a5b" }; // bronze
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
  // sm 이상 3열에서만 순위 배치(2·1·3). sm 미만 스택에서는 DOM 순서(1·2·3) 그대로.
  const orderClass = rank === 1 ? "sm:order-2" : rank === 2 ? "sm:order-1" : "sm:order-3";

  // 참가자가 그 순위에 없으면(인원 < 3) sm 이상에서만 자리 유지용 빈 칸(모바일 스택에선 숨김)
  if (!player) {
    return <div aria-hidden className={`hidden min-h-[8rem] sm:block ${orderClass}`} />;
  }

  return (
    <div
      className={`flex flex-col items-center gap-2.5 rounded-[22px] border p-4 text-center transition-transform sm:p-5 ${orderClass} ${
        isChampion
          ? "border-[#ffc93c] bg-[color:rgba(255,201,60,0.07)] shadow-[0_0_40px_rgba(255,201,60,0.16)] sm:-translate-y-2"
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
        <span className="rounded-full bg-[color:rgba(255,201,60,0.16)] px-3 py-1 text-xs font-black text-[#ffc93c]">
          최고 점수!
        </span>
      )}
    </div>
  );
}
