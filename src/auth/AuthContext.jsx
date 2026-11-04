import { createContext, useContext, useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
} from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  auth,
  db,
  firebaseEnabled,
  firebaseGoogleEnabled,
} from "../firebase";

const AuthContext = createContext(null);
const cachedDataKeys = [
  "mindmate-data-v1",
  "mindmate-gratitude-",
  "mindmate-habits-",
];

function clearSensitiveCache() {
  try {
    const keysToRemove = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && cachedDataKeys.some((prefix) => key.startsWith(prefix)))
        keysToRemove.push(key);
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Browser storage may be unavailable in restricted contexts.
  }
}

async function ensureUserProfile(user, displayName = user.displayName || "") {
  const profileRef = doc(db, "users", user.uid);
  const profileSnapshot = await getDoc(profileRef);
  await setDoc(
    profileRef,
    {
      uid: user.uid,
      displayName,
      email: user.email || "",
      updatedAt: serverTimestamp(),
      ...(!profileSnapshot.exists() ? { createdAt: serverTimestamp() } : {}),
    },
    { merge: true },
  );
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseEnabled) {
      setLoading(false);
      return undefined;
    }
    return onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setLoading(false);
        if (!currentUser) clearSensitiveCache();
      },
      () => {
        setUser(null);
        setLoading(false);
        clearSensitiveCache();
      },
    );
  }, []);

  async function signIn(email, password, rememberMe) {
    if (!firebaseEnabled) throw new Error("Firebase is not configured yet.");
    await setPersistence(
      auth,
      rememberMe ? browserLocalPersistence : browserSessionPersistence,
    );
    return signInWithEmailAndPassword(auth, email.trim(), password);
  }

  async function signUp({ displayName, email, password }) {
    if (!firebaseEnabled) throw new Error("Firebase is not configured yet.");
    await setPersistence(auth, browserLocalPersistence);
    const credential = await createUserWithEmailAndPassword(
      auth,
      email.trim(),
      password,
    );
    const name = displayName.trim();
    if (name) await updateProfile(credential.user, { displayName: name });
    await ensureUserProfile(credential.user, name);
    await sendEmailVerification(credential.user);
    return credential.user;
  }

  async function signInWithGoogle() {
    if (!firebaseGoogleEnabled)
      throw new Error("Google sign-in is not enabled for this app.");
    await setPersistence(auth, browserLocalPersistence);
    const credential = await signInWithPopup(auth, new GoogleAuthProvider());
    await ensureUserProfile(credential.user);
    return credential.user;
  }

  async function sendPasswordReset(email) {
    if (!firebaseEnabled) throw new Error("Firebase is not configured yet.");
    return sendPasswordResetEmail(auth, email.trim());
  }

  async function signOut() {
    if (!firebaseEnabled) return;
    await firebaseSignOut(auth);
    clearSensitiveCache();
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        firebaseEnabled,
        firebaseGoogleEnabled,
        signIn,
        signUp,
        signInWithGoogle,
        sendPasswordReset,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}

export function getAuthErrorMessage(error) {
  const messages = {
    "auth/configuration-not-found": "Firebase Authentication is not set up for this project yet. In Firebase Console, open the project matching VITE_FIREBASE_PROJECT_ID, choose Authentication, click Get started, and enable Email/Password.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/invalid-credential": "That email and password combination was not recognized.",
    "auth/email-already-in-use": "An account already exists for that email.",
    "auth/weak-password": "Choose a stronger password with at least 6 characters.",
    "auth/popup-closed-by-user": "The Google sign-in window was closed before finishing.",
    "auth/operation-not-allowed": "This sign-in method is not enabled in Firebase yet.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
    "auth/network-request-failed": "Check your internet connection and try again.",
  };
  return messages[error?.code] || error?.message || "Something went wrong. Please try again.";
}