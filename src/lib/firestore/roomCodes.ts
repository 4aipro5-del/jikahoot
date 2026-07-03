import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import type { RoomCode } from '@/types/firestore'

export async function resolveRoomCode(code: string): Promise<string | null> {
  const snap = await getDoc(doc(db, 'roomCodes', code))
  if (!snap.exists()) return null
  return (snap.data() as RoomCode).teacherUid
}
