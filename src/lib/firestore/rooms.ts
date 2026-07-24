import { doc, getDoc, onSnapshot, runTransaction, serverTimestamp, setDoc, updateDoc, type Timestamp } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { db } from '@/lib/firebase/client'
import type { Room } from '@/types/firestore'

// no 0/O/1/I/L — easy to read aloud and type on a Chromebook
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const ROOM_CODE_LENGTH = 6
const MAX_ATTEMPTS = 5

function generateRoomCode(): string {
  let code = ''
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)]
  }
  return code
}

// Creates rooms/{teacherUid} + a matching roomCodes/{code} reservation on first
// login; returns the existing room untouched on every login after that.
export async function ensureRoom(user: User): Promise<Room> {
  const roomRef = doc(db, 'rooms', user.uid)
  const existing = await getDoc(roomRef)
  if (existing.exists()) {
    return existing.data() as Room
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generateRoomCode()
    const codeRef = doc(db, 'roomCodes', code)

    try {
      return await runTransaction(db, async (tx) => {
        const codeSnap = await tx.get(codeRef)
        if (codeSnap.exists()) {
          throw new Error('ROOM_CODE_TAKEN')
        }

        const room: Room = {
          teacherUid: user.uid,
          displayName: user.displayName ?? '',
          email: user.email ?? '',
          photoUrl: user.photoURL ?? null,
          roomCode: code,
          createdAt: serverTimestamp() as unknown as Timestamp,
        }

        tx.set(roomRef, room)
        tx.set(codeRef, { teacherUid: user.uid })
        return room
      })
    } catch (err) {
      if (err instanceof Error && err.message === 'ROOM_CODE_TAKEN') continue
      throw err
    }
  }

  throw new Error('방 코드를 생성하지 못했습니다. 다시 시도해 주세요.')
}

export async function getRoomByTeacherUid(teacherUid: string): Promise<Room | null> {
  const roomSnap = await getDoc(doc(db, 'rooms', teacherUid))
  return roomSnap.exists() ? (roomSnap.data() as Room) : null
}

export function subscribeToRoom(teacherUid: string, callback: (room: Room | null) => void) {
  return onSnapshot(doc(db, 'rooms', teacherUid), (snap) => {
    callback(snap.exists() ? (snap.data() as Room) : null)
  })
}

// Settings tab writes: persist any subset of the teacher-configurable Room
// fields (display name, game defaults, avatar pref). 학생 제출 여부는 여기가
// 아니라 roomCodes.submissionOpen 으로 제어한다.
export function updateRoomSettings(
  teacherUid: string,
  patch: Partial<
    Pick<Room, 'displayName' | 'useGooglePhoto' | 'defaultQuestionDurationSec' | 'autoAdvance'>
  >,
) {
  return updateDoc(doc(db, 'rooms', teacherUid), patch)
}

// explicit "다시 시작": dismisses the finished game so the next startGame call
// doesn't try to reuse it, and other sessions viewing this room see it as idle
export function clearCurrentGame(teacherUid: string) {
  return updateDoc(doc(db, 'rooms', teacherUid), {
    currentGameId: null,
    currentGameStatus: null,
  })
}

export async function syncRoomProfile(user: User): Promise<Room> {
  const existing = await getRoomByTeacherUid(user.uid)
  if (!existing) {
    return ensureRoom(user)
  }

  const nextProfile = {
    displayName: user.displayName ?? '',
    email: user.email ?? '',
    photoUrl: user.photoURL ?? null,
  }

  if (
    existing.displayName === nextProfile.displayName &&
    existing.email === nextProfile.email &&
    existing.photoUrl === nextProfile.photoUrl
  ) {
    return existing
  }

  await setDoc(
    doc(db, 'rooms', user.uid),
    nextProfile,
    { merge: true },
  )

  return {
    ...existing,
    ...nextProfile,
  }
}
