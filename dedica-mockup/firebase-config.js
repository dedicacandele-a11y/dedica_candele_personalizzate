// Configurazione Firebase SDK (CDN / ES Module)

const firebaseConfig = {
  apiKey: "AIzaSyAj9acsq7LrJrkxyBIy7CmnwhyUgojkuyM",
  authDomain: "dedica-6642d.firebaseapp.com",
  projectId: "dedica-6642d",
  storageBucket: "dedica-6642d.firebasestorage.app",
  messagingSenderId: "949503215842",
  appId: "1:949503215842:web:ff99afb4e455ecbb8d76bb",
  measurementId: "G-2WGE2T77N3"
};

let app = null;
let analytics = null;
let auth = null;
let db = null;
let storage = null;
let isFirebaseLocal = true;

async function initFirebase() {
  if (!firebaseConfig.apiKey) {
    console.warn("DEDICA: In esecuzione in modalita locale di emergenza. Per attivare il database reale, inserisci le tue chiavi in firebase-config.js");
    return;
  }

  try {
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
    const { getAuth } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
    const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    const { getStorage } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js");

    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    isFirebaseLocal = false;

    console.log("Firebase inizializzato correttamente in modalita Cloud.");
  } catch (err) {
    console.error("Errore durante il caricamento di Firebase SDK. Avvio in modalita locale di emergenza.", err);
  }
}

const firebaseReady = initFirebase();

async function enableAnalyticsAfterConsent() {
  await firebaseReady;
  if (!app || analytics) return analytics;
  const { getAnalytics, isSupported } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js");
  analytics = (await isSupported()) ? getAnalytics(app) : null;
  return analytics;
}

export { app, analytics, auth, db, storage, isFirebaseLocal, firebaseReady, enableAnalyticsAfterConsent };
