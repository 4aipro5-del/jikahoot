import { useEffect, useState } from "react";
import { subscribeToAnswer, type PlayerWithId } from "@/lib/firestore/games";
import type { Answer, Game } from "@/types/firestore";

// Subscribes to every player's answer doc for the current question so the
// host view can show a live "answered" count. Grading (including the rank
// bonus, which needs every player's answer to compare submission order)
// happens once in finalizeQuestion when the host advances past the question.
export function useGrading(
  gameCode: string,
  game: Game | null | undefined,
  players: PlayerWithId[],
) {
  const currentIndex = game && game.status === "active" ? game.currentQuestionIndex : -1;
  const [trackedIndex, setTrackedIndex] = useState(currentIndex);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});

  if (currentIndex !== trackedIndex) {
    setTrackedIndex(currentIndex);
    setAnswers({});
  }

  useEffect(() => {
    if (!game || game.status !== "active" || game.currentQuestionIndex < 0) {
      return;
    }

    const questionIndex = game.currentQuestionIndex;

    const unsubscribes = players.map((player) =>
      subscribeToAnswer(gameCode, player.id, questionIndex, (answer) => {
        if (!answer) return;
        setAnswers((prev) => ({ ...prev, [player.id]: answer }));
      }),
    );

    return () => unsubscribes.forEach((unsub) => unsub());
  }, [gameCode, game, players]);

  return answers;
}
