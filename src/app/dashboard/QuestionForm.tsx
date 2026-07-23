"use client";

import QuestionEditorForm from "@/components/QuestionEditorForm";
import { createTeacherQuestion } from "@/lib/firestore/questions";

export default function QuestionForm({ teacherUid }: { teacherUid: string }) {
  return (
    <QuestionEditorForm
      title="새 문제 만들기"
      submitLabel="문제 은행에 추가"
      successMessage="문제를 추가했습니다."
      className="dashboard-builder-card"
      hideTitle
      onSubmit={(input) => createTeacherQuestion(teacherUid, input)}
    />
  );
}
