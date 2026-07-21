import { slugify } from "../../../../catalog-taxonomy.js";

export const emptyProductForm = {
  id: "",
  name: "",
  price: 0,
  desc: "",
  badge: "",
  category: "",
  occasion: "",
  image: "assets/product-dedica.webp",
  gallery: [],
  details: {
    fragrance: "",
    wax: "",
    fragrances: [],
    colors: [],
    waxes: [],
    sizes: [],
    burnTime: "",
    size: "",
    productionTime: "",
    packaging: ""
  },
  logistics: { packagedWeightGrams: 500, lengthCm: 10, widthCm: 10, heightCm: 14, maxUnitsPerParcel: 10, fragile: true },
  customization: {
    intro: "",
    designBrief: [],
    optionGroups: [],
    personalization: {
      text: { enabled: true, required: true, label: "Dedica", placeholder: "Sempre con te", maxLength: 80, priceDelta: 0 },
      photo: { enabled: false, required: false, label: "Fotografia", priceDelta: 4 },
      generic: { enabled: false, required: false, label: "Note personalizzazione", placeholder: "", maxLength: 180, priceDelta: 0 }
    }
  }
};

export function productToForm(product, categories) {
  const firstCategory = categories[0];
  const categoryId = product?.category || firstCategory?.id || "";
  const category = categories.find(item => item.id === categoryId) || firstCategory;

  return {
    ...emptyProductForm,
    ...product,
    category: categoryId,
    occasion: product?.occasion || category?.subcategories?.[0] || "Generale",
    gallery: Array.isArray(product?.gallery) ? product.gallery : [],
    details: {
      ...emptyProductForm.details,
      ...(product?.details || {}),
      fragrances: product?.details?.fragrances || splitLegacy(product?.details?.fragrance),
      colors: product?.details?.colors || splitLegacy(product?.details?.color),
      waxes: product?.details?.waxes || splitLegacy(product?.details?.wax),
      sizes: product?.details?.sizes || splitLegacy(product?.details?.size)
    },
    logistics: { ...emptyProductForm.logistics, ...(product?.logistics || {}) },
    customization: {
      ...emptyProductForm.customization,
      ...(product?.customization || {}),
      personalization: {
        ...emptyProductForm.customization.personalization,
        ...(product?.customization?.personalization || {})
      }
    }
  };
}

export function formToProduct(form) {
  const optionGroups = syncCatalogGroups(form.customization.optionGroups || [], form.details);
  return {
    id: form.id || slugify(form.name),
    name: form.name.trim(),
    price: Number(form.price || 0),
    desc: form.desc.trim(),
    badge: form.badge.trim(),
    category: form.category,
    occasion: form.occasion || "Generale",
    image: form.image || "assets/product-dedica.webp",
    gallery: form.gallery || [],
    details: {
      fragrance: (form.details?.fragrances || []).join(", "),
      wax: (form.details?.waxes || []).join(", "),
      fragrances: form.details?.fragrances || [],
      color: (form.details?.colors || []).join(", "),
      colors: form.details?.colors || [],
      waxes: form.details?.waxes || [],
      sizes: form.details?.sizes || [],
      burnTime: form.details?.burnTime?.trim() || "",
      size: (form.details?.sizes || []).join(", "),
      productionTime: form.details?.productionTime?.trim() || "",
      packaging: form.details?.packaging?.trim() || ""
    },
    logistics: {
      packagedWeightGrams: Number(form.logistics?.packagedWeightGrams || 0), lengthCm: Number(form.logistics?.lengthCm || 0), widthCm: Number(form.logistics?.widthCm || 0), heightCm: Number(form.logistics?.heightCm || 0), maxUnitsPerParcel: Number(form.logistics?.maxUnitsPerParcel || 1), fragile: form.logistics?.fragile !== false
    },
    customization: {
      intro: form.customization.intro || "",
      designBrief: Array.isArray(form.customization.designBrief)
        ? form.customization.designBrief
        : String(form.customization.designBrief || "").split(/\r?\n/).map(item => item.trim()).filter(Boolean),
      optionGroups,
      personalization: form.customization.personalization || emptyProductForm.customization.personalization
    }
  };
}

function splitLegacy(value = "") { return String(value).split(",").map(item => item.trim()).filter(Boolean); }

function syncCatalogGroups(groups, details) {
  const definitions = [["fragrance", "Fragranza", details?.fragrances], ["color", "Colore cera", details?.colors], ["wax", "Cera", details?.waxes], ["size", "Formato", details?.sizes]];
  const catalogKeys = definitions.map(([key]) => key);
  const customGroups = groups.filter(group => !catalogKeys.includes(group.key));
  const generated = definitions.filter(([, , values]) => values?.length).map(([key, label, values]) => ({ key, label, type: values.length > 4 ? "select" : "choice", required: true, options: values.map(value => ({ label: value, value: value.toLowerCase().replace(/[^a-z0-9]+/gi, "_"), priceDelta: 0 })) }));
  return [...generated, ...customGroups];
}
