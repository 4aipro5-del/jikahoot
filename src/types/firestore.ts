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
  // working unchanged. The 학생 제출 flags are persisted here but not yet
  // enforced (server-side enforcement would need firestore.rules changes).
  useGooglePhoto?: boolean // default true
  defaultQuestionDurationSec?: number // default 20
  autoAdvance?: boolean // default true
  allowStudentSubmission?: boolean // default true
  allowStudentEdit?: boolean // default true
  submissionLimit?: number | null // default null (제한 없음)
}

// roomCodes/{code} — reverse lookup so students can resolve a room by code alone
export interface RoomCode {
  teacherUid: string
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
