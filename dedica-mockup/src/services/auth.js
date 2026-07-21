import { auth, firebaseReady, isFirebaseLocal } from "./firebase.js";

export const ADMIN_EMAIL = "gennaro.mazzacane@gmail.com";

export function isAdminUser(user) {
  return Boolean(user?.isLocalAdmin || user?.email?.toLowerCase() === ADMIN_EMAIL);
}

export async function getCurrentUser() {
  await firebaseReady;
  if (isFirebaseLocal || !auth) {
    return sessionStorage.getItem("admin_logged") === "true"
      ? { email: "admin locale", isLocalAdmin: true }
      : null;
  }

  return auth.currentUser || null;
}

export async function watchCurrentUser(callback) {
  await firebaseReady;
  if (isFirebaseLocal || !auth) {
    callback(await getCurrentUser());
    return () => {};
  }

  const { onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
  return onAuthStateChanged(auth, callback);
}

export async function signOutUser() {
  await firebaseReady;
  if (isFirebaseLocal || !auth) {
    sessionStorage.removeItem("admin_logged");
    return;
  }

  const { signOut } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
  await signOut(auth);
}

export async function signInUser(email, password) {
  await firebaseReady;
  if (isFirebaseLocal || !auth) {
    throw new Error("Firebase Auth non disponibile in modalità locale.");
  }

  const { signInWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function registerUser(email, password) {
  await firebaseReady;
  if (isFirebaseLocal || !auth) {
    throw new Error("Firebase Auth non disponibile in modalità locale.");
  }

  const { createUserWithEmailAndPassword, sendEmailVerification } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await sendEmailVerification(credential.user, {
    url: `${window.location.origin}/account`,
    handleCodeInApp: false
  });
  return credential.user;
}

export async function resetUserPassword(email) {
  await firebaseReady;
  if (isFirebaseLocal || !auth) {
    throw new Error("Firebase Auth non disponibile in modalità locale.");
  }

  const { sendPasswordResetEmail } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
  await sendPasswordResetEmail(auth, email);
}

export async function resendCurrentUserVerification() {
  await firebaseReady;
  if (isFirebaseLocal || !auth?.currentUser) throw new Error("Accedi prima di richiedere una nuova email.");
  const { sendEmailVerification } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
  await sendEmailVerification(auth.currentUser, {
    url: `${window.location.origin}/account`,
    handleCodeInApp: false
  });
}

export function setLoginRedirect(path) {
  localStorage.setItem("dedica_login_redirect", path);
}

export function consumeLoginRedirect(fallback = "/account") {
  const redirect = localStorage.getItem("dedica_login_redirect") || fallback;
  localStorage.removeItem("dedica_login_redirect");
  return redirect;
}
