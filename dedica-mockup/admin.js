// DÈDICA Admin Control Panel Logic
import { app, db, storage, isFirebaseLocal, auth, firebaseReady } from "./firebase-config.js";

// --- STATO ADMIN LOCALE DI FALLBACK ---
const LOCAL_PRODUCTS_KEY = 'dedica_products_db';
const LOCAL_ORDERS_KEY = 'dedica_placed_orders';
const LOCAL_DISCOUNTS_KEY = 'dedica_discounts_db';
const ADMIN_EMAIL = "gennaro.mazzacane@gmail.com";

// Ottieni prodotti (se vuoto inizializza da catalogo statico di script.js)
const getLocalProducts = () => {
  const data = localStorage.getItem(LOCAL_PRODUCTS_KEY);
  if (data) return JSON.parse(data);
  // Default seeding locale
  const defaults = {
    "dedica": {"id": "dedica", "name": "Candela con dedica", "price": 12.0, "desc": "Candela artigianale personalizzata con una frase breve, stampata su etichetta materica. Ideale per compleanni, anniversari e regali intimi.", "image": "assets/product-dedica.webp", "badge": "Più amata", "gallery": ["assets/product-dedica.webp", "assets/gallery-pastel.webp", "assets/product-set.webp", "assets/gallery-top.webp"]},
    "foto": {"id": "foto", "name": "Candela con fotografia", "price": 16.0, "desc": "Candela personalizzata con fotografia, dedica e bozza digitale prima della produzione. Un regalo pensato per conservare un ricordo importante.", "image": "assets/product-foto.webp", "badge": "Con foto", "gallery": ["assets/product-foto.webp", "assets/gallery-pastel.webp", "assets/product-set.webp", "assets/gallery-top.webp"]},
    "incisa": {"id": "incisa", "name": "Candela incisa", "price": 18.0, "desc": "Candela con incisione personalizzata per nomi, date o simboli. Finitura essenziale, elegante e adatta ai momenti da ricordare.", "image": "assets/product-incisa.webp", "badge": "Premium", "gallery": ["assets/product-incisa.webp", "assets/gallery-pastel.webp", "assets/product-set.webp", "assets/gallery-top.webp"]},
    "evento": {"id": "evento", "name": "Bomboniera matrimonio", "price": 6.9, "desc": "Candela bomboniera personalizzata per matrimoni, battesimi e cerimonie. Grafica coordinata, confezione singola e prezzi dedicati alle quantità.", "image": "assets/product-evento.webp", "badge": "Eventi", "gallery": ["assets/product-evento.webp", "assets/gallery-pastel.webp", "assets/product-set.webp", "assets/gallery-top.webp"]},
    "natale": {"id": "natale", "name": "Il calore di casa", "price": 11.0, "desc": "Candela natalizia personalizzata con dedica e fragranze calde. Pensata per regali aziendali, famiglia e piccoli pensieri delle feste.", "image": "assets/product-natale.webp", "badge": "Stagionale", "gallery": ["assets/product-natale.webp", "assets/gallery-pastel.webp", "assets/product-set.webp", "assets/gallery-top.webp"]},
    "set": {"id": "set", "name": "Set Un pensiero per te", "price": 19.0, "desc": "Set regalo con candela personalizzata, confezione coordinata e biglietto con dedica. Pronto da consegnare a una persona speciale.", "image": "assets/product-set.webp", "badge": "Set regalo", "gallery": ["assets/product-set.webp", "assets/product-dedica.webp", "assets/gallery-pastel.webp", "assets/gallery-top.webp"]}
  };
  localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(defaults));
  return defaults;
};

const saveLocalProducts = (products) => localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(products));

const getLocalOrders = () => JSON.parse(localStorage.getItem(LOCAL_ORDERS_KEY) || '[]');
const saveLocalOrders = (orders) => localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(orders));

const getLocalDiscounts = () => {
  const data = localStorage.getItem(LOCAL_DISCOUNTS_KEY);
  if (data) return JSON.parse(data);
  const defaults = [
    { code: "BENVENUTO10", value: 10, active: true },
    { code: "EVENTO20", value: 20, active: true }
  ];
  localStorage.setItem(LOCAL_DISCOUNTS_KEY, JSON.stringify(defaults));
  return defaults;
};
const saveLocalDiscounts = (discounts) => localStorage.setItem(LOCAL_DISCOUNTS_KEY, JSON.stringify(discounts));

const DEFAULT_CUSTOMIZATION = {
  optionGroups: [
    { key: "formato", label: "Formato", type: "select", required: true, options: [
      { label: "90 g", value: "90", priceDelta: -3 },
      { label: "180 g", value: "180", priceDelta: 0 },
      { label: "300 g", value: "300", priceDelta: 6 }
    ] },
    { key: "modello", label: "Colorazione / contenitore", type: "choice", required: true, options: [
      { label: "Vetro chiaro", value: "chiaro", priceDelta: 0 },
      { label: "Vetro ambrato", value: "ambrato", priceDelta: 2 },
      { label: "Ceramica", value: "ceramica", priceDelta: 4 }
    ] },
    { key: "fragranza", label: "Fragranza", type: "select", required: true, options: [
      { label: "Cotone e vaniglia", value: "Cotone", priceDelta: 0 },
      { label: "Fico e legni chiari", value: "Fico", priceDelta: 0 },
      { label: "Ambra delicata", value: "Ambra", priceDelta: 0 },
      { label: "Senza profumazione", value: "Neutra", priceDelta: 0 }
    ] },
    { key: "stile", label: "Stile grafico", type: "choice", required: true, options: [
      { label: "Elegante", value: "elegante", priceDelta: 0 },
      { label: "Essenziale", value: "essenziale", priceDelta: 0 },
      { label: "Romantico", value: "romantico", priceDelta: 0 }
    ] },
    { key: "confezione", label: "Confezione", type: "choice", required: true, options: [
      { label: "Essenziale", value: "essenziale", priceDelta: 0 },
      { label: "Regalo", value: "regalo", priceDelta: 3 },
      { label: "Evento", value: "evento", priceDelta: 1.5 }
    ] }
  ],
  personalization: {
    text: { enabled: true, required: true, label: "Dedica", placeholder: "Sempre con te", maxLength: 42, priceDelta: 0 },
    photo: { enabled: false, required: false, label: "Fotografia", priceDelta: 4 },
    generic: { enabled: false, required: false, label: "Note personalizzazione", placeholder: "Aggiungi indicazioni speciali", maxLength: 160, priceDelta: 0 }
  }
};

function getDefaultCustomization(productId = "dedica") {
  const clone = JSON.parse(JSON.stringify(DEFAULT_CUSTOMIZATION));
  if (productId === "foto") {
    clone.personalization.photo.enabled = true;
    clone.personalization.photo.required = true;
  }
  if (productId === "incisa") {
    clone.personalization.text.label = "Testo da incidere";
    clone.personalization.text.priceDelta = 6;
    clone.personalization.generic.enabled = true;
    clone.personalization.generic.label = "Note incisione";
  }
  if (productId === "evento") {
    clone.personalization.generic.enabled = true;
    clone.personalization.generic.label = "Nome evento e data";
    clone.personalization.generic.placeholder = "Es. Anna & Luca · 14 settembre";
  }
  if (productId === "set") {
    clone.personalization.text.required = false;
    clone.personalization.generic.enabled = true;
    clone.personalization.generic.label = "Messaggio biglietto";
    clone.personalization.generic.priceDelta = 2;
  }
  return clone;
}

function customizationForProduct(product) {
  return product?.customization || getDefaultCustomization(product?.id);
}

function parseVariantLines(text) {
  return text.split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [label, value, priceDelta] = line.split('|').map(part => part.trim());
      return {
        label: label || value,
        value: value || label,
        priceDelta: Number.parseFloat(String(priceDelta || "0").replace(',', '.')) || 0
      };
    });
}

function stringifyVariantLines(options = []) {
  return options.map(option => `${option.label}|${option.value}|${Number(option.priceDelta || 0)}`).join('\n');
}

function groupByKey(customization, key) {
  return customization.optionGroups?.find(group => group.key === key);
}

function buildCustomizationFromForm() {
  const optionGroups = [
    { key: "formato", label: "Formato", type: "select", required: true, options: parseVariantLines(document.getElementById('productFormFormats').value) },
    { key: "modello", label: "Colorazione / contenitore", type: "choice", required: true, options: parseVariantLines(document.getElementById('productFormColors').value) },
    { key: "fragranza", label: "Fragranza", type: "select", required: true, options: parseVariantLines(document.getElementById('productFormFragrances').value) },
    { key: "stile", label: "Stile grafico", type: "choice", required: true, options: parseVariantLines(document.getElementById('productFormStyles').value) },
    { key: "confezione", label: "Confezione", type: "choice", required: true, options: parseVariantLines(document.getElementById('productFormPackaging').value) }
  ].filter(group => group.options.length > 0);

  return {
    optionGroups,
    personalization: {
      text: {
        enabled: document.getElementById('productFormTextEnabled').checked,
        required: document.getElementById('productFormTextRequired').checked,
        label: document.getElementById('productFormTextLabel').value.trim() || "Dedica",
        placeholder: "Sempre con te",
        maxLength: 80,
        priceDelta: Number.parseFloat(document.getElementById('productFormTextExtra').value || "0") || 0
      },
      photo: {
        enabled: document.getElementById('productFormPhotoEnabled').checked,
        required: document.getElementById('productFormPhotoRequired').checked,
        label: "Fotografia",
        priceDelta: Number.parseFloat(document.getElementById('productFormPhotoExtra').value || "0") || 0
      },
      generic: {
        enabled: document.getElementById('productFormGenericEnabled').checked,
        required: document.getElementById('productFormGenericRequired').checked,
        label: document.getElementById('productFormGenericLabel').value.trim() || "Note personalizzazione",
        placeholder: "Aggiungi indicazioni speciali",
        maxLength: 180,
        priceDelta: Number.parseFloat(document.getElementById('productFormGenericExtra').value || "0") || 0
      }
    }
  };
}

function fillCustomizationForm(product) {
  const customization = customizationForProduct(product);
  document.getElementById('productFormFormats').value = stringifyVariantLines(groupByKey(customization, "formato")?.options || []);
  document.getElementById('productFormColors').value = stringifyVariantLines(groupByKey(customization, "modello")?.options || []);
  document.getElementById('productFormFragrances').value = stringifyVariantLines(groupByKey(customization, "fragranza")?.options || []);
  document.getElementById('productFormStyles').value = stringifyVariantLines(groupByKey(customization, "stile")?.options || []);
  document.getElementById('productFormPackaging').value = stringifyVariantLines(groupByKey(customization, "confezione")?.options || []);
  const text = customization.personalization?.text || {};
  const photo = customization.personalization?.photo || {};
  const generic = customization.personalization?.generic || {};
  document.getElementById('productFormTextEnabled').checked = Boolean(text.enabled);
  document.getElementById('productFormTextRequired').checked = Boolean(text.required);
  document.getElementById('productFormPhotoEnabled').checked = Boolean(photo.enabled);
  document.getElementById('productFormPhotoRequired').checked = Boolean(photo.required);
  document.getElementById('productFormGenericEnabled').checked = Boolean(generic.enabled);
  document.getElementById('productFormGenericRequired').checked = Boolean(generic.required);
  document.getElementById('productFormTextLabel').value = text.label || "Dedica";
  document.getElementById('productFormTextExtra').value = Number(text.priceDelta || 0);
  document.getElementById('productFormPhotoExtra').value = Number(photo.priceDelta || 0);
  document.getElementById('productFormGenericExtra').value = Number(generic.priceDelta || 0);
  document.getElementById('productFormGenericLabel').value = generic.label || "Note personalizzazione";
}


// --- INIZIALIZZAZIONE & AUTHENTICATION ---
const loginOverlay = document.getElementById('loginOverlay');
const loginForm = document.getElementById('loginForm');
const localNotice = document.getElementById('localLoginNotice');
const adminMainContent = document.getElementById('adminMainContent');
const adminEmailSpan = document.getElementById('adminEmail');
const logoutBtn = document.getElementById('logoutBtn');
const notificationSound = document.getElementById('notificationSound');
const toast = document.querySelector('.toast');

function showToast(text) {
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(window.__toast);
  window.__toast = setTimeout(() => toast.classList.remove('show'), 2500);
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

function formatCurrency(value) {
  return `${Number(value || 0).toFixed(2).replace('.', ',')} €`;
}

function safeStatus(status) {
  return [
    "pending_payment",
    "paid",
    "draft_sent",
    "revision_requested",
    "draft_approved",
    "in_production",
    "shipped",
    "cancelled",
    "payment_expired",
  ].includes(status)
    ? status
    : "pending_payment";
}

function safeImageSrc(value, fallback = "assets/product-dedica.webp") {
  const src = String(value || '').trim();
  if (
    src.startsWith('assets/')
    || src.startsWith('https://')
    || src.startsWith('http://')
    || src.startsWith('data:image/')
  ) {
    return src;
  }
  return fallback;
}

// Controllo stato iniziale
async function initAdminApp() {
  await firebaseReady;

  if (isFirebaseLocal) {
    if (localNotice) localNotice.style.display = 'block';
    
    // Auto-login se loggato in precedenza in sessione
    const isLogged = sessionStorage.getItem('admin_logged') === 'true';
    if (isLogged) {
      unlockDashboard(ADMIN_EMAIL);
    } else {
      showLogin();
    }
  } else {
    if (localNotice) localNotice.style.display = 'none';
    
    // Gestione con Firebase Auth
    auth.onAuthStateChanged(async user => {
      if (user && user.email === ADMIN_EMAIL) {
        unlockDashboard(user.email);
      } else {
        if (user) {
          const { signOut } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
          await signOut(auth);
          showToast("Accesso consentito solo all'amministratore DÈDICA.");
        }
        showLogin();
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdminApp);
} else {
  initAdminApp();
}

function showLogin() {
  loginOverlay.style.display = 'grid';
  adminMainContent.style.display = 'none';
  if (adminEmailSpan) adminEmailSpan.style.display = 'none';
  if (logoutBtn) logoutBtn.style.display = 'none';
}

function unlockDashboard(email) {
  loginOverlay.style.display = 'none';
  adminMainContent.style.display = 'block';
  if (adminEmailSpan) {
    adminEmailSpan.textContent = email;
    adminEmailSpan.style.display = 'inline';
  }
  if (logoutBtn) logoutBtn.style.display = 'inline';
  
  // Avvia caricamento dati
  initDashboardData();
}

// Submit Form Login
loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  const submitBtn = loginForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "Verifica...";

  if (email !== ADMIN_EMAIL) {
    showToast("Accesso consentito solo all'amministratore DÈDICA.");
    submitBtn.disabled = false;
    submitBtn.textContent = "Accedi →";
    return;
  }

  if (isFirebaseLocal) {
    // Modalita locale di emergenza
    setTimeout(() => {
      submitBtn.disabled = false;
      submitBtn.textContent = "Accedi →";
      if (email === ADMIN_EMAIL && password === "admin123") {
        sessionStorage.setItem('admin_logged', 'true');
        unlockDashboard(email);
        showToast("Accesso amministratore locale effettuato!");
      } else {
        showToast(`Credenziali locali errate. Usa ${ADMIN_EMAIL} / admin123`);
      }
    }, 800);
  } else {
    // Firebase Cloud Auth
    try {
      const { signInWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
      await signInWithEmailAndPassword(auth, email, password);
      showToast("Accesso Amministratore effettuato!");
    } catch (err) {
      console.error(err);
      showToast("Errore di accesso: credenziali non valide.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Accedi →";
    }
  }
});

// Logout
logoutBtn?.addEventListener('click', async () => {
  if (isFirebaseLocal) {
    sessionStorage.removeItem('admin_logged');
    showLogin();
    showToast("Disconnesso.");
  } else {
    try {
      const { signOut } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
      await signOut(auth);
      showToast("Disconnesso.");
    } catch (err) {
      console.error(err);
    }
  }
});


// --- MENU NAVIGAZIONE DASHBOARD (TAB) ---
const navItems = document.querySelectorAll('.admin-nav-item');
const tabSections = document.querySelectorAll('.admin-tab-section');

navItems.forEach(item => {
  item.addEventListener('click', () => {
    navItems.forEach(x => x.classList.remove('active'));
    item.classList.add('active');

    const tabId = item.dataset.tab;
    tabSections.forEach(section => {
      section.classList.toggle('active', section.id === `${tabId}Tab`);
    });
  });
});


// --- INIZIALIZZAZIONE DATI SULLA DASHBOARD ---
let unsubs = []; // Per ripulire listener realtime in cloud mode

function initDashboardData() {
  // Pulisce listener precedenti
  unsubs.forEach(unsub => unsub());
  unsubs = [];

  loadOrders();
  loadProducts();
  loadDiscounts();
  loadStripeStatus(false);
}


// --- 1. TABELLA ORDINI ---
const ordersList = document.getElementById('ordersList');
const statusFilter = document.getElementById('orderStatusFilter');

let allOrdersCached = [];
const adminMessageUnsubs = new Map();

async function loadOrders() {
  if (isFirebaseLocal) {
    // Sincronizzazione locale realtime tramite polling finto / listener
    allOrdersCached = getLocalOrders().sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    renderOrders();
    
    // Ascolta i cambiamenti in localStorage periodicamente (per testare da tab diverse)
    window.addEventListener('storage', (e) => {
      if (e.key === LOCAL_ORDERS_KEY) {
        allOrdersCached = getLocalOrders().sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
        renderOrders();
        playPing();
      }
    });
  } else {
    // Firebase Cloud Realtime Listener
    try {
      const { collection, onSnapshot, query, orderBy } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
      const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
      
      let initialLoad = true;
      const unsub = onSnapshot(q, (snapshot) => {
        const orders = [];
        snapshot.forEach(doc => {
          orders.push({ id: doc.id, ...doc.data() });
        });

        // Se cresce il numero di ordini, riproduci suono di notifica
        if (!initialLoad && orders.length > allOrdersCached.length) {
          playPing();
          showToast("Nuovo ordine ricevuto in tempo reale!");
        }

        allOrdersCached = orders;
        renderOrders();
        initialLoad = false;
      });

      unsubs.push(unsub);
    } catch (err) {
      console.error("Errore caricamento ordini Firestore:", err);
      ordersList.innerHTML = `<div class="empty-note">Errore nel caricamento dei dati: ${escapeHtml(err.message)}</div>`;
    }
  }
}

function playPing() {
  if (notificationSound) {
    notificationSound.play().catch(e => console.log("Suono bloccato dal browser:", e));
  }
}

statusFilter?.addEventListener('change', () => {
  renderOrders();
});

function renderOrders() {
  const filterVal = statusFilter.value;
  const filtered = allOrdersCached.filter(order => filterVal === 'all' || order.status === filterVal);

  if (filtered.length === 0) {
    ordersList.innerHTML = `<div class="empty-note" style="text-align:center; padding:50px 0;">Nessun ordine trovato con questo filtro.</div>`;
    return;
  }

  const statusTexts = {
    pending_payment: "Pagamento in attesa",
    paid: "Pagato",
    draft_sent: "Bozza inviata",
    revision_requested: "Modifica richiesta",
    draft_approved: "Bozza approvata",
    in_production: "In produzione",
    shipped: "Spedito",
    cancelled: "Annullato",
    payment_expired: "Pagamento scaduto"
  };

  ordersList.innerHTML = filtered.map(order => {
    const formattedDate = new Date(order.createdAt).toLocaleString('it-IT', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const orderId = String(order.id || '');
    const status = safeStatus(order.status);
    const items = Array.isArray(order.items) ? order.items : [];

    return `
      <article class="order-admin-card" id="card-${escapeHtml(orderId)}">
        <div class="order-admin-header" data-order-toggle>
          <span class="order-id">#${escapeHtml(orderId.substring(0, 10).toUpperCase())}</span>
          <span class="muted">${escapeHtml(formattedDate)}</span>
          <span class="muted">${escapeHtml(order.email)}</span>
          <strong>${formatCurrency(order.total)}</strong>
          <span class="order-status-badge ${status}">${escapeHtml(statusTexts[status])}</span>
        </div>
        <div class="order-admin-details">
          <div class="order-details-grid">
            <div class="order-client-info">
              <h4>Cliente & Spedizione</h4>
              <p><strong>Destinatario:</strong> ${escapeHtml(order.nome)} ${escapeHtml(order.cognome)}</p>
              <p><strong>Indirizzo:</strong> ${escapeHtml(order.indirizzo)}</p>
              <p><strong>Città:</strong> ${escapeHtml(order.citta)} (${escapeHtml(order.cap)})</p>
              <p><strong>Email:</strong> ${escapeHtml(order.email)}</p>
              ${order.promoCode ? `<p style="color:var(--terracotta);"><strong>Promo Code:</strong> ${escapeHtml(order.promoCode)}</p>` : ''}
            </div>
            <div class="order-items-info">
              <h4>Candele ordinate</h4>
              ${items.map(item => {
                const fallbackImage = item.productType === 'foto' ? 'assets/product-foto.webp' : 'assets/product-dedica.webp';
                const imgUrl = safeImageSrc(item.photo, fallbackImage);
                return `
                  <div class="order-item-detail">
                    <img src="${escapeHtml(imgUrl)}" alt="Anteprima" class="order-item-preview">
                    <div class="order-item-text">
                      <h5>${escapeHtml(item.productName)} (x${escapeHtml(item.qty)})</h5>
                      ${renderOrderItemDetails(item)}
                    </div>
                    <div style="font-weight:700;">${formatCurrency(Number(item.price || 0) * Number(item.qty || 0))}</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          ${["paid", "draft_sent", "revision_requested"].includes(status) ? `
            <form class="draft-upload-form" data-draft-form="${escapeHtml(orderId)}" style="border-top:1px solid var(--line); padding-top:18px; margin-top:18px;">
              <h4>Bozza digitale</h4>
              ${order.draft?.url ? `<p><a class="btn btn-light" href="${escapeHtml(order.draft.url)}" target="_blank" rel="noopener">Apri bozza inviata</a></p>` : ''}
              ${order.customerRevisionNote ? `<p style="color:var(--terracotta);"><strong>Richiesta cliente:</strong> ${escapeHtml(order.customerRevisionNote)}</p>` : ''}
              <div class="checkout-row">
                <div class="field">
                  <label>File bozza</label>
                  <input class="input" type="file" name="draftFile" accept="image/*,application/pdf" required>
                </div>
                <div class="field">
                  <label>Messaggio per il cliente</label>
                  <input class="input" name="draftNote" maxlength="1000" placeholder="La tua bozza è pronta per la revisione.">
                </div>
              </div>
              <button class="btn btn-primary" type="submit" style="min-height:42px; border:none;">Carica e invia bozza</button>
            </form>
          ` : ''}

          <div class="order-chat-box" style="border-top:1px solid var(--line); padding-top:18px; margin-top:18px;">
            <h4>Comunicazioni cliente</h4>
            <div class="order-messages" id="admin-messages-${escapeHtml(orderId)}"><p class="muted">Apri l'ordine per caricare i messaggi.</p></div>
            <form data-admin-message-form="${escapeHtml(orderId)}" style="display:flex; gap:8px; margin-top:10px;">
              <input class="input" name="message" placeholder="Scrivi al cliente..." maxlength="800">
              <button class="btn btn-secondary" type="submit">Invia</button>
            </form>
          </div>

          <div class="order-actions-bar">
            ${status === 'draft_approved' ? `
              <button class="btn btn-primary" data-order-id="${escapeHtml(orderId)}" data-order-status="in_production" style="min-height:42px; border:none;">Avvia produzione</button>
            ` : ''}
            ${status === 'in_production' ? `
              <button class="btn btn-primary" data-order-id="${escapeHtml(orderId)}" data-order-status="shipped" style="min-height:42px; border:none; background:var(--coal); color:white;">Segna come Spedito</button>
            ` : ''}
            ${status !== 'shipped' && status !== 'cancelled' ? `
              <button class="btn btn-secondary" data-order-id="${escapeHtml(orderId)}" data-order-status="cancelled" style="min-height:42px;">Annulla Ordine</button>
            ` : ''}
          </div>
        </div>
      </article>
    `;
  }).join('');

  ordersList.querySelectorAll('[data-order-toggle]').forEach(header => {
    header.addEventListener('click', () => {
      header.closest('.order-admin-card')?.classList.toggle('open');
    });
  });

  ordersList.querySelectorAll('[data-order-status]').forEach(button => {
    button.addEventListener('click', () => {
      updateOrderStatus(button.dataset.orderId, button.dataset.orderStatus);
    });
  });

  ordersList.querySelectorAll('[data-draft-form]').forEach(form => {
    form.addEventListener('submit', (event) => sendDraft(event, form.dataset.draftForm));
  });

  ordersList.querySelectorAll('[data-admin-message-form]').forEach(form => {
    form.addEventListener('submit', (event) => sendAdminMessage(event, form.dataset.adminMessageForm));
  });

  filtered.forEach(order => subscribeAdminMessages(String(order.id || '')));

  ordersList.querySelectorAll('.order-item-preview').forEach(img => {
    img.addEventListener('click', () => {
      if (img.src) window.open(img.src, '_blank', 'noopener,noreferrer');
    });
  });
}

async function subscribeAdminMessages(orderId) {
  if (!orderId || adminMessageUnsubs.has(orderId) || isFirebaseLocal) return;
  const { collection, onSnapshot, orderBy, query } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  const q = query(collection(db, "orders", orderId, "messages"), orderBy("createdAt", "asc"));
  const unsub = onSnapshot(q, (snapshot) => {
    const target = document.getElementById(`admin-messages-${orderId}`);
    if (!target) return;
    const messages = [];
    snapshot.forEach(docSnap => messages.push(docSnap.data()));
    target.innerHTML = messages.length ? messages.map(message => `
      <p><strong>${escapeHtml(message.senderRole === "admin" ? "Tu" : message.senderEmail || "Cliente")}:</strong> ${escapeHtml(message.text)}</p>
    `).join('') : `<p class="muted">Nessun messaggio per ora.</p>`;
  });
  adminMessageUnsubs.set(orderId, unsub);
}

async function sendAdminMessage(event, orderId) {
  event.preventDefault();
  const input = event.currentTarget.elements.message;
  const text = input.value.trim();
  if (!text) return;

  if (isFirebaseLocal) {
    showToast("Chat disponibile in modalità cloud.");
    return;
  }

  const { addDoc, collection, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  await addDoc(collection(db, "orders", orderId, "messages"), {
    text,
    senderUid: auth.currentUser?.uid || "",
    senderEmail: auth.currentUser?.email || ADMIN_EMAIL,
    senderRole: "admin",
    createdAt: serverTimestamp(),
  });
  input.value = "";
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function sendDraft(event, orderId) {
  event.preventDefault();
  if (isFirebaseLocal) {
    showToast("Invio bozza disponibile in modalità cloud.");
    return;
  }

  const form = event.currentTarget;
  const file = form.elements.draftFile.files[0];
  if (!file) {
    showToast("Seleziona un file bozza.");
    return;
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = "Invio bozza...";

  try {
    const { ref, uploadString, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js");
    const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const dataUrl = await readFileAsDataUrl(file);
    const draftRef = ref(storage, `drafts/${orderId}/${Date.now()}_${safeName}`);
    await uploadString(draftRef, dataUrl, 'data_url');
    const draftUrl = await getDownloadURL(draftRef);
    const sendOrderDraft = httpsCallable(getFunctions(app, "europe-west1"), "sendOrderDraft");
    await sendOrderDraft({
      orderId,
      draftUrl,
      note: form.elements.draftNote.value.trim(),
    });
    form.reset();
    showToast("Bozza inviata al cliente.");
  } catch (err) {
    console.error(err);
    showToast("Errore durante l'invio della bozza.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

// Funzione globale disponibile anche da console per aggiornare lo stato dell'ordine
window.updateOrderStatus = async (orderId, newStatus) => {
  if (!["draft_sent", "revision_requested", "draft_approved", "in_production", "shipped", "cancelled"].includes(newStatus)) {
    showToast("Stato ordine non valido.");
    return;
  }

  if (isFirebaseLocal) {
    const orders = getLocalOrders();
    const order = orders.find(x => x.id === orderId);
    if (order) {
      order.status = newStatus;
      saveLocalOrders(orders);
      allOrdersCached = orders.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
      renderOrders();
      showToast(`Stato ordine aggiornato a: ${newStatus}`);
    }
  } else {
    try {
      const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");
      const adminUpdateOrderStatus = httpsCallable(getFunctions(app, "europe-west1"), "adminUpdateOrderStatus");
      await adminUpdateOrderStatus({ orderId, status: newStatus });
      showToast(`Stato ordine aggiornato cloud!`);
    } catch (err) {
      console.error(err);
      showToast("Errore aggiornamento ordine cloud.");
    }
  }
};


// --- 2. GESTIONE PRODOTTI ---
const productsAdminList = document.getElementById('productsAdminList');
const openFormBtn = document.getElementById('openNewProductFormBtn');
const closeFormBtn = document.getElementById('closeProductFormBtn');
const productFormContainer = document.getElementById('productFormContainer');
const productEditForm = document.getElementById('productEditForm');
const productFormTitle = document.getElementById('productFormTitle');

openFormBtn?.addEventListener('click', () => {
  productFormTitle.textContent = "Aggiungi Nuovo Prodotto";
  productEditForm.reset();
  document.getElementById('productFormId').value = "";
  fillCustomizationForm({ id: "dedica", customization: getDefaultCustomization("dedica") });
  productFormContainer.style.display = 'block';
  productFormContainer.scrollIntoView({ behavior: 'smooth' });
});

closeFormBtn?.addEventListener('click', () => {
  productFormContainer.style.display = 'none';
});

let allProductsCached = {};

async function loadProducts() {
  if (isFirebaseLocal) {
    allProductsCached = getLocalProducts();
    renderProducts();
  } else {
    try {
      const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
      const querySnapshot = await getDocs(collection(db, "products"));
      const products = {};
      querySnapshot.forEach(docSnap => {
        products[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
      });
      allProductsCached = products;
      renderProducts();
    } catch (err) {
      console.error("Errore caricamento prodotti Firestore:", err);
    }
  }
}

function renderProducts() {
  const list = Object.values(allProductsCached);
  if (list.length === 0) {
    productsAdminList.innerHTML = `<div class="empty-note">Nessun prodotto configurato nel catalogo.</div>`;
    return;
  }

  productsAdminList.innerHTML = `
    <table class="products-admin-table">
      <thead>
        <tr>
          <th>Immagine</th>
          <th>Prodotto</th>
          <th>Prezzo Base</th>
          <th>Personalizzazioni</th>
          <th>Azioni</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(product => `
          <tr>
            <td><img src="${escapeHtml(safeImageSrc(product.image))}" alt="${escapeHtml(product.name)}"></td>
            <td>
              <div class="admin-table-product-info">
                <h4>${escapeHtml(product.name)}</h4>
                <span>${escapeHtml(product.badge || 'Nessun badge')}</span>
              </div>
            </td>
            <td><strong>${formatCurrency(product.price)}</strong></td>
            <td><small class="muted">${escapeHtml(getCustomizationSummary(product))}</small></td>
            <td>
              <div class="action-btn-group">
                <button class="small-action-btn" data-product-edit="${escapeHtml(product.id)}">Modifica</button>
                <button class="small-action-btn delete-btn" data-product-delete="${escapeHtml(product.id)}">Elimina</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  productsAdminList.querySelectorAll('[data-product-edit]').forEach(button => {
    button.addEventListener('click', () => editProduct(button.dataset.productEdit));
  });
  productsAdminList.querySelectorAll('[data-product-delete]').forEach(button => {
    button.addEventListener('click', () => deleteProduct(button.dataset.productDelete));
  });
}

function renderOrderItemDetails(item) {
  const optionDetails = Array.isArray(item.selectedOptions) && item.selectedOptions.length > 0
    ? item.selectedOptions.map(option => `<p><strong>${escapeHtml(option.groupLabel)}:</strong> ${escapeHtml(option.label)}</p>`).join('')
    : [
        item.modello ? `<p><strong>Contenitore:</strong> ${escapeHtml(item.modello)}</p>` : '',
        item.formato ? `<p><strong>Formato:</strong> ${escapeHtml(item.formato)}</p>` : '',
        item.fragranza ? `<p><strong>Profumo:</strong> ${escapeHtml(item.fragranza)}</p>` : '',
        item.confezione ? `<p><strong>Confezione:</strong> ${escapeHtml(item.confezione)}</p>` : ''
      ].join('');

  const personalizations = item.personalizations || {};
  const personalizationDetails = [
    personalizations.text ? `<p style="font-size:0.86rem; color:var(--terracotta); background:#fdf9f4; padding:6px; border-radius:6px; margin-top:5px;"><strong>${escapeHtml(personalizations.textLabel || "Testo")}:</strong> “${escapeHtml(personalizations.text)}”</p>` : '',
    personalizations.generic ? `<p style="font-size:0.86rem; color:var(--terracotta); background:#fdf9f4; padding:6px; border-radius:6px; margin-top:5px;"><strong>${escapeHtml(personalizations.genericLabel || "Personalizzazione")}:</strong> ${escapeHtml(personalizations.generic)}</p>` : '',
    item.photo ? `<p><strong>${escapeHtml(personalizations.photoLabel || "Foto")}:</strong> caricata</p>` : '',
    !personalizations.text && item.dedica ? `<p style="font-size:0.86rem; color:var(--terracotta); background:#fdf9f4; padding:6px; border-radius:6px; margin-top:5px;"><strong>Dedica:</strong> “${escapeHtml(item.dedica)}” ${item.stile ? `[Stile: ${escapeHtml(item.stile)}]` : ''}</p>` : ''
  ].join('');

  return `${optionDetails}${personalizationDetails}`;
}

function getCustomizationSummary(product) {
  const customization = customizationForProduct(product);
  const groups = customization.optionGroups?.map(group => `${group.label}: ${group.options?.length || 0}`).join(' · ') || "Nessuna variante";
  const activePersonalizations = Object.values(customization.personalization || {})
    .filter(item => item.enabled)
    .map(item => item.label)
    .join(' · ');
  return `${groups}${activePersonalizations ? ` · ${activePersonalizations}` : ''}`;
}

// Modifica Prodotto
window.editProduct = (id) => {
  const p = allProductsCached[id];
  if (!p) return;

  productFormTitle.textContent = `Modifica ${p.name}`;
  document.getElementById('productFormId').value = p.id;
  document.getElementById('productFormName').value = p.name;
  document.getElementById('productFormPrice').value = p.price;
  document.getElementById('productFormDesc').value = p.desc;
  document.getElementById('productFormBadge').value = p.badge || "";
  fillCustomizationForm(p);

  productFormContainer.style.display = 'block';
  productFormContainer.scrollIntoView({ behavior: 'smooth' });
};

// Elimina Prodotto
window.deleteProduct = async (id) => {
  if (!confirm("Sei sicuro di voler eliminare questo prodotto dal catalogo?")) return;

  if (isFirebaseLocal) {
    const products = getLocalProducts();
    delete products[id];
    saveLocalProducts(products);
    showToast("Prodotto rimosso dal catalogo locale.");
    loadProducts();
  } else {
    try {
      const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
      await deleteDoc(doc(db, "products", id));
      showToast("Prodotto rimosso da Firestore.");
      loadProducts();
    } catch (err) {
      console.error(err);
      showToast("Errore rimozione prodotto cloud.");
    }
  }
};

// Salva o Modifica Prodotto (Form Submit)
productEditForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const idInput = document.getElementById('productFormId').value;
  const name = document.getElementById('productFormName').value.trim();
  const price = parseFloat(document.getElementById('productFormPrice').value);
  const desc = document.getElementById('productFormDesc').value.trim();
  const badge = document.getElementById('productFormBadge').value.trim();
  const imageFile = document.getElementById('productFormImage').files[0];

  const submitBtn = productEditForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "Salvataggio...";

  let imageUrl = "assets/product-dedica.webp"; // fallback

  const finalizeSave = async (img) => {
    const finalId = idInput || name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const existing = allProductsCached[finalId] || {};

    const productDoc = {
      id: finalId,
      name: name,
      price: price,
      desc: desc,
      badge: badge,
      image: img || existing.image || imageUrl,
      gallery: existing.gallery || [img || existing.image || imageUrl, "assets/gallery-pastel.webp", "assets/product-set.webp"],
      customization: buildCustomizationFromForm()
    };

    if (isFirebaseLocal) {
      const products = getLocalProducts();
      products[finalId] = productDoc;
      saveLocalProducts(products);
      showToast("Prodotto salvato localmente!");
      productFormContainer.style.display = 'none';
      loadProducts();
    } else {
      try {
        const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        await setDoc(doc(db, "products", finalId), productDoc);
        showToast("Prodotto salvato su Firestore!");
        productFormContainer.style.display = 'none';
        loadProducts();
      } catch (err) {
        console.error(err);
        showToast("Errore salvataggio prodotto cloud.");
      }
    }
    submitBtn.disabled = false;
    submitBtn.textContent = "Salva Prodotto";
  };

  // Se c'è un'immagine caricata
  if (imageFile) {
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Data = event.target.result;
      if (isFirebaseLocal) {
        // In locale usiamo Base64
        finalizeSave(base64Data);
      } else {
        // In cloud carichiamo su Firebase Storage
        try {
          const { ref, uploadString, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js");
          const uploadId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
          const safeFileName = imageFile.name.replace(/[^a-z0-9._-]/gi, '-');
          const storageRef = ref(storage, `catalog_images/${uploadId}_${safeFileName}`);
          await uploadString(storageRef, base64Data, 'data_url');
          const downloadUrl = await getDownloadURL(storageRef);
          finalizeSave(downloadUrl);
        } catch (err) {
          console.error(err);
          showToast("Errore caricamento immagine Storage.");
          finalizeSave(null);
        }
      }
    };
    reader.readAsDataURL(imageFile);
  } else {
    finalizeSave(null);
  }
});


// --- 3. GESTIONE CODICI SCONTO ---
const discountsAdminList = document.getElementById('discountsAdminList');
const discountCreateForm = document.getElementById('discountCreateForm');

let allDiscountsCached = [];

async function loadDiscounts() {
  if (isFirebaseLocal) {
    allDiscountsCached = getLocalDiscounts();
    renderDiscounts();
  } else {
    try {
      const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
      const querySnapshot = await getDocs(collection(db, "discounts"));
      const discounts = [];
      querySnapshot.forEach(docSnap => {
        discounts.push({ code: docSnap.id, ...docSnap.data() });
      });
      allDiscountsCached = discounts;
      renderDiscounts();
    } catch (err) {
      console.error("Errore caricamento sconti Firestore:", err);
    }
  }
}

function renderDiscounts() {
  if (allDiscountsCached.length === 0) {
    discountsAdminList.innerHTML = `<div class="empty-note">Nessun codice promozionale attivo.</div>`;
    return;
  }

  discountsAdminList.innerHTML = `
    <div class="discounts-admin-grid">
      ${allDiscountsCached.map(discount => `
        <div class="discount-admin-card">
          <div class="discount-card-info">
            <h4>${escapeHtml(discount.code)}</h4>
            <p>Sconto: <strong>-${escapeHtml(discount.value)}%</strong></p>
            <p class="muted">Stato: ${discount.active ? 'Attivo' : 'Disattivato'}</p>
          </div>
          <button class="small-action-btn delete-btn" data-discount-delete="${escapeHtml(discount.code)}">Elimina</button>
        </div>
      `).join('')}
    </div>
  `;

  discountsAdminList.querySelectorAll('[data-discount-delete]').forEach(button => {
    button.addEventListener('click', () => deleteDiscount(button.dataset.discountDelete));
  });
}

// Crea codice sconto
discountCreateForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = document.getElementById('discountFormCode').value.trim().toUpperCase();
  const value = parseInt(document.getElementById('discountFormPercent').value, 10);

  const discountDoc = {
    code: code,
    value: value,
    active: true
  };

  if (isFirebaseLocal) {
    const discounts = getLocalDiscounts();
    if (discounts.some(x => x.code === code)) {
      showToast("Codice sconto già esistente.");
      return;
    }
    discounts.push(discountDoc);
    saveLocalDiscounts(discounts);
    showToast("Codice sconto creato locale!");
    discountCreateForm.reset();
    loadDiscounts();
  } else {
    try {
      const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
      await setDoc(doc(db, "discounts", code), {
        value: value,
        active: true
      });
      showToast("Codice sconto creato su Firestore!");
      discountCreateForm.reset();
      loadDiscounts();
    } catch (err) {
      console.error(err);
      showToast("Errore creazione codice cloud.");
    }
  }
});

// Elimina codice sconto
window.deleteDiscount = async (code) => {
  if (!confirm(`Sei sicuro di voler eliminare il codice promozionale ${code}?`)) return;

  if (isFirebaseLocal) {
    let discounts = getLocalDiscounts();
    discounts = discounts.filter(x => x.code !== code);
    saveLocalDiscounts(discounts);
    showToast("Codice sconto rimosso.");
    loadDiscounts();
  } else {
    try {
      const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
      await deleteDoc(doc(db, "discounts", code));
      showToast("Codice sconto rimosso cloud.");
      loadDiscounts();
    } catch (err) {
      console.error(err);
      showToast("Errore rimozione codice cloud.");
    }
  }
};


// --- 4. PAGAMENTI STRIPE ---
const checkStripeBtn = document.getElementById('checkStripeBtn');
const stripeStatusBox = document.getElementById('stripeStatusBox');

async function loadStripeStatus(showFeedback = true) {
  if (!stripeStatusBox) return;
  if (isFirebaseLocal || !app) {
    stripeStatusBox.innerHTML = "Stripe disponibile solo in modalità cloud.";
    return;
  }

  if (showFeedback) stripeStatusBox.innerHTML = "Controllo collegamento Stripe...";
  try {
    const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");
    const checkStripeConfig = httpsCallable(getFunctions(app, "europe-west1"), "checkStripeConfig");
    const result = await checkStripeConfig();
    const data = result.data || {};
    stripeStatusBox.innerHTML = `
      <div class="order-details-grid">
        <div>
          <p><strong>Stato configurazione:</strong> ${data.connected ? "Collegato" : "Non collegato"}</p>
          <p><strong>Modalità:</strong> ${escapeHtml(data.mode || "non configurata")}</p>
          <p><strong>Webhook:</strong> ${data.webhookConfigured ? "Configurato" : "Non configurato"}</p>
          <p><strong>Ultimo controllo:</strong> ${escapeHtml(new Date(data.lastCheckedAt).toLocaleString('it-IT'))}</p>
        </div>
        <div>
          <p><strong>Webhook URL:</strong><br><code>${escapeHtml(data.webhookUrl || "")}</code></p>
          <p><a class="btn btn-secondary" href="${escapeHtml(data.dashboardUrl || "https://dashboard.stripe.com/test/dashboard")}" target="_blank" rel="noopener">Apri pannello Stripe</a></p>
        </div>
      </div>
    `;
  } catch (err) {
    console.error(err);
    stripeStatusBox.innerHTML = "Impossibile verificare Stripe. Controlla variabili d'ambiente e permessi.";
  }
}

checkStripeBtn?.addEventListener('click', () => loadStripeStatus(true));
