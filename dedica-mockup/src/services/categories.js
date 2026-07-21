import { db, firebaseReady, isFirebaseLocal } from "./firebase.js";
import {
  DEFAULT_CATEGORIES,
  findCategory,
  getLocalCategories,
  getSubcategoriesForCategory,
  normalizeCategories,
  saveLocalCategories
} from "../../catalog-taxonomy.js";

export async function listCategories({ includeInactive = false } = {}) {
  await firebaseReady;

  if (isFirebaseLocal || !db) {
    return filterCategories(getLocalCategories(), includeInactive);
  }

  try {
    const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    const snapshot = await getDocs(collection(db, "categories"));
    const categories = [];
    snapshot.forEach(docSnap => categories.push({ id: docSnap.id, ...docSnap.data() }));
    return filterCategories(normalizeCategories(categories.length ? categories : DEFAULT_CATEGORIES), includeInactive);
  } catch (error) {
    console.error("Errore lettura categorie:", error);
    return filterCategories(getLocalCategories(), includeInactive);
  }
}

export async function saveCategories(categories) {
  await firebaseReady;
  const normalized = normalizeCategories(categories);

  if (isFirebaseLocal || !db) {
    saveLocalCategories(normalized);
    return normalized;
  }

  const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  await Promise.all(normalized.map(category => setDoc(doc(db, "categories", category.id), category)));
  return normalized;
}

export async function saveCategory(category) {
  const current = await listCategories({ includeInactive: true });
  const normalizedCategory = normalizeCategories([category])[0];
  const nextCategories = current.filter(item => item.id !== normalizedCategory.id);
  nextCategories.push(normalizedCategory);
  await saveCategories(nextCategories);
  return normalizedCategory;
}

export async function deleteCategory(categoryId) {
  await firebaseReady;

  if (isFirebaseLocal || !db) {
    const nextCategories = getLocalCategories().filter(category => category.id !== categoryId);
    saveLocalCategories(nextCategories);
    return nextCategories;
  }

  const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  await deleteDoc(doc(db, "categories", categoryId));
  return listCategories({ includeInactive: true });
}

export function getCategoryById(categories, categoryId) {
  return findCategory(categories, categoryId);
}

export function getSubcategories(categories, categoryId) {
  return getSubcategoriesForCategory(categories, categoryId);
}

function filterCategories(categories, includeInactive) {
  return includeInactive ? categories : categories.filter(category => category.active);
}
