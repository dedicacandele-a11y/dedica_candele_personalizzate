import { db, firebaseReady, isFirebaseLocal } from "./firebase.js";

const LOCAL_KEY = "dedica_catalog_options";
export const OPTION_TYPES = { fragrance: "Fragranze", color: "Colori", wax: "Cere", size: "Formati" };
const defaults = [
  { id: "fragrance-vanilla", type: "fragrance", label: "Vaniglia", active: true },
  { id: "fragrance-cotton", type: "fragrance", label: "Cotone", active: true },
  { id: "fragrance-amber", type: "fragrance", label: "Ambra", active: true },
  { id: "color-white", type: "color", label: "Bianco", active: true },
  { id: "wax-vegetable", type: "wax", label: "Cera vegetale", active: true },
  { id: "wax-soy", type: "wax", label: "Cera di soia", active: true },
  { id: "size-180", type: "size", label: "180 g", active: true },
  { id: "size-300", type: "size", label: "300 g", active: true }
];

export async function listCatalogOptions({ includeInactive = false } = {}) {
  await firebaseReady;
  let items;
  if (isFirebaseLocal || !db) {
    const stored = localStorage.getItem(LOCAL_KEY);
    if (!stored) localStorage.setItem(LOCAL_KEY, JSON.stringify(defaults));
    items = JSON.parse(stored || JSON.stringify(defaults));
  } else {
    const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    const snapshot = await getDocs(collection(db, "catalog_options"));
    items = snapshot.empty ? defaults : snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
  }
  return items.filter(item => includeInactive || item.active !== false).sort((a, b) => a.type.localeCompare(b.type) || a.label.localeCompare(b.label));
}

export async function saveCatalogOption(option) {
  const normalized = { id: option.id || `${option.type}-${slugify(option.label)}-${Date.now().toString().slice(-4)}`, type: option.type, label: option.label.trim(), description: String(option.description || "").trim(), active: option.active !== false };
  if (!OPTION_TYPES[normalized.type] || !normalized.label) throw new Error("Tipo e nome sono obbligatori.");
  await firebaseReady;
  if (isFirebaseLocal || !db) { const items = await listCatalogOptions({ includeInactive: true }); localStorage.setItem(LOCAL_KEY, JSON.stringify([normalized, ...items.filter(item => item.id !== normalized.id)])); return normalized; }
  const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  await setDoc(doc(db, "catalog_options", normalized.id), normalized);
  return normalized;
}

export async function deleteCatalogOption(id) {
  await firebaseReady;
  if (isFirebaseLocal || !db) { localStorage.setItem(LOCAL_KEY, JSON.stringify((await listCatalogOptions({ includeInactive: true })).filter(item => item.id !== id))); return; }
  const { deleteDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  await deleteDoc(doc(db, "catalog_options", id));
}

function slugify(value) { return String(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
