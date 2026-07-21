import { app, firebaseReady, isFirebaseLocal } from "./firebase.js";

async function call(name, data = {}) {
  await firebaseReady;
  if (isFirebaseLocal || !app) throw new Error("Gestione utenti non disponibile in modalità locale.");
  const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");
  return (await httpsCallable(getFunctions(app, "europe-west1"), name)(data)).data;
}
export const listAdminUsers = (data = {}) => call("adminListUsers", data);
export const setAdminUserDisabled = (uid, disabled) => call("adminSetUserDisabled", { uid, disabled });
