import { db, firebaseReady, isFirebaseLocal } from "./firebase.js";

export const LOCAL_DISCOUNTS_KEY = "dedica_discounts_db";

export async function listDiscounts() {
  await firebaseReady;

  if (isFirebaseLocal || !db) {
    return getLocalDiscounts();
  }

  const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  const snapshot = await getDocs(collection(db, "discounts"));
  const discounts = [];
  snapshot.forEach(docSnap => discounts.push({ code: docSnap.id, ...docSnap.data() }));
  return discounts;
}

export async function saveDiscount(discount) {
  await firebaseReady;
  const normalized = {
    code: String(discount.code || "").trim().toUpperCase(),
    value: Number(discount.value || 0),
    active: discount.active !== false
  };

  if (isFirebaseLocal || !db) {
    const discounts = getLocalDiscounts().filter(item => item.code !== normalized.code);
    discounts.push(normalized);
    localStorage.setItem(LOCAL_DISCOUNTS_KEY, JSON.stringify(discounts));
    return normalized;
  }

  const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  await setDoc(doc(db, "discounts", normalized.code), {
    value: normalized.value,
    active: normalized.active
  });
  return normalized;
}

export async function deleteDiscount(code) {
  await firebaseReady;

  if (isFirebaseLocal || !db) {
    const discounts = getLocalDiscounts().filter(item => item.code !== code);
    localStorage.setItem(LOCAL_DISCOUNTS_KEY, JSON.stringify(discounts));
    return;
  }

  const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  await deleteDoc(doc(db, "discounts", code));
}

export async function validateDiscountCode(code) {
  const normalizedCode = String(code || "").trim().toUpperCase();
  if (!normalizedCode) return null;

  let discount;
  if (isFirebaseLocal || !db) {
    discount = getLocalDiscounts().find(item => item.code === normalizedCode);
  } else {
    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    const snapshot = await getDoc(doc(db, "discounts", normalizedCode));
    discount = snapshot.exists() ? { code: snapshot.id, ...snapshot.data() } : null;
  }
  if (!discount || discount.active === false) return null;

  return {
    code: discount.code,
    percent: Math.max(0, Math.min(100, Number(discount.value || 0)))
  };
}

function getLocalDiscounts() {
  const stored = localStorage.getItem(LOCAL_DISCOUNTS_KEY);
  if (stored) return JSON.parse(stored);
  const defaults = [
    { code: "BENVENUTO10", value: 10, active: true },
    { code: "EVENTO20", value: 20, active: true }
  ];
  localStorage.setItem(LOCAL_DISCOUNTS_KEY, JSON.stringify(defaults));
  return defaults;
}
