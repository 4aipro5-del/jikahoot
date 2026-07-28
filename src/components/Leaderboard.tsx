import type { PlayerWithId } from "@/lib/firestore/games";

// 순위 배지 색: 1위 gold(경고색), 2위 은색(중립), 3위 coral(오류색), 그 외 중립 —
// 핵심 4색 토큰 안에서 메달 느낌을 낸다.
function rankStyle(rank: number): { background: string; color: string } {
  if (rank === 1) return { background: "var(--warning)", color: "#3a2a00" };
  if (rank === 2) return { background: "rgba(255,255,255,0.78)", color: "#1a1626" };
  if (rank === 3) return { background: "var(--error)", color: "#ffffff" };
  return { background: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.7)" };
}

// 실시간 순위(전광판 진행 중)와 최종 순위(종료 화면)가 같은 리스트 UI를 공유한다.
// highlightPlayerId를 주면 그 참가자 행을 강조(학생 본인)한다.
export default function Leaderboard({
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
        <p className="text-lg font-bold text-white/45">아직 참가자가 없어요.</p>
      </div>
    );
  }

  return (
    <ol className="flex w-full flex-col gap-2.5">
      {ranked.map((player, index) => {
        const rank = index + 1;
        const badge = rankStyle(rank);
        const isMe = player.id === highlightPlayerId;
        return (
          <li
            key={player.id}
            className={`flex items-center gap-4 rounded-2xl px-4 py-3.5 ${
              isMe ? "bg-[var(--primary-soft)] ring-2 ring-[var(--primary)]" : "bg-white/[0.04]"
            }`}
          >
            <span
              className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-base font-black tabular-nums"
              style={badge}
            >
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
  );
}
