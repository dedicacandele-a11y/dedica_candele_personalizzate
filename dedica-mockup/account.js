import { app, auth, db, firebaseReady, isFirebaseLocal } from "./firebase-config.js";

const ADMIN_EMAIL = "gennaro.mazzacane@gmail.com";
const ordersList = document.getElementById("customerOrdersList");
const accountEmail = document.getElementById("accountEmail");
const logoutBtn = document.getElementById("logoutBtn");
const resetPasswordBtn = document.getElementById("resetPasswordBtn");
const toast = document.querySelector(".toast");
const messageUnsubs = new Map();
let currentUser = null;

const STATUS_TEXTS = {
  pending_payment: "Pagamento in attesa",
  paid: "Pagato · bozza in preparazione",
  draft_sent: "Bozza inviata",
  revision_requested: "Modifica richiesta",
  draft_approved: "Bozza approvata",
  in_production: "In produzione",
  shipped: "Spedito",
  cancelled: "Annullato",
  payment_expired: "Pagamento scaduto",
};

function showToast(text) {
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(window.__toast);
  window.__toast = setTimeout(() => toast.classList.remove("show"), 2600);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function formatCurrency(value) {
  return `${Number(value || 0).toFixed(2).replace(".", ",")} €`;
}

async function loadOrders() {
  const { collection, onSnapshot, query, where } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  const q = query(collection(db, "orders"), where("customerUid", "==", currentUser.uid));
  onSnapshot(q, (snapshot) => {
    const orders = [];
    snapshot.forEach((docSnap) => orders.push({ id: docSnap.id, ...docSnap.data() }));
    orders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    renderOrders(orders);
  }, (err) => {
    console.error(err);
    ordersList.innerHTML = `<div class="empty-note">Errore caricamento ordini.</div>`;
  });
}

function renderOrders(orders) {
  if (!orders.length) {
    ordersList.innerHTML = `<div class="empty-note">Non hai ancora ordini collegati a questo account.</div>`;
    return;
  }

  ordersList.innerHTML = orders.map((order) => {
    const status = order.status || "pending_payment";
    const canRetry = ["pending_payment", "payment_expired"].includes(status) && order.paymentStatus !== "paid";
    const canReview = ["draft_sent", "revision_requested"].includes(status);
    return `
      <article class="order-admin-card open" data-order-card="${escapeHtml(order.id)}">
        <div class="order-admin-header">
          <span class="order-id">#${escapeHtml(order.id.substring(0, 10).toUpperCase())}</span>
          <span class="muted">${escapeHtml(new Date(order.createdAt).toLocaleString("it-IT"))}</span>
          <strong>${formatCurrency(order.total)}</strong>
          <span class="order-status-badge ${escapeHtml(status)}">${escapeHtml(STATUS_TEXTS[status] || status)}</span>
        </div>
        <div class="order-admin-details">
          ${order.draft?.url ? `
            <div class="order-client-info">
              <h4>Bozza digitale</h4>
              <p>${escapeHtml(order.draft.note || "La tua bozza è pronta per la revisione.")}</p>
              <p><a class="btn btn-light" href="${escapeHtml(order.draft.url)}" target="_blank" rel="noopener">Apri bozza</a></p>
            </div>
          ` : `<p class="muted">La bozza sarà disponibile dopo la conferma del pagamento.</p>`}
          <div class="order-actions-bar">
            ${canRetry ? `<button class="btn btn-primary" data-retry-payment="${escapeHtml(order.id)}" style="border:none;">Riprendi pagamento</button>` : ""}
            ${canReview ? `<button class="btn btn-primary" data-approve-draft="${escapeHtml(order.id)}" style="border:none;">Approva bozza</button>` : ""}
          </div>
          <div class="order-chat-box">
            <h4>Comunicazioni</h4>
            <div class="order-messages" id="messages-${escapeHtml(order.id)}"><p class="muted">Caricamento messaggi...</p></div>
            <form data-message-form="${escapeHtml(order.id)}" style="display:flex; gap:8px; margin-top:10px;">
              <input class="input" name="message" placeholder="Scrivi un messaggio..." maxlength="800">
              <button class="btn btn-secondary" type="submit">Invia</button>
            </form>
            ${canReview ? `
              <form data-revision-form="${escapeHtml(order.id)}" style="display:flex; gap:8px; margin-top:10px;">
                <input class="input" name="revision" placeholder="Richiedi una modifica alla bozza..." maxlength="800">
                <button class="btn btn-secondary" type="submit">Richiedi modifica</button>
              </form>
            ` : ""}
          </div>
        </div>
      </article>
    `;
  }).join("");

  orders.forEach((order) => subscribeMessages(order.id));
  ordersList.querySelectorAll("[data-retry-payment]").forEach((button) => {
    button.addEventListener("click", () => retryPayment(button.dataset.retryPayment));
  });
  ordersList.querySelectorAll("[data-approve-draft]").forEach((button) => {
    button.addEventListener("click", () => updateDraftStatus(button.dataset.approveDraft, "draft_approved"));
  });
  ordersList.querySelectorAll("[data-message-form]").forEach((form) => {
    form.addEventListener("submit", (event) => sendMessage(event, form.dataset.messageForm));
  });
  ordersList.querySelectorAll("[data-revision-form]").forEach((form) => {
    form.addEventListener("submit", (event) => requestRevision(event, form.dataset.revisionForm));
  });
}

async function subscribeMessages(orderId) {
  if (messageUnsubs.has(orderId)) return;
  const { collection, onSnapshot, orderBy, query } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  const q = query(collection(db, "orders", orderId, "messages"), orderBy("createdAt", "asc"));
  const unsub = onSnapshot(q, (snapshot) => {
    const target = document.getElementById(`messages-${orderId}`);
    if (!target) return;
    const messages = [];
    snapshot.forEach((docSnap) => messages.push(docSnap.data()));
    target.innerHTML = messages.length ? messages.map((message) => `
      <p><strong>${escapeHtml(message.senderRole === "admin" ? "DÈDICA" : "Tu")}:</strong> ${escapeHtml(message.text)}</p>
    `).join("") : `<p class="muted">Nessun messaggio per ora.</p>`;
  });
  messageUnsubs.set(orderId, unsub);
}

async function sendMessage(event, orderId) {
  event.preventDefault();
  const input = event.currentTarget.elements.message;
  const text = input.value.trim();
  if (!text) return;
  const { addDoc, collection, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  await addDoc(collection(db, "orders", orderId, "messages"), {
    text,
    senderUid: currentUser.uid,
    senderEmail: currentUser.email,
    senderRole: "customer",
    createdAt: serverTimestamp(),
  });
  input.value = "";
}

async function requestRevision(event, orderId) {
  event.preventDefault();
  const input = event.currentTarget.elements.revision;
  const text = input.value.trim();
  if (!text) return;
  const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  await updateDoc(doc(db, "orders", orderId), {
    status: "revision_requested",
    customerRevisionNote: text,
    updatedAt: new Date().toISOString(),
  });
  await sendMessage({ preventDefault() {}, currentTarget: { elements: { message: input } } }, orderId);
  showToast("Richiesta modifica inviata.");
}

async function updateDraftStatus(orderId, status) {
  const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  await updateDoc(doc(db, "orders", orderId), {
    status,
    updatedAt: new Date().toISOString(),
  });
  showToast("Bozza approvata.");
}

async function retryPayment(orderId) {
  try {
    const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");
    const retryOrderPayment = httpsCallable(getFunctions(app, "europe-west1"), "retryOrderPayment");
    const result = await retryOrderPayment({ orderId });
    window.location.href = result.data.checkoutUrl;
  } catch (err) {
    console.error(err);
    showToast("Impossibile riaprire il pagamento.");
  }
}

async function init() {
  await firebaseReady;
  if (isFirebaseLocal || !auth || !db) {
    ordersList.innerHTML = `<div class="empty-note">Area cliente disponibile con Firebase attivo.</div>`;
    return;
  }
  auth.onAuthStateChanged((user) => {
    if (!user) {
      window.location.href = "login.html?redirect=account.html";
      return;
    }
    if (user.email === ADMIN_EMAIL) {
      window.location.href = "admin.html";
      return;
    }
    currentUser = user;
    accountEmail.textContent = user.email || "";
    loadOrders();
  });
}

logoutBtn?.addEventListener("click", async () => {
  const { signOut } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
  await signOut(auth);
  window.location.href = "login.html";
});

resetPasswordBtn?.addEventListener("click", async () => {
  const { sendPasswordResetEmail } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
  await sendPasswordResetEmail(auth, currentUser.email);
  showToast("Email recupero password inviata.");
});

init();
