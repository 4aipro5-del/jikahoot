import type { Timestamp } from 'firebase/firestore'

// rooms/{teacherUid}
export interface Room {
  teacherUid: string
  displayName: string
  email: string
  photoUrl: string | null
  roomCode: string
  createdAt: Timestamp
  // Points at the teacher's current game session so the dashboard can resume
  // it after a reload. Only updated at lifecycle boundaries (created/finished),
  // not on every in-game transition — live status comes from subscribing to
  // games/{currentGameId} directly, this is just "which game to subscribe to".
  currentGameId?: string | null
  currentGameStatus?: GameStatus | null
  currentGameStartedAt?: Timestamp | null
  // Teacher-configurable settings (Settings tab). All optional — readers apply
  // the documented default when a field is absent, so existing rooms keep
  // working unchanged. 학생 제출 여부는 room이 아니라 roomCodes.submissionOpen
  // 으로만 제어한다(학생이 읽을 수 있는 유일한 교사 소유 문서).
  useGooglePhoto?: boolean // default true
  defaultQuestionDurationSec?: number // default 20
  autoAdvance?: boolean // default true
}

// roomCodes/{code} — reverse lookup so students can resolve a room by code alone.
// submissionOpen gates 학생 문제 제출: it lives here (not on the room) because
// anonymous students can read roomCodes but never the private room doc, so this
// is the only teacher-owned flag a student can check before submitting. Absent
// means "open" — existing rooms keep accepting submissions unchanged.
export interface RoomCode {
  teacherUid: string
  submissionOpen?: boolean
}

export type QuestionStatus = 'pending' | 'approved' | 'rejected'

export interface Choice {
  id: string
  text: string
}

// rooms/{teacherUid}/questionBank/{questionId}
export interface Question {
  text: string
  choices: Choice[]
  correctChoiceId: string
  createdBy: 'teacher' | 'student'
  authorUid: string | null
  authorNickname: string | null
  status: QuestionStatus
  createdAt: Timestamp
  reviewedAt: Timestamp | null
}

// Snapshot of a Question stored on Game.questions — never includes correctChoiceId
export interface PublicQuestion {
  id: string
  text: string
  choices: Choice[]
}

export type GameStatus = 'lobby' | 'active' | 'finished'

// games/{gameCode}
export interface Game {
  teacherUid: string
  status: GameStatus
  questions: PublicQuestion[]
  currentQuestionIndex: number // -1 while in lobby
  questionDurationSec: number
  // snapshot of the teacher's 자동 진행 setting at game-creation time, so the
  // host client advances (or waits) per the setting the game was started with
  autoAdvance: boolean
  currentQuestionStartedAt: Timestamp | null
  createdAt: Timestamp
  endedAt: Timestamp | null
}

// games/{gameCode}/nicknames/{nicknameSlug}
export interface NicknameReservation {
  playerUid: string
}

// games/{gameCode}/players/{playerUid}
export interface Player {
  nickname: string
  joinedAt: Timestamp
  totalScore: number
  currentStreak: number
}

// games/{gameCode}/players/{playerUid}/answers/{questionIndex}
export interface Answer {
  choiceId: string
  answeredAt: Timestamp
  isCorrect: boolean | null // null until the teacher client grades it
  pointsEarned: number | null
}

// Streak bonus: 1-2 streak = no bonus, 3 = +50%, 4 = +100%, 5 = +150%, 6+ = +200% (cap)
export function streakBonusMultiplier(streak: number): number {
  if (streak < 3) return 1
  const bonusPercent = Math.min((streak - 2) * 50, 200)
  return 1 + bonusPercent / 100
}

// Rank bonus: correct answers are ranked by submission order (earliest first).
// The top ceil(correctCount * 0.25) ranks (at least 1) share a bonus zone where
// 1st place always gets +30%, decaying linearly to just above 0% at the back
// of the zone; every rank outside the zone gets +0%.
export function rankBonusMultiplier(rank: number, correctCount: number): number {
  const zoneSize = Math.max(1, Math.ceil(correctCount * 0.25))
  if (rank > zoneSize) return 1
  const bonusPercent = (30 * (zoneSize - rank + 1)) / zoneSize
  return 1 + bonusPercent / 100
}
