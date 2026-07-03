import { useEffect, useState } from "react";
import { gradeAnswer, subscribeToAnswer, type PlayerWithId } from "@/lib/firestore/games";
import type { Answer, Game } from "@/types/firestore";

// Subscribes to every player's answer doc for the current question and
// grades each one the moment it arrives, using the host's own correct-choice
// cache (students never get to see correctChoiceId).
export function useGrading(
  gameCode: string,
  game: Game | null | undefined,
  players: PlayerWithId[],
  correctChoiceMap: Record<string, string>,
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
    const question = game.questions[questionIndex];
    const correctChoiceId = question ? correctChoiceMap[question.id] : undefined;
    if (!correctChoiceId) return;

    const unsubscribes = players.map((player) =>
      subscribeToAnswer(gameCode, player.id, questionIndex, (answer) => {
        if (!answer) return;
        setAnswers((prev) => ({ ...prev, [player.id]: answer }));
        if (answer.isCorrect === null) {
          gradeAnswer(gameCode, player.id, questionIndex, answer.choiceId === correctChoiceId).catch(
            (err) => console.error("채점 실패", player.id, err),
          );
        }
      }),
    );

    return () => unsubscribes.forEach((unsub) => unsub());
  }, [gameCode, game, players, correctChoiceMap]);

  return answers;
}
