import { app, auth, db, firebaseReady, isFirebaseLocal } from "./firebase.js";

export const LOCAL_ORDERS_KEY = "dedica_placed_orders";

export const ORDER_FLOW = ["pending_payment", "paid", "draft_sent", "draft_approved", "in_production", "shipped"];

const ADMIN_TRANSITIONS = {
  payment_review: ["paid", "cancelled"],
  draft_approved: ["in_production", "cancelled"],
  in_production: ["shipped", "cancelled"]
};

export function getAllowedAdminStatuses(status, { local = false } = {}) {
  const allowed = ADMIN_TRANSITIONS[status] || [];
  return local ? allowed : allowed.filter(nextStatus => nextStatus !== "paid");
}

export async function listLocalOrders() {
  return JSON.parse(localStorage.getItem(LOCAL_ORDERS_KEY) || "[]");
}

export async function listAdminOrders() {
  await firebaseReady;

  if (isFirebaseLocal || !db) {
    return listLocalOrders();
  }

  const { collection, getDocs, orderBy, query } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  const snapshot = await getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc")));
  const orders = [];
  snapshot.forEach(docSnap => orders.push({ id: docSnap.id, ...docSnap.data() }));
  return orders;
}

export async function listCustomerOrders() {
  await firebaseReady;

  if (isFirebaseLocal || !db || !auth?.currentUser) {
    return listLocalOrders();
  }

  const { collection, getDocs, orderBy, query, where } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  const snapshot = await getDocs(query(
    collection(db, "orders"),
    where("customerUid", "==", auth.currentUser.uid),
    orderBy("createdAt", "desc")
  ));
  const orders = [];
  snapshot.forEach(docSnap => orders.push({ id: docSnap.id, ...docSnap.data() }));
  return orders;
}

export async function watchCustomerUnread(onChange) {
  await firebaseReady;
  if (isFirebaseLocal || !db || !auth?.currentUser) {
    const orders = await listLocalOrders();
    onChange(orders.reduce((sum, order) => sum + Number(order.unreadForCustomer || 0), 0));
    return () => {};
  }
  const { collection, onSnapshot, query, where } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  return onSnapshot(
    query(collection(db, "orders"), where("customerUid", "==", auth.currentUser.uid)),
    snapshot => onChange(snapshot.docs.reduce((sum, item) => sum + Number(item.data().unreadForCustomer || 0), 0)),
    () => onChange(0)
  );
}

export async function markOrderMessagesRead(orderId) {
  await firebaseReady;
  if (isFirebaseLocal || !app || !db) return { ok: true };
  const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");
  const result = await httpsCallable(getFunctions(app, "europe-west1"), "markOrderMessagesRead")({ orderId });
  return result.data;
}

export async function saveLocalOrder(order) {
  const orders = await listLocalOrders();
  orders.unshift(order);
  localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(orders));
  return order;
}

export async function updateOrderStatus(orderId, status) {
  await firebaseReady;

  if (isFirebaseLocal || !db) {
    const orders = await listLocalOrders();
    const currentOrder = orders.find(order => order.id === orderId);
    if (!currentOrder) throw new Error("Ordine non trovato.");
    if (!getAllowedAdminStatuses(currentOrder.status, { local: true }).includes(status)) {
      throw new Error(`Passaggio non consentito: ${getOrderStatusLabel(currentOrder.status)} → ${getOrderStatusLabel(status)}.`);
    }
    const nextOrders = orders.map(order => order.id === orderId ? { ...order, status, updatedAt: new Date().toISOString() } : order);
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(nextOrders));
    return nextOrders.find(order => order.id === orderId) || null;
  }

  if (app) {
    const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");
    const adminUpdateOrderStatusFn = httpsCallable(getFunctions(app, "europe-west1"), "adminUpdateOrderStatus");
    const result = await adminUpdateOrderStatusFn({ orderId, status });
    return result.data || { id: orderId, status };
  }

  return { id: orderId, status };
}

export async function updateOrderShipment(orderId, shipment) {
  await firebaseReady;
  if (isFirebaseLocal || !app || !db) {
    const orders = await listLocalOrders();
    const nextOrders = orders.map(order => order.id === orderId ? { ...order, shipment: { ...shipment, shippedAt: new Date().toISOString() }, status: "shipped", updatedAt: new Date().toISOString() } : order);
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(nextOrders));
    return nextOrders.find(order => order.id === orderId);
  }
  const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");
  const result = await httpsCallable(getFunctions(app, "europe-west1"), "adminShipOrder")({ orderId, shipment });
  return result.data;
}

export async function adminEditOrder(orderId, action, payload = {}) {
  await firebaseReady;
  if (isFirebaseLocal || !app || !db) {
    const orders = await listLocalOrders();
    const now = new Date().toISOString();
    if (action === "delete_test") {
      localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(orders.filter(order => order.id !== orderId)));
      return { ok: true, action };
    }
    const next = orders.map(order => {
      if (order.id !== orderId) return order;
      if (action === "update_delivery") return { ...order, ...payload.value, updatedAt: now };
      if (action === "update_shipment") return { ...order, shipment: { ...order.shipment, ...payload.value, updatedAt: now }, updatedAt: now };
      if (action === "attach_invoice") return { ...order, invoice: { ...payload.value, uploadedAt: now }, updatedAt: now };
      if (action === "cancel") return { ...order, status: "cancelled", cancellation: { reason: payload.reason, previousStatus: order.status, cancelledAt: now }, updatedAt: now };
      return order;
    });
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(next));
    return { ok: true, action };
  }
  const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");
  const result = await httpsCallable(getFunctions(app, "europe-west1"), "adminEditOrder")({ orderId, action, ...payload });
  return result.data;
}

export async function attachOrderInvoice(orderId, invoice) {
  await firebaseReady;
  if (isFirebaseLocal || !db) return adminEditOrder(orderId, "attach_invoice", { value: invoice });
  const { doc, serverTimestamp, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  await updateDoc(doc(db, "orders", orderId), { invoice: { ...invoice, uploadedAt: new Date().toISOString() }, updatedAt: serverTimestamp() });
  return { ok: true };
}

export async function sendOrderDraft(orderId, draftUrl, note = "") {
  await firebaseReady;

  if (isFirebaseLocal || !app || !db) {
    const orders = await listLocalOrders();
    const currentOrder = orders.find(order => order.id === orderId);
    if (!currentOrder || !["paid", "revision_requested", "draft_sent"].includes(currentOrder.status)) {
      throw new Error("La bozza può essere inviata solo dopo la conferma del pagamento.");
    }
    const nextOrders = orders.map(order => order.id === orderId
      ? {
          ...order,
          status: "draft_sent",
          draft: { url: draftUrl, note, sentAt: new Date().toISOString(), sentBy: "admin locale" },
          updatedAt: new Date().toISOString()
        }
      : order);
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(nextOrders));
    return { ok: true, status: "draft_sent" };
  }

  const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");
  const sendOrderDraftFn = httpsCallable(getFunctions(app, "europe-west1"), "sendOrderDraft");
  const result = await sendOrderDraftFn({ orderId, draftUrl, note });
  return result.data || {};
}

export async function listOrderMessages(orderId) {
  await firebaseReady;

  if (isFirebaseLocal || !db) {
    const order = (await listLocalOrders()).find(item => item.id === orderId);
    return order?.messages || [];
  }

  const { collection, getDocs, orderBy, query } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  const snapshot = await getDocs(query(collection(db, "orders", orderId, "messages"), orderBy("createdAt", "asc")));
  const messages = [];
  snapshot.forEach(docSnap => messages.push({ id: docSnap.id, ...docSnap.data() }));
  return messages;
}

export async function sendAdminMessage(orderId, text) {
  const messageText = String(text || "").trim();
  if (!messageText) return null;

  await firebaseReady;
  if (isFirebaseLocal || !db) {
    const orders = await listLocalOrders();
    const nextOrders = orders.map(order => order.id === orderId
      ? {
          ...order,
          messages: [
            ...(order.messages || []),
            { text: messageText, senderRole: "admin", createdAt: new Date().toISOString() }
          ]
        }
      : order);
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(nextOrders));
    return { ok: true };
  }

  const { addDoc, collection, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  await addDoc(collection(db, "orders", orderId, "messages"), {
    text: messageText,
    senderUid: auth?.currentUser?.uid || "",
    senderEmail: auth?.currentUser?.email || "",
    senderRole: "admin",
    createdAt: serverTimestamp()
  });
  return { ok: true };
}

export async function reviewDraft(orderId, action, revisionNote = "") {
  await firebaseReady;

  if (isFirebaseLocal || !app || !db) {
    const orders = await listLocalOrders();
    const currentOrder = orders.find(order => order.id === orderId);
    if (!currentOrder || currentOrder.status !== "draft_sent") throw new Error("Non c’è una nuova bozza da revisionare.");
    if (action === "request_revision" && !String(revisionNote).trim()) throw new Error("Inserisci la modifica richiesta.");
    const nextStatus = action === "approve" ? "draft_approved" : "revision_requested";
    const nextOrders = orders.map(order => order.id === orderId
      ? { ...order, status: nextStatus, customerRevisionNote: revisionNote, updatedAt: new Date().toISOString() }
      : order);
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(nextOrders));
    return { ok: true, status: nextStatus };
  }

  const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");
  const customerReviewDraftFn = httpsCallable(getFunctions(app, "europe-west1"), "customerReviewDraft");
  const result = await customerReviewDraftFn({ orderId, action, revisionNote });
  return result.data || {};
}

export async function sendCustomerMessage(orderId, text) {
  const messageText = String(text || "").trim();
  if (!messageText) return null;

  await firebaseReady;
  if (isFirebaseLocal || !db) {
    const orders = await listLocalOrders();
    const nextOrders = orders.map(order => order.id === orderId
      ? {
          ...order,
          messages: [
            ...(order.messages || []),
            { text: messageText, senderRole: "customer", createdAt: new Date().toISOString() }
          ]
        }
      : order);
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(nextOrders));
    return { ok: true };
  }

  const { addDoc, collection, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  await addDoc(collection(db, "orders", orderId, "messages"), {
    text: messageText,
    senderUid: auth?.currentUser?.uid || "",
    senderEmail: auth?.currentUser?.email || "",
    senderRole: "customer",
    createdAt: serverTimestamp()
  });
  return { ok: true };
}

export function getOrderStatusLabel(status) {
  return {
    pending_payment: "Pagamento in attesa",
    payment_failed: "Pagamento non riuscito",
    payment_review: "Pagamento in verifica",
    paid: "Pagato / bozza da preparare",
    draft_sent: "Bozza inviata",
    revision_requested: "Modifica richiesta",
    draft_approved: "Bozza approvata",
    in_production: "In produzione",
    shipped: "Spedito",
    cancelled: "Annullato",
    payment_expired: "Pagamento scaduto"
  }[status] || "Stato sconosciuto";
}
