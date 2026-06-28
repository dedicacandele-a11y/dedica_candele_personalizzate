const { randomUUID } = require("node:crypto");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { Resend } = require("resend");
const Stripe = require("stripe");

admin.initializeApp({
  storageBucket: "dedica-6642d.firebasestorage.app",
});

const db = admin.firestore();
const bucket = admin.storage().bucket();
const TEMP_UPLOAD_PREFIX = "temp_uploads";
const ORDER_UPLOAD_PREFIX = "custom_uploads";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ADMIN_EMAIL = "gennaro.mazzacane@gmail.com";
const STRIPE_API_VERSION = "2026-02-25.clover";
const BRAND_NAME = "D\u00c8DICA";
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_PUBLISHABLE_KEY = defineSecret("STRIPE_PUBLISHABLE_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");
const APP_BASE_URL = defineSecret("APP_BASE_URL");
const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
const EMAIL_FROM = defineSecret("EMAIL_FROM");
const ADMIN_NOTIFY_EMAIL = defineSecret("ADMIN_NOTIFY_EMAIL");
const EMAIL_REPLY_TO = defineSecret("EMAIL_REPLY_TO");
const STRIPE_SECRETS = [
  STRIPE_SECRET_KEY,
  STRIPE_PUBLISHABLE_KEY,
  STRIPE_WEBHOOK_SECRET,
  APP_BASE_URL,
];
const EMAIL_SECRETS = [
  RESEND_API_KEY,
  EMAIL_FROM,
  ADMIN_NOTIFY_EMAIL,
  EMAIL_REPLY_TO,
];
const EMAIL_FUNCTION_SECRETS = [
  ...EMAIL_SECRETS,
  APP_BASE_URL,
];
const CHECKOUT_SECRETS = [
  ...STRIPE_SECRETS,
  ...EMAIL_SECRETS,
];

const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "draft_sent",
  "revision_requested",
  "draft_approved",
  "in_production",
  "shipped",
  "cancelled",
  "payment_expired",
];

function getStripe() {
  const secretKey = STRIPE_SECRET_KEY.value().trim();
  if (!secretKey) {
    throw new HttpsError("failed-precondition", "Stripe non configurato.");
  }
  return new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });
}

function getStripeMode() {
  const secretKey = STRIPE_SECRET_KEY.value().trim() || "";
  if (secretKey.startsWith("sk_live_")) return "production";
  if (secretKey.startsWith("sk_test_")) return "test";
  return "not_configured";
}

function requireAuth(request) {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Accedi prima di continuare.");
  }
  return request.auth;
}

function requireAdmin(request) {
  const auth = requireAuth(request);
  if (auth.token?.email !== ADMIN_EMAIL) {
    throw new HttpsError("permission-denied", "Accesso amministratore richiesto.");
  }
  return auth;
}

function assertStatus(status) {
  if (!ORDER_STATUSES.includes(status)) {
    throw new HttpsError("invalid-argument", "Stato ordine non valido.");
  }
  return status;
}

function toCents(value) {
  const cents = Math.round(Number(value || 0) * 100);
  if (!Number.isInteger(cents) || cents < 0) {
    throw new HttpsError("internal", "Importo ordine non valido.");
  }
  return cents;
}

function buildPersonalizationSummary(item) {
  const parts = [];
  (item.selectedOptions || []).forEach((option) => {
    if (option.groupLabel && option.label) parts.push(`${option.groupLabel}: ${option.label}`);
  });
  const personalizations = item.personalizations || {};
  if (personalizations.text) {
    parts.push(`${personalizations.textLabel || "Testo"}: ${personalizations.text}`);
  }
  if (personalizations.generic) {
    parts.push(`${personalizations.genericLabel || "Note"}: ${personalizations.generic}`);
  }
  if (personalizations.photo) {
    parts.push(`${personalizations.photoLabel || "Foto"} caricata`);
  }
  return parts.join(" · ").substring(0, 500);
}

function buildOrderAudit(type, actor, extra = {}) {
  return {
    type,
    actor,
    at: new Date().toISOString(),
    ...extra,
  };
}

function readSecret(secret) {
  try {
    return secret.value().trim();
  } catch (err) {
    return "";
  }
}

function getAppBaseUrl() {
  return (readSecret(APP_BASE_URL) || "http://localhost:5173").replace(/\/+$/, "");
}

function getResend() {
  const apiKey = readSecret(RESEND_API_KEY);
  if (!apiKey) return null;
  return new Resend(apiKey);
}

function normalizeText(value) {
  const replacements = {
    "\u0044\u00c3\u02c6DICA": BRAND_NAME,
    "\u00c3\u02c6": "\u00c8",
    "\u00c3\u00a8": "\u00e8",
    "\u00c3\u00a0": "\u00e0",
    "\u00c3\u00b2": "\u00f2",
    "\u00c3\u00b9": "\u00f9",
    "\u00c3\u00ac": "\u00ec",
    "\u00c3\u00a9": "\u00e9",
    "\u00c2\u00b7": "\u00b7",
    "\u00e2\u201a\u00ac": "\u20ac",
  };
  let text = String(value ?? "");
  Object.entries(replacements).forEach(([broken, fixed]) => {
    text = text.split(broken).join(fixed);
  });
  text = text.replace(/D\?+DICA/g, BRAND_NAME);
  return text;
}

function escapeHtml(value) {
  return normalizeText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeEmailHtml(value) {
  return escapeHtml(value).replace(/[^\x20-\x7E]/g, (char) => `&#x${char.codePointAt(0).toString(16).toUpperCase()};`);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));
}

function displayOrderId(orderId) {
  return String(orderId || "").substring(0, 10).toUpperCase();
}

function getEmailFrom() {
  return readSecret(EMAIL_FROM);
}

function getAdminNotifyEmail() {
  return readSecret(ADMIN_NOTIFY_EMAIL) || ADMIN_EMAIL;
}

function getReplyToEmail() {
  return readSecret(EMAIL_REPLY_TO) || getAdminNotifyEmail();
}

function buildOrderItemsHtml(order) {
  return (order.items || []).map((item) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #eee;">
        <strong>${escapeEmailHtml(item.productName || `Prodotto ${BRAND_NAME}`)}</strong><br>
        <span style="color:#756e68;font-size:14px;">${escapeEmailHtml(buildPersonalizationSummary(item) || "Personalizzazione inclusa")}</span>
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #eee;text-align:center;">${escapeEmailHtml(item.qty || 1)}</td>
      <td style="padding:12px 0;border-bottom:1px solid #eee;text-align:right;">${escapeEmailHtml(formatCurrency(item.lineTotal || 0))}</td>
    </tr>
  `).join("");
}

function buildEmailLayout({ title, intro, bodyHtml, actionUrl, actionLabel }) {
  const action = actionUrl ? `
    <p style="margin:28px 0;">
      <a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#C96F45;color:#fff;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:700;">${escapeEmailHtml(actionLabel || "Apri")}</a>
    </p>
  ` : "";
  return `
    <div style="margin:0;padding:0;background:#F4EFE7;font-family:Inter,Segoe UI,Arial,sans-serif;color:#242321;">
      <div style="max-width:640px;margin:0 auto;padding:32px 18px;">
        <div style="background:#fffdf9;border-radius:24px;padding:32px;border:1px solid rgba(36,35,33,.1);">
          <p style="margin:0 0 18px;color:#C96F45;font-size:12px;letter-spacing:.16em;text-transform:uppercase;font-weight:800;">D&#xC8;DICA</p>
          <h1 style="font-family:Georgia,serif;font-weight:400;font-size:34px;line-height:1.05;margin:0 0 18px;">${escapeEmailHtml(title)}</h1>
          <p style="font-size:16px;color:#756e68;margin:0 0 24px;">${escapeEmailHtml(intro)}</p>
          ${bodyHtml || ""}
          ${action}
          <p style="font-size:13px;color:#756e68;margin:28px 0 0;">Per dubbi o modifiche, rispondi a questa email: ti aiutiamo noi.</p>
        </div>
      </div>
    </div>
  `;
}

function buildOrderSummaryHtml(orderId, order) {
  return `
    <p style="margin:0 0 12px;"><strong>Ordine:</strong> #${escapeEmailHtml(displayOrderId(orderId))}</p>
    <table style="width:100%;border-collapse:collapse;margin:18px 0;">
      <thead>
        <tr>
          <th style="text-align:left;color:#756e68;font-size:13px;">Prodotto</th>
          <th style="text-align:center;color:#756e68;font-size:13px;">Qt&#xE0;</th>
          <th style="text-align:right;color:#756e68;font-size:13px;">Totale</th>
        </tr>
      </thead>
      <tbody>${buildOrderItemsHtml(order)}</tbody>
    </table>
    <p style="text-align:right;font-size:18px;margin:0;"><strong>Totale: ${escapeEmailHtml(formatCurrency(order.total))}</strong></p>
  `;
}

function buildPlainOrderSummary(orderId, order) {
  const lines = [
    `Ordine #${displayOrderId(orderId)}`,
    ...(order.items || []).map((item) => `- ${normalizeText(item.productName || `Prodotto ${BRAND_NAME}`)} x${item.qty || 1}: ${formatCurrency(item.lineTotal || 0)}`),
    `Totale: ${formatCurrency(order.total)}`,
  ];
  return lines.join("\n");
}

async function addEmailAudit(orderRef, type, extra) {
  if (!orderRef) return;
  try {
    await orderRef.update({
      audit: admin.firestore.FieldValue.arrayUnion(
        buildOrderAudit(type, "email", extra),
      ),
    });
  } catch (err) {
    console.error("Email audit failed", err?.message);
  }
}

function maskEmail(email) {
  const [name, domain] = String(email || "").split("@");
  if (!name || !domain) return "";
  return `${name.slice(0, 2)}***@${domain}`;
}

async function sendEmail({ to, subject, html, text, event, orderRef }) {
  const resend = getResend();
  const from = getEmailFrom();
  const cleanTo = String(to || "").trim();
  if (!resend || !from || !cleanTo) {
    const reason = !resend ? "missing_resend_api_key" : !from ? "missing_email_from" : "missing_recipient";
    console.error("Email skipped", { event, reason });
    await addEmailAudit(orderRef, "email_failed", { event, reason, to: maskEmail(cleanTo) });
    return { ok: false, skipped: true, reason };
  }

  try {
    const result = await resend.emails.send({
      from: normalizeText(from),
      to: cleanTo,
      subject: normalizeText(subject),
      html,
      text: normalizeText(text),
      replyTo: normalizeText(getReplyToEmail()),
    });
    if (result?.error) {
      throw new Error(result.error.message || "Resend ha rifiutato l'email.");
    }
    await addEmailAudit(orderRef, "email_sent", { event, to: maskEmail(cleanTo), providerId: result?.data?.id || "" });
    return { ok: true, providerId: result?.data?.id || "" };
  } catch (err) {
    console.error("Resend email failed", { event, message: err?.message });
    await addEmailAudit(orderRef, "email_failed", { event, to: maskEmail(cleanTo), reason: err?.message || "resend_error" });
    return { ok: false, error: err };
  }
}

async function sendAdminOrderEmail(orderId, order) {
  const orderRef = db.collection("orders").doc(orderId);
  const subject = `Nuovo ordine ${BRAND_NAME} #${displayOrderId(orderId)}`;
  const html = buildEmailLayout({
    title: "Nuovo ordine ricevuto.",
    intro: `${order.nome || "Cliente"} ${order.cognome || ""} ha creato un nuovo ordine.`,
    bodyHtml: `
      <p><strong>Cliente:</strong> ${escapeEmailHtml(order.email)}</p>
      ${buildOrderSummaryHtml(orderId, order)}
    `,
    actionUrl: `${getAppBaseUrl()}/admin.html`,
    actionLabel: "Apri pannello admin",
  });
  const text = `Nuovo ordine ${BRAND_NAME}.\nCliente: ${order.email}\n${buildPlainOrderSummary(orderId, order)}`;
  return sendEmail({ to: getAdminNotifyEmail(), subject, html, text, event: "admin_order_created", orderRef });
}

async function sendCustomerOrderEmail(orderId, order, checkoutUrl) {
  const orderRef = db.collection("orders").doc(orderId);
  const subject = `Il tuo ordine ${BRAND_NAME} #${displayOrderId(orderId)}`;
  const html = buildEmailLayout({
    title: "Abbiamo ricevuto il tuo ordine.",
    intro: "Completa il pagamento sicuro: dopo la conferma prepareremo la bozza digitale prima della produzione.",
    bodyHtml: buildOrderSummaryHtml(orderId, order),
    actionUrl: checkoutUrl,
    actionLabel: "Completa pagamento",
  });
  const text = `Abbiamo ricevuto il tuo ordine.\n${buildPlainOrderSummary(orderId, order)}\nPagamento: ${checkoutUrl}`;
  return sendEmail({ to: order.email, subject, html, text, event: "customer_order_created", orderRef });
}

async function sendPaymentConfirmedEmail(orderId, order) {
  const orderRef = db.collection("orders").doc(orderId);
  const customerSubject = `Pagamento confermato #${displayOrderId(orderId)}`;
  const customerHtml = buildEmailLayout({
    title: "Pagamento confermato.",
    intro: "Grazie! Ora prepariamo la bozza digitale della tua candela personalizzata.",
    bodyHtml: buildOrderSummaryHtml(orderId, order),
    actionUrl: `${getAppBaseUrl()}/account.html`,
    actionLabel: "Vai al tuo account",
  });
  const customerText = `Pagamento confermato.\n${buildPlainOrderSummary(orderId, order)}`;
  await sendEmail({ to: order.email, subject: customerSubject, html: customerHtml, text: customerText, event: "customer_payment_confirmed", orderRef });

  const adminSubject = `Pagamento ricevuto #${displayOrderId(orderId)}`;
  const adminHtml = buildEmailLayout({
    title: "Pagamento ricevuto.",
    intro: "L'ordine è pronto per la preparazione della bozza.",
    bodyHtml: `
      <p><strong>Cliente:</strong> ${escapeEmailHtml(order.email)}</p>
      ${buildOrderSummaryHtml(orderId, order)}
    `,
    actionUrl: `${getAppBaseUrl()}/admin.html`,
    actionLabel: "Gestisci ordine",
  });
  const adminText = `Pagamento ricevuto.\nCliente: ${order.email}\n${buildPlainOrderSummary(orderId, order)}`;
  return sendEmail({ to: getAdminNotifyEmail(), subject: adminSubject, html: adminHtml, text: adminText, event: "admin_payment_confirmed", orderRef });
}

async function sendDraftEmail(orderId, order, draftUrl, note) {
  const orderRef = db.collection("orders").doc(orderId);
  const subject = `La tua bozza ${BRAND_NAME} è pronta #${displayOrderId(orderId)}`;
  const html = buildEmailLayout({
    title: "La tua bozza è pronta.",
    intro: note || "Abbiamo preparato la bozza digitale della tua candela personalizzata.",
    bodyHtml: `<p>Controllala con calma: se va bene puoi approvarla dall'area account, altrimenti chiedici una modifica.</p>`,
    actionUrl: draftUrl,
    actionLabel: "Apri bozza",
  });
  const text = `La tua bozza è pronta.\n${note || ""}\nApri bozza: ${draftUrl}`;
  return sendEmail({ to: order.email, subject, html, text, event: "customer_draft_sent", orderRef });
}

async function sendStatusEmail(orderId, order, status) {
  const messages = {
    draft_approved: ["Bozza approvata.", "Perfetto: abbiamo registrato l'approvazione e possiamo procedere."],
    in_production: ["Ordine in produzione.", "La tua candela personalizzata è entrata in produzione."],
    shipped: ["Ordine spedito.", "Il tuo ordine è stato segnato come spedito."],
    cancelled: ["Ordine annullato.", "Il tuo ordine è stato annullato. Se hai dubbi, rispondi a questa email."],
  };
  const [title, intro] = messages[status] || [];
  if (!title) return { ok: false, skipped: true, reason: "status_not_notifiable" };
  const orderRef = db.collection("orders").doc(orderId);
  const subject = `${title} #${displayOrderId(orderId)}`;
  const html = buildEmailLayout({
    title,
    intro,
    bodyHtml: buildOrderSummaryHtml(orderId, order),
    actionUrl: `${getAppBaseUrl()}/account.html`,
    actionLabel: "Vai al tuo account",
  });
  const text = `${title}\n${intro}\n${buildPlainOrderSummary(orderId, order)}`;
  return sendEmail({ to: order.email, subject, html, text, event: `customer_status_${status}`, orderRef });
}

const DEFAULT_CATALOG = {
  dedica: {
    id: "dedica",
    name: "Candela con dedica",
    price: 12,
    image: "assets/product-dedica.webp",
  },
  foto: {
    id: "foto",
    name: "Candela con fotografia",
    price: 16,
    image: "assets/product-foto.webp",
  },
  incisa: {
    id: "incisa",
    name: "Candela incisa",
    price: 18,
    image: "assets/product-incisa.webp",
  },
  evento: {
    id: "evento",
    name: "Bomboniera matrimonio",
    price: 6.9,
    image: "assets/product-evento.webp",
  },
  natale: {
    id: "natale",
    name: "Il calore di casa",
    price: 11,
    image: "assets/product-natale.webp",
  },
  set: {
    id: "set",
    name: "Set Un pensiero per te",
    price: 19,
    image: "assets/product-set.webp",
  },
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
      { label: "300 g", value: "300", priceDelta: 6 },
    ],
  },
  {
    key: "modello",
    label: "Colorazione / contenitore",
    type: "choice",
    required: true,
    options: [
      { label: "Vetro chiaro", value: "chiaro", priceDelta: 0 },
      { label: "Vetro ambrato", value: "ambrato", priceDelta: 2 },
      { label: "Ceramica", value: "ceramica", priceDelta: 4 },
    ],
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
      { label: "Senza profumazione", value: "Neutra", priceDelta: 0 },
    ],
  },
  {
    key: "stile",
    label: "Stile grafico",
    type: "choice",
    required: true,
    options: [
      { label: "Elegante", value: "elegante", priceDelta: 0 },
      { label: "Essenziale", value: "essenziale", priceDelta: 0 },
      { label: "Romantico", value: "romantico", priceDelta: 0 },
    ],
  },
  {
    key: "confezione",
    label: "Confezione",
    type: "choice",
    required: true,
    options: [
      { label: "Essenziale", value: "essenziale", priceDelta: 0 },
      { label: "Regalo", value: "regalo", priceDelta: 3 },
      { label: "Evento", value: "evento", priceDelta: 1.5 },
    ],
  },
];

function getDefaultPersonalization(productId) {
  return {
    text: {
      enabled: true,
      required: productId !== "set",
      label: productId === "incisa" ? "Testo da incidere" : "Dedica",
      maxLength: 42,
      priceDelta: productId === "incisa" ? 6 : 0,
    },
    photo: {
      enabled: productId === "foto",
      required: productId === "foto",
      label: "Fotografia",
      priceDelta: 4,
    },
    generic: {
      enabled: ["incisa", "evento", "set"].includes(productId),
      required: false,
      label: productId === "evento" ? "Nome evento e data" : "Note personalizzazione",
      maxLength: 180,
      priceDelta: productId === "set" ? 2 : 0,
    },
  };
}

function getProductCustomization(product) {
  const productId = product.id || "dedica";
  const customization = product.customization || {};
  const optionGroups = Array.isArray(customization.optionGroups) && customization.optionGroups.length > 0
    ? customization.optionGroups
    : DEFAULT_OPTION_GROUPS;

  return {
    optionGroups: optionGroups
      .map((group) => ({
        ...group,
        type: group.type === "select" ? "select" : "choice",
        options: Array.isArray(group.options) ? group.options : [],
      }))
      .filter((group) => group.key && group.options.length > 0),
    personalization: {
      ...getDefaultPersonalization(productId),
      ...(customization.personalization || {}),
    },
  };
}

function asString(value, field, maxLength) {
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", `${field} non valido.`);
  }
  const clean = value.trim();
  if (!clean || clean.length > maxLength) {
    throw new HttpsError("invalid-argument", `${field} non valido.`);
  }
  return clean;
}

function asOptionalString(value, maxLength) {
  if (value == null) return "";
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function getQuantityDiscountPercent(qty) {
  if (qty >= 100) return 35;
  if (qty >= 50) return 25;
  if (qty >= 20) return 15;
  return 0;
}

function assertEmail(email) {
  const clean = asString(email, "Email", 180).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) {
    throw new HttpsError("invalid-argument", "Email non valida.");
  }
  return clean;
}

function getSubmittedOption(item, key) {
  if (Array.isArray(item.selectedOptions)) {
    const match = item.selectedOptions.find((option) => option && option.key === key);
    if (match) return match.value ?? match.label;
  }
  return item[key];
}

function selectOption(group, submittedValue) {
  const value = String(submittedValue ?? "");
  const option = group.options.find((candidate) => (
    String(candidate.value) === value || String(candidate.label) === value
  ));
  if (!option) {
    throw new HttpsError("invalid-argument", `Variante ${group.label} non valida.`);
  }
  return {
    key: group.key,
    groupLabel: group.label,
    value: option.value,
    label: option.label,
    priceDelta: Number(option.priceDelta || 0),
  };
}

function parseDataImage(dataUrl) {
  if (typeof dataUrl !== "string") return null;
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([a-zA-Z0-9+/=]+)$/);
  if (!match) return null;
  const contentType = match[1] === "image/jpg" ? "image/jpeg" : match[1];
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
    throw new HttpsError("invalid-argument", "La foto supera il limite di 5MB.");
  }
  return { contentType, buffer };
}

function extensionForContentType(contentType) {
  const extensionByType = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return extensionByType[contentType] || "jpg";
}

function buildDownloadUrl(filePath, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media&token=${token}`;
}

async function saveImageBuffer(filePath, buffer, contentType, metadata = {}) {
  const token = randomUUID();
  const file = bucket.file(filePath);

  await file.save(buffer, {
    resumable: false,
    contentType,
    metadata: {
      cacheControl: "private, max-age=31536000",
      metadata: {
        firebaseStorageDownloadTokens: token,
        ...metadata,
      },
    },
  });

  return {
    storagePath: filePath,
    downloadUrl: buildDownloadUrl(filePath, token),
  };
}

async function stageImage(dataUrl) {
  const parsed = parseDataImage(dataUrl);
  if (!parsed) {
    throw new HttpsError("invalid-argument", "Formato immagine non valido.");
  }

  const uploadId = randomUUID();
  const extension = extensionForContentType(parsed.contentType);
  const filePath = `${TEMP_UPLOAD_PREFIX}/${uploadId}/original.${extension}`;

  return saveImageBuffer(filePath, parsed.buffer, parsed.contentType, {
    stagedAt: new Date().toISOString(),
    uploadId,
  });
}

function getStagedPath(rawItem) {
  const path = typeof rawItem.photoUploadPath === "string" ? rawItem.photoUploadPath.trim() : "";
  if (!path) return "";
  if (!path.startsWith(`${TEMP_UPLOAD_PREFIX}/`) || path.includes("..")) {
    throw new HttpsError("invalid-argument", "Upload foto non valido.");
  }
  return path;
}

async function finalizeStagedImage(rawItem, orderId, itemIndex) {
  const stagedPath = getStagedPath(rawItem);
  if (stagedPath) {
    const stagedFile = bucket.file(stagedPath);
    const [exists] = await stagedFile.exists();
    if (!exists) {
      throw new HttpsError("invalid-argument", "Upload foto scaduto o non trovato.");
    }

    const [metadata] = await stagedFile.getMetadata();
    const contentType = metadata.contentType || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      throw new HttpsError("invalid-argument", "Upload foto non valido.");
    }

    const [buffer] = await stagedFile.download();
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
      throw new HttpsError("invalid-argument", "Upload foto non valido.");
    }

    const extension = extensionForContentType(contentType);
    const finalPath = `${ORDER_UPLOAD_PREFIX}/${orderId}/item_${itemIndex}_${randomUUID()}.${extension}`;
    const result = await saveImageBuffer(finalPath, buffer, contentType, {
      finalizedFrom: stagedPath,
      finalizedAt: new Date().toISOString(),
    });
    await stagedFile.delete({ ignoreNotFound: true });
    return result.downloadUrl;
  }

  const parsed = parseDataImage(rawItem.photo);
  if (!parsed) return "";
  const extension = extensionForContentType(parsed.contentType);
  const finalPath = `${ORDER_UPLOAD_PREFIX}/${orderId}/item_${itemIndex}_${randomUUID()}.${extension}`;
  const result = await saveImageBuffer(finalPath, parsed.buffer, parsed.contentType, {
    finalizedAt: new Date().toISOString(),
  });
  return result.downloadUrl;
}

async function loadProduct(productId) {
  const fallback = DEFAULT_CATALOG[productId];
  const snapshot = await db.collection("products").doc(productId).get();
  if (!snapshot.exists) {
    if (!fallback) {
      throw new HttpsError("invalid-argument", "Prodotto non disponibile.");
    }
    return fallback;
  }
  return { id: snapshot.id, ...snapshot.data() };
}

async function getPromoDiscountPercent(promoCode) {
  const code = asOptionalString(promoCode, 40).toUpperCase();
  if (!code) return { code: "", percent: 0 };

  const snapshot = await db.collection("discounts").doc(code).get();
  if (!snapshot.exists) {
    throw new HttpsError("failed-precondition", "Codice promozionale non valido.");
  }

  const data = snapshot.data();
  const value = Number(data.value);
  if (!data.active || !Number.isInteger(value) || value <= 0 || value > 90) {
    throw new HttpsError("failed-precondition", "Codice promozionale non valido.");
  }

  return { code, percent: value };
}

function validateCustomer(customer = {}) {
  return {
    email: assertEmail(customer.email),
    nome: asString(customer.nome, "Nome", 100),
    cognome: asString(customer.cognome, "Cognome", 100),
    indirizzo: asString(customer.indirizzo, "Indirizzo", 240),
    citta: asString(customer.citta, "Città", 120),
    cap: asString(customer.cap, "CAP", 20),
  };
}

async function buildOrderItem(rawItem, itemIndex, orderId) {
  const productId = asString(rawItem.productType || rawItem.productId, "Prodotto", 80);
  const product = await loadProduct(productId);
  const customization = getProductCustomization(product);
  const qty = Math.min(999, Math.max(1, Number.parseInt(rawItem.qty, 10) || 1));
  const selectedOptions = customization.optionGroups.map((group) => (
    selectOption(group, getSubmittedOption(rawItem, group.key))
  ));

  const personalizations = rawItem.personalizations || {};
  const textConfig = customization.personalization.text || {};
  const photoConfig = customization.personalization.photo || {};
  const genericConfig = customization.personalization.generic || {};

  const text = textConfig.enabled
    ? asOptionalString(personalizations.text ?? rawItem.dedica, Number(textConfig.maxLength || 80))
    : "";
  if (textConfig.enabled && textConfig.required && !text) {
    throw new HttpsError("invalid-argument", `Compila il campo "${textConfig.label || "Testo"}".`);
  }

  const generic = genericConfig.enabled
    ? asOptionalString(personalizations.generic, Number(genericConfig.maxLength || 180))
    : "";
  if (genericConfig.enabled && genericConfig.required && !generic) {
    throw new HttpsError("invalid-argument", `Compila il campo "${genericConfig.label || "Personalizzazione"}".`);
  }

  let photo = "";
  if (photoConfig.enabled && (rawItem.photoUploadPath || rawItem.photo)) {
    photo = await finalizeStagedImage(rawItem, orderId, itemIndex);
  }
  if (photoConfig.enabled && photoConfig.required && !photo) {
    throw new HttpsError("invalid-argument", "Carica una fotografia per questo prodotto.");
  }

  let unitBasePrice = Number(product.price || 0);
  selectedOptions.forEach((option) => {
    unitBasePrice += Number(option.priceDelta || 0);
  });
  if (textConfig.enabled && Number(textConfig.priceDelta || 0) !== 0) {
    unitBasePrice += Number(textConfig.priceDelta || 0);
  }
  if (photoConfig.enabled && photo && Number(photoConfig.priceDelta || 0) !== 0) {
    unitBasePrice += Number(photoConfig.priceDelta || 0);
  }
  if (genericConfig.enabled && generic && Number(genericConfig.priceDelta || 0) !== 0) {
    unitBasePrice += Number(genericConfig.priceDelta || 0);
  }

  unitBasePrice = roundMoney(Math.max(0, unitBasePrice));
  const lineBaseTotal = roundMoney(unitBasePrice * qty);
  const bulkDiscountPercent = getQuantityDiscountPercent(qty);
  const lineTotal = roundMoney(lineBaseTotal - (lineBaseTotal * bulkDiscountPercent / 100));
  const unitFinalPrice = roundMoney(lineTotal / qty);

  return {
    id: `item-${itemIndex + 1}`,
    productType: product.id,
    productName: product.name,
    selectedOptions,
    personalizations: {
      text,
      textLabel: textConfig.label || "Testo",
      photo: Boolean(photo),
      photoLabel: photoConfig.label || "Foto",
      generic,
      genericLabel: genericConfig.label || "Personalizzazione",
    },
    photo,
    consegna: asOptionalString(rawItem.consegna, 40),
    unitBasePrice,
    price: unitFinalPrice,
    lineBaseTotal,
    lineTotal,
    bulkDiscountPercent,
    qty,
  };
}

async function createCheckoutSessionForOrder(orderRef, orderObject, idempotencySuffix = "") {
  const stripe = getStripe();
  const appBaseUrl = getAppBaseUrl();
  if (toCents(orderObject.total) <= 0) {
    throw new HttpsError("failed-precondition", "Importo ordine non valido per il pagamento.");
  }

  const lineItems = orderObject.items.map((item) => {
    const unitAmount = toCents(item.price);
    if (unitAmount <= 0) {
      throw new HttpsError("failed-precondition", "Importo prodotto non valido per il pagamento.");
    }
    return {
      quantity: Number(item.qty || 1),
      price_data: {
        currency: "eur",
        unit_amount: unitAmount,
        product_data: {
          name: item.productName,
          description: buildPersonalizationSummary(item) || undefined,
          images: item.photo ? [item.photo] : undefined,
        },
      },
    };
  });

  if (toCents(orderObject.shipping) > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "eur",
        unit_amount: toCents(orderObject.shipping),
        product_data: {
          name: "Spedizione",
          description: "Consegna ordine DEDICA",
        },
      },
    });
  }

  const discounts = [];
  if (toCents(orderObject.discount) > 0) {
    const coupon = await stripe.coupons.create({
      amount_off: toCents(orderObject.discount),
      currency: "eur",
      duration: "once",
      name: orderObject.promoCode ? `Promo ${orderObject.promoCode}` : "Sconto ordine",
      metadata: {
        orderId: orderRef.id,
        promoCode: orderObject.promoCode || "",
      },
    });
    discounts.push({ coupon: coupon.id });
  }

  const sessionPayload = {
    mode: "payment",
    client_reference_id: orderRef.id,
    customer_email: orderObject.email,
    line_items: lineItems,
    metadata: {
      orderId: orderRef.id,
      customerUid: orderObject.customerUid,
      source: "dedica_checkout",
    },
    success_url: `${appBaseUrl}/payment-success.html?session_id={CHECKOUT_SESSION_ID}&order_id=${orderRef.id}`,
    cancel_url: `${appBaseUrl}/payment-cancel.html?order_id=${orderRef.id}`,
  };
  if (discounts.length) sessionPayload.discounts = discounts;

  return stripe.checkout.sessions.create(sessionPayload, {
    idempotencyKey: `checkout_${orderRef.id}${idempotencySuffix}`,
  });
}

exports.createOrder = onCall({
  region: "europe-west1",
  cors: true,
  maxInstances: 10,
  secrets: CHECKOUT_SECRETS,
}, async (request) => {
  const auth = requireAuth(request);
  const data = request.data || {};
  const customer = validateCustomer(data.customer || {});
  if (auth.token?.email && auth.token.email.toLowerCase() !== customer.email.toLowerCase()) {
    throw new HttpsError("permission-denied", "L'email dell'ordine deve coincidere con l'account connesso.");
  }
  const rawItems = Array.isArray(data.items) ? data.items : [];
  if (rawItems.length === 0 || rawItems.length > 30) {
    throw new HttpsError("invalid-argument", "Il carrello non è valido.");
  }

  const orderRef = db.collection("orders").doc();
  const orderItems = [];
  for (const [index, rawItem] of rawItems.entries()) {
    orderItems.push(await buildOrderItem(rawItem || {}, index, orderRef.id));
  }

  const promo = await getPromoDiscountPercent(data.promoCode);
  const subtotal = roundMoney(orderItems.reduce((sum, item) => sum + item.lineTotal, 0));
  const shipping = subtotal >= 59 || subtotal === 0 ? 0 : 4.9;
  const discount = roundMoney(subtotal * (promo.percent / 100));
  const total = roundMoney(Math.max(0, subtotal + shipping - discount));

  const orderObject = {
    ...customer,
    customerUid: auth.uid,
    items: orderItems,
    subtotal,
    shipping,
    discount,
    total,
    promoCode: promo.code,
    status: "pending_payment",
    paymentStatus: "pending",
    stripeMode: getStripeMode(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdVia: "cloud_function",
    audit: [buildOrderAudit("order_created", auth.token?.email || auth.uid)],
  };

  await orderRef.set(orderObject);
  const session = await createCheckoutSessionForOrder(orderRef, orderObject);
  await orderRef.update({
    stripeCheckoutSessionId: session.id,
    stripeCheckoutUrl: session.url,
    updatedAt: new Date().toISOString(),
    audit: admin.firestore.FieldValue.arrayUnion(
      buildOrderAudit("stripe_checkout_created", "system", { sessionId: session.id }),
    ),
  });

  const orderWithCheckout = {
    ...orderObject,
    stripeCheckoutSessionId: session.id,
    stripeCheckoutUrl: session.url,
  };
  await Promise.all([
    sendCustomerOrderEmail(orderRef.id, orderWithCheckout, session.url),
    sendAdminOrderEmail(orderRef.id, orderWithCheckout),
  ]);

  return {
    orderId: orderRef.id,
    displayOrderId: orderRef.id.substring(0, 10).toUpperCase(),
    checkoutUrl: session.url,
    stripeCheckoutSessionId: session.id,
    totals: { subtotal, shipping, discount, total },
  };
});

exports.retryOrderPayment = onCall({
  region: "europe-west1",
  cors: true,
  maxInstances: 10,
  secrets: STRIPE_SECRETS,
}, async (request) => {
  const auth = requireAuth(request);
  const orderId = asString(request.data?.orderId, "Ordine", 120);
  const orderRef = db.collection("orders").doc(orderId);
  const snapshot = await orderRef.get();
  if (!snapshot.exists) {
    throw new HttpsError("not-found", "Ordine non trovato.");
  }

  const order = snapshot.data();
  if (order.customerUid !== auth.uid) {
    throw new HttpsError("permission-denied", "Non puoi pagare questo ordine.");
  }
  if (order.paymentStatus === "paid" || order.status === "paid") {
    throw new HttpsError("failed-precondition", "Ordine già pagato.");
  }
  if (!["pending_payment", "payment_expired"].includes(order.status)) {
    throw new HttpsError("failed-precondition", "Pagamento non disponibile per questo ordine.");
  }

  const session = await createCheckoutSessionForOrder(orderRef, order, `_retry_${Date.now()}`);
  await orderRef.update({
    status: "pending_payment",
    paymentStatus: "pending",
    stripeCheckoutSessionId: session.id,
    stripeCheckoutUrl: session.url,
    updatedAt: new Date().toISOString(),
    audit: admin.firestore.FieldValue.arrayUnion(
      buildOrderAudit("stripe_checkout_retried", auth.token?.email || auth.uid, { sessionId: session.id }),
    ),
  });

  return { checkoutUrl: session.url, stripeCheckoutSessionId: session.id };
});

exports.getCheckoutResult = onCall({
  region: "europe-west1",
  cors: true,
  maxInstances: 10,
}, async (request) => {
  const auth = requireAuth(request);
  const orderId = asString(request.data?.orderId, "Ordine", 120);
  const sessionId = asOptionalString(request.data?.sessionId, 200);
  const snapshot = await db.collection("orders").doc(orderId).get();
  if (!snapshot.exists) {
    throw new HttpsError("not-found", "Ordine non trovato.");
  }

  const order = snapshot.data();
  const isAdmin = auth.token?.email === ADMIN_EMAIL;
  if (!isAdmin && order.customerUid !== auth.uid) {
    throw new HttpsError("permission-denied", "Non puoi visualizzare questo ordine.");
  }
  if (sessionId && order.stripeCheckoutSessionId && sessionId !== order.stripeCheckoutSessionId) {
    throw new HttpsError("permission-denied", "Sessione pagamento non valida per questo ordine.");
  }

  return {
    orderId,
    displayOrderId: orderId.substring(0, 10).toUpperCase(),
    status: order.status,
    paymentStatus: order.paymentStatus || "pending",
    total: order.total,
    paidAt: order.paidAt || "",
    stripeCheckoutSessionId: order.stripeCheckoutSessionId || "",
  };
});

exports.checkStripeConfig = onCall({
  region: "europe-west1",
  cors: true,
  maxInstances: 5,
  secrets: STRIPE_SECRETS,
}, async (request) => {
  requireAdmin(request);
  const secretKey = STRIPE_SECRET_KEY.value().trim() || "";
  const publishableKey = STRIPE_PUBLISHABLE_KEY.value().trim() || "";
  const webhookSecret = STRIPE_WEBHOOK_SECRET.value().trim() || "";
  let apiReachable = false;

  if (secretKey) {
    try {
      const stripe = getStripe();
      await stripe.balance.retrieve();
      apiReachable = true;
    } catch (err) {
      console.error("Stripe config check failed", err?.type || err?.code || err?.message);
    }
  }

  return {
    connected: Boolean(secretKey && publishableKey && webhookSecret && apiReachable),
    mode: getStripeMode(),
    webhookConfigured: Boolean(webhookSecret),
    publishableConfigured: Boolean(publishableKey),
    secretConfigured: Boolean(secretKey),
    lastCheckedAt: new Date().toISOString(),
    dashboardUrl: "https://dashboard.stripe.com/test/dashboard",
    webhookUrl: "https://europe-west1-dedica-6642d.cloudfunctions.net/stripeWebhook",
  };
});

exports.adminUpdateOrderStatus = onCall({
  region: "europe-west1",
  cors: true,
  maxInstances: 10,
  secrets: EMAIL_FUNCTION_SECRETS,
}, async (request) => {
  const auth = requireAdmin(request);
  const orderId = asString(request.data?.orderId, "Ordine", 120);
  const status = assertStatus(request.data?.status);
  if (["pending_payment", "paid", "payment_expired"].includes(status)) {
    throw new HttpsError("failed-precondition", "Questo stato è gestito dal pagamento Stripe.");
  }

  const orderRef = db.collection("orders").doc(orderId);
  const snapshot = await orderRef.get();
  if (!snapshot.exists) {
    throw new HttpsError("not-found", "Ordine non trovato.");
  }
  const order = snapshot.data();

  await orderRef.update({
    status,
    updatedAt: new Date().toISOString(),
    audit: admin.firestore.FieldValue.arrayUnion(
      buildOrderAudit("admin_status_updated", auth.token.email, { status }),
    ),
  });
  await sendStatusEmail(orderId, { ...order, status }, status);
  return { ok: true, status };
});

exports.sendOrderDraft = onCall({
  region: "europe-west1",
  cors: true,
  maxInstances: 10,
  secrets: EMAIL_FUNCTION_SECRETS,
}, async (request) => {
  const auth = requireAdmin(request);
  const orderId = asString(request.data?.orderId, "Ordine", 120);
  const draftUrl = asString(request.data?.draftUrl, "URL bozza", 2000);
  const note = asOptionalString(request.data?.note, 1000);
  const orderRef = db.collection("orders").doc(orderId);
  const snapshot = await orderRef.get();
  if (!snapshot.exists) {
    throw new HttpsError("not-found", "Ordine non trovato.");
  }
  const order = snapshot.data();
  if (!["paid", "draft_sent", "revision_requested"].includes(order.status)) {
    throw new HttpsError("failed-precondition", "Puoi inviare la bozza solo dopo il pagamento.");
  }

  await orderRef.update({
    status: "draft_sent",
    draft: {
      url: draftUrl,
      note,
      sentAt: new Date().toISOString(),
      sentBy: auth.token.email,
    },
    updatedAt: new Date().toISOString(),
    audit: admin.firestore.FieldValue.arrayUnion(
      buildOrderAudit("draft_sent", auth.token.email),
    ),
  });
  await sendDraftEmail(orderId, { ...order, status: "draft_sent" }, draftUrl, note);

  return { ok: true, status: "draft_sent" };
});

exports.stripeWebhook = onRequest({
  region: "europe-west1",
  cors: false,
  maxInstances: 10,
  secrets: CHECKOUT_SECRETS,
}, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const webhookSecret = STRIPE_WEBHOOK_SECRET.value().trim();
  if (!webhookSecret) {
    console.error("Stripe webhook secret missing");
    res.status(500).send("Webhook not configured");
    return;
  }

  let event;
  try {
    const stripe = getStripe();
    const signature = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(req.rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed", err?.message);
    res.status(400).send("Invalid signature");
    return;
  }

  try {
    let paidEmail = null;

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      if (session.payment_status === "paid") {
        const orderId = session.metadata?.orderId;
        if (!orderId) throw new Error("Missing orderId metadata");
        const orderRef = db.collection("orders").doc(orderId);
        await db.runTransaction(async (transaction) => {
          const snapshot = await transaction.get(orderRef);
          if (!snapshot.exists) throw new Error(`Order ${orderId} not found`);
          const order = snapshot.data();
          if (order.paymentStatus === "paid") return;
          paidEmail = {
            orderId,
            order: {
              ...order,
              status: "paid",
              paymentStatus: "paid",
              stripeCheckoutSessionId: session.id,
              stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : "",
              paidAt: new Date().toISOString(),
            },
          };
          transaction.update(orderRef, {
            status: "paid",
            paymentStatus: "paid",
            stripeCheckoutSessionId: session.id,
            stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : "",
            paidAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            audit: admin.firestore.FieldValue.arrayUnion(
              buildOrderAudit("stripe_payment_completed", "stripe", { sessionId: session.id }),
            ),
          });
        });
      }
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        const orderRef = db.collection("orders").doc(orderId);
        await db.runTransaction(async (transaction) => {
          const snapshot = await transaction.get(orderRef);
          if (!snapshot.exists) return;
          const order = snapshot.data();
          if (order.paymentStatus === "paid" || order.stripeCheckoutSessionId !== session.id) return;
          transaction.update(orderRef, {
            status: "payment_expired",
            paymentStatus: "expired",
            updatedAt: new Date().toISOString(),
            audit: admin.firestore.FieldValue.arrayUnion(
              buildOrderAudit("stripe_checkout_expired", "stripe", { sessionId: session.id }),
            ),
          });
        });
      }
    }

    if (paidEmail) {
      await sendPaymentConfirmedEmail(paidEmail.orderId, paidEmail.order);
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Stripe webhook processing failed", err?.message);
    res.status(500).send("Webhook processing failed");
  }
});

exports.stageOrderImage = onCall({
  region: "europe-west1",
  cors: true,
  maxInstances: 10,
}, async (request) => {
  const data = request.data || {};
  const result = await stageImage(data.photo);
  return result;
});

exports.cleanupStagedUploads = onSchedule({
  region: "europe-west1",
  schedule: "every 24 hours",
  timeZone: "Europe/Rome",
}, async () => {
  const [files] = await bucket.getFiles({ prefix: `${TEMP_UPLOAD_PREFIX}/` });
  const cutoff = Date.now() - (24 * 60 * 60 * 1000);
  await Promise.all(files.map(async (file) => {
    const [metadata] = await file.getMetadata();
    const updated = new Date(metadata.updated || metadata.timeCreated || 0).getTime();
    if (updated > 0 && updated < cutoff) {
      await file.delete({ ignoreNotFound: true });
    }
  }));
});
