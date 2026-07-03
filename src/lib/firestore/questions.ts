import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import type { Choice, Question } from '@/types/firestore'

export type QuestionWithId = Question & { id: string }

function questionBankRef(teacherUid: string) {
  return collection(db, 'rooms', teacherUid, 'questionBank')
}

export function buildChoices(texts: string[]): Choice[] {
  return texts.map((text, index) => ({ id: `c${index}`, text }))
}

export function subscribeToQuestionBank(
  teacherUid: string,
  callback: (questions: QuestionWithId[]) => void,
) {
  const q = query(questionBankRef(teacherUid), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Question) })))
  })
}

export function createTeacherQuestion(
  teacherUid: string,
  input: { text: string; choices: Choice[]; correctChoiceId: string },
) {
  return addDoc(questionBankRef(teacherUid), {
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
  teacherUid: string,
  input: {
    text: string
    choices: Choice[]
    correctChoiceId: string
    authorUid: string
    authorNickname: string
  },
) {
  return addDoc(questionBankRef(teacherUid), {
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
  teacherUid: string,
  questionId: string,
  patch: Partial<Pick<Question, 'text' | 'choices' | 'correctChoiceId'>>,
) {
  return updateDoc(doc(db, 'rooms', teacherUid, 'questionBank', questionId), patch)
}

export function deleteQuestion(teacherUid: string, questionId: string) {
  return deleteDoc(doc(db, 'rooms', teacherUid, 'questionBank', questionId))
}

export function approveQuestion(teacherUid: string, questionId: string) {
  return updateDoc(doc(db, 'rooms', teacherUid, 'questionBank', questionId), {
    status: 'approved',
    reviewedAt: serverTimestamp(),
  })
}

export function rejectQuestion(teacherUid: string, questionId: string) {
  return updateDoc(doc(db, 'rooms', teacherUid, 'questionBank', questionId), {
    status: 'rejected',
    reviewedAt: serverTimestamp(),
  })
}

// only the room owner can read questionBank, so this only ever runs on the
// host client to know what counts as correct while grading a live game
export async function getCorrectChoiceMap(
  teacherUid: string,
  questionIds: string[],
): Promise<Record<string, string>> {
  const entries = await Promise.all(
    questionIds.map(async (id) => {
      const snap = await getDoc(doc(db, 'rooms', teacherUid, 'questionBank', id))
      return [id, (snap.data() as Question).correctChoiceId] as const
    }),
  )
  return Object.fromEntries(entries)
}
