"use client";

import { useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { subscribeToAuthState } from "@/lib/firebase/auth";
import {
  advanceQuestion,
  finalizeQuestion,
  finishGame,
  subscribeToGame,
  subscribeToPlayers,
  type PlayerWithId,
} from "@/lib/firestore/games";
import { getCorrectChoiceMap } from "@/lib/firestore/questions";
import type { Game } from "@/types/firestore";
import { useNow } from "@/lib/useNow";

// 게임 자동 진행(문제 마감 시 다음 문제로/종료)을 담당하는 헤드리스 컨트롤러.
// 대시보드 루트에 진행 중 게임마다 항상 마운트돼, 교사가 Dashboard/Question/
// Settings 탭으로 이동하거나 방을 바꿔도 타이머가 죽지 않는다(예전엔 별도 팝업
// 창이 이 역할). 화면에 보이는 GameHostClient(embedded)는 자동 진행을 하지 않고
// 수동 '다음 문제'만 담당하므로 이중 진행은 없다. 혹시 마감 순간 수동/자동이
// 동시에 finalize를 불러도 gradeAnswer의 트랜잭션 내부 멱등 가드가 이중 채점을 막는다.
export default function GameAutoAdvancer({ gameCode }: { gameCode: string }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [game, setGame] = useState<Game | null | undefined>(undefined);
  const [players, setPlayers] = useState<PlayerWithId[]>([]);
  const [correctChoiceMap, setCorrectChoiceMap] = useState<Record<string, string>>({});
  // 재진입 방지: advancing 상태가 없으니 ref로 동기 잠금.
  const busyRef = useRef(false);
  const autoAdvancedIndexRef = useRef<number | null>(null);
  const now = useNow(500);

  useEffect(() => subscribeToAuthState(setUser), []);

  useEffect(() => {
    if (!user) return;
    return subscribeToGame(gameCode, setGame);
  }, [gameCode, user]);

  useEffect(() => {
    if (!user || !game) return;
    return subscribeToPlayers(gameCode, setPlayers);
  }, [gameCode, user, game]);

  useEffect(() => {
    if (!game || !user || game.teacherUid !== user.uid) return;
    getCorrectChoiceMap(
      game.roomId ?? game.teacherUid,
      game.questions.map((q) => q.id),
    ).then(setCorrectChoiceMap);
  }, [game, user]);

  useEffect(() => {
    if (!user || !game || game.teacherUid !== user.uid) return;
    if (game.status !== "active") return;
    // 일시정지 중에는 자동 진행하지 않음
    if (game.paused) return;
    // 교사의 자동 진행 설정 존중(undefined=on, 구버전 호환)
    if (game.autoAdvance === false) return;
    if (!game.currentQuestionStartedAt) return;

    const deadline = game.currentQuestionStartedAt.toMillis() + game.questionDurationSec * 1000;
    if (now < deadline) return;
    if (autoAdvancedIndexRef.current === game.currentQuestionIndex) return;
    if (busyRef.current) return;

    // 정답 맵이 아직 로딩 전이면 대기 — 지금 넘어가면 이 문제 채점이 누락된다.
    const question = game.questions[game.currentQuestionIndex];
    const correctChoiceId = question ? correctChoiceMap[question.id] : undefined;
    if (!correctChoiceId) return;

    autoAdvancedIndexRef.current = game.currentQuestionIndex;
    const questionIndex = game.currentQuestionIndex;
    const isLast = questionIndex + 1 >= game.questions.length;

    (async () => {
      busyRef.current = true;
      try {
        // 넘어가기 전에 현재 문제를 채점(점수/연속정답이 리더보드에 반영)
        await finalizeQuestion(
          gameCode,
          players.map((p) => p.id),
          questionIndex,
          correctChoiceId,
        );
        if (isLast) {
          await finishGame(gameCode);
        } else {
          await advanceQuestion(gameCode, questionIndex + 1);
        }
      } catch (err) {
        console.error("자동 진행 실패", err);
        // 실패 시 다음 tick에 재시도할 수 있게 잠금을 푼다
        autoAdvancedIndexRef.current = null;
      } finally {
        busyRef.current = false;
      }
    })();
  }, [game, now, user, correctChoiceMap, players, gameCode]);

  return null;
}
