import { app, db, firebaseReady, isFirebaseLocal } from "./firebase.js";

const LOCAL_SUPPORT_KEY = "dedica_support_tickets";

function localTickets() {
  return JSON.parse(localStorage.getItem(LOCAL_SUPPORT_KEY) || "[]");
}

export async function createSupportTicket(value) {
  await firebaseReady;
  if (isFirebaseLocal || !app || !db) {
    const id = `SUP-${Date.now().toString().slice(-8)}`;
    const ticket = { id, ...value, status: "open", priority: value.topic === "transport_damage" ? "high" : "normal", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), replies: [] };
    localStorage.setItem(LOCAL_SUPPORT_KEY, JSON.stringify([ticket, ...localTickets()]));
    return { ok: true, ticketId: id };
  }
  const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");
  const result = await httpsCallable(getFunctions(app, "europe-west1"), "createSupportTicket")(value);
  return result.data;
}

export async function listSupportTickets() {
  await firebaseReady;
  if (isFirebaseLocal || !db) return localTickets();
  const { collection, getDocs, orderBy, query } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  const snapshot = await getDocs(query(collection(db, "support_tickets"), orderBy("createdAt", "desc")));
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

export async function manageSupportTicket(ticketId, action, value = {}) {
  await firebaseReady;
  if (isFirebaseLocal || !app || !db) {
    const now = new Date().toISOString();
    const tickets = localTickets().map(ticket => {
      if (ticket.id !== ticketId) return ticket;
      if (action === "reply") return { ...ticket, status: "waiting_customer", updatedAt: now, replies: [...(ticket.replies || []), { text: value.text, senderRole: "admin", createdAt: now }] };
      if (action === "update") return { ...ticket, status: value.status || ticket.status, priority: value.priority || ticket.priority, updatedAt: now };
      return ticket;
    });
    localStorage.setItem(LOCAL_SUPPORT_KEY, JSON.stringify(tickets));
    return { ok: true };
  }
  const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");
  const result = await httpsCallable(getFunctions(app, "europe-west1"), "adminManageSupportTicket")({ ticketId, action, value });
  return result.data;
}
