export const LOCAL_CATEGORIES_KEY = "dedica_categories_db";

export const DEFAULT_CATEGORIES = [
  {
    id: "gift",
    name: "Idee regalo",
    slug: "idee-regalo",
    description: "Candele pensate come regalo personale o stagionale.",
    subcategories: ["Natale", "San Valentino", "Compleanno", "Anniversario", "Ringraziamenti"],
    active: true,
    sortOrder: 10
  },
  {
    id: "event",
    name: "Candele per evento",
    slug: "candele-evento",
    description: "Candele, bomboniere e campioni per cerimonie ed eventi.",
    subcategories: ["Matrimonio", "Battesimo", "Comunione", "Laurea", "Evento aziendale"],
    active: true,
    sortOrder: 20
  }
];

export function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeCategory(category) {
  const id = String(category?.id || category?.slug || category || "").trim();
  const name = String(category?.name || id || "Categoria").trim();
  const normalizedId = slugify(id || name) || `category-${Date.now()}`;
  const subcategories = Array.isArray(category?.subcategories)
    ? category.subcategories.map(item => String(item).trim()).filter(Boolean)
    : [];

  return {
    id: normalizedId,
    name,
    slug: slugify(category?.slug || name) || normalizedId,
    description: String(category?.description || "").trim(),
    subcategories,
    active: category?.active !== false,
    sortOrder: Number(category?.sortOrder || 0)
  };
}

export function normalizeCategories(categories) {
  const source = Array.isArray(categories) && categories.length > 0 ? categories : DEFAULT_CATEGORIES;
  return source
    .map(normalizeCategory)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function getLocalCategories() {
  const stored = localStorage.getItem(LOCAL_CATEGORIES_KEY);
  if (stored === null) {
    saveLocalCategories(DEFAULT_CATEGORIES);
    return normalizeCategories(DEFAULT_CATEGORIES);
  }
  return normalizeCategories(JSON.parse(stored || "[]"));
}

export function saveLocalCategories(categories) {
  localStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(normalizeCategories(categories)));
}

export function findCategory(categories, categoryId) {
  const normalizedId = slugify(categoryId);
  return normalizeCategories(categories).find(category => category.id === normalizedId)
    || normalizeCategories(categories).find(category => category.slug === normalizedId)
    || normalizeCategories(categories)[0]
    || normalizeCategory(DEFAULT_CATEGORIES[0]);
}

export function getSubcategoriesForCategory(categories, categoryId) {
  return findCategory(categories, categoryId).subcategories;
}

export function getCategoryLabel(categories, categoryId) {
  return findCategory(categories, categoryId).name;
}

export function resolveLegacyCategoryId(categoryId) {
  if (categoryId === "gift") return "gift";
  if (categoryId === "event") return "event";
  return slugify(categoryId) || "gift";
}
