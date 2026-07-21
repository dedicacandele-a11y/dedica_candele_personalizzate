import { db, firebaseReady, isFirebaseLocal } from "./firebase.js";

const LOCAL_KEY = "dedica_business_settings";
export const EMPTY_BUSINESS_SETTINGS = {
  businessName: "",
  vatNumber: "",
  taxCode: "",
  address: "",
  postalCode: "",
  city: "",
  province: "",
  country: "Italia",
  email: "",
  phone: "",
  pec: "",
  rea: "",
};

export async function getBusinessSettings() {
  await firebaseReady;
  if (isFirebaseLocal || !db) return { ...EMPTY_BUSINESS_SETTINGS, ...JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}") };
  const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  const snapshot = await getDoc(doc(db, "business_settings", "company"));
  return snapshot.exists() ? { ...EMPTY_BUSINESS_SETTINGS, ...snapshot.data() } : EMPTY_BUSINESS_SETTINGS;
}

export async function saveBusinessSettings(settings) {
  const normalized = Object.fromEntries(Object.entries({ ...EMPTY_BUSINESS_SETTINGS, ...settings }).map(([key, value]) => [key, String(value || "").trim()]));
  normalized.province = normalized.province.toUpperCase();
  normalized.updatedAt = new Date().toISOString();
  await firebaseReady;
  if (isFirebaseLocal || !db) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(normalized));
    return normalized;
  }
  const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  await setDoc(doc(db, "business_settings", "company"), normalized);
  return normalized;
}
