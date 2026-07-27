import {
  GoogleAuthProvider,
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { auth } from '@/lib/firebase/client'

const googleProvider = new GoogleAuthProvider()

// Both a student and a guest teacher are anonymous Firebase users, so we can't
// tell them apart from the auth session alone. This browser-local marker flags
// "this anonymous session is acting as a teacher" so the landing/dashboard can
// route and label it correctly.
const GUEST_TEACHER_KEY = 'jikahoot-guest-teacher'

// Teacher flow: real identity, used as the room/game owner uid everywhere.
export function signInTeacherWithGoogle() {
  return signInWithPopup(auth, googleProvider)
}

// Guest teacher flow: same anonymous mechanism as students, but the resulting
// uid is used as a room/game owner. Rules are uid-based (provider-agnostic), so
// no rules change is needed. Persistence is browser-local only.
export function signInTeacherAsGuest() {
  return signInAnonymously(auth)
}

// Upgrade a guest (anonymous) teacher into a permanent Google-backed account
// WITHOUT changing the uid — so their room, question bank, and games carry over.
export function linkTeacherWithGoogle(user: User) {
  return linkWithPopup(user, googleProvider)
}

export function markGuestTeacher() {
  if (typeof window !== 'undefined') window.localStorage.setItem(GUEST_TEACHER_KEY, '1')
}

export function isGuestTeacher() {
  return typeof window !== 'undefined' && window.localStorage.getItem(GUEST_TEACHER_KEY) === '1'
}

export function clearGuestTeacher() {
  if (typeof window !== 'undefined') window.localStorage.removeItem(GUEST_TEACHER_KEY)
}

// Student flow: no visible login UI, just a uid to hang security rules off of.
export function signInStudentAnonymously() {
  return signInAnonymously(auth)
}

export function signOutUser() {
  // drop the guest marker so a later anonymous student session on this browser
  // isn't mistaken for a teacher
  clearGuestTeacher()
  return signOut(auth)
}

export function updateTeacherDisplayName(user: User, displayName: string) {
  return updateProfile(user, { displayName })
}

export function subscribeToAuthState(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback)
}
