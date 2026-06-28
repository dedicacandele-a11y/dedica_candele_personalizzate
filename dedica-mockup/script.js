// DÈDICA E-Commerce Logic (Client-Side & Firebase Integration)
import { app, db, auth, isFirebaseLocal, firebaseReady } from "./firebase-config.js";

// 1. DATABASE PRODOTTI (CATALOGO DI BACKUP LOCALE)
const CATALOG = {
  "dedica": {
    "id": "dedica",
    "name": "Candela con dedica",
    "price": 12.0,
    "desc": "Candela artigianale personalizzata con una frase breve, stampata su etichetta materica. Ideale per compleanni, anniversari e regali intimi.",
    "image": "assets/product-dedica.webp",
    "badge": "Più amata",
    "gallery": [
      "assets/product-dedica.webp",
      "assets/gallery-pastel.webp",
      "assets/product-set.webp",
      "assets/gallery-top.webp"
    ]
  },
  "foto": {
    "id": "foto",
    "name": "Candela con fotografia",
    "price": 16.0,
    "desc": "Candela personalizzata con fotografia, dedica e bozza digitale prima della produzione. Un regalo pensato per conservare un ricordo importante.",
    "image": "assets/product-foto.webp",
    "badge": "Con foto",
    "gallery": [
      "assets/product-foto.webp",
      "assets/gallery-pastel.webp",
      "assets/product-set.webp",
      "assets/gallery-top.webp"
    ]
  },
  "incisa": {
    "id": "incisa",
    "name": "Candela incisa",
    "price": 18.0,
    "desc": "Candela con incisione personalizzata per nomi, date o simboli. Finitura essenziale, elegante e adatta ai momenti da ricordare.",
    "image": "assets/product-incisa.webp",
    "badge": "Premium",
    "gallery": [
      "assets/product-incisa.webp",
      "assets/gallery-pastel.webp",
      "assets/product-set.webp",
      "assets/gallery-top.webp"
    ]
  },
  "evento": {
    "id": "evento",
    "name": "Bomboniera matrimonio",
    "price": 6.9,
    "desc": "Candela bomboniera personalizzata per matrimoni, battesimi e cerimonie. Grafica coordinata, confezione singola e prezzi dedicati alle quantità.",
    "image": "assets/product-evento.webp",
    "badge": "Eventi",
    "gallery": [
      "assets/product-evento.webp",
      "assets/gallery-pastel.webp",
      "assets/product-set.webp",
      "assets/gallery-top.webp"
    ]
  },
  "natale": {
    "id": "natale",
    "name": "Il calore di casa",
    "price": 11.0,
    "desc": "Candela natalizia personalizzata con dedica e fragranze calde. Pensata per regali aziendali, famiglia e piccoli pensieri delle feste.",
    "image": "assets/product-natale.webp",
    "badge": "Stagionale",
    "gallery": [
      "assets/product-natale.webp",
      "assets/gallery-pastel.webp",
      "assets/product-set.webp",
      "assets/gallery-top.webp"
    ]
  },
  "set": {
    "id": "set",
    "name": "Set Un pensiero per te",
    "price": 19.0,
    "desc": "Set regalo con candela personalizzata, confezione coordinata e biglietto con dedica. Pronto da consegnare a una persona speciale.",
    "image": "assets/product-set.webp",
    "badge": "Set regalo",
    "gallery": [
      "assets/product-set.webp",
      "assets/product-dedica.webp",
      "assets/gallery-pastel.webp",
      "assets/gallery-top.webp"
    ]
  }
};

const DEFAULT_OPTION_GROUPS = [
  {
    key: "formato",
    label: "Formato",
    type: "select",
    required: true,
    options: [
      { label: "90 g", value: "90", priceDelta: -3 },
      { label: "180 g", value: "180", priceDelta: 0 },
      { label: "300 g", value: "300", priceDelta: 6 }
    ]
  },
  {
    key: "modello",
    label: "Colorazione / contenitore",
    type: "choice",
    required: true,
    options: [
      { label: "Vetro chiaro", value: "chiaro", priceDelta: 0 },
      { label: "Vetro ambrato", value: "ambrato", priceDelta: 2 },
      { label: "Ceramica", value: "ceramica", priceDelta: 4 }
    ]
  },
  {
    key: "fragranza",
    label: "Fragranza",
    type: "select",
    required: true,
    options: [
      { label: "Cotone e vaniglia", value: "Cotone", priceDelta: 0 },
      { label: "Fico e legni chiari", value: "Fico", priceDelta: 0 },
      { label: "Ambra delicata", value: "Ambra", priceDelta: 0 },
      { label: "Senza profumazione", value: "Neutra", priceDelta: 0 }
    ]
  },
  {
    key: "stile",
    label: "Stile grafico",
    type: "choice",
    required: true,
    options: [
      { label: "Elegante", value: "elegante", priceDelta: 0 },
      { label: "Essenziale", value: "essenziale", priceDelta: 0 },
      { label: "Romantico", value: "romantico", priceDelta: 0 }
    ]
  },
  {
    key: "confezione",
    label: "Confezione",
    type: "choice",
    required: true,
    options: [
      { label: "Essenziale", value: "essenziale", priceDelta: 0 },
      { label: "Regalo", value: "regalo", priceDelta: 3 },
      { label: "Evento", value: "evento", priceDelta: 1.5 }
    ]
  }
];

function getDefaultPersonalization(productId) {
  const base = {
    text: {
      enabled: true,
      required: productId !== "set",
      label: productId === "incisa" ? "Testo da incidere" : "Dedica",
      placeholder: "Sempre con te",
      maxLength: 42,
      priceDelta: productId === "incisa" ? 6 : 0
    },
    photo: {
      enabled: productId === "foto",
      required: productId === "foto",
      label: "Fotografia",
      priceDelta: 4
    },
    generic: {
      enabled: ["incisa", "evento", "set"].includes(productId),
      required: false,
      label: productId === "evento" ? "Nome evento e data" : "Note personalizzazione",
      placeholder: productId === "evento" ? "Es. Anna & Luca · 14 settembre" : "Aggiungi indicazioni speciali",
      maxLength: 160,
      priceDelta: productId === "set" ? 2 : 0
    }
  };

  return base;
}

function getProductCustomization(product) {
  const productId = product?.id || "dedica";
  const customization = product?.customization || {};
  const optionGroups = Array.isArray(customization.optionGroups) && customization.optionGroups.length > 0
    ? customization.optionGroups
    : DEFAULT_OPTION_GROUPS;

  return {
    optionGroups: optionGroups.map(group => ({
      ...group,
      type: group.type === "select" ? "select" : "choice",
      options: Array.isArray(group.options) ? group.options : []
    })).filter(group => group.key && group.options.length > 0),
    personalization: {
      ...getDefaultPersonalization(productId),
      ...(customization.personalization || {})
    }
  };
}

function getSelectedOption(group, value) {
  return group.options.find(option => String(option.value) === String(value)) || group.options[0];
}

function getOptionLabel(group, value) {
  return getSelectedOption(group, value)?.label || value;
}

function getOptionPriceDelta(group, value) {
  return Number(getSelectedOption(group, value)?.priceDelta || 0);
}

// 2. GESTIONE CARRELLO (LOCALSTORAGE)
function getCart() {
  const cart = localStorage.getItem('dedica_cart');
  return cart ? JSON.parse(cart) : [];
}

function saveCart(cart) {
  localStorage.setItem('dedica_cart', JSON.stringify(cart));
  updateCartBadge();
}

function formatCurrency(value) {
  return `${value.toFixed(2).replace('.', ',')} €`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[char]);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.onerror = () => reject(reader.error || new Error("Lettura file non riuscita."));
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Immagine non leggibile."));
    image.src = dataUrl;
  });
}

async function compressImageFile(file, maxSize = 1600, quality = 0.82) {
  const sourceDataUrl = await readFileAsDataUrl(file);
  const image = await loadImageFromDataUrl(sourceDataUrl);
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

async function stageOrderImageUpload(dataUrl) {
  const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");
  const functions = getFunctions(app, "europe-west1");
  const stageOrderImage = httpsCallable(functions, "stageOrderImage");
  const result = await stageOrderImage({ photo: dataUrl });
  return result.data || {};
}

function getQuantityDiscountPercent(qty) {
  if (qty >= 100) return 35;
  if (qty >= 50) return 25;
  if (qty >= 20) return 15;
  return 0;
}

function getCartLineBaseTotal(item) {
  const unitBasePrice = Number(item.unitBasePrice ?? item.price ?? 0);
  const qty = Number(item.qty ?? 1);
  return unitBasePrice * qty;
}

function getCartLineTotal(item) {
  const baseTotal = getCartLineBaseTotal(item);
  const discountPercent = getQuantityDiscountPercent(Number(item.qty ?? 1));
  return baseTotal - (baseTotal * discountPercent / 100);
}

function getCartUnitPrice(item) {
  const qty = Math.max(1, Number(item.qty ?? 1));
  return getCartLineTotal(item) / qty;
}

function calculateCartTotals(cart, promoDiscountPercent = 0) {
  const subtotal = cart.reduce((sum, item) => sum + getCartLineTotal(item), 0);
  const shipping = subtotal >= 59.00 || subtotal === 0 ? 0.00 : 4.90;
  const discount = subtotal * (promoDiscountPercent / 100);
  const total = Math.max(0, subtotal + shipping - discount);
  return { subtotal, shipping, discount, total };
}

function updateCartBadge() {
  const cart = getCart();
  const count = cart.reduce((sum, item) => sum + Number(item.qty ?? 0), 0);
  document.querySelectorAll('.cart-count').forEach(badge => {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'grid' : 'none';
  });
}

// Mostra toast temporaneo
const toast = document.querySelector('.toast');
function showToast(text) {
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(window.__toast);
  window.__toast = setTimeout(() => toast.classList.remove('show'), 2500);
}

// Sincronizzazione catalogo da Firestore
async function loadCatalogFromFirestore() {
  await firebaseReady;

  if (isFirebaseLocal || !db) {
    console.log("DÈDICA: Utilizzo catalogo locale di emergenza.");
    return;
  }

  try {
    const { collection, getDocs, doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    const querySnapshot = await getDocs(collection(db, "products"));
    
    if (querySnapshot.empty) {
      console.log("DÈDICA: Firestore 'products' vuoto. Eseguo seeding iniziale...");
      // Inserisce i prodotti locali in Firestore
      for (const [key, value] of Object.entries(CATALOG)) {
        await setDoc(doc(db, "products", key), value);
      }
      console.log("DÈDICA: Seeding completato.");
    } else {
      // Sincronizza
      querySnapshot.forEach(docSnap => {
        CATALOG[docSnap.id] = docSnap.data();
      });
      console.log("DÈDICA: Catalogo sincronizzato con Firestore Cloud.");
    }
  } catch (err) {
    console.error("Errore durante la sincronizzazione con Firestore:", err);
  }
}

function renderHomeProductGrid() {
  const productGrid = document.querySelector('#prodotti .product-grid');
  if (!productGrid) return;

  productGrid.innerHTML = Object.values(CATALOG).map(item => `
    <article class="product-card">
      <a href="product.html?id=${encodeURIComponent(item.id)}">
        <div class="product-image">
          <img loading="lazy" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">
          ${item.badge ? `<span class="badge product-badge">${escapeHtml(item.badge)}</span>` : ''}
        </div>
        <div class="product-info">
          <div class="product-top">
            <h3 class="product-name">${escapeHtml(item.name)}</h3>
            <span class="product-price">da ${formatCurrency(Number(item.price ?? 0))}</span>
          </div>
          <p class="product-desc">${escapeHtml(item.desc)}</p>
        </div>
      </a>
    </article>
  `).join('');
}

function initDynamicConfigurator() {
  const configPage = document.querySelector('.config-page');
  const formCard = document.querySelector('.config-form-card');
  if (!configPage || !formCard) return;

  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id') || 'dedica';
  const product = CATALOG[productId] || CATALOG.dedica;
  const customization = getProductCustomization(product);

  const heroTitle = configPage.querySelector('.title');
  const heroLead = configPage.querySelector('.lead');
  if (heroTitle) heroTitle.textContent = product.name;
  if (heroLead) heroLead.textContent = "Personalizza questo prodotto con le opzioni configurate dall'amministrazione.";

  const previewImage = document.getElementById('configCandleImage');
  const previewLabel = document.getElementById('previewLabel');
  const previewText = document.querySelector('[data-preview-text]');
  const previewPhoto = document.getElementById('previewUploadedPhoto');
  if (previewImage) {
    previewImage.src = product.image || "assets/config-candle.webp";
    previewImage.alt = `Anteprima ${product.name}`;
  }

  const selectedOptions = {};
  customization.optionGroups.forEach(group => {
    const urlValue = urlParams.get(group.key);
    const initialOption = getSelectedOption(group, urlValue) || group.options[0];
    selectedOptions[group.key] = initialOption?.value;
  });

  const textConfig = customization.personalization.text || {};
  const photoConfig = customization.personalization.photo || {};
  const genericConfig = customization.personalization.generic || {};
  const state = {
    productType: product.id,
    productName: product.name,
    selectedOptions,
    text: urlParams.get('dedica') ? decodeURIComponent(urlParams.get('dedica')) : (textConfig.placeholder || ""),
    generic: "",
    photo: null,
    photoUploadPath: "",
    photoUploadPending: false,
    consegna: "",
    qty: parseInt(urlParams.get('qty'), 10) || 1,
    unitBasePrice: Number(product.price || 0),
    calculatedPrice: Number(product.price || 0),
    bulkDiscountPercent: 0
  };

  const renderOptionControl = (group, index) => {
    const optionsMarkup = group.options.map(option => {
      const selected = String(option.value) === String(state.selectedOptions[group.key]);
      const price = Number(option.priceDelta || 0);
      const priceLabel = price === 0 ? "" : ` (${price > 0 ? "+" : ""}${formatCurrency(price)})`;
      if (group.type === "select") {
        return `<option value="${escapeHtml(option.value)}" ${selected ? "selected" : ""}>${escapeHtml(option.label)}${escapeHtml(priceLabel)}</option>`;
      }
      return `<button type="button" class="choice ${selected ? "active" : ""}" data-option-group="${escapeHtml(group.key)}" data-option-value="${escapeHtml(option.value)}">${escapeHtml(option.label)}${escapeHtml(priceLabel)}</button>`;
    }).join('');

    if (group.type === "select") {
      return `
        <div class="field">
          <label for="dynamicOption${index}">${escapeHtml(group.label)}</label>
          <select class="select dynamic-option" id="dynamicOption${index}" data-option-group="${escapeHtml(group.key)}">
            ${optionsMarkup}
          </select>
        </div>
      `;
    }

    return `
      <div class="field">
        <label>${escapeHtml(group.label)}</label>
        <div class="choice-grid dynamic-choice-grid">${optionsMarkup}</div>
      </div>
    `;
  };

  formCard.innerHTML = `
    <span class="badge">Configurazione prodotto</span>
    <div class="config-steps">
      <div class="config-step active"><i>1</i><span>Varianti</span></div>
      <div class="step-line"></div>
      <div class="config-step active"><i>2</i><span>Personalizzazione</span></div>
      <div class="step-line"></div>
      <div class="config-step active"><i>3</i><span>Riepilogo</span></div>
    </div>
    <h2 class="subtitle">1. Scegli le varianti</h2>
    <div id="dynamicOptions">
      ${customization.optionGroups.map(renderOptionControl).join('')}
    </div>

    <h2 class="subtitle" style="margin-top:32px">2. Personalizza</h2>
    ${textConfig.enabled ? `
      <div class="field">
        <label for="dynamicText">${escapeHtml(textConfig.label || "Testo personalizzato")}${textConfig.required ? " *" : ""}</label>
        <input id="dynamicText" class="input" value="${escapeHtml(state.text)}" maxlength="${Number(textConfig.maxLength || 80)}" placeholder="${escapeHtml(textConfig.placeholder || "")}">
        <small class="muted">Massimo ${Number(textConfig.maxLength || 80)} caratteri</small>
      </div>
    ` : ''}
    ${photoConfig.enabled ? `
      <div class="field">
        <label>${escapeHtml(photoConfig.label || "Fotografia")}${photoConfig.required ? " *" : ""}</label>
        <div class="upload-box" id="dynamicUploadBox" style="cursor:pointer;">＋<br><strong id="dynamicUploadText">Trascina o clicca per caricare una foto</strong><br><small>JPG o PNG · massimo 5MB</small><input type="file" id="dynamicPhotoUpload" style="display:none" accept="image/*"></div>
      </div>
    ` : ''}
    ${genericConfig.enabled ? `
      <div class="field">
        <label for="dynamicGeneric">${escapeHtml(genericConfig.label || "Personalizzazione")}${genericConfig.required ? " *" : ""}</label>
        <textarea id="dynamicGeneric" class="input" rows="3" maxlength="${Number(genericConfig.maxLength || 160)}" placeholder="${escapeHtml(genericConfig.placeholder || "")}"></textarea>
      </div>
    ` : ''}

    <h2 class="subtitle" style="margin-top:32px">3. Dettagli ordine</h2>
    <div class="field"><label>Quando ti serve?</label><input class="input" type="date" id="dynamicConsegna"></div>
    <div class="field" style="margin-top:24px"><label>Quantità</label><div class="qty" style="width:max-content"><button id="dynamicQtyMinus" type="button">−</button><span id="dynamicQty">1</span><button id="dynamicQtyPlus" type="button">＋</button></div></div>
    <div class="summary-box">
      <div class="summary-line"><span>Prodotto</span><strong>${escapeHtml(product.name)}</strong></div>
      <div class="summary-line"><span>Varianti</span><strong id="dynamicSummaryOptions">—</strong></div>
      <div class="summary-line"><span>Personalizzazioni</span><strong id="dynamicSummaryPersonalization">—</strong></div>
      <div class="summary-line total"><span>Totale indicativo</span><strong id="dynamicSummaryTotal">0,00 €</strong></div>
    </div>
    <button id="dynamicAddToCartBtn" class="btn btn-primary" style="width:100%;margin-top:18px;border:none;">Aggiungi al carrello →</button>
  `;

  const textInput = document.getElementById('dynamicText');
  const genericInput = document.getElementById('dynamicGeneric');
  const uploadBox = document.getElementById('dynamicUploadBox');
  const photoUpload = document.getElementById('dynamicPhotoUpload');
  const uploadText = document.getElementById('dynamicUploadText');
  const deliveryInput = document.getElementById('dynamicConsegna');
  const qtySpan = document.getElementById('dynamicQty');
  const summaryOptions = document.getElementById('dynamicSummaryOptions');
  const summaryPersonalization = document.getElementById('dynamicSummaryPersonalization');
  const summaryTotal = document.getElementById('dynamicSummaryTotal');

  if (deliveryInput) {
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 10);
    deliveryInput.value = deliveryDate.toISOString().split('T')[0];
    state.consegna = deliveryInput.value;
  }
  if (qtySpan) qtySpan.textContent = state.qty;
  if (previewText) previewText.textContent = state.text || product.name;

  const updatePreviewStyle = () => {
    if (!previewLabel) return;
    const styleValue = state.selectedOptions.stile;
    previewLabel.className = 'preview-label';
    if (styleValue) previewLabel.classList.add(`style-${styleValue}`);
  };

  const updatePreviewImageTone = () => {
    if (!previewImage) return;
    previewImage.classList.remove('filter-vetro-ambrato', 'filter-ceramica');
    if (state.selectedOptions.modello === 'ambrato') previewImage.classList.add('filter-vetro-ambrato');
    if (state.selectedOptions.modello === 'ceramica') previewImage.classList.add('filter-ceramica');
  };

  const calculateUnitPrice = () => {
    let unitPrice = Number(product.price || 0);
    customization.optionGroups.forEach(group => {
      unitPrice += getOptionPriceDelta(group, state.selectedOptions[group.key]);
    });
    if (textConfig.enabled && Number(textConfig.priceDelta || 0) !== 0) unitPrice += Number(textConfig.priceDelta || 0);
    if (photoConfig.enabled && state.photo && Number(photoConfig.priceDelta || 0) !== 0) unitPrice += Number(photoConfig.priceDelta || 0);
    if (genericConfig.enabled && state.generic.trim() && Number(genericConfig.priceDelta || 0) !== 0) unitPrice += Number(genericConfig.priceDelta || 0);
    return Math.max(0, unitPrice);
  };

  const updateSummary = () => {
    const selectedDetails = customization.optionGroups.map(group => ({
      key: group.key,
      groupLabel: group.label,
      value: state.selectedOptions[group.key],
      label: getOptionLabel(group, state.selectedOptions[group.key]),
      priceDelta: getOptionPriceDelta(group, state.selectedOptions[group.key])
    }));

    const unitPrice = calculateUnitPrice();
    const baseTotal = unitPrice * state.qty;
    const discountPercentage = getQuantityDiscountPercent(state.qty);
    const total = baseTotal - (baseTotal * (discountPercentage / 100));

    state.unitBasePrice = unitPrice;
    state.calculatedPrice = total / state.qty;
    state.bulkDiscountPercent = discountPercentage;
    state.selectedDetails = selectedDetails;

    if (summaryOptions) {
      summaryOptions.textContent = selectedDetails.map(item => `${item.groupLabel}: ${item.label}`).join(' · ');
    }

    const personalizations = [];
    if (textConfig.enabled && state.text.trim()) personalizations.push(textConfig.label || "Testo");
    if (photoConfig.enabled && state.photo) personalizations.push(photoConfig.label || "Foto");
    if (genericConfig.enabled && state.generic.trim()) personalizations.push(genericConfig.label || "Personalizzazione");
    if (summaryPersonalization) {
      const discountText = discountPercentage > 0 ? ` · Sconto quantità -${discountPercentage}%` : "";
      summaryPersonalization.textContent = `${personalizations.length ? personalizations.join(' · ') : "Nessuna"}${discountText}`;
    }
    if (summaryTotal) {
      summaryTotal.innerHTML = `${formatCurrency(total)}${discountPercentage > 0 ? `<br><small style="font-size:0.75rem;color:var(--terracotta);text-decoration:line-through;font-weight:normal;">${formatCurrency(baseTotal)}</small>` : ''}`;
    }

    updatePreviewStyle();
    updatePreviewImageTone();
  };

  formCard.querySelectorAll('.dynamic-option').forEach(select => {
    select.addEventListener('change', () => {
      state.selectedOptions[select.dataset.optionGroup] = select.value;
      updateSummary();
    });
  });

  formCard.querySelectorAll('[data-option-group]').forEach(button => {
    button.addEventListener('click', () => {
      const groupKey = button.dataset.optionGroup;
      formCard.querySelectorAll(`[data-option-group="${groupKey}"]`).forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      state.selectedOptions[groupKey] = button.dataset.optionValue;
      updateSummary();
    });
  });

  textInput?.addEventListener('input', () => {
    state.text = textInput.value.trim();
    if (previewText) previewText.textContent = state.text || product.name;
    updateSummary();
  });
  genericInput?.addEventListener('input', () => {
    state.generic = genericInput.value.trim();
    updateSummary();
  });
  deliveryInput?.addEventListener('change', () => {
    state.consegna = deliveryInput.value;
  });

  const setQty = (nextQty) => {
    state.qty = Math.max(1, nextQty);
    if (qtySpan) qtySpan.textContent = state.qty;
    updateSummary();
  };
  document.getElementById('dynamicQtyMinus')?.addEventListener('click', () => setQty(state.qty - 1));
  document.getElementById('dynamicQtyPlus')?.addEventListener('click', () => setQty(state.qty + 1));

  const handleFile = async (file) => {
    if (!file.type.startsWith('image/')) {
      showToast("Seleziona un'immagine valida.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast("La foto supera il limite di 5MB.");
      return;
    }

    state.photo = null;
    state.photoUploadPath = "";
    state.photoUploadPending = true;
    if (uploadText) uploadText.textContent = "Compressione e caricamento foto...";
    updateSummary();

    try {
      const compressedDataUrl = await compressImageFile(file);
      if (previewPhoto) {
        previewPhoto.src = compressedDataUrl;
        previewPhoto.classList.add('show');
      }

      if (!isFirebaseLocal && app) {
        await firebaseReady;
        const staged = await stageOrderImageUpload(compressedDataUrl);
        state.photo = staged.downloadUrl;
        state.photoUploadPath = staged.storagePath;
      } else {
        state.photo = compressedDataUrl;
      }

      if (uploadText) uploadText.textContent = `Foto: ${file.name} caricata`;
      updateSummary();
      showToast("Foto caricata nell'anteprima.");
    } catch (err) {
      console.error("Errore caricamento foto:", err);
      state.photo = null;
      state.photoUploadPath = "";
      if (previewPhoto) {
        previewPhoto.removeAttribute('src');
        previewPhoto.classList.remove('show');
      }
      if (uploadText) uploadText.textContent = "Trascina o clicca per caricare una foto";
      showToast(err?.message || "Errore durante il caricamento foto.");
      updateSummary();
    } finally {
      state.photoUploadPending = false;
    }
  };

  uploadBox?.addEventListener('click', () => photoUpload?.click());
  uploadBox?.addEventListener('dragover', (event) => {
    event.preventDefault();
    uploadBox.style.background = 'rgba(201, 111, 69, 0.05)';
  });
  uploadBox?.addEventListener('dragleave', () => {
    uploadBox.style.background = '';
  });
  uploadBox?.addEventListener('drop', (event) => {
    event.preventDefault();
    uploadBox.style.background = '';
    if (event.dataTransfer.files.length > 0) handleFile(event.dataTransfer.files[0]);
  });
  photoUpload?.addEventListener('change', (event) => {
    if (event.target.files.length > 0) handleFile(event.target.files[0]);
  });

  document.getElementById('dynamicAddToCartBtn')?.addEventListener('click', () => {
    if (textConfig.enabled && textConfig.required && !state.text.trim()) {
      showToast(`Compila il campo "${textConfig.label || "Testo"}".`);
      return;
    }
    if (state.photoUploadPending) {
      showToast("Attendi il completamento del caricamento foto.");
      return;
    }
    if (photoConfig.enabled && photoConfig.required && !state.photo) {
      showToast("Carica una fotografia per questo prodotto.");
      return;
    }
    if (genericConfig.enabled && genericConfig.required && !state.generic.trim()) {
      showToast(`Compila il campo "${genericConfig.label || "Personalizzazione"}".`);
      return;
    }

    const cart = getCart();
    const details = state.selectedDetails || [];
    const optionLabelByKey = Object.fromEntries(details.map(item => [item.key, item.label]));
    const itemToAdd = {
      id: `item-${Date.now()}`,
      productType: state.productType,
      productName: state.productName,
      selectedOptions: details,
      personalizations: {
        text: textConfig.enabled ? state.text : "",
        textLabel: textConfig.label || "Testo",
        photo: Boolean(state.photo),
        photoLabel: photoConfig.label || "Foto",
        generic: genericConfig.enabled ? state.generic : "",
        genericLabel: genericConfig.label || "Personalizzazione"
      },
      modello: optionLabelByKey.modello || optionLabelByKey.colore || "",
      formato: optionLabelByKey.formato || "",
      fragranza: optionLabelByKey.fragranza || "",
      dedica: textConfig.enabled ? state.text : "",
      stile: optionLabelByKey.stile || "",
      photo: state.photo,
      photoUploadPath: state.photoUploadPath,
      confezione: optionLabelByKey.confezione || "",
      consegna: state.consegna,
      unitBasePrice: state.unitBasePrice,
      price: state.calculatedPrice,
      bulkDiscountPercent: state.bulkDiscountPercent,
      qty: state.qty
    };

    cart.push(itemToAdd);
    saveCart(cart);
    showToast("Candela aggiunta al carrello!");
    setTimeout(() => {
      window.location.href = "cart.html";
    }, 700);
  });

  updateSummary();
}

// 3. HEADER & MENU MOBILE
const header = document.querySelector('.site-header');
window.addEventListener('scroll', () => header?.classList.toggle('scrolled', window.scrollY > 18));

const toggle = document.querySelector('.menu-toggle');
const mobile = document.querySelector('.mobile-menu');
toggle?.addEventListener('click', () => {
  mobile?.classList.toggle('open');
  document.body.classList.toggle('menu-open');
});
mobile?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  mobile.classList.remove('open');
  document.body.classList.remove('menu-open');
}));

// 4. OVERLAY RICERCA
const searchBtn = document.querySelector('button[aria-label="Cerca"]');
const searchOverlay = document.getElementById('searchOverlay');
const searchCloseBtn = document.getElementById('searchCloseBtn');
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

if (searchOverlay) {
  searchBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    searchOverlay.classList.add('open');
    searchInput.focus();
    document.body.style.overflow = 'hidden';
  });

  const closeSearch = () => {
    searchOverlay.classList.remove('open');
    document.body.style.overflow = '';
    searchInput.value = '';
    searchResults.innerHTML = '';
  };
  searchCloseBtn?.addEventListener('click', closeSearch);
  searchOverlay.addEventListener('click', (e) => {
    if (e.target === searchOverlay) closeSearch();
  });

  searchInput?.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    if (q.length < 2) {
      searchResults.innerHTML = '';
      return;
    }

    const matched = Object.values(CATALOG).filter(item => 
      item.name.toLowerCase().includes(q) || 
      item.desc.toLowerCase().includes(q)
    );

    if (matched.length === 0) {
      searchResults.innerHTML = '<div class="empty-note">Nessun prodotto trovato per "' + searchInput.value + '"</div>';
      return;
    }

    searchResults.innerHTML = matched.map(item => `
      <a href="product.html?id=${item.id}" class="search-item">
        <img src="${item.image}" alt="${item.name}">
        <div class="search-item-info">
          <h4>${item.name}</h4>
          <p>${item.desc.substring(0, 75)}...</p>
        </div>
        <div class="search-item-price">da ${item.price.toFixed(2).replace('.', ',')} €</div>
      </a>
    `).join('');
  });
}

// 5. ACCORDION GENERATOR
document.querySelectorAll('.accordion button').forEach(btn => btn.addEventListener('click', () => {
  btn.parentElement.classList.toggle('open');
}));

// 6. LOGICA DI PAGINA
function initApp() {
  // Sincronizza il catalogo remoto in background: la UI deve restare utilizzabile
  // anche se Firebase impiega qualche secondo o non è raggiungibile.
  const catalogReady = loadCatalogFromFirestore().then(() => {
    if (document.querySelector('.hero')) renderHomeProductGrid();
  });
  updateCartBadge();

  document.addEventListener('click', (event) => {
    const pendingButton = event.target.closest('[data-pending]');
    if (!pendingButton) return;
    
    if (pendingButton.matches('button')) event.preventDefault();
    const label = pendingButton.dataset.pending || 'Azione';
    showToast(`${label}: funzione in preparazione.`);
  });

  // --- HOMEPAGE SPECIFIC (index.html) ---
  if (document.querySelector('.hero')) {
    renderHomeProductGrid();

    const homeDedication = document.querySelector('#dedication');
    const homePreviewText = document.querySelector('[data-preview-text]');
    const continueBtn = document.querySelector('.config-panel .btn-primary');

    if (homeDedication && homePreviewText) {
      homeDedication.addEventListener('input', () => {
        homePreviewText.textContent = homeDedication.value.trim() || 'Sempre con te';
      });
    }

    let selectedStyle = 'elegante';
    const styleChoices = document.querySelectorAll('.choice-grid .choice');
    styleChoices.forEach(btn => {
      btn.addEventListener('click', () => {
        styleChoices.forEach(x => x.classList.remove('active'));
        btn.classList.add('active');
        selectedStyle = btn.textContent.trim().toLowerCase();
      });
    });

    continueBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      const txt = homeDedication ? encodeURIComponent(homeDedication.value.trim()) : '';
      window.location.href = `configuratore.html?id=dedica&dedica=${txt}&stile=${selectedStyle}`;
    });
  }

  // --- PAGINA PRODOTTO DINAMICA (product.html) ---
  if (document.querySelector('.product-page')) {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id') || 'dedica';
    const product = CATALOG[productId];

    if (product) {
      document.title = `${product.name} — DÈDICA`;
      const breadcrumb = document.querySelector('.breadcrumb');
      if (breadcrumb) {
        breadcrumb.innerHTML = `<a href="index.html">Home</a> / <a href="index.html#prodotti">Candele personalizzate</a> / ${product.name}`;
      }
      const titleEl = document.getElementById('productTitle');
      if (titleEl) titleEl.innerHTML = product.name.replace(' ', '<br>');
      const descEl = document.getElementById('productDesc');
      if (descEl) descEl.textContent = product.desc;
      const priceEl = document.getElementById('productPrice');
      if (priceEl) priceEl.textContent = `da ${product.price.toFixed(2).replace('.', ',')} €`;
      const badgeEl = document.getElementById('productBadge');
      if (badgeEl) badgeEl.textContent = product.badge;

      const mainImg = document.getElementById('mainProductImage');
      const thumbsContainer = document.getElementById('productThumbs');
      if (mainImg && product.gallery && product.gallery.length > 0) {
        mainImg.src = product.gallery[0];
        mainImg.alt = product.name;

        if (thumbsContainer) {
          thumbsContainer.innerHTML = product.gallery.map((imgUrl, i) => `
            <button class="thumb ${i === 0 ? 'active' : ''}">
              <img loading="lazy" src="${imgUrl}" alt="Galleria ${i + 1}">
            </button>
          `).join('');

          const thumbs = thumbsContainer.querySelectorAll('.thumb');
          thumbs.forEach(btn => btn.addEventListener('click', () => {
            thumbs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            mainImg.src = btn.querySelector('img').src;
          }));
        }
      }

      const blockStile = document.getElementById('blockStile');
      if (productId === 'set' && blockStile) {
        blockStile.style.display = 'none';
      }

      const state = {
        formato: '180 g',
        fragranza: 'Cotone',
        stile: 'Elegante',
        qty: 1
      };

      const bindSwatches = (containerId, stateKey, labelId) => {
        const buttons = document.querySelectorAll(`#${containerId} .swatch`);
        const label = document.getElementById(labelId);
        buttons.forEach(btn => {
          btn.addEventListener('click', () => {
            buttons.forEach(x => x.classList.remove('active'));
            btn.classList.add('active');
            state[stateKey] = btn.textContent.trim();
            if (label) label.textContent = `Selezionato: ${state[stateKey]}`;
            updatePersonalizeUrl();
          });
        });
      };

      bindSwatches('swatchesFormato', 'formato', 'selectedFormato');
      bindSwatches('swatchesFragranza', 'fragranza', 'selectedFragranza');
      bindSwatches('swatchesStile', 'stile', 'selectedStile');

      const qtySpan = document.getElementById('productQty');
      document.querySelectorAll('[data-qty]').forEach(btn => {
        btn.addEventListener('click', () => {
          let n = state.qty;
          n = Math.max(1, n + (btn.dataset.qty === 'plus' ? 1 : -1));
          state.qty = n;
          if (qtySpan) qtySpan.textContent = n;
          updatePersonalizeUrl();
        });
      });

      const personalizeBtn = document.getElementById('personalizeBtn');
      const updatePersonalizeUrl = () => {
        if (!personalizeBtn) return;
        const fmt = encodeURIComponent(state.formato.replace(' g', ''));
        const frag = encodeURIComponent(state.fragranza);
        const stl = encodeURIComponent(state.stile.toLowerCase());
        personalizeBtn.href = `configuratore.html?id=${productId}&formato=${fmt}&fragranza=${frag}&stile=${stl}&qty=${state.qty}`;
      };

      updatePersonalizeUrl();
    }
  }

  // --- CONFIGURATORE LIVE (configuratore.html) ---
  if (document.querySelector('.config-page')) {
    catalogReady.then(initDynamicConfigurator);
    return;

    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id') || 'dedica';
    const product = CATALOG[productId];

    const configState = {
      productType: productId,
      productName: product ? product.name : "Candela personalizzata",
      modello: "chiaro",
      formato: "180",
      dedica: urlParams.get('dedica') ? decodeURIComponent(urlParams.get('dedica')) : "Sempre con te",
      stile: urlParams.get('stile') || "elegante",
      fragranza: urlParams.get('fragranza') || "Cotone",
      confezione: "essenziale",
      consegna: "",
      qty: parseInt(urlParams.get('qty'), 10) || 1,
      photo: null
    };

    const urlFormato = urlParams.get('formato');
    if (urlFormato && ["90", "180", "300"].includes(urlFormato)) {
      configState.formato = urlFormato;
    }

    const urlFragranza = urlParams.get('fragranza');
    if (urlFragranza) {
      configState.fragranza = urlFragranza;
    }

    const candleImg = document.getElementById('configCandleImage');
    const previewLabel = document.getElementById('previewLabel');
    const previewText = document.querySelector('[data-preview-text]');
    const dedicationInput = document.getElementById('dedication');
    const previewPhoto = document.getElementById('previewUploadedPhoto');
    const uploadBox = document.getElementById('uploadBox');
    const photoUpload = document.getElementById('photoUpload');
    const uploadText = document.getElementById('uploadText');

    const selectFormato = document.getElementById('configFormato');
    const selectFragranza = document.getElementById('configFragranza');
    const inputConsegna = document.getElementById('configConsegna');

    const qtySpan = document.getElementById('configQty');
    const qtyMinus = document.getElementById('qtyMinus');
    const qtyPlus = document.getElementById('qtyPlus');

    const summaryFormato = document.getElementById('summaryFormato');
    const summaryPersonalizzazione = document.getElementById('summaryPersonalizzazione');
    const summaryConfezione = document.getElementById('summaryConfezione');
    const summaryTotal = document.getElementById('summaryTotal');
    const addToCartBtn = document.getElementById('addToCartBtn');

    if (dedicationInput) dedicationInput.value = configState.dedica;
    if (previewText) previewText.textContent = configState.dedica;
    if (selectFormato) selectFormato.value = configState.formato;
    if (selectFragranza) selectFragranza.value = configState.fragranza;
    if (qtySpan) qtySpan.textContent = configState.qty;

    if (inputConsegna) {
      const deliveryDate = new Date();
      deliveryDate.setDate(deliveryDate.getDate() + 10);
      inputConsegna.value = deliveryDate.toISOString().split('T')[0];
      configState.consegna = inputConsegna.value;
    }

    if (productId === 'foto') {
      if (uploadBox) uploadBox.style.borderColor = 'var(--terracotta)';
      if (uploadText) uploadText.textContent = "Carica la foto principale per la candela";
    }

    const initButtons = (containerId, stateKey, updateFn) => {
      const container = document.getElementById(containerId);
      if (!container) return;
      const buttons = container.querySelectorAll('.choice');
      
      buttons.forEach(btn => {
        const val = btn.dataset[stateKey];
        if (val === configState[stateKey]) {
          buttons.forEach(x => x.classList.remove('active'));
          btn.classList.add('active');
        }
        
        btn.addEventListener('click', () => {
          buttons.forEach(x => x.classList.remove('active'));
          btn.classList.add('active');
          configState[stateKey] = val;
          updateFn();
        });
      });
    };

    const updateModello = () => {
      if (!candleImg) return;
      candleImg.classList.remove('filter-vetro-ambrato', 'filter-ceramica');
      if (configState.modello === 'ambrato') {
        candleImg.classList.add('filter-vetro-ambrato');
      } else if (configState.modello === 'ceramica') {
        candleImg.classList.add('filter-ceramica');
      }
      updatePrice();
    };
    initButtons('configModello', 'modello', updateModello);
    updateModello();

    const updateStile = () => {
      if (!previewLabel) return;
      previewLabel.className = 'preview-label';
      previewLabel.classList.add(`style-${configState.stile}`);
    };
    initButtons('configStile', 'stile', updateStile);
    updateStile();

    const updateConfezione = () => {
      updatePrice();
    };
    initButtons('configConfezione', 'confezione', updateConfezione);

    dedicationInput?.addEventListener('input', () => {
      configState.dedica = dedicationInput.value.trim();
      if (previewText) previewText.textContent = configState.dedica || 'Sempre con te';
    });

    selectFormato?.addEventListener('change', () => {
      configState.formato = selectFormato.value;
      updatePrice();
    });

    selectFragranza?.addEventListener('change', () => {
      configState.fragranza = selectFragranza.value;
    });

    inputConsegna?.addEventListener('change', () => {
      configState.consegna = inputConsegna.value;
    });

    qtyMinus?.addEventListener('click', () => {
      configState.qty = Math.max(1, configState.qty - 1);
      if (qtySpan) qtySpan.textContent = configState.qty;
      updatePrice();
    });
    qtyPlus?.addEventListener('click', () => {
      configState.qty += 1;
      if (qtySpan) qtySpan.textContent = configState.qty;
      updatePrice();
    });

    uploadBox?.addEventListener('click', () => photoUpload?.click());

    uploadBox?.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadBox.style.background = 'rgba(201, 111, 69, 0.05)';
    });
    uploadBox?.addEventListener('dragleave', () => {
      uploadBox.style.background = '';
    });
    uploadBox?.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadBox.style.background = '';
      if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
      }
    });

    photoUpload?.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
      }
    });

    const handleFile = (file) => {
      if (!file.type.startsWith('image/')) {
        showToast("Seleziona un'immagine valida.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast("La foto supera il limite di 5MB.");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        configState.photo = e.target.result;
        if (previewPhoto) {
          previewPhoto.src = configState.photo;
          previewPhoto.classList.add('show');
        }
        if (uploadText) uploadText.textContent = `Foto: ${file.name} caricata!`;
        updatePrice();
        showToast("Foto caricata con successo nell'anteprima!");
      };
      reader.readAsDataURL(file);
    };

    function updatePrice() {
      let basePrice = 12.00;
      if (configState.formato === "90") basePrice = 9.00;
      if (configState.formato === "300") basePrice = 18.00;

      let extraModello = 0.00;
      if (configState.modello === "ambrato") extraModello = 2.00;
      if (configState.modello === "ceramica") extraModello = 4.00;

      let customizationCost = 0.00;
      if (configState.photo || configState.productType === 'foto') {
        customizationCost = 4.00;
      } else if (configState.productType === 'incisa') {
        customizationCost = 6.00;
      } else if (configState.productType === 'set') {
        customizationCost = 7.00;
      }

      let extraConfezione = 0.00;
      if (configState.confezione === "regalo") extraConfezione = 3.00;
      if (configState.confezione === "evento") extraConfezione = 1.50;

      const singleItemCost = basePrice + extraModello + customizationCost + extraConfezione;
      let totalCost = singleItemCost * configState.qty;

      const discountPercentage = getQuantityDiscountPercent(configState.qty);

      let discountText = "inclusa";
      if (customizationCost > 0) {
        discountText = `+${customizationCost.toFixed(2).replace('.', ',')} €`;
      }

      if (discountPercentage > 0) {
        const discountAmount = totalCost * (discountPercentage / 100);
        totalCost -= discountAmount;
        discountText += ` (Sconto quantità -${discountPercentage}%)`;
      }

      const formatoLabels = { "90": "90 g", "180": "180 g", "300": "300 g" };
      const modelloLabels = { "chiaro": "Vetro chiaro", "ambrato": "Vetro ambrato", "ceramica": "Ceramica" };
      
      if (summaryFormato) summaryFormato.textContent = `Candela ${formatoLabels[configState.formato]} · ${modelloLabels[configState.modello]}`;
      if (summaryPersonalizzazione) summaryPersonalizzazione.textContent = discountText;
      if (summaryConfezione) {
        summaryConfezione.textContent = extraConfezione > 0 ? 
          `+${extraConfezione.toFixed(2).replace('.', ',')} € (${configState.confezione})` : 
          "inclusa (essenziale)";
      }
      if (summaryTotal) {
        summaryTotal.innerHTML = `
          ${totalCost.toFixed(2).replace('.', ',')} €
          ${discountPercentage > 0 ? `<br><small style="font-size:0.75rem;color:var(--terracotta);text-decoration:line-through;font-weight:normal;">${(singleItemCost * configState.qty).toFixed(2).replace('.', ',')} €</small>` : ''}
        `;
      }

      configState.unitBasePrice = singleItemCost;
      configState.calculatedPrice = totalCost / configState.qty;
      configState.bulkDiscountPercent = discountPercentage;
    }

    updatePrice();

    addToCartBtn?.addEventListener('click', () => {
      const cart = getCart();

      const itemToAdd = {
        id: `item-${Date.now()}`,
        productType: configState.productType,
        productName: configState.productName,
        modello: configState.modello === "chiaro" ? "Vetro chiaro" : (configState.modello === "ambrato" ? "Vetro ambrato" : "Ceramica"),
        formato: configState.formato + " g",
        fragranza: selectFragranza ? selectFragranza.options[selectFragranza.selectedIndex].text : configState.fragranza,
        dedica: configState.dedica,
        stile: configState.stile.charAt(0).toUpperCase() + configState.stile.slice(1),
        photo: configState.photo,
        confezione: configState.confezione.charAt(0).toUpperCase() + configState.confezione.slice(1),
        consegna: configState.consegna,
        unitBasePrice: configState.unitBasePrice,
        price: configState.calculatedPrice,
        bulkDiscountPercent: configState.bulkDiscountPercent,
        qty: configState.qty
      };

      cart.push(itemToAdd);
      saveCart(cart);

      showToast("Candela aggiunta al carrello!");
      
      setTimeout(() => {
        window.location.href = "cart.html";
      }, 1000);
    });
  }

  // --- PAGINA CARRELLO DINAMICO (cart.html) ---
  if (document.getElementById('cartItemsList')) {
    const listContainer = document.getElementById('cartItemsList');
    const cartSubtotal = document.getElementById('cartSubtotal');
    const cartShipping = document.getElementById('cartShipping');
    const cartDiscount = document.getElementById('cartDiscount');
    const cartTotal = document.getElementById('cartTotal');
    const discountRow = document.getElementById('discountRow');
    const discountCodeName = document.getElementById('discountCodeName');
    
    const checkoutBtn = document.getElementById('checkoutBtn');
    const checkoutModal = document.getElementById('checkoutModal');
    const checkoutCloseBtn = document.getElementById('checkoutCloseBtn');
    const checkoutForm = document.getElementById('checkoutForm');
    const checkoutFormState = document.getElementById('checkoutFormState');
    const checkoutSuccessState = document.getElementById('checkoutSuccessState');
    const successCloseBtn = document.getElementById('successCloseBtn');
    const successOrderId = document.getElementById('successOrderId');
    const checkoutTotalText = document.getElementById('checkoutTotalText');

    let promoDiscountPercent = 0;
    let activePromoCode = "";

    const renderCart = () => {
      const cart = getCart();

      if (cart.length === 0) {
        listContainer.innerHTML = `
          <div class="empty-note">
            Il tuo carrello è vuoto.<br><br>
            Hai bisogno di una candela personalizzata? 
            <a href="configuratore.html" style="color:var(--terracotta);font-weight:800;text-decoration:underline;">Crea una nuova personalizzazione →</a>
          </div>
        `;
        if (checkoutBtn) checkoutBtn.disabled = true;
        
        if (cartSubtotal) cartSubtotal.textContent = "0,00 €";
        if (cartShipping) cartShipping.textContent = "0,00 €";
        if (cartTotal) cartTotal.textContent = "0,00 €";
        if (discountRow) discountRow.style.display = "none";
        return;
      }

      if (checkoutBtn) checkoutBtn.disabled = false;

      listContainer.innerHTML = cart.map(item => {
        const imgSource = item.photo ? item.photo : (CATALOG[item.productType] ? CATALOG[item.productType].image : "assets/product-dedica.webp");
        const lineBaseTotal = getCartLineBaseTotal(item);
        const lineTotal = getCartLineTotal(item);
        const quantityDiscount = getQuantityDiscountPercent(Number(item.qty ?? 1));
        const optionDetails = Array.isArray(item.selectedOptions) && item.selectedOptions.length > 0
          ? item.selectedOptions.map(option => `${option.groupLabel}: ${option.label}`)
          : [
              item.formato ? `Formato: ${item.formato}` : null,
              item.modello ? `Colorazione / contenitore: ${item.modello}` : null,
              item.fragranza ? `Fragranza: ${item.fragranza}` : null,
              item.stile ? `Stile: ${item.stile}` : null,
              item.confezione ? `Confezione: ${item.confezione}` : null
            ].filter(Boolean);
        const personalizationDetails = [
          item.personalizations?.text ? `${item.personalizations.textLabel || "Testo"}: “${item.personalizations.text}”` : null,
          item.personalizations?.generic ? `${item.personalizations.genericLabel || "Personalizzazione"}: ${item.personalizations.generic}` : null,
          item.photo ? `${item.personalizations?.photoLabel || "Foto"}: caricata` : null,
          !item.personalizations?.text && item.dedica ? `Dedica: “${item.dedica}”` : null
        ].filter(Boolean);
        const detailsList = [
          ...optionDetails,
          ...personalizationDetails,
          quantityDiscount > 0 ? `Sconto quantità: -${quantityDiscount}%` : null
        ].filter(Boolean);

        return `
          <article class="cart-item" data-id="${item.id}">
            <img src="${imgSource}" alt="${item.productName}">
            <div>
              <span class="badge">Personalizzata</span>
              <h3>${item.productName}</h3>
              ${detailsList.map(p => `<p>${p}</p>`).join('')}
              <div class="qty" style="width:max-content; margin-top:12px">
                <button class="qty-btn" data-action="minus">−</button>
                <span class="item-qty-val">${item.qty}</span>
                <button class="qty-btn" data-action="plus">＋</button>
              </div>
            </div>
            <div class="item-price">
              <span>${formatCurrency(lineTotal)}</span><br>
              ${quantityDiscount > 0 ? `<small class="muted" style="text-decoration:line-through;">${formatCurrency(lineBaseTotal)}</small><br>` : ''}
              <button class="remove-link">Rimuovi</button>
            </div>
          </article>
        `;
      }).join('') + `
        <div class="empty-note">
          Hai bisogno di un'altra candela con una dedica diversa? 
          <a href="configuratore.html" style="color:var(--terracotta);font-weight:800">Crea una nuova personalizzazione →</a>
        </div>
      `;

      listContainer.querySelectorAll('.cart-item').forEach(row => {
        const itemId = row.dataset.id;

        row.querySelector('[data-action="minus"]').addEventListener('click', () => {
          adjustQty(itemId, -1);
        });

        row.querySelector('[data-action="plus"]').addEventListener('click', () => {
          adjustQty(itemId, 1);
        });

        row.querySelector('.remove-link').addEventListener('click', () => {
          removeItem(itemId);
        });
      });

      calculateTotals(cart);
    };

    const adjustQty = (id, delta) => {
      let cart = getCart();
      const item = cart.find(x => x.id === id);
      if (item) {
        item.qty = Math.max(1, item.qty + delta);
        saveCart(cart);
        renderCart();
      }
    };

    const removeItem = (id) => {
      let cart = getCart();
      cart = cart.filter(x => x.id !== id);
      saveCart(cart);
      renderCart();
      showToast("Articolo rimosso dal carrello.");
    };

    const calculateTotals = (cart) => {
      const totals = calculateCartTotals(cart, promoDiscountPercent);

      if (promoDiscountPercent > 0) {
        if (discountRow) discountRow.style.display = "flex";
        if (discountCodeName) discountCodeName.textContent = activePromoCode;
        if (cartDiscount) cartDiscount.textContent = `-${formatCurrency(totals.discount)}`;
      } else {
        if (discountRow) discountRow.style.display = "none";
      }

      if (cartSubtotal) cartSubtotal.textContent = formatCurrency(totals.subtotal);
      if (cartShipping) cartShipping.textContent = totals.shipping === 0 ? "Gratis" : formatCurrency(totals.shipping);
      if (cartTotal) cartTotal.textContent = formatCurrency(totals.total);

      if (checkoutTotalText) {
        checkoutTotalText.textContent = formatCurrency(totals.total);
      }

      return totals;
    };


    // PROMO CODE LOGIC
    const promoInput = document.getElementById('promoInput');
    const applyPromoBtn = document.getElementById('applyPromoBtn');

    // Funzione per validare codici sconto (se Firebase è attivo, legge da Firestore, altrimenti locale)
    const validatePromoCode = async (code) => {
      await firebaseReady;

      if (isFirebaseLocal || !db) {
        // Fallback locale
        if (code === "BENVENUTO10") return { percent: 10, label: "BENVENUTO10 (-10%)" };
        if (code === "EVENTO20") return { percent: 20, label: "EVENTO20 (-20%)" };
        return null;
      }

      try {
        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        const docSnap = await getDoc(doc(db, "discounts", code));
        if (docSnap.exists() && docSnap.data().active) {
          const data = docSnap.data();
          return { percent: data.value, label: `${code} (-${data.value}%)` };
        }
      } catch (err) {
        console.error("Errore verifica codice sconto Firestore:", err);
      }
      return null;
    };

    applyPromoBtn?.addEventListener('click', async () => {
      const code = promoInput.value.trim().toUpperCase();
      if (code === "") {
        showToast("Inserisci un codice promozionale.");
        return;
      }

      applyPromoBtn.disabled = true;
      applyPromoBtn.textContent = "...";
      
      const promoResult = await validatePromoCode(code);
      applyPromoBtn.disabled = false;
      applyPromoBtn.textContent = "Applica";

      if (promoResult) {
        promoDiscountPercent = promoResult.percent;
        activePromoCode = code;
        showToast(`Codice ${code} applicato con successo!`);
      } else {
        showToast("Codice promozionale non valido.");
        promoDiscountPercent = 0;
        activePromoCode = "";
      }
      renderCart();
    });

    // MODAL CHECKOUT FLOW
    checkoutBtn?.addEventListener('click', async () => {
      const cart = getCart();
      if (cart.length > 0) {
        await firebaseReady;
        if (!isFirebaseLocal && auth && !auth.currentUser) {
          localStorage.setItem('dedica_login_redirect', 'cart.html');
          showToast("Accedi o registrati prima di pagare.");
          window.location.href = "login.html?redirect=cart.html";
          return;
        }
        checkoutModal.classList.add('open');
        document.body.style.overflow = 'hidden';
        if (!isFirebaseLocal && auth?.currentUser) {
          const emailField = document.getElementById('checkoutEmail');
          if (emailField && !emailField.value) emailField.value = auth.currentUser.email || "";
          if (emailField) emailField.readOnly = true;
        }
        if (checkoutFormState) checkoutFormState.style.display = 'block';
        if (checkoutSuccessState) checkoutSuccessState.classList.remove('active');
      }
    });

    const closeCheckout = () => {
      checkoutModal.classList.remove('open');
      document.body.style.overflow = '';
    };

    checkoutCloseBtn?.addEventListener('click', closeCheckout);

    const buildOrderItems = (cart) => cart.map(item => ({
      ...item,
      price: getCartUnitPrice(item),
      lineTotal: getCartLineTotal(item),
      bulkDiscountPercent: getQuantityDiscountPercent(Number(item.qty ?? 1))
    }));

    // Submit del form di checkout
    checkoutForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const confirmBtn = document.getElementById('confirmPaymentBtn');
      const originalText = confirmBtn.textContent;
      confirmBtn.disabled = true;
      confirmBtn.textContent = "Elaborazione in corso...";
      
      const cart = getCart();
      await firebaseReady;

      // In cloud l'ordine viene creato dalla Cloud Function, non dal client.
      if (!isFirebaseLocal && app) {
        try {
          if (!auth?.currentUser) {
            localStorage.setItem('dedica_login_redirect', 'cart.html');
            window.location.href = "login.html?redirect=cart.html";
            return;
          }
          const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");
          const functions = getFunctions(app, "europe-west1");
          const createOrder = httpsCallable(functions, "createOrder");
          const result = await createOrder({
            customer: {
              email: document.getElementById('checkoutEmail').value.trim(),
              nome: document.getElementById('checkoutNome').value.trim(),
              cognome: document.getElementById('checkoutCognome').value.trim(),
              indirizzo: document.getElementById('checkoutIndirizzo').value.trim(),
              citta: document.getElementById('checkoutCitta').value.trim(),
              cap: document.getElementById('checkoutCap').value.trim()
            },
            items: cart,
            promoCode: activePromoCode
          });

          const response = result.data || {};
          if (!response.checkoutUrl) {
            throw new Error("Sessione Stripe non disponibile.");
          }
          successOrderId.textContent = response.displayOrderId || String(response.orderId || "").substring(0, 10).toUpperCase();
          localStorage.setItem('dedica_pending_order_id', response.orderId || "");

          if (response.totals) {
            const totals = response.totals;
            if (cartSubtotal) cartSubtotal.textContent = formatCurrency(Number(totals.subtotal || 0));
            if (cartShipping) cartShipping.textContent = Number(totals.shipping || 0) === 0 ? "Gratis" : formatCurrency(Number(totals.shipping || 0));
            if (cartDiscount) cartDiscount.textContent = `-${formatCurrency(Number(totals.discount || 0))}`;
            if (cartTotal) cartTotal.textContent = formatCurrency(Number(totals.total || 0));
            if (checkoutTotalText) checkoutTotalText.textContent = formatCurrency(Number(totals.total || 0));
          }

          window.location.href = response.checkoutUrl;
          return;

        } catch (err) {
          console.error("Errore durante la creazione ordine tramite Cloud Function:", err);
          showToast(err?.message || "Errore di rete. Ordine non registrato.");
        } finally {
          confirmBtn.disabled = false;
          confirmBtn.textContent = originalText;
        }
      } else {
        // Fallback locale di emergenza
        setTimeout(() => {
          confirmBtn.disabled = false;
          confirmBtn.textContent = originalText;
          
          const randomNum = Math.floor(1000 + Math.random() * 9000);
          const orderId = `DEC-2026-${randomNum}`;
          successOrderId.textContent = orderId;

          // Salva l'ordine nello storico locale di emergenza per vederlo nel pannello admin
          const placedOrders = JSON.parse(localStorage.getItem('dedica_placed_orders') || '[]');
          
          const orderItems = buildOrderItems(cart);
          const totals = calculateCartTotals(orderItems, promoDiscountPercent);

          placedOrders.push({
            id: orderId,
            email: document.getElementById('checkoutEmail').value.trim(),
            nome: document.getElementById('checkoutNome').value.trim(),
            cognome: document.getElementById('checkoutCognome').value.trim(),
            indirizzo: document.getElementById('checkoutIndirizzo').value.trim(),
            citta: document.getElementById('checkoutCitta').value.trim(),
            cap: document.getElementById('checkoutCap').value.trim(),
            items: orderItems,
            subtotal: totals.subtotal,
            shipping: totals.shipping,
            discount: totals.discount,
            total: totals.total,
            promoCode: activePromoCode,
            status: "pending_payment",
            paymentStatus: "local_only",
            createdAt: new Date().toISOString()
          });
          localStorage.setItem('dedica_placed_orders', JSON.stringify(placedOrders));
          
          // Innesca evento storage per sincronizzare altre schede admin aperte
          localStorage.setItem('dedica_trigger_ping', Date.now()); 
          
          if (checkoutFormState) checkoutFormState.style.display = 'none';
          if (checkoutSuccessState) checkoutSuccessState.classList.add('active');
          
          localStorage.removeItem('dedica_cart');
          updateCartBadge();
        }, 1500);
      }
    });

    successCloseBtn?.addEventListener('click', () => {
      closeCheckout();
      window.location.href = "index.html";
    });

    renderCart();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

