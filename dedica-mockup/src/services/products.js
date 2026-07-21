import { db, firebaseReady, isFirebaseLocal } from "./firebase.js";
import { getCategoryById, listCategories } from "./categories.js";

export const LOCAL_PRODUCTS_KEY = "dedica_products_db";

const DEFAULT_PRODUCTS = {
  dedica_classica: {
    id: "dedica_classica",
    name: "Candela Dedica Classica",
    price: 24,
    desc: "Candela personalizzata con dedica breve, profumazione delicata e confezione regalo.",
    badge: "Bestseller",
    category: "gift",
    occasion: "Compleanno",
    image: "assets/product-dedica.webp",
    gallery: ["assets/product-set.webp", "assets/gallery-pastel.webp"],
    details: {
      fragrance: "Vaniglia morbida e cotone",
      wax: "Cera vegetale",
      burnTime: "35-40 ore",
      size: "180 g",
      productionTime: "3-5 giorni lavorativi",
      packaging: "Scatola regalo inclusa"
    },
    logistics: {
      packagedWeightGrams: 500, lengthCm: 10, widthCm: 10, heightCm: 14, maxUnitsPerParcel: 10, fragile: true
    },
    customization: {
      intro: "Scrivi una dedica breve e scegli lo stile grafico più adatto alla persona che la riceverà.",
      optionGroups: [
        {
          key: "stile",
          label: "Stile grafico",
          type: "choice",
          required: true,
          options: [
            { label: "Essenziale", value: "essenziale", priceDelta: 0 },
            { label: "Romantico", value: "romantico", priceDelta: 0 },
            { label: "Elegante", value: "elegante", priceDelta: 2 }
          ]
        },
        {
          key: "confezione",
          label: "Confezione",
          type: "choice",
          required: true,
          options: [
            { label: "Standard regalo", value: "standard", priceDelta: 0 },
            { label: "Premium con biglietto", value: "premium", priceDelta: 5 }
          ]
        }
      ],
      personalization: {
        text: { enabled: true, required: true, label: "Dedica", placeholder: "Sempre con te", maxLength: 80, priceDelta: 0 },
        photo: { enabled: false, required: false, label: "Foto", priceDelta: 0 },
        generic: { enabled: true, required: false, label: "Note per la bozza", placeholder: "Colori, stile o richieste particolari", maxLength: 180, priceDelta: 0 }
      }
    }
  },
  foto_ricordo: {
    id: "foto_ricordo",
    name: "Candela Foto Ricordo",
    price: 32,
    desc: "Una candela con fotografia e dedica, pensata per anniversari, ricordi e momenti importanti.",
    badge: "Con foto",
    category: "gift",
    occasion: "Anniversario",
    image: "assets/product-foto.webp",
    gallery: ["assets/product-incisa.webp", "assets/gallery-top.webp"],
    details: {
      fragrance: "Fiori bianchi",
      wax: "Cera vegetale",
      burnTime: "40-45 ore",
      size: "220 g",
      productionTime: "4-6 giorni lavorativi",
      packaging: "Scatola regalo con protezione foto"
    },
    customization: {
      intro: "Carica una foto e aggiungi poche parole: prepareremo una bozza pulita prima della produzione.",
      optionGroups: [
        {
          key: "layout",
          label: "Layout foto",
          type: "choice",
          required: true,
          options: [
            { label: "Foto centrale", value: "centrale", priceDelta: 0 },
            { label: "Foto + cornice", value: "cornice", priceDelta: 3 }
          ]
        }
      ],
      personalization: {
        text: { enabled: true, required: true, label: "Dedica", placeholder: "Il nostro posto felice", maxLength: 70, priceDelta: 0 },
        photo: { enabled: true, required: true, label: "Fotografia", priceDelta: 0 },
        generic: { enabled: true, required: false, label: "Indicazioni foto", placeholder: "Taglio, colori o dettagli da valorizzare", maxLength: 180, priceDelta: 0 }
      }
    }
  },
  bomboniera_evento: {
    id: "bomboniera_evento",
    name: "Mini Candela Evento",
    price: 9.5,
    desc: "Mini candela coordinata per matrimonio, battesimo o comunione, ideale anche in quantità.",
    badge: "Eventi",
    category: "event",
    occasion: "Matrimonio",
    image: "assets/product-evento.webp",
    gallery: ["assets/event.webp", "assets/config-candle.webp"],
    details: {
      fragrance: "Talco e fiori delicati",
      wax: "Cera vegetale",
      burnTime: "12-15 ore",
      size: "80 g",
      productionTime: "7-12 giorni lavorativi",
      packaging: "Etichetta coordinata e nastrino"
    },
    customization: {
      intro: "Perfetta per creare una linea coordinata: scegli stile, dedica e quantità.",
      optionGroups: [
        {
          key: "tema",
          label: "Tema grafico",
          type: "choice",
          required: true,
          options: [
            { label: "Botanico", value: "botanico", priceDelta: 0 },
            { label: "Minimal", value: "minimal", priceDelta: 0 },
            { label: "Romantico", value: "romantico", priceDelta: 0 }
          ]
        }
      ],
      personalization: {
        text: { enabled: true, required: true, label: "Nomi e data", placeholder: "Anna & Luca · 12.09.2026", maxLength: 90, priceDelta: 0 },
        photo: { enabled: false, required: false, label: "Foto", priceDelta: 0 },
        generic: { enabled: true, required: false, label: "Colori evento", placeholder: "Avorio, salvia, oro...", maxLength: 120, priceDelta: 0 }
      }
    }
  },
  natale_dedica: {
    id: "natale_dedica",
    name: "Candela Natale Dedica",
    price: 28,
    desc: "Candela natalizia personalizzata con dedica, profumazione calda e confezione pronta da mettere sotto l’albero.",
    badge: "Natale",
    category: "gift",
    occasion: "Natale",
    image: "assets/product-natale.webp",
    gallery: ["assets/gift.webp", "assets/hero.webp"],
    details: {
      fragrance: "Cannella, arancia e legno dolce",
      wax: "Cera vegetale",
      burnTime: "35-40 ore",
      size: "180 g",
      productionTime: "3-5 giorni lavorativi",
      packaging: "Confezione regalo natalizia"
    },
    customization: {
      intro: "Scegli una dedica natalizia e il tono grafico: caldo, elegante o giocoso.",
      optionGroups: [
        {
          key: "grafica",
          label: "Grafica",
          type: "choice",
          required: true,
          options: [
            { label: "Bosco", value: "bosco", priceDelta: 0 },
            { label: "Stelle", value: "stelle", priceDelta: 0 },
            { label: "Classica rossa", value: "rossa", priceDelta: 0 }
          ]
        }
      ],
      personalization: {
        text: { enabled: true, required: true, label: "Dedica natalizia", placeholder: "Per scaldare il tuo Natale", maxLength: 80, priceDelta: 0 },
        photo: { enabled: false, required: false, label: "Foto", priceDelta: 0 },
        generic: { enabled: true, required: false, label: "Note regalo", placeholder: "Nome destinatario o preferenze", maxLength: 120, priceDelta: 0 }
      }
    }
  }
};

export async function listProducts() {
  await firebaseReady;
  const categories = await listCategories({ includeInactive: true });

  if (isFirebaseLocal || !db) {
    return normalizeProducts(readLocalProducts(), categories);
  }

  try {
    const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    const snapshot = await getDocs(collection(db, "products"));
    const products = {};
    snapshot.forEach(docSnap => {
      products[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
    });
    return normalizeProducts(products, categories);
  } catch (error) {
    console.error("Errore lettura prodotti:", error);
    return normalizeProducts(readLocalProducts(), categories);
  }
}

export async function getProduct(productId) {
  const products = await listProducts();
  return products.find(product => product.id === productId) || null;
}

export async function saveProduct(product) {
  await firebaseReady;
  // La normalizzazione deve conoscere la tassonomia corrente. Senza le
  // categorie configurate, getCategoryById ripiega sulla categoria predefinita
  // e finisce per sovrascrivere silenziosamente la scelta fatta nell'admin.
  const categories = await listCategories({ includeInactive: true });
  const normalized = normalizeProduct(product, product?.id, categories);

  if (isFirebaseLocal || !db) {
    const products = readLocalProducts();
    products[normalized.id] = normalized;
    localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(products));
    return normalized;
  }

  const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  await setDoc(doc(db, "products", normalized.id), normalized);
  return normalized;
}

export async function deleteProduct(productId) {
  await firebaseReady;

  if (isFirebaseLocal || !db) {
    const products = readLocalProducts();
    delete products[productId];
    localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(products));
    return;
  }

  const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  await deleteDoc(doc(db, "products", productId));
}

function readLocalProducts() {
  const stored = localStorage.getItem(LOCAL_PRODUCTS_KEY);
  if (stored === null) {
    localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(DEFAULT_PRODUCTS));
    return DEFAULT_PRODUCTS;
  }
  return JSON.parse(stored || "{}");
}

function normalizeProducts(productsById, categories) {
  return Object.entries(productsById).map(([id, product]) => normalizeProduct(product, id, categories));
}

function normalizeProduct(product, fallbackId = product?.id, categories = []) {
  const category = getCategoryById(categories, product?.category || "gift");
  return {
    id: product?.id || fallbackId,
    name: product?.name || "Prodotto senza nome",
    price: Number(product?.price || 0),
    desc: product?.desc || "",
    badge: product?.badge || "",
    category: category.id,
    occasion: product?.occasion || category.subcategories[0] || "Generale",
    image: product?.image || "assets/product-dedica.webp",
    gallery: Array.isArray(product?.gallery) ? product.gallery : [],
    details: {
      fragrance: product?.details?.fragrance || "",
      color: product?.details?.color || "",
      wax: product?.details?.wax || "",
      fragrances: Array.isArray(product?.details?.fragrances) ? product.details.fragrances : [],
      colors: Array.isArray(product?.details?.colors) ? product.details.colors : [],
      waxes: Array.isArray(product?.details?.waxes) ? product.details.waxes : [],
      sizes: Array.isArray(product?.details?.sizes) ? product.details.sizes : [],
      burnTime: product?.details?.burnTime || "",
      size: product?.details?.size || "",
      productionTime: product?.details?.productionTime || "",
      packaging: product?.details?.packaging || ""
    },
    logistics: {
      packagedWeightGrams: Number(product?.logistics?.packagedWeightGrams || 500), lengthCm: Number(product?.logistics?.lengthCm || 10), widthCm: Number(product?.logistics?.widthCm || 10), heightCm: Number(product?.logistics?.heightCm || 14), maxUnitsPerParcel: Number(product?.logistics?.maxUnitsPerParcel || 10), fragile: product?.logistics?.fragile !== false
    },
    customization: product?.customization || null
  };
}
