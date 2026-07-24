import { doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import type { RoomCode } from '@/types/firestore'

export async function resolveRoomCode(code: string): Promise<string | null> {
  const snap = await getDoc(doc(db, 'roomCodes', code))
  if (!snap.exists()) return null
  return (snap.data() as RoomCode).teacherUid
}

export type RoomCodeInfo = {
  teacherUid: string
  // absent submissionOpen means "open" — see the RoomCode type note
  submissionOpen: boolean
}

// Student-side read: resolves a code to its owner AND whether submissions are
// currently accepted, so /submit can refuse when the teacher ended the session.
export async function getRoomCodeInfo(code: string): Promise<RoomCodeInfo | null> {
  const snap = await getDoc(doc(db, 'roomCodes', code))
  if (!snap.exists()) return null
  const data = snap.data() as RoomCode
  return { teacherUid: data.teacherUid, submissionOpen: data.submissionOpen !== false }
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
    callback({ teacherUid: data.teacherUid, submissionOpen: data.submissionOpen !== false })
  })
}

// 제출 종료 / 다시 열기 — only the owning teacher may flip this (enforced in rules)
export function setSubmissionOpen(code: string, open: boolean) {
  return updateDoc(doc(db, 'roomCodes', code), { submissionOpen: open })
}
