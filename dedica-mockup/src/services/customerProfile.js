import { auth, db, firebaseReady, isFirebaseLocal } from "./firebase.js";

export const EMPTY_CUSTOMER_PROFILE = {
  email: "", nome: "", cognome: "", telefono: "",
  indirizzo: "", civico: "", indirizzo2: "", citta: "", provincia: "", cap: "", paese: "Italia", countryCode: "IT", noteConsegna: "",
  billingSameAsShipping: true, tipoCliente: "privato", ragioneSociale: "", codiceFiscale: "", partitaIva: "", codiceDestinatario: "", pec: "",
};

export function normalizeCustomerProfile(value = {}) {
  return { ...EMPTY_CUSTOMER_PROFILE, ...value, countryCode: "IT", paese: "Italia", billingSameAsShipping: value.billingSameAsShipping !== false };
}

export async function getCustomerProfile() {
  await firebaseReady;
  if (isFirebaseLocal || !db || !auth?.currentUser) return normalizeCustomerProfile(JSON.parse(localStorage.getItem("dedica_customer_profile") || "{}"));
  const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  const snapshot = await getDoc(doc(db, "customer_profiles", auth.currentUser.uid));
  return normalizeCustomerProfile({ email: auth.currentUser.email || "", ...(snapshot.exists() ? snapshot.data() : {}) });
}

export async function saveCustomerProfile(profile) {
  const normalized = normalizeCustomerProfile(profile);
  await firebaseReady;
  if (isFirebaseLocal || !db || !auth?.currentUser) { localStorage.setItem("dedica_customer_profile", JSON.stringify(normalized)); return normalized; }
  const { doc, serverTimestamp, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  await setDoc(doc(db, "customer_profiles", auth.currentUser.uid), { ...normalized, email: auth.currentUser.email || normalized.email, updatedAt: serverTimestamp() }, { merge: true });
  return normalized;
}
