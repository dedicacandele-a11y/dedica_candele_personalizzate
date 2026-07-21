import { app, firebaseReady, isFirebaseLocal } from "./firebase.js";

const LOCAL_NEWSLETTER_KEY = "dedica_newsletter_subscribers";

export async function subscribeNewsletter(email, { consentVersion = "" } = {}) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error("Inserisci una email valida.");
  }

  await firebaseReady;
  if (isFirebaseLocal || !app) {
    const subscribers = JSON.parse(localStorage.getItem(LOCAL_NEWSLETTER_KEY) || "[]");
    if (!subscribers.some(item => item.email === normalizedEmail)) {
      subscribers.push({ email: normalizedEmail, source: "react_home", consentVersion, consentAt: new Date().toISOString() });
      localStorage.setItem(LOCAL_NEWSLETTER_KEY, JSON.stringify(subscribers));
    }
    return { ok: true, source: "local" };
  }

  const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");
  const subscribeNewsletterFn = httpsCallable(getFunctions(app, "europe-west1"), "subscribeNewsletter");
  const result = await subscribeNewsletterFn({ email: normalizedEmail, source: "react_home", consent: true, consentVersion });
  return result.data || { ok: true };
}
