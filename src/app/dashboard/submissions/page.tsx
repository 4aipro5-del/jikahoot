import SubmissionsWindowClient from "./SubmissionsWindowClient";

// 학생 문제 받기 전용 창 라우트. 교사 대시보드에서 새 창으로 열린다.
export default function SubmissionsPage() {
  return <SubmissionsWindowClient />;
}
