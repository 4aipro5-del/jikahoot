import DisplayClient from "./DisplayClient";

export default async function DisplayPage({
  params,
}: {
  params: Promise<{ gameCode: string }>;
}) {
  const { gameCode } = await params;
  return <DisplayClient gameCode={gameCode} />;
}
