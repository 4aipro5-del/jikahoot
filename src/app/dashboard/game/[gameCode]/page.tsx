import GameHostClient from "../../GameHostClient";

// 게임 운영 콘솔의 독립 라우트(보조 경로). 평소 운영은 대시보드 Game 탭 안에
// 임베드된 GameHostClient(embedded)에서 이루어지고, 학생용 전광판은 별도
// /display/[code] 창이 담당한다. 이 라우트는 URL 직접 접근용으로 남겨둔다.
export default async function GameHostPage({
  params,
}: {
  params: Promise<{ gameCode: string }>;
}) {
  const { gameCode } = await params;
  return <GameHostClient gameCode={gameCode} />;
}
