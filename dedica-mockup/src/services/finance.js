import { auth, db, firebaseReady, isFirebaseLocal } from "./firebase.js";

const LOCAL_EXPENSES_KEY = "dedica_finance_expenses";
const LOCAL_SETTINGS_KEY = "dedica_finance_settings";

export const EXPENSE_AREAS = {
  production: { label: "Produzione", subareas: ["Materie prime", "Packaging", "Attrezzature", "Campioni e test", "Prodotti difettosi", "Materiali di consumo"] },
  digital: { label: "Digital e promozione", subareas: ["Advertising", "Hosting e dominio", "Software e abbonamenti", "Foto e video", "Creator e collaboratori", "Email marketing", "Grafica"] },
  operations: { label: "Logistica e amministrazione", subareas: ["Spedizioni", "Imballaggi protettivi", "Resi e rimborsi", "Commercialista", "Banca", "Assicurazioni", "Altri costi amministrativi"] }
};

export async function getFinanceSettings() {
  await firebaseReady;
  if (isFirebaseLocal || !db) return JSON.parse(localStorage.getItem(LOCAL_SETTINGS_KEY) || '{"productionShare":50,"digitalShare":50}');
  const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  const snapshot = await getDoc(doc(db, "finance_settings", "distribution"));
  return snapshot.exists() ? snapshot.data() : { productionShare: 50, digitalShare: 50 };
}

export async function saveFinanceSettings(settings) {
  const normalized = { productionShare: Number(settings.productionShare), digitalShare: Number(settings.digitalShare), updatedAt: new Date().toISOString(), updatedBy: auth?.currentUser?.email || "admin locale" };
  if (normalized.productionShare < 0 || normalized.digitalShare < 0 || normalized.productionShare + normalized.digitalShare !== 100) throw new Error("Le percentuali devono essere positive e sommare al 100%.");
  await firebaseReady;
  if (isFirebaseLocal || !db) { localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(normalized)); return normalized; }
  const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  await setDoc(doc(db, "finance_settings", "distribution"), normalized);
  return normalized;
}

export async function listExpenses() {
  await firebaseReady;
  if (isFirebaseLocal || !db) return JSON.parse(localStorage.getItem(LOCAL_EXPENSES_KEY) || "[]");
  const { collection, getDocs, orderBy, query } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  const snapshot = await getDocs(query(collection(db, "finance_expenses"), orderBy("date", "desc")));
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

export async function saveExpense(expense) {
  const normalized = { ...expense, id: expense.id || `EXP-${Date.now()}`, amount: Number(expense.amount), vatIncluded: true, subareas: Array.isArray(expense.subareas) ? expense.subareas : [], createdAt: expense.createdAt || new Date().toISOString(), createdBy: auth?.currentUser?.email || "admin locale" };
  if (!normalized.description?.trim() || !normalized.date || !EXPENSE_AREAS[normalized.area] || normalized.amount <= 0) throw new Error("Completa descrizione, data, area e importo.");
  await firebaseReady;
  if (isFirebaseLocal || !db) { const items = await listExpenses(); const next = [normalized, ...items.filter(item => item.id !== normalized.id)]; localStorage.setItem(LOCAL_EXPENSES_KEY, JSON.stringify(next)); return normalized; }
  const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  await setDoc(doc(db, "finance_expenses", normalized.id), normalized);
  return normalized;
}

export async function deleteExpense(expenseId) {
  await firebaseReady;
  if (isFirebaseLocal || !db) { localStorage.setItem(LOCAL_EXPENSES_KEY, JSON.stringify((await listExpenses()).filter(item => item.id !== expenseId))); return; }
  const { deleteDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  await deleteDoc(doc(db, "finance_expenses", expenseId));
}
