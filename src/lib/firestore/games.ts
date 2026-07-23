import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { signInStudentAnonymously } from '@/lib/firebase/auth'
import type { Answer, Game, NicknameReservation, Player, PublicQuestion, Room } from '@/types/firestore'
import { streakBonusMultiplier, rankBonusMultiplier } from '@/types/firestore'
import { BASE_POINTS_PER_CORRECT_ANSWER } from '@/lib/gameConfig'

// no 0/O/1/I/L — easy to read aloud and type on a Chromebook
const GAME_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const GAME_CODE_LENGTH = 6
const MAX_ATTEMPTS = 5

function generateGameCode(): string {
  let code = ''
  for (let i = 0; i < GAME_CODE_LENGTH; i++) {
    code += GAME_CODE_ALPHABET[Math.floor(Math.random() * GAME_CODE_ALPHABET.length)]
  }
  return code
}

function slugifyNickname(nickname: string): string {
  return 'n-' + nickname.trim().toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')
}

function shuffleChoicesForGame(questions: PublicQuestion[]): PublicQuestion[] {
  return questions.map((question) => {
    const shuffledChoices = [...question.choices]

    for (let index = shuffledChoices.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1))
      ;[shuffledChoices[index], shuffledChoices[swapIndex]] = [
        shuffledChoices[swapIndex],
        shuffledChoices[index],
      ]
    }

    return {
      ...question,
      choices: shuffledChoices,
    }
  })
}

// Creates a new game AND links it as the room's current session, atomically.
// If the room already points at a game that hasn't finished, that game is
// returned instead of creating a duplicate — this is what makes a reload, a
// double-click, or a second tab all converge on the same live session.
export async function createGame(
  teacherUid: string,
  questions: PublicQuestion[],
  questionDurationSec: number,
): Promise<string> {
  const roomRef = doc(db, 'rooms', teacherUid)

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generateGameCode()
    const gameRef = doc(db, 'games', code)

    try {
      return await runTransaction(db, async (tx) => {
        const roomSnap = await tx.get(roomRef)
        const room = roomSnap.data() as Room | undefined

        if (room?.currentGameId) {
          const existingSnap = await tx.get(doc(db, 'games', room.currentGameId))
          if (existingSnap.exists() && (existingSnap.data() as Game).status !== 'finished') {
            return room.currentGameId
          }
        }

        const snap = await tx.get(gameRef)
        if (snap.exists()) {
          throw new Error('GAME_CODE_TAKEN')
        }

        const shuffledQuestions = shuffleChoicesForGame(questions)
        const game: Game = {
          teacherUid,
          status: 'lobby',
          questions: shuffledQuestions,
          currentQuestionIndex: -1,
          questionDurationSec,
          currentQuestionStartedAt: null,
          createdAt: serverTimestamp() as unknown as Game['createdAt'],
          endedAt: null,
        }
        tx.set(gameRef, game)
        tx.update(roomRef, {
          currentGameId: code,
          currentGameStatus: 'lobby',
          currentGameStartedAt: serverTimestamp(),
        })
        return code
      })
    } catch (err) {
      if (err instanceof Error && err.message === 'GAME_CODE_TAKEN') continue
      throw err
    }
  }

  throw new Error('게임 코드를 생성하지 못했습니다. 다시 시도해 주세요.')
}

// used by the home portal to tell a game code apart from a room code before
// routing a student into /play vs /submit
export async function gameExists(gameCode: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'games', gameCode))
  return snap.exists()
}

export function subscribeToGame(gameCode: string, callback: (game: Game | null) => void) {
  return onSnapshot(doc(db, 'games', gameCode), (snap) => {
    callback(snap.exists() ? (snap.data() as Game) : null)
  })
}

export type PlayerWithId = Player & { id: string }

export function subscribeToPlayers(
  gameCode: string,
  callback: (players: PlayerWithId[]) => void,
) {
  const q = query(collection(db, 'games', gameCode, 'players'), orderBy('joinedAt', 'asc'))
  return onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Player) })))
    },
    () => {
      // Expected right as the game flips from 'lobby' to 'active': the full
      // roster is host-only once play starts, so a listener still open from
      // the lobby phase can catch one permission-denied in the instant before
      // its caller unsubscribes. Not a real failure — just stop delivering
      // updates instead of letting it surface as an uncaught console error.
    },
  )
}

export function subscribeToPlayer(
  gameCode: string,
  playerUid: string,
  callback: (player: Player | null) => void,
) {
  return onSnapshot(doc(db, 'games', gameCode, 'players', playerUid), (snap) => {
    callback(snap.exists() ? (snap.data() as Player) : null)
  })
}

export async function joinGame(
  gameCode: string,
  nickname: string,
): Promise<{ authorUid: string; nickname: string }> {
  const cred = await signInStudentAnonymously()
  const playerUid = cred.user.uid
  const slug = slugifyNickname(nickname)

  const gameRef = doc(db, 'games', gameCode)
  const nicknameRef = doc(db, 'games', gameCode, 'nicknames', slug)
  const playerRef = doc(db, 'games', gameCode, 'players', playerUid)

  await runTransaction(db, async (tx) => {
    const gameSnap = await tx.get(gameRef)
    if (!gameSnap.exists()) {
      throw new Error('게임 코드를 찾을 수 없어요. 선생님께 다시 확인해 주세요.')
    }
    if ((gameSnap.data() as Game).status !== 'lobby') {
      throw new Error('이미 시작했거나 끝난 게임이에요.')
    }

    const nicknameSnap = await tx.get(nicknameRef)
    if (nicknameSnap.exists()) {
      throw new Error('이미 사용 중인 닉네임이에요. 다른 이름을 입력해 주세요.')
    }

    const reservation: NicknameReservation = { playerUid }
    tx.set(nicknameRef, reservation)

    const player: Player = {
      nickname,
      joinedAt: serverTimestamp() as unknown as Player['joinedAt'],
      totalScore: 0,
      currentStreak: 0,
    }
    tx.set(playerRef, player)
  })

  return { authorUid: playerUid, nickname }
}

export async function removePlayerFromGame(
  gameCode: string,
  playerUid: string,
  nickname: string,
) {
  const slug = slugifyNickname(nickname)
  await runTransaction(db, async (tx) => {
    tx.delete(doc(db, 'games', gameCode, 'players', playerUid))
    tx.delete(doc(db, 'games', gameCode, 'nicknames', slug))
  })
}

export function advanceQuestion(gameCode: string, nextIndex: number) {
  return updateDoc(doc(db, 'games', gameCode), {
    status: 'active',
    currentQuestionIndex: nextIndex,
    currentQuestionStartedAt: serverTimestamp(),
  })
}

// also flips the room's currentGameStatus to 'finished' (read from the game
// doc itself, so callers never need to pass teacherUid separately) — the
// room keeps pointing at this game so its results stay reachable until the
// teacher explicitly dismisses it via clearCurrentGame ("다시 시작")
export async function finishGame(gameCode: string) {
  const gameRef = doc(db, 'games', gameCode)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(gameRef)
    if (!snap.exists()) return
    const game = snap.data() as Game

    tx.update(gameRef, {
      status: 'finished',
      endedAt: serverTimestamp(),
    })
    tx.update(doc(db, 'rooms', game.teacherUid), {
      currentGameStatus: 'finished',
    })
  })
}

export function resetStreak(gameCode: string, playerUid: string) {
  return updateDoc(doc(db, 'games', gameCode, 'players', playerUid), {
    currentStreak: 0,
  })
}

function answerRef(gameCode: string, playerUid: string, questionIndex: number) {
  return doc(db, 'games', gameCode, 'players', playerUid, 'answers', String(questionIndex))
}

export function submitAnswer(
  gameCode: string,
  playerUid: string,
  questionIndex: number,
  choiceId: string,
) {
  const answer: Answer = {
    choiceId,
    answeredAt: serverTimestamp() as unknown as Answer['answeredAt'],
    isCorrect: null,
    pointsEarned: null,
  }
  return setDoc(answerRef(gameCode, playerUid, questionIndex), answer)
}

export function subscribeToAnswer(
  gameCode: string,
  playerUid: string,
  questionIndex: number,
  callback: (answer: Answer | null) => void,
) {
  return onSnapshot(answerRef(gameCode, playerUid, questionIndex), (snap) => {
    callback(snap.exists() ? (snap.data() as Answer) : null)
  })
}

// called right before the host advances past a question (or ends the game).
// This is the only place grading happens: the rank bonus needs every
// player's answer at once to compare submission order, so nothing is graded
// live while the question is still active — students see a "grading..."
// state (PlayingGame.tsx) until the host advances.
export async function finalizeQuestion(
  gameCode: string,
  playerIds: string[],
  questionIndex: number,
  correctChoiceId: string,
) {
  const entries = await Promise.all(
    playerIds.map(async (playerUid) => {
      try {
        const snap = await getDoc(answerRef(gameCode, playerUid, questionIndex))
        return { playerUid, answer: snap.exists() ? (snap.data() as Answer) : null }
      } catch (err) {
        console.error('finalizeQuestion: 답안 조회 실패', playerUid, err)
        return { playerUid, answer: null }
      }
    }),
  )

  const correctByRank = entries
    .filter((entry) => entry.answer && entry.answer.choiceId === correctChoiceId)
    .sort((a, b) => a.answer!.answeredAt.toMillis() - b.answer!.answeredAt.toMillis())
  const correctCount = correctByRank.length
  const rankByPlayerId = new Map(correctByRank.map((entry, index) => [entry.playerUid, index + 1]))

  await Promise.all(
    entries.map(async ({ playerUid, answer }) => {
      try {
        if (!answer) {
          await resetStreak(gameCode, playerUid)
          return
        }
        if (answer.isCorrect !== null) return

        const isCorrect = answer.choiceId === correctChoiceId
        const rankMultiplier = isCorrect
          ? rankBonusMultiplier(rankByPlayerId.get(playerUid)!, correctCount)
          : 1
        await gradeAnswer(gameCode, playerUid, questionIndex, isCorrect, rankMultiplier)
      } catch (err) {
        console.error('finalizeQuestion: 답안 정리 실패', playerUid, err)
      }
    }),
  )
}

// grades a single answer and folds the result into the player's running
// score/streak; only ever called from finalizeQuestion, which is the only
// place that knows the correct choice and every player's submission rank
export async function gradeAnswer(
  gameCode: string,
  playerUid: string,
  questionIndex: number,
  isCorrect: boolean,
  rankMultiplier: number,
) {
  const playerRef = doc(db, 'games', gameCode, 'players', playerUid)

  await runTransaction(db, async (tx) => {
    const playerSnap = await tx.get(playerRef)
    const player = playerSnap.data() as Player

    const newStreak = isCorrect ? player.currentStreak + 1 : 0
    const points = isCorrect
      ? Math.round(BASE_POINTS_PER_CORRECT_ANSWER * streakBonusMultiplier(newStreak) * rankMultiplier)
      : 0

    tx.update(answerRef(gameCode, playerUid, questionIndex), {
      isCorrect,
      pointsEarned: points,
    })
    tx.update(playerRef, {
      totalScore: player.totalScore + points,
      currentStreak: newStreak,
    })
  })
}

