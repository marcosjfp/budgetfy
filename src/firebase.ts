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
export { signInWithEmailAndPassword, createUserWithEmailAndPassword };
