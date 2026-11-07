import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  type Auth,
} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

/**
 * Firebase (Google sign-in) is optional. Without an API key — in
 * firebase-applet-config.json or VITE_FIREBASE_API_KEY — the app still runs
 * with email/password auth and the Google button is hidden, instead of
 * crashing at startup with auth/invalid-api-key.
 */
const apiKey = (firebaseConfig as { apiKey?: string }).apiKey || import.meta.env.VITE_FIREBASE_API_KEY;

let authInstance: Auth | null = null;
if (apiKey) {
  try {
    authInstance = getAuth(initializeApp({ ...firebaseConfig, apiKey }));
  } catch (error) {
    console.error('[firebase] initialisation failed; Google sign-in disabled.', error);
  }
}

export const auth = authInstance;
export const firebaseEnabled = authInstance !== null;
export const googleProvider = new GoogleAuthProvider();

export const signIn = () => {
  if (!auth) return Promise.reject(new Error('Firebase is not configured'));
  return signInWithPopup(auth, googleProvider);
};
export const logOut = () => (auth ? signOut(auth) : Promise.resolve());

/** Session returned by /api/auth/login, /register and /firebase. */
export interface AppSession {
  token: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any;
}

/**
 * Trades the signed-in Firebase (Google) user for a normal Budgetfy session. The server opens the
 * existing account with the same verified email, so Google and email/password reach the same data.
 * The Firebase session is then closed: the app only uses its own token from here on.
 */
export async function exchangeFirebaseSession(
  firebaseUser: { getIdToken: () => Promise<string> },
  post: (endpoint: string, body: unknown) => Promise<AppSession>,
): Promise<AppSession> {
  const idToken = await firebaseUser.getIdToken();
  try {
    return await post('/auth/firebase', { idToken });
  } finally {
    await logOut().catch(() => undefined);
  }
}
export { signInWithEmailAndPassword, createUserWithEmailAndPassword };
