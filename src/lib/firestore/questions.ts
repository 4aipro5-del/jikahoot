import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import type { Choice, Question } from '@/types/firestore'

export type QuestionWithId = Question & { id: string }

function questionBankRef(roomId: string) {
  return collection(db, 'rooms', roomId, 'questionBank')
}

export function buildChoices(texts: string[]): Choice[] {
  return texts.map((text, index) => ({ id: `c${index}`, text }))
}

export function subscribeToQuestionBank(
  roomId: string,
  callback: (questions: QuestionWithId[]) => void,
) {
  const q = query(questionBankRef(roomId), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Question) })))
  })
}

export function createTeacherQuestion(
  roomId: string,
  input: { text: string; choices: Choice[]; correctChoiceId: string },
) {
  return addDoc(questionBankRef(roomId), {
    text: input.text,
    choices: input.choices,
    correctChoiceId: input.correctChoiceId,
    createdBy: 'teacher',
    authorUid: null,
    authorNickname: null,
    status: 'approved',
    createdAt: serverTimestamp(),
    reviewedAt: serverTimestamp(),
  })
}

export function submitStudentQuestion(
  roomId: string,
  input: {
    text: string
    choices: Choice[]
    correctChoiceId: string
    authorUid: string
    authorNickname: string
  },
) {
  return addDoc(questionBankRef(roomId), {
    text: input.text,
    choices: input.choices,
    correctChoiceId: input.correctChoiceId,
    createdBy: 'student',
    authorUid: input.authorUid,
    authorNickname: input.authorNickname,
    status: 'pending',
    createdAt: serverTimestamp(),
    reviewedAt: null,
  })
}

export function updateQuestion(
  roomId: string,
  questionId: string,
  patch: Partial<Pick<Question, 'text' | 'choices' | 'correctChoiceId'>>,
) {
  return updateDoc(doc(db, 'rooms', roomId, 'questionBank', questionId), patch)
}

export function deleteQuestion(roomId: string, questionId: string) {
  return deleteDoc(doc(db, 'rooms', roomId, 'questionBank', questionId))
}

export function approveQuestion(roomId: string, questionId: string) {
  return updateDoc(doc(db, 'rooms', roomId, 'questionBank', questionId), {
    status: 'approved',
    reviewedAt: serverTimestamp(),
  })
}

export function rejectQuestion(roomId: string, questionId: string) {
  return updateDoc(doc(db, 'rooms', roomId, 'questionBank', questionId), {
    status: 'rejected',
    reviewedAt: serverTimestamp(),
  })
}

// only the room owner can read questionBank, so this only ever runs on the
// host client to know what counts as correct while grading a live game
export async function getCorrectChoiceMap(
  roomId: string,
  questionIds: string[],
): Promise<Record<string, string>> {
  const entries = await Promise.all(
    questionIds.map(async (id) => {
      const snap = await getDoc(doc(db, 'rooms', roomId, 'questionBank', id))
      return [id, (snap.data() as Question).correctChoiceId] as const
    }),
  )
  return Object.fromEntries(entries)
}

export type RoomQuestionStats = { total: number; pending: number; rejected: number }

// Aggregate counts for a room card (문제 수 / 승인 대기 / 검토 필요). Uses server
// count aggregation so it's cheap even across many rooms — a one-shot snapshot,
// not a live subscription.
export async function getRoomQuestionStats(roomId: string): Promise<RoomQuestionStats> {
  const base = questionBankRef(roomId)
  const [total, pending, rejected] = await Promise.all([
    getCountFromServer(base),
    getCountFromServer(query(base, where('status', '==', 'pending'))),
    getCountFromServer(query(base, where('status', '==', 'rejected'))),
  ])
  return {
    total: total.data().count,
    pending: pending.data().count,
    rejected: rejected.data().count,
  }
}
