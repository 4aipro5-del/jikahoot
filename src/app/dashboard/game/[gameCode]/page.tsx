import GameHostClient from "../../GameHostClient";

// 게임 운영 전용 창. 교사가 새 게임 시작 시 이 라우트가 고정된 window name으로
// 팝업으로 열리고, 로비/진행/결과 등 모든 운영이 여기서 이루어진다. 원래
// 대시보드 창은 '게임 진행 중' 상태 화면만 표시한다.
export default async function GameHostPage({
  params,
}: {
  params: Promise<{ gameCode: string }>;
}) {
  const { gameCode } = await params;
  return <GameHostClient gameCode={gameCode} />;
}
