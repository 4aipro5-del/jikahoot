import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import type { Room, RoomWithId } from '@/types/firestore'

// no 0/O/1/I/L — easy to read aloud and type on a Chromebook
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const ROOM_CODE_LENGTH = 6
const MAX_ATTEMPTS = 5
const DEFAULT_ROOM_NAME = '기본 방'
// generous cap so a normal teacher is never blocked, but runaway creation is
export const MAX_ROOMS_PER_TEACHER = 20

function generateRoomCode(): string {
  let code = ''
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)]
  }
  return code
}

function attachId(roomId: string, data: Room): RoomWithId {
  return { roomId, ...data }
}

// A teacher's PRIMARY room lives at rooms/{ownerUid} (doc id == uid). This keeps
// guests (anon uid) and pre-multi-room rooms working, and makes migration a
// no-op move — additional rooms (a later phase) use random ids with the same
// ownerUid field. Rooms are queried by ownerUid, never by doc id.

// Pre-multi-room rooms predate ownerUid/name (and stored the teacher profile,
// which now lives in Firebase Auth). Backfill the room-scoped fields lazily so
// multi-room queries/labels work; the leftover profile fields are simply
// ignored from here on. Runs at most once per room (no-op after backfill).
async function migrateLegacyRoom(roomId: string, data: Record<string, unknown>): Promise<Room> {
  const patch: Record<string, unknown> = {}
  if (data.ownerUid == null) patch.ownerUid = roomId
  if (data.name == null) patch.name = DEFAULT_ROOM_NAME
  if (Object.keys(patch).length > 0) {
    await updateDoc(doc(db, 'rooms', roomId), patch)
  }
  return { ...data, ...patch } as unknown as Room
}

export async function getPrimaryRoom(ownerUid: string): Promise<RoomWithId | null> {
  const snap = await getDoc(doc(db, 'rooms', ownerUid))
  if (!snap.exists()) return null
  const data = await migrateLegacyRoom(ownerUid, snap.data() as Record<string, unknown>)
  return attachId(ownerUid, data)
}

// Ensures the teacher's primary room (+ a matching roomCodes reservation) exists
// on first login; returns the existing room untouched afterwards.
export async function ensurePrimaryRoom(ownerUid: string): Promise<RoomWithId> {
  const existing = await getPrimaryRoom(ownerUid)
  if (existing) return existing

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generateRoomCode()
    const codeRef = doc(db, 'roomCodes', code)

    try {
      const room = await runTransaction(db, async (tx) => {
        const codeSnap = await tx.get(codeRef)
        if (codeSnap.exists()) {
          throw new Error('ROOM_CODE_TAKEN')
        }

        const newRoom: Room = {
          ownerUid,
          name: DEFAULT_ROOM_NAME,
          roomCode: code,
          createdAt: serverTimestamp() as unknown as Timestamp,
        }
        tx.set(doc(db, 'rooms', ownerUid), newRoom)
        // teacherUid (owner) keeps the roomCodes rules uid-based; roomId is the
        // room the code points at (equals ownerUid for a primary room).
        tx.set(codeRef, { teacherUid: ownerUid, roomId: ownerUid })
        return newRoom
      })
      return attachId(ownerUid, room)
    } catch (err) {
      if (err instanceof Error && err.message === 'ROOM_CODE_TAKEN') continue
      throw err
    }
  }

  throw new Error('방 코드를 생성하지 못했습니다. 다시 시도해 주세요.')
}

export function subscribeToRoom(roomId: string, callback: (room: RoomWithId | null) => void) {
  return onSnapshot(doc(db, 'rooms', roomId), (snap) => {
    callback(snap.exists() ? attachId(roomId, snap.data() as Room) : null)
  })
}

// Live list of every room this teacher owns (newest first). Single-field filter
// so no composite index is needed; ordering is done client-side.
export function subscribeToRooms(
  ownerUid: string,
  callback: (rooms: RoomWithId[]) => void,
) {
  const q = query(collection(db, 'rooms'), where('ownerUid', '==', ownerUid))
  return onSnapshot(q, (snapshot) => {
    const rooms = snapshot.docs
      .map((d) => attachId(d.id, d.data() as Room))
      .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0))
    callback(rooms)
  })
}

// Creates an ADDITIONAL room (random id) for a teacher who already has one. The
// very first room is created at rooms/{uid} by ensurePrimaryRoom instead.
export async function createRoom(ownerUid: string, name: string): Promise<RoomWithId> {
  const roomRef = doc(collection(db, 'rooms')) // random id
  const roomId = roomRef.id

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generateRoomCode()
    const codeRef = doc(db, 'roomCodes', code)
    try {
      const room = await runTransaction(db, async (tx) => {
        const codeSnap = await tx.get(codeRef)
        if (codeSnap.exists()) throw new Error('ROOM_CODE_TAKEN')
        const newRoom: Room = {
          ownerUid,
          name: name.trim() || DEFAULT_ROOM_NAME,
          roomCode: code,
          createdAt: serverTimestamp() as unknown as Timestamp,
        }
        tx.set(roomRef, newRoom)
        tx.set(codeRef, { teacherUid: ownerUid, roomId })
        return newRoom
      })
      return attachId(roomId, room)
    } catch (err) {
      if (err instanceof Error && err.message === 'ROOM_CODE_TAKEN') continue
      throw err
    }
  }
  throw new Error('방 코드를 생성하지 못했습니다. 다시 시도해 주세요.')
}

export function renameRoom(roomId: string, name: string) {
  return updateDoc(doc(db, 'rooms', roomId), { name: name.trim() || DEFAULT_ROOM_NAME })
}

// Deletes a room and its question bank + code reservation. Question docs are
// removed first (while the room still exists, so the owner rule can resolve
// ownership), then the room and its roomCode. Any past game docs are ephemeral
// and left as-is (a future cleanup job / TTL handles those).
export async function deleteRoom(roomId: string, roomCode: string): Promise<void> {
  const bankSnap = await getDocs(collection(db, 'rooms', roomId, 'questionBank'))
  let batch = writeBatch(db)
  let pending = 0
  for (const d of bankSnap.docs) {
    batch.delete(d.ref)
    pending += 1
    if (pending >= 400) {
      await batch.commit()
      batch = writeBatch(db)
      pending = 0
    }
  }
  if (pending > 0) await batch.commit()

  const finalBatch = writeBatch(db)
  finalBatch.delete(doc(db, 'roomCodes', roomCode))
  finalBatch.delete(doc(db, 'rooms', roomId))
  await finalBatch.commit()
}

// Settings tab writes: persist any subset of the room-configurable fields (name,
// game defaults). 학생 제출 여부는 여기가 아니라 roomCodes.submissionOpen 으로 제어한다.
export function updateRoomSettings(
  roomId: string,
  patch: Partial<Pick<Room, 'name' | 'defaultQuestionDurationSec' | 'autoAdvance'>>,
) {
  return updateDoc(doc(db, 'rooms', roomId), patch)
}

// explicit "다시 시작": dismisses the finished game so the next startGame call
// doesn't try to reuse it. Only clears the pointer when the room STILL points at
// this game — so an old results tab (or one opened after a newer game started)
// can't wipe the live session's link.
export function clearCurrentGame(roomId: string, gameCode: string) {
  const roomRef = doc(db, 'rooms', roomId)
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef)
    if (!snap.exists()) return
    if ((snap.data() as Room).currentGameId !== gameCode) return
    tx.update(roomRef, {
      currentGameId: null,
      currentGameStatus: null,
    })
  })
}
