import { app, firebaseReady, isFirebaseLocal } from "./firebase.js";

export async function createOrderCheckout(payload) {
  await firebaseReady;

  if (isFirebaseLocal || !app) {
    throw new Error("Checkout Stripe disponibile solo in modalità cloud.");
  }

  const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");
  const createOrderFn = httpsCallable(getFunctions(app, "europe-west1"), "createOrder");
  const result = await createOrderFn(payload);
  return result.data || {};
}

export const createCheckoutSession = createOrderCheckout;

export async function retryOrderPayment(orderId) {
  await firebaseReady;

  if (isFirebaseLocal || !app) {
    throw new Error("Pagamento disponibile solo in modalità cloud.");
  }

  const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");
  const retryOrderPaymentFn = httpsCallable(getFunctions(app, "europe-west1"), "retryOrderPayment");
  const result = await retryOrderPaymentFn({ orderId });
  return result.data || {};
}

export async function getPaymentResult(orderId, sessionId = "") {
  await firebaseReady;

  if (!orderId) return null;
  if (isFirebaseLocal || !app) return { orderId, source: "local" };

  const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");
  const getCheckoutResultFn = httpsCallable(getFunctions(app, "europe-west1"), "getCheckoutResult");
  const result = await getCheckoutResultFn({ orderId, sessionId });
  return result.data || null;
}
