import type { Timestamp } from 'firebase/firestore'

// rooms/{roomId}
// A teacher may own many rooms (rooms are queried by ownerUid). The teacher's
// profile (name/photo/email) is NOT stored here — it lives in Firebase Auth and
// is the single source of truth. This doc only holds room-scoped data.
export interface Room {
  ownerUid: string
  name: string
  roomCode: string
  createdAt: Timestamp
  // Points at this room's current game session so the dashboard can resume it
  // after a reload. Only updated at lifecycle boundaries (created/finished),
  // not on every in-game transition — live status comes from subscribing to
  // games/{currentGameId} directly, this is just "which game to subscribe to".
  currentGameId?: string | null
  currentGameStatus?: GameStatus | null
  currentGameStartedAt?: Timestamp | null
  // Room-configurable settings (Settings tab). All optional — readers apply the
  // documented default when a field is absent, so existing rooms keep working.
  defaultQuestionDurationSec?: number // default 20
  autoAdvance?: boolean // default true
  // 학생 문제 제출 허용 여부. This is the ENFORCEMENT source of truth: the
  // questionBank create rule get()s this room by its {roomId} path. It is
  // mirrored onto roomCodes.submissionOpen for the student client to read, and
  // both are written together atomically. Absent means "open" (하위호환).
  submissionOpen?: boolean
}

// A room paired with its document id (the roomId). Reads attach the doc id so
// callers can key questionBank/games/roomCodes off the room without a second
// field on the doc itself.
export type RoomWithId = Room & { roomId: string }

// roomCodes/{code} — reverse lookup so students can resolve a room by code
// alone (mirrors the game-code pattern). submissionOpen here is a student-
// READABLE mirror of Room.submissionOpen: anonymous students can read roomCodes
// but never the private room doc, so this copy lets /submit gate its UI. The
// rule enforcement reads Room.submissionOpen, not this — this is UX only.
// Absent means "open".
export interface RoomCode {
  // owner uid — kept as `teacherUid` so the roomCodes rules stay uid-based and
  // unchanged. Equals the room's ownerUid.
  teacherUid: string
  // which room this code points at. Legacy docs (pre-multi-room) may lack it —
  // readers fall back to teacherUid, which equals the roomId for primary rooms.
  roomId?: string
  submissionOpen?: boolean
}

export type QuestionStatus = 'pending' | 'approved' | 'rejected'

export interface Choice {
  id: string
  text: string
}

// rooms/{roomId}/questionBank/{questionId}
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
  // owner uid — kept as `teacherUid` because the security rules key game
  // ownership off this field (gameOwner). Equals the room's ownerUid.
  teacherUid: string
  // which room this game was started from (for per-room lookups/cleanup).
  // Optional because games created before multi-room predate it — readers fall
  // back to teacherUid, which equals the roomId for a primary room.
  roomId?: string
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
  // 진행 중 일시정지 상태. paused=true면 타이머를 pausedAt 시점에 고정하고
  // 학생 답안 제출을 막는다(클라이언트 게이팅). 재개 시 currentQuestionStartedAt을
  // 일시정지된 시간만큼 뒤로 밀어 남은 시간을 보존한다. 없으면 진행 중(하위호환).
  paused?: boolean
  pausedAt?: Timestamp | null
  // 정답 공개 단계. 문제 마감 시 방장이 현재 문제의 정답 보기 id를 여기에 기록하면
  // (게임 문서는 누구나 읽으므로) 학생/교사 화면이 정답 보기를 강조한다. 답안 중에는
  // null/부재. 다음 문제로 넘어가면(advanceQuestion) 다시 null로 비운다. PublicQuestion
  // 자체엔 정답이 없어 공개 전 사전 노출은 불가능하다.
  revealedChoiceId?: string | null
  // 정답 공개 시작 시각 — 공개 후 자동 진행(기본 5초) 타이밍 기준.
  revealStartedAt?: Timestamp | null
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
