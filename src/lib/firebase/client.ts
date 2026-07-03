import { getApps, initializeApp, type FirebaseOptions } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Every consumer in this app is client-only (popup sign-in, anonymous auth,
// onSnapshot listeners), so skip initialization during SSR/build where no
// real config is available and Firebase would throw on an invalid api key.
export const firebaseApp =
  typeof window !== 'undefined' ? (getApps()[0] ?? initializeApp(firebaseConfig)) : undefined

export const auth = firebaseApp ? getAuth(firebaseApp) : (undefined as unknown as Auth)
export const db = firebaseApp ? getFirestore(firebaseApp) : (undefined as unknown as Firestore)
