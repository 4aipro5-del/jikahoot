import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { auth } from '@/lib/firebase/client'

const googleProvider = new GoogleAuthProvider()

// Teacher flow: real identity, used as the room/game owner uid everywhere.
export function signInTeacherWithGoogle() {
  return signInWithPopup(auth, googleProvider)
}

// Student flow: no visible login UI, just a uid to hang security rules off of.
export function signInStudentAnonymously() {
  return signInAnonymously(auth)
}

export function signOutUser() {
  return signOut(auth)
}

export function subscribeToAuthState(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback)
}
