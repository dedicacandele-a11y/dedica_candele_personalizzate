import { app, firebaseReady, isFirebaseLocal } from "./firebase.js";

export async function checkSpediamoConnection() {
  await firebaseReady;
  if (isFirebaseLocal || !app) {
    return { connected: false, local: true, draftCount: 0, message: "La connessione reale è disponibile dopo il deploy su Firebase." };
  }
  const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");
  const result = await httpsCallable(getFunctions(app, "europe-west1"), "adminCheckSpediamo")({});
  return result.data;
}
