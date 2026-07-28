"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import { subscribeToAuthState } from "@/lib/firebase/auth";
import { getPrimaryRoom, subscribeToRoom } from "@/lib/firestore/rooms";
import { subscribeToQuestionBank, type QuestionWithId } from "@/lib/firestore/questions";
import type { RoomWithId } from "@/types/firestore";
import StageSkeleton from "@/components/StageSkeleton";
import StudentSubmissionPanel from "../StudentSubmissionPanel";

// 학생 문제 받기 전용 창. 교사가 대시보드(문제 관리 창)에서 '학생 문제 받기'를
// 누르면 이 라우트가 새 창으로 열려, 학생에게 보여줄 QR·제출 코드·현황을 담는다.
// 교사는 원래 창에서 계속 문제를 관리하고, 이 창은 프로젝션/현황판 역할을 한다.
// 대시보드 페이지와 동일한 데이터(인증→방→문제 구독)를 독립적으로 로드한다.
export default function SubmissionsWindowClient() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [room, setRoom] = useState<RoomWithId | null>(null);
  const [questions, setQuestions] = useState<QuestionWithId[]>([]);

  useEffect(() => subscribeToAuthState(setUser), []);

  useEffect(() => {
    if (user === null) {
      router.replace("/");
      return;
    }
    if (!user) return;

    // the opener passes ?room=<roomId> for the room being managed; subscribe to
    // it live (code / submission-open reflect changes). Fall back to the primary
    // room when opened directly without a param.
    const roomIdParam = new URLSearchParams(window.location.search).get("room");
    if (roomIdParam) {
      return subscribeToRoom(roomIdParam, (nextRoom) => setRoom(nextRoom));
    }

    let active = true;
    getPrimaryRoom(user.uid)
      .then((nextRoom) => {
        if (active) setRoom(nextRoom);
      })
      .catch(() => {
        if (active) setRoom(null);
      });
    return () => {
      active = false;
    };
  }, [user, router]);

  useEffect(() => {
    if (!room) return;
    return subscribeToQuestionBank(room.roomId, setQuestions);
  }, [room]);

  if (!user || !room) {
    return <StageSkeleton />;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--background)] px-5 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto w-full max-w-5xl">
        <StudentSubmissionPanel
          roomId={room.roomId}
          roomCode={room.roomCode}
          questions={questions}
        />
      </div>
    </main>
  );
}
