import { doc, getDoc, runTransaction, serverTimestamp, type Timestamp } from 'firebase/firestore'
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
