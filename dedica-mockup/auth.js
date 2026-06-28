import { auth, firebaseReady, isFirebaseLocal } from "./firebase-config.js";

const ADMIN_EMAIL = "gennaro.mazzacane@gmail.com";
const form = document.getElementById("authForm");
const emailInput = document.getElementById("authEmail");
const passwordInput = document.getElementById("authPassword");
const registerBtn = document.getElementById("registerBtn");
const resetBtn = document.getElementById("resetBtn");
const toast = document.querySelector(".toast");

function showToast(text) {
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(window.__toast);
  window.__toast = setTimeout(() => toast.classList.remove("show"), 2600);
}

function getRedirect() {
  const params = new URLSearchParams(window.location.search);
  return params.get("redirect") || localStorage.getItem("dedica_login_redirect") || "account.html";
}

function routeUser(user) {
  localStorage.removeItem("dedica_login_redirect");
  if (user.email === ADMIN_EMAIL) {
    window.location.href = "admin.html";
    return;
  }
  window.location.href = getRedirect();
}

async function init() {
  await firebaseReady;
  if (isFirebaseLocal || !auth) {
    showToast("Firebase Auth non disponibile in modalità locale.");
    return;
  }

  auth.onAuthStateChanged((user) => {
    if (user) routeUser(user);
  });
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const { signInWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
    const credential = await signInWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value);
    routeUser(credential.user);
  } catch (err) {
    console.error(err);
    showToast("Accesso non riuscito. Controlla email e password.");
  }
});

registerBtn?.addEventListener("click", async () => {
  try {
    const { createUserWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
    const credential = await createUserWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value);
    routeUser(credential.user);
  } catch (err) {
    console.error(err);
    showToast("Registrazione non riuscita. Password minima: 6 caratteri.");
  }
});

resetBtn?.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  if (!email) {
    showToast("Inserisci l'email per recuperare la password.");
    return;
  }
  try {
    const { sendPasswordResetEmail } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
    await sendPasswordResetEmail(auth, email);
    showToast("Email di recupero inviata.");
  } catch (err) {
    console.error(err);
    showToast("Impossibile inviare il recupero password.");
  }
});

init();
