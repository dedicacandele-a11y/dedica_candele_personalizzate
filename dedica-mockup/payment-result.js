import { app, auth, firebaseReady, isFirebaseLocal } from "./firebase-config.js";

const message = document.getElementById("paymentMessage");
const actions = document.getElementById("paymentActions");
const params = new URLSearchParams(window.location.search);
const orderId = params.get("order_id") || localStorage.getItem("dedica_pending_order_id") || "";
const sessionId = params.get("session_id") || "";

function setActions(html) {
  actions.innerHTML = html;
}

async function init() {
  await firebaseReady;
  if (isFirebaseLocal || !auth) {
    message.textContent = "Firebase non disponibile: impossibile verificare il pagamento.";
    return;
  }
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      localStorage.setItem("dedica_login_redirect", window.location.pathname.split("/").pop() + window.location.search);
      window.location.href = "login.html";
      return;
    }
    if (!orderId) {
      message.textContent = "Ordine non trovato.";
      setActions(`<a class="btn btn-secondary" href="account.html">Vai al tuo account</a>`);
      return;
    }
    try {
      const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");
      const functions = getFunctions(app, "europe-west1");
      const getCheckoutResult = httpsCallable(functions, "getCheckoutResult");
      const result = await getCheckoutResult({ orderId, sessionId });
      const data = result.data || {};
      if (data.paymentStatus === "paid" || data.status === "paid") {
        localStorage.removeItem("dedica_cart");
        localStorage.removeItem("dedica_pending_order_id");
        message.textContent = `Pagamento confermato per l'ordine #${data.displayOrderId}. Ora prepareremo la bozza digitale.`;
        setActions(`<a class="btn btn-primary" href="account.html" style="border:none;">Apri area cliente</a>`);
      } else {
        message.textContent = `Pagamento non ancora confermato. Stato ordine: ${data.status}.`;
        setActions(`<a class="btn btn-secondary" href="account.html">Vai al tuo account</a>`);
      }
    } catch (err) {
      console.error(err);
      message.textContent = "Non riesco a verificare il pagamento in questo momento.";
      setActions(`<a class="btn btn-secondary" href="account.html">Vai al tuo account</a>`);
    }
  });
}

init();
