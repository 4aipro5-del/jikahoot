import GameHostClient from "./GameHostClient";

export default async function GameHostPage({
  params,
}: {
  params: Promise<{ gameCode: string }>;
}) {
  const { gameCode } = await params;
  return <GameHostClient gameCode={gameCode} />;
}
