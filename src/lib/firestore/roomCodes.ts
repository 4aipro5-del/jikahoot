import { doc, getDoc, onSnapshot, writeBatch } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import type { RoomCode } from '@/types/firestore'

// Legacy roomCodes docs only carry teacherUid; new ones also carry roomId. For a
// primary room the two are equal, so falling back to teacherUid resolves both.
function roomIdOf(data: RoomCode): string {
  return data.roomId ?? data.teacherUid
}

// Resolves a code to the room it points at (used by the home portal to tell a
// room code apart from a game code before routing a student to /submit).
export async function resolveRoomCode(code: string): Promise<string | null> {
  const snap = await getDoc(doc(db, 'roomCodes', code))
  if (!snap.exists()) return null
  return roomIdOf(snap.data() as RoomCode)
}

export type RoomCodeInfo = {
  roomId: string
  // absent submissionOpen means "open" — see the RoomCode type note
  submissionOpen: boolean
}

// Student-side read: resolves a code to its room AND whether submissions are
// currently accepted, so /submit can refuse when the teacher ended the session.
export async function getRoomCodeInfo(code: string): Promise<RoomCodeInfo | null> {
  const snap = await getDoc(doc(db, 'roomCodes', code))
  if (!snap.exists()) return null
  const data = snap.data() as RoomCode
  return { roomId: roomIdOf(data), submissionOpen: data.submissionOpen !== false }
}

// Teacher-side live view of their own submission session (code + open state),
// so the 학생 문제 제출 screen reflects 제출 종료/열기 without a reload.
export function subscribeToRoomCode(
  code: string,
  callback: (info: RoomCodeInfo | null) => void,
) {
  return onSnapshot(doc(db, 'roomCodes', code), (snap) => {
    if (!snap.exists()) {
      callback(null)
      return
    }
    const data = snap.data() as RoomCode
    callback({ roomId: roomIdOf(data), submissionOpen: data.submissionOpen !== false })
  })
}

// 제출 종료 / 다시 열기.
// Writes BOTH copies atomically so they never diverge:
//  - rooms/{roomId}.submissionOpen    → the rules ENFORCEMENT source
//    (questionBank create get()s it by roomId)
//  - roomCodes/{code}.submissionOpen  → student-readable mirror for the UI
// Only the owning teacher may write either (enforced in firestore.rules).
export function setSubmissionOpen(roomId: string, code: string, open: boolean) {
  const batch = writeBatch(db)
  batch.update(doc(db, 'rooms', roomId), { submissionOpen: open })
  batch.update(doc(db, 'roomCodes', code), { submissionOpen: open })
  return batch.commit()
}
