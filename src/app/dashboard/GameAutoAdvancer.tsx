"use client";

import { useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { subscribeToAuthState } from "@/lib/firebase/auth";
import {
  advanceQuestion,
  finalizeQuestion,
  finishGame,
  revealAnswer,
  subscribeToGame,
  subscribeToPlayers,
  type PlayerWithId,
} from "@/lib/firestore/games";
import { getCorrectChoiceMap } from "@/lib/firestore/questions";
import { REVEAL_DURATION_SEC } from "@/lib/gameConfig";
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
  // 문제 index별로 공개/진행을 각각 한 번씩만 트리거하기 위한 잠금.
  const revealedIndexRef = useRef<number | null>(null);
  const advancedIndexRef = useRef<number | null>(null);
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
    // 일시정지 중에는 공개/진행 모두 멈춘다
    if (game.paused) return;
    if (busyRef.current) return;

    const idx = game.currentQuestionIndex;
    const question = game.questions[idx];
    if (!question) return;

    if (!game.revealedChoiceId) {
      // ── 답안 단계: 타이머 마감 시 채점 + 정답 공개 (자동 진행 설정과 무관하게 항상) ──
      if (!game.currentQuestionStartedAt) return;
      const deadline = game.currentQuestionStartedAt.toMillis() + game.questionDurationSec * 1000;
      if (now < deadline) return;
      if (revealedIndexRef.current === idx) return;
      // 정답 맵이 아직 로딩 전이면 대기 — 지금 공개하면 채점이 누락된다.
      const correctChoiceId = correctChoiceMap[question.id];
      if (!correctChoiceId) return;

      revealedIndexRef.current = idx;
      (async () => {
        busyRef.current = true;
        try {
          await finalizeQuestion(gameCode, players.map((p) => p.id), idx, correctChoiceId);
          await revealAnswer(gameCode, idx, correctChoiceId);
        } catch (err) {
          console.error("정답 공개 실패", err);
          revealedIndexRef.current = null; // 다음 tick 재시도
        } finally {
          busyRef.current = false;
        }
      })();
      return;
    }

    // ── 공개 단계: 자동 진행 ON이면 REVEAL_DURATION 뒤 다음 문제/종료 ──
    // (자동 진행 OFF면 교사가 '다음 문제'를 눌러 진행 — 여기서는 아무것도 안 함)
    if (game.autoAdvance === false) return;
    if (!game.revealStartedAt) return;
    const advanceAt = game.revealStartedAt.toMillis() + REVEAL_DURATION_SEC * 1000;
    if (now < advanceAt) return;
    if (advancedIndexRef.current === idx) return;

    advancedIndexRef.current = idx;
    const isLast = idx + 1 >= game.questions.length;
    (async () => {
      busyRef.current = true;
      try {
        if (isLast) {
          await finishGame(gameCode);
        } else {
          await advanceQuestion(gameCode, idx + 1);
        }
      } catch (err) {
        console.error("자동 진행 실패", err);
        advancedIndexRef.current = null; // 다음 tick 재시도
      } finally {
        busyRef.current = false;
      }
    })();
  }, [game, now, user, correctChoiceMap, players, gameCode]);

  return null;
}
