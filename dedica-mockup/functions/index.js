const { createHash, randomUUID } = require("node:crypto");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
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
const SUPPORT_EMAIL_TOKEN = "__DEDICA_SUPPORT_EMAIL__";
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_PUBLISHABLE_KEY = defineSecret("STRIPE_PUBLISHABLE_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");
const APP_BASE_URL = defineSecret("APP_BASE_URL");
const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
const EMAIL_FROM = defineSecret("EMAIL_FROM");
const ADMIN_NOTIFY_EMAIL = defineSecret("ADMIN_NOTIFY_EMAIL");
const EMAIL_REPLY_TO = defineSecret("EMAIL_REPLY_TO");
const RESEND_WEBHOOK_SECRET = defineSecret("RESEND_WEBHOOK_SECRET");
const SPEDIAMO_API_KEY = defineSecret("SPEDIAMO_API_KEY");
const SPEDIAMO_API_BASE_URL = "https://api.spediamo.it/v1";
const RESEND_INBOUND_DOMAIN = "veloxbraai.resend.app";
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
  "payment_failed",
  "payment_review",
];

const ADMIN_STATUS_TRANSITIONS = {
  draft_approved: ["in_production", "cancelled"],
  in_production: ["shipped", "cancelled"],
};


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

async function spediamoRequest(path, { method = "GET", body } = {}) {
  const apiKey = SPEDIAMO_API_KEY.value().trim();
  if (!apiKey) {
    throw new HttpsError("failed-precondition", "Spediamo.it non configurato: manca il secret SPEDIAMO_API_KEY.");
  }

  const response = await fetch(`${SPEDIAMO_API_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });

  const text = await response.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = { message: text.slice(0, 500) }; }
  }
  if (!response.ok) {
    console.error("Spediamo API error", { status: response.status, path });
    throw new HttpsError(
      response.status === 401 || response.status === 403 ? "permission-denied" : "unavailable",
      response.status === 401 || response.status === 403
        ? "Chiave Spediamo.it non valida o non autorizzata."
        : `Spediamo.it non disponibile (HTTP ${response.status}).`,
    );
  }
  return payload;
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

function getSessionAmountTotal(session) {
  return Number.isFinite(Number(session?.amount_total)) ? Number(session.amount_total) : 0;
}

function getSessionCurrency(session) {
  return String(session?.currency || "").toLowerCase();
}

function getSessionPaymentIntentId(session) {
  return typeof session?.payment_intent === "string" ? session.payment_intent : "";
}

async function retrieveCheckoutSession(stripe, sessionId) {
  const cleanSessionId = String(sessionId || "").trim();
  if (!cleanSessionId) return null;
  try {
    return await stripe.checkout.sessions.retrieve(cleanSessionId);
  } catch (err) {
    console.error("Stripe session retrieve failed", {
      sessionId: cleanSessionId,
      message: err?.message,
    });
    return null;
  }
}

async function expireCheckoutSessionIfOpen(stripe, sessionId) {
  const session = await retrieveCheckoutSession(stripe, sessionId);
  if (!session || session.status !== "open") return false;
  try {
    await stripe.checkout.sessions.expire(session.id);
    return true;
  } catch (err) {
    console.error("Stripe session expire failed", {
      sessionId: session.id,
      message: err?.message,
    });
    return false;
  }
}

function getPaidSessionMismatch(session, order) {
  const expectedAmount = toCents(order.total);
  const actualAmount = getSessionAmountTotal(session);
  const currency = getSessionCurrency(session);
  if (currency && currency !== "eur") {
    return { reason: "currency_mismatch", expectedAmount, actualAmount, currency };
  }
  if (actualAmount !== expectedAmount) {
    return { reason: "amount_mismatch", expectedAmount, actualAmount, currency };
  }
  return null;
}

async function markOrderPaidFromSession(orderRef, session, auditType = "stripe_payment_completed") {
  let paidEmail = null;
  let sessionToExpire = "";
  let mismatch = null;

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(orderRef);
    if (!snapshot.exists) throw new Error(`Order ${orderRef.id} not found`);
    const order = snapshot.data();

    const mismatchData = getPaidSessionMismatch(session, order);
    if (mismatchData) {
      mismatch = mismatchData;
      transaction.update(orderRef, {
        status: "payment_review",
        paymentStatus: "amount_mismatch",
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: getSessionPaymentIntentId(session),
        updatedAt: new Date().toISOString(),
        audit: admin.firestore.FieldValue.arrayUnion(
          buildOrderAudit("stripe_payment_mismatch", "stripe", {
            sessionId: session.id,
            ...mismatchData,
          }),
        ),
      });
      return;
    }

    if (order.paymentStatus === "paid") {
      if (order.stripeCheckoutSessionId && order.stripeCheckoutSessionId !== session.id) {
        transaction.update(orderRef, {
          audit: admin.firestore.FieldValue.arrayUnion(
            buildOrderAudit("stripe_duplicate_payment_seen", "stripe", { sessionId: session.id }),
          ),
        });
      }
      return;
    }

    if (order.stripeCheckoutSessionId && order.stripeCheckoutSessionId !== session.id) {
      sessionToExpire = order.stripeCheckoutSessionId;
    }

    const paidAt = new Date().toISOString();
    paidEmail = {
      orderId: orderRef.id,
      order: {
        ...order,
        status: "paid",
        paymentStatus: "paid",
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: getSessionPaymentIntentId(session),
        paidAt,
      },
    };

    transaction.update(orderRef, {
      status: "paid",
      paymentStatus: "paid",
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: getSessionPaymentIntentId(session),
      paidAt,
      updatedAt: new Date().toISOString(),
      audit: admin.firestore.FieldValue.arrayUnion(
        buildOrderAudit(auditType, "stripe", { sessionId: session.id }),
      ),
    });
  });

  if (sessionToExpire) {
    await expireCheckoutSessionIfOpen(getStripe(), sessionToExpire);
  }

  return { paidEmail, mismatch };
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

function getAppBaseUrl(options = {}) {
  const value = readSecret(APP_BASE_URL);
  if (!value && options.required) {
    throw new HttpsError("failed-precondition", "APP_BASE_URL non configurato.");
  }
  return (value || "http://localhost:5173").replace(/\/+$/, "");
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

async function getBusinessContactEmail() {
  try {
    const snapshot = await db.collection("business_settings").doc("company").get();
    const email = String(snapshot.data()?.email || "").trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return email;
  } catch (error) {
    console.error("Business contact email lookup failed", error?.message);
  }
  return getReplyToEmail();
}

function buildOrderItemsHtml(order) {
  return (order.items || []).map((item) => `
    <tr>
      <td style="padding:16px 8px 16px 0;border-bottom:1px solid #E7DED3;vertical-align:top;">
        <strong style="display:block;color:#292522;font-size:15px;line-height:1.4;">${escapeEmailHtml(item.productName || `Prodotto ${BRAND_NAME}`)}</strong>
        <span style="display:block;color:#786F68;font-size:13px;line-height:1.5;margin-top:4px;">${escapeEmailHtml(buildPersonalizationSummary(item) || "Personalizzazione inclusa")}</span>
      </td>
      <td style="padding:16px 8px;border-bottom:1px solid #E7DED3;text-align:center;vertical-align:top;color:#514A45;font-size:14px;">${escapeEmailHtml(item.qty || 1)}</td>
      <td style="padding:16px 0 16px 8px;border-bottom:1px solid #E7DED3;text-align:right;vertical-align:top;color:#292522;font-size:14px;font-weight:700;white-space:nowrap;">${escapeEmailHtml(formatCurrency(item.lineTotal || 0))}</td>
    </tr>
  `).join("");
}

function buildEmailLayout({ title, intro, bodyHtml, actionUrl, actionLabel }) {
  const safeTitle = escapeEmailHtml(title);
  const safeIntro = escapeEmailHtml(intro);
  const safeSupportEmail = SUPPORT_EMAIL_TOKEN;
  const supportHref = `mailto:${SUPPORT_EMAIL_TOKEN}`;
  const action = actionUrl ? `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:30px 0 8px;">
      <tr>
        <td bgcolor="#B85F3C" style="border-radius:999px;">
          <a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:14px 24px;border:1px solid #B85F3C;border-radius:999px;color:#FFFFFF;font-size:15px;line-height:20px;font-weight:700;text-decoration:none;">${escapeEmailHtml(actionLabel || "Apri")}</a>
        </td>
      </tr>
    </table>
  ` : "";
  return `
    <!doctype html>
    <html lang="it">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <meta name="color-scheme" content="light">
        <title>${safeTitle}</title>
      </head>
      <body style="margin:0;padding:0;background:#F3EEE7;font-family:Arial,'Segoe UI',sans-serif;color:#292522;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safeIntro}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#F3EEE7;">
          <tr>
            <td align="center" style="padding:28px 12px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:640px;">
                <tr>
                  <td align="center" style="padding:4px 16px 22px;">
                    <a href="${escapeHtml(getAppBaseUrl())}" style="color:#292522;text-decoration:none;font-family:Georgia,'Times New Roman',serif;font-size:25px;letter-spacing:5px;">D&#xC8;DICA</a>
                    <div style="margin-top:7px;color:#8A7E75;font-size:10px;letter-spacing:2px;text-transform:uppercase;">Candele create per custodire emozioni</div>
                  </td>
                </tr>
                <tr>
                  <td style="background:#FFFDF9;border:1px solid #E5DCD1;border-radius:22px;padding:38px 34px;box-shadow:0 8px 28px rgba(54,43,34,.06);">
                    <div style="width:38px;height:3px;background:#B85F3C;border-radius:3px;margin:0 0 22px;"></div>
                    <h1 style="margin:0 0 14px;color:#292522;font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:1.15;font-weight:400;">${safeTitle}</h1>
                    <p style="margin:0 0 27px;color:#706760;font-size:16px;line-height:1.65;">${safeIntro}</p>
                    <div style="color:#3D3834;font-size:15px;line-height:1.65;">${bodyHtml || ""}</div>
                    ${action}
                    <div style="margin-top:30px;padding-top:22px;border-top:1px solid #E7DED3;">
                      <p style="margin:0;color:#706760;font-size:13px;line-height:1.6;">Hai bisogno di aiuto? Scrivici a <a href="${supportHref}" style="color:#B85F3C;font-weight:700;text-decoration:underline;">${safeSupportEmail}</a>. Il team D&#xC8;DICA ti risponder&#xE0; al pi&#xF9; presto.</p>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:22px 18px 4px;color:#8A7E75;font-size:11px;line-height:1.6;">
                    <a href="${escapeHtml(getAppBaseUrl())}" style="color:#8A7E75;text-decoration:underline;">dedicacandele.it</a><br>
                    Questa &#xE8; un'email di servizio relativa alla tua richiesta o al tuo ordine.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

function buildOrderSummaryHtml(orderId, order) {
  return `
    <div style="margin:0 0 20px;padding:13px 16px;background:#F7F2EC;border-radius:12px;color:#615851;font-size:13px;letter-spacing:.4px;">
      ORDINE <strong style="color:#292522;">#${escapeEmailHtml(displayOrderId(orderId))}</strong>
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:0 0 20px;">
      <thead>
        <tr>
          <th style="padding:0 8px 9px 0;text-align:left;color:#8A7E75;font-size:11px;letter-spacing:.7px;text-transform:uppercase;">Prodotto</th>
          <th style="padding:0 8px 9px;text-align:center;color:#8A7E75;font-size:11px;letter-spacing:.7px;text-transform:uppercase;">Qt&#xE0;</th>
          <th style="padding:0 0 9px 8px;text-align:right;color:#8A7E75;font-size:11px;letter-spacing:.7px;text-transform:uppercase;">Importo</th>
        </tr>
      </thead>
      <tbody>${buildOrderItemsHtml(order)}</tbody>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="color:#706760;font-size:14px;">Totale ordine</td>
        <td align="right" style="color:#292522;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;">${escapeEmailHtml(formatCurrency(order.total))}</td>
      </tr>
    </table>
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

async function sendEmail({ to, subject, html, text, event, orderRef, replyTo }) {
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
    const contactEmail = await getBusinessContactEmail();
    const hydratedHtml = String(html || "").split(SUPPORT_EMAIL_TOKEN).join(escapeEmailHtml(contactEmail));
    const result = await resend.emails.send({
      from: normalizeText(from),
      to: cleanTo,
      subject: normalizeText(subject),
      html: hydratedHtml,
      text: normalizeText(text),
      replyTo: normalizeText(replyTo || contactEmail),
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
    actionUrl: `${getAppBaseUrl()}/admin`,
    actionLabel: "Apri pannello admin",
  });
  const text = `Nuovo ordine ${BRAND_NAME}.\nCliente: ${order.email}\n${buildPlainOrderSummary(orderId, order)}`;
  return sendEmail({ to: await getBusinessContactEmail(), subject, html, text, event: "admin_order_created", orderRef });
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
    actionUrl: `${getAppBaseUrl()}/account`,
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
    actionUrl: `${getAppBaseUrl()}/admin`,
    actionLabel: "Gestisci ordine",
  });
  const adminText = `Pagamento ricevuto.\nCliente: ${order.email}\n${buildPlainOrderSummary(orderId, order)}`;
  return sendEmail({ to: await getBusinessContactEmail(), subject: adminSubject, html: adminHtml, text: adminText, event: "admin_payment_confirmed", orderRef });
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
    actionUrl: `${getAppBaseUrl()}/account`,
    actionLabel: "Vai al tuo account",
  });
  const text = `${title}\n${intro}\n${buildPlainOrderSummary(orderId, order)}`;
  return sendEmail({ to: order.email, subject, html, text, event: `customer_status_${status}`, orderRef });
}

async function sendAdminDraftReviewEmail(orderId, order, action, note = "") {
  const isApproval = action === "approved";
  const orderRef = db.collection("orders").doc(orderId);
  const title = isApproval ? "Bozza approvata dal cliente." : "Modifica richiesta dal cliente.";
  const intro = isApproval
    ? "Il cliente ha approvato la bozza: l'ordine può entrare in produzione."
    : "Il cliente ha richiesto una revisione della bozza prima della produzione.";
  const subject = `${title} #${displayOrderId(orderId)}`;
  const html = buildEmailLayout({
    title,
    intro,
    bodyHtml: `
      <p><strong>Cliente:</strong> ${escapeEmailHtml(order.email)}</p>
      ${note ? `<p><strong>Nota cliente:</strong> ${escapeEmailHtml(note)}</p>` : ""}
      ${buildOrderSummaryHtml(orderId, order)}
    `,
    actionUrl: `${getAppBaseUrl()}/admin`,
    actionLabel: "Apri ordine",
  });
  const text = `${title}\nCliente: ${order.email}\n${note ? `Nota: ${normalizeText(note)}\n` : ""}${buildPlainOrderSummary(orderId, order)}`;
  return sendEmail({
    to: await getBusinessContactEmail(),
    subject,
    html,
    text,
    event: isApproval ? "admin_draft_approved" : "admin_revision_requested",
    orderRef,
  });
}

async function sendMessageNotificationEmail(orderId, order, message) {
  const isAdminMessage = message.senderRole === "admin";
  const orderRef = db.collection("orders").doc(orderId);
  const recipient = isAdminMessage ? order.email : await getBusinessContactEmail();
  const title = isAdminMessage ? "Nuovo messaggio da DÈDICA." : "Nuovo messaggio cliente.";
  const intro = isAdminMessage
    ? "Ti abbiamo scritto nell'area cliente del tuo ordine."
    : `${order.email || "Un cliente"} ha scritto nell'ordine.`;
  const actionUrl = `${getAppBaseUrl()}/${isAdminMessage ? "account" : "admin"}`;
  const html = buildEmailLayout({
    title,
    intro,
    bodyHtml: `
      <p style="padding:14px 16px;background:#F4EFE7;border-radius:14px;">${escapeEmailHtml(message.text)}</p>
      <p><strong>Ordine:</strong> #${escapeEmailHtml(displayOrderId(orderId))}</p>
    `,
    actionUrl,
    actionLabel: isAdminMessage ? "Apri area cliente" : "Apri pannello admin",
  });
  const text = `${title}\nOrdine #${displayOrderId(orderId)}\n${normalizeText(message.text)}`;
  return sendEmail({
    to: recipient,
    subject: `${title} #${displayOrderId(orderId)}`,
    html,
    text,
    event: isAdminMessage ? "customer_message_received" : "admin_customer_message",
    orderRef,
  });
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

async function calculateShippingQuote(items, subtotal) {
  const snapshot = await db.collection("shipping_settings").doc("default").get();
  const defaultSettings = {
    packagingWeightGrams: 300,
    volumetricDivisor: 4545.45,
    pricingSource: "https://spediamo.it/tariffe",
    pricingUpdatedAt: "2026-07-20",
    freeRules: [{ id: "free-standard", label: "Gratis sopra 79 euro", minAmount: 79, maxQuantity: 10, maxWeightGrams: 5000, active: true }],
    carriers: [{ id: "spediamo", name: "Spediamo.it", deliveryTime: "1-2 giorni lavorativi" }],
    rates: [
      { id: "spediamo-3", label: "Spediamo.it 0-3 kg", carrierId: "spediamo", minQuantity: 1, maxWeightGrams: 3000, price: 6.78, active: true },
      { id: "spediamo-5", label: "Spediamo.it 3-5 kg", carrierId: "spediamo", minQuantity: 1, maxWeightGrams: 5000, price: 8.49, active: true },
      { id: "spediamo-15", label: "Spediamo.it 5-15 kg", carrierId: "spediamo", minQuantity: 1, maxWeightGrams: 15000, price: 10.59, active: true },
      { id: "spediamo-25", label: "Spediamo.it 15-25 kg", carrierId: "spediamo", minQuantity: 1, maxWeightGrams: 25000, price: 12.59, active: true },
      { id: "spediamo-30", label: "Spediamo.it 25-30 kg", carrierId: "spediamo", minQuantity: 1, maxWeightGrams: 30000, price: 17.89, active: true },
      { id: "spediamo-50", label: "Spediamo.it 30-50 kg", carrierId: "spediamo", minQuantity: 1, maxWeightGrams: 50000, price: 20.89, active: true },
      { id: "spediamo-100", label: "Spediamo.it 50-100 kg", carrierId: "spediamo", minQuantity: 1, maxWeightGrams: 100000, price: 39.16, active: true },
    ],
  };
  const storedSettings = snapshot.exists ? snapshot.data() : null;
  const settings = storedSettings && String(storedSettings.pricingUpdatedAt || "") >= defaultSettings.pricingUpdatedAt
    ? storedSettings
    : {
        ...(storedSettings || {}),
        volumetricDivisor: defaultSettings.volumetricDivisor,
        pricingSource: defaultSettings.pricingSource,
        pricingUpdatedAt: defaultSettings.pricingUpdatedAt,
        carriers: defaultSettings.carriers,
        rates: defaultSettings.rates,
        freeRules: storedSettings?.freeRules || defaultSettings.freeRules,
        packagingWeightGrams: storedSettings?.packagingWeightGrams ?? defaultSettings.packagingWeightGrams,
      };
  const quantity = items.reduce((sum, item) => sum + Number(item.qty || 1), 0);
  const parcelWeights = items.reduce((totals, item) => { const qty = Number(item.qty || 1); const dimensions = item.shippingDimensions || {}; const actual = Number(item.shippingWeightGrams || 500) * qty; const volumetric = (Number(dimensions.lengthCm || 0) * Number(dimensions.widthCm || 0) * Number(dimensions.heightCm || 0) / Number(settings.volumetricDivisor || 5000)) * 1000 * qty; return { actual: totals.actual + actual, volumetric: totals.volumetric + volumetric }; }, { actual: 0, volumetric: 0 });
  const weightGrams = Number(settings.packagingWeightGrams || 0) + Math.max(parcelWeights.actual, parcelWeights.volumetric);
  const freeRule = (settings.freeRules || []).find(rule => rule.active !== false && subtotal >= Number(rule.minAmount || 0) && (!rule.maxQuantity || quantity <= rule.maxQuantity) && (!rule.maxWeightGrams || weightGrams <= rule.maxWeightGrams));
  if (freeRule) return { price: 0, quantity, weightGrams, label: freeRule.label, free: true, ruleId: freeRule.id };
  const rate = (settings.rates || []).filter(item => item.active !== false && quantity >= Number(item.minQuantity || 1) && (!item.maxQuantity || quantity <= item.maxQuantity) && (!item.maxWeightGrams || weightGrams <= item.maxWeightGrams)).sort((a,b) => Number(a.price) - Number(b.price))[0];
  if (!rate) throw new HttpsError("failed-precondition", "Ordine fuori dalle fasce di spedizione configurate.");
  const carrier = (settings.carriers || []).find(item => item.id === rate.carrierId);
  return { price: Number(rate.price), quantity, weightGrams, label: rate.label, rateId: rate.id, carrierId: rate.carrierId, carrierName: carrier?.name || "Corriere", deliveryTime: carrier?.deliveryTime || "" };
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
  const tipoCliente = customer.tipoCliente === "azienda" ? "azienda" : "privato";
  const codiceFiscale = asOptionalString(customer.codiceFiscale, 32).toUpperCase();
  const partitaIva = asOptionalString(customer.partitaIva, 20);
  const ragioneSociale = asOptionalString(customer.ragioneSociale, 160);
  if (!/^(?:[A-Z0-9]{16}|[0-9]{11})$/.test(codiceFiscale)) throw new HttpsError("invalid-argument", "Il codice fiscale deve avere 16 caratteri oppure 11 cifre.");
  if (tipoCliente === "azienda" && (!ragioneSociale || !/^[0-9]{11}$/.test(partitaIva))) throw new HttpsError("invalid-argument", "Ragione sociale e partita IVA valida di 11 cifre sono obbligatorie per la fattura.");
  return {
    email: assertEmail(customer.email),
    nome: asString(customer.nome, "Nome", 100),
    cognome: asString(customer.cognome, "Cognome", 100),
    telefono: asString(customer.telefono, "Telefono", 40),
    indirizzo: asString(customer.indirizzo, "Indirizzo", 240),
    civico: asString(customer.civico, "Numero civico", 30),
    indirizzo2: asOptionalString(customer.indirizzo2, 160),
    citta: asString(customer.citta, "Città", 120),
    provincia: asString(customer.provincia, "Provincia", 2).toUpperCase(),
    cap: asString(customer.cap, "CAP", 20),
    paese: "Italia",
    countryCode: "IT",
    noteConsegna: asOptionalString(customer.noteConsegna, 300),
    billingSameAsShipping: customer.billingSameAsShipping !== false,
    tipoCliente,
    ragioneSociale,
    codiceFiscale,
    partitaIva,
    codiceDestinatario: asOptionalString(customer.codiceDestinatario, 12).toUpperCase(),
    pec: customer.pec ? assertEmail(customer.pec) : "",
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
    shippingWeightGrams: Number(product.logistics?.packagedWeightGrams || 500),
    shippingDimensions: { lengthCm: Number(product.logistics?.lengthCm || 10), widthCm: Number(product.logistics?.widthCm || 10), heightCm: Number(product.logistics?.heightCm || 14) },
    qty,
  };
}

async function createCheckoutSessionForOrder(orderRef, orderObject, idempotencySuffix = "") {
  const stripe = getStripe();
  const appBaseUrl = getAppBaseUrl({ required: true });
  if (toCents(orderObject.total) <= 0) {
    throw new HttpsError("failed-precondition", "Importo ordine non valido per il pagamento.");
  }

  const lineItems = orderObject.items.map((item) => {
    const itemQuantity = Math.max(1, Number(item.qty || 1));
    const lineAmount = toCents(item.lineTotal);
    if (lineAmount <= 0) {
      throw new HttpsError("failed-precondition", "Importo prodotto non valido per il pagamento.");
    }
    const personalizationSummary = buildPersonalizationSummary(item);
    const description = [
      itemQuantity > 1 ? `Quantità: ${itemQuantity}` : "",
      personalizationSummary,
    ].filter(Boolean).join(" · ");
    return {
      quantity: 1,
      price_data: {
        currency: "eur",
        unit_amount: lineAmount,
        product_data: {
          name: itemQuantity > 1 ? `${item.productName} x${itemQuantity}` : item.productName,
          description: description || undefined,
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
    success_url: `${appBaseUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}&order_id=${orderRef.id}`,
    cancel_url: `${appBaseUrl}/payment-cancel?order_id=${orderRef.id}`,
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
  const shippingQuote = await calculateShippingQuote(orderItems, subtotal);
  const shipping = shippingQuote.price;
  const discount = roundMoney(subtotal * (promo.percent / 100));
  const total = roundMoney(Math.max(0, subtotal + shipping - discount));

  const orderObject = {
    ...customer,
    customerUid: auth.uid,
    items: orderItems,
    subtotal,
    shipping,
    shippingQuote,
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
  let session;
  try {
    session = await createCheckoutSessionForOrder(orderRef, orderObject);
  } catch (err) {
    await orderRef.update({
      status: "payment_failed",
      paymentStatus: "checkout_failed",
      updatedAt: new Date().toISOString(),
      audit: admin.firestore.FieldValue.arrayUnion(
        buildOrderAudit("stripe_checkout_failed", "system", {
          reason: err?.message || "stripe_error",
        }),
      ),
    });
    throw err;
  }
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
  if (!["pending_payment", "payment_expired", "payment_failed"].includes(order.status)) {
    throw new HttpsError("failed-precondition", "Pagamento non disponibile per questo ordine.");
  }

  const stripe = getStripe();
  const existingSession = await retrieveCheckoutSession(stripe, order.stripeCheckoutSessionId);
  if (order.stripeCheckoutSessionId && !existingSession) {
    throw new HttpsError("unavailable", "Non riesco a verificare la sessione Stripe esistente. Riprova tra poco.");
  }
  if (existingSession?.payment_status === "paid") {
    const { paidEmail, mismatch } = await markOrderPaidFromSession(
      orderRef,
      existingSession,
      "stripe_payment_recovered",
    );
    if (paidEmail) {
      await sendPaymentConfirmedEmail(paidEmail.orderId, paidEmail.order);
    }
    if (mismatch) {
      throw new HttpsError("failed-precondition", "Pagamento ricevuto ma in verifica manuale.");
    }
    return {
      checkoutUrl: `${getAppBaseUrl()}/payment-success?session_id=${existingSession.id}&order_id=${orderRef.id}`,
      stripeCheckoutSessionId: existingSession.id,
      alreadyPaid: true,
    };
  }

  if (existingSession?.status === "open" && existingSession.url) {
    await orderRef.update({
      status: "pending_payment",
      paymentStatus: "pending",
      stripeCheckoutUrl: existingSession.url,
      updatedAt: new Date().toISOString(),
      audit: admin.firestore.FieldValue.arrayUnion(
        buildOrderAudit("stripe_checkout_reused", auth.token?.email || auth.uid, { sessionId: existingSession.id }),
      ),
    });
    return { checkoutUrl: existingSession.url, stripeCheckoutSessionId: existingSession.id, reused: true };
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

exports.subscribeNewsletter = onCall({
  region: "europe-west1",
  cors: true,
  maxInstances: 10,
}, async (request) => {
  if (request.data?.consent !== true) throw new HttpsError("invalid-argument", "Consenso newsletter richiesto.");
  const email = assertEmail(request.data?.email);
  const source = asOptionalString(request.data?.source, 80) || "website";
  const consentVersion = asOptionalString(request.data?.consentVersion, 80);
  if (!consentVersion) throw new HttpsError("invalid-argument", "Versione informativa mancante.");
  const subscriberId = email.replace(/[.#$\/\[\]]/g, "_");

  await db.collection("newsletterSubscriptions").doc(subscriberId).set({
    email,
    source,
    consentVersion,
    consentAt: admin.firestore.FieldValue.serverTimestamp(),
    consentText: "Iscrizione newsletter DÈDICA dal sito",
    status: "subscribed",
    updatedAt: new Date().toISOString(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return { ok: true };
});

exports.adminListUsers = onCall({ region: "europe-west1", cors: true, maxInstances: 5 }, async (request) => {
  requireAdmin(request);
  const search = asOptionalString(request.data?.search, 160).toLowerCase();
  const pageToken = asOptionalString(request.data?.pageToken, 1000) || undefined;
  const result = await admin.auth().listUsers(100, pageToken);
  const users = result.users.filter((user) => !search || `${user.email || ""} ${user.displayName || ""} ${user.uid}`.toLowerCase().includes(search));
  const orders = await Promise.all(users.map((user) => db.collection("orders").where("customerUid", "==", user.uid).get()));
  const newsletters = await Promise.all(users.map((user) => user.email
    ? db.collection("newsletterSubscriptions").doc(user.email.toLowerCase().replace(/[.#$\/\[\]]/g, "_")).get()
    : Promise.resolve(null)));
  return { users: users.map((user, index) => ({
    uid: user.uid, email: user.email || "", displayName: user.displayName || "",
    emailVerified: user.emailVerified, disabled: user.disabled,
    createdAt: user.metadata.creationTime || "", lastSignInAt: user.metadata.lastSignInTime || "",
    providers: user.providerData.map((provider) => provider.providerId), orderCount: orders[index].size,
    newsletterStatus: newsletters[index]?.exists ? newsletters[index].data().status || "subscribed" : "not_subscribed",
  })), nextPageToken: result.pageToken || "" };
});

exports.adminSetUserDisabled = onCall({ region: "europe-west1", cors: true, maxInstances: 5 }, async (request) => {
  const actor = requireAdmin(request);
  const uid = asOptionalString(request.data?.uid, 160);
  if (!uid) throw new HttpsError("invalid-argument", "Utente mancante.");
  const disabled = request.data?.disabled;
  if (typeof disabled !== "boolean") throw new HttpsError("invalid-argument", "Stato account non valido.");
  if (uid === actor.uid) throw new HttpsError("failed-precondition", "Non puoi disabilitare il tuo account amministratore.");
  const target = await admin.auth().getUser(uid);
  if (target.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) throw new HttpsError("failed-precondition", "L’account amministratore non può essere disabilitato.");
  await admin.auth().updateUser(uid, { disabled });
  await db.collection("admin_audit").add({ action: disabled ? "user_disabled" : "user_enabled", targetUid: uid, targetEmail: target.email || "", actorUid: actor.uid, actorEmail: actor.token?.email || "", createdAt: admin.firestore.FieldValue.serverTimestamp() });
  return { ok: true, uid, disabled };
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
  const appBaseUrl = APP_BASE_URL.value().trim() || "";
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
    connected: Boolean(secretKey && publishableKey && webhookSecret && appBaseUrl && apiReachable),
    mode: getStripeMode(),
    webhookConfigured: Boolean(webhookSecret),
    publishableConfigured: Boolean(publishableKey),
    secretConfigured: Boolean(secretKey),
    appBaseUrlConfigured: Boolean(appBaseUrl),
    appBaseUrl: appBaseUrl || "",
    lastCheckedAt: new Date().toISOString(),
    dashboardUrl: getStripeMode() === "production"
      ? "https://dashboard.stripe.com/dashboard"
      : "https://dashboard.stripe.com/test/dashboard",
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

  const allowedStatuses = ADMIN_STATUS_TRANSITIONS[order.status] || [];
  if (!allowedStatuses.includes(status)) {
    throw new HttpsError(
      "failed-precondition",
      `Passaggio di stato non consentito: ${order.status} -> ${status}.`,
    );
  }

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

exports.adminCheckSpediamo = onCall({
  region: "europe-west1",
  cors: true,
  maxInstances: 5,
  secrets: [SPEDIAMO_API_KEY],
}, async (request) => {
  requireAdmin(request);
  const payload = await spediamoRequest("/shipments/search/DRAFT");
  const shipments = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.shipments)
      ? payload.shipments
      : Array.isArray(payload?.content)
        ? payload.content
        : [];
  const drafts = shipments.slice(0, 50).map((shipment) => ({
    id: String(shipment.id || shipment.shipmentId || shipment.code || ""),
    reference: String(shipment.reference || shipment.externalReference || shipment.orderReference || shipment.notes || "").slice(0, 180),
    recipientName: String(shipment.recipientName || shipment.receiverName || shipment.recipient?.name || "").slice(0, 160),
    recipientCity: String(shipment.recipientCity || shipment.receiverCity || shipment.recipient?.city || "").slice(0, 120),
    status: String(shipment.status || "DRAFT").slice(0, 40),
  }));
  return { connected: true, draftCount: shipments.length, drafts, lastCheckedAt: new Date().toISOString() };
});

exports.adminShipOrder = onCall({
  region: "europe-west1", cors: true, maxInstances: 10, secrets: EMAIL_FUNCTION_SECRETS,
}, async (request) => {
  const auth = requireAdmin(request);
  const orderId = asString(request.data?.orderId, "Ordine", 120);
  const shipment = request.data?.shipment || {};
  const carrierName = asString(shipment.carrierName, "Corriere", 120);
  const trackingCode = asString(shipment.trackingCode, "Tracking", 180);
  const trackingUrl = asOptionalString(shipment.trackingUrl, 2000);
  const actualCost = roundMoney(Math.max(0, Number(shipment.actualCost || 0)));
  const orderRef = db.collection("orders").doc(orderId);
  const snapshot = await orderRef.get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Ordine non trovato.");
  const order = snapshot.data();
  if (!["draft_approved", "in_production"].includes(order.status)) throw new HttpsError("failed-precondition", "L'ordine non è pronto per la spedizione.");
  const now = new Date().toISOString();
  const shipmentData = { carrierName, trackingCode, trackingUrl, actualCost, shippedAt: now };
  await orderRef.update({ status: "shipped", shipment: shipmentData, updatedAt: now, audit: admin.firestore.FieldValue.arrayUnion(buildOrderAudit("order_shipped", auth.token.email, { carrierName, trackingCode })) });
  if (actualCost > 0) await db.collection("finance_expenses").doc(`shipping-${orderId}`).set({ id: `shipping-${orderId}`, description: `Spedizione ordine ${orderId}`, amount: actualCost, date: now.slice(0,10), area: "operations", subareas: ["Spedizioni"], paidBy: "company", vatIncluded: true, orderId, createdAt: now, createdBy: auth.token.email });
  await sendStatusEmail(orderId, { ...order, status: "shipped", shipment: shipmentData }, "shipped");
  return { ok: true, status: "shipped", shipment: shipmentData };
});

exports.adminEditOrder = onCall({ region: "europe-west1", cors: true, maxInstances: 10 }, async (request) => {
  const auth = requireAdmin(request);
  const orderId = asString(request.data?.orderId, "Ordine", 120);
  const action = asString(request.data?.action, "Azione", 40);
  const orderRef = db.collection("orders").doc(orderId);
  const snapshot = await orderRef.get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Ordine non trovato.");
  const order = snapshot.data();
  const now = new Date().toISOString();

  if (action === "delete_test") {
    if (order.stripeMode !== "test" && order.status !== "cancelled") {
      throw new HttpsError("failed-precondition", "L’eliminazione definitiva è consentita per ordini Stripe test oppure ordini annullati.");
    }
    await Promise.all([
      bucket.deleteFiles({ prefix: `invoices/${orderId}/` }),
      bucket.deleteFiles({ prefix: `drafts/${orderId}/` }),
    ]);
    await db.recursiveDelete(orderRef);
    await db.collection("finance_expenses").doc(`shipping-${orderId}`).delete().catch(() => undefined);
    return { ok: true, action };
  }

  if (action === "update_delivery") {
    const value = request.data?.value || {};
    const patch = {
      nome: asString(value.nome, "Nome", 100), cognome: asString(value.cognome, "Cognome", 100),
      telefono: asString(value.telefono, "Telefono", 40), indirizzo: asString(value.indirizzo, "Indirizzo", 240),
      civico: asString(value.civico, "Numero civico", 30), indirizzo2: asOptionalString(value.indirizzo2, 160),
      cap: asString(value.cap, "CAP", 20), citta: asString(value.citta, "Città", 120),
      provincia: asString(value.provincia, "Provincia", 2).toUpperCase(), noteConsegna: asOptionalString(value.noteConsegna, 300), updatedAt: now,
    };
    patch.audit = admin.firestore.FieldValue.arrayUnion(buildOrderAudit("order_delivery_updated", auth.token.email));
    await orderRef.update(patch);
    return { ok: true, action, value: patch };
  }

  if (action === "update_shipment") {
    const value = request.data?.value || {};
    const shipment = {
      carrierName: asString(value.carrierName, "Corriere", 120), trackingCode: asString(value.trackingCode, "Tracking", 180),
      trackingUrl: asOptionalString(value.trackingUrl, 2000), actualCost: roundMoney(Math.max(0, Number(value.actualCost || 0))),
      shippedAt: order.shipment?.shippedAt || now, updatedAt: now,
    };
    await orderRef.update({ shipment, updatedAt: now, audit: admin.firestore.FieldValue.arrayUnion(buildOrderAudit("order_shipment_updated", auth.token.email, { trackingCode: shipment.trackingCode })) });
    return { ok: true, action, shipment };
  }

  if (action === "cancel") {
    const reason = asString(request.data?.reason, "Motivo annullamento", 500);
    await orderRef.update({ status: "cancelled", cancellation: { reason, cancelledAt: now, cancelledBy: auth.token.email, previousStatus: order.status }, updatedAt: now, audit: admin.firestore.FieldValue.arrayUnion(buildOrderAudit("order_cancelled_by_admin", auth.token.email, { reason, previousStatus: order.status })) });
    return { ok: true, action, status: "cancelled" };
  }
  throw new HttpsError("invalid-argument", "Azione ordine non valida.");
});

exports.createSupportTicket = onCall({ region: "europe-west1", cors: true, maxInstances: 10, secrets: EMAIL_FUNCTION_SECRETS }, async (request) => {
  const value = request.data || {};
  if (asOptionalString(value.website, 200)) return { ok: true, ticketId: `SUP-${Date.now().toString().slice(-8)}` };
  const name = asString(value.name, "Nome e cognome", 160);
  const email = assertEmail(value.email);
  const topics = ["order", "draft", "shipping", "transport_damage", "returns", "other"];
  const topic = asString(value.topic, "Argomento", 40);
  if (!topics.includes(topic)) throw new HttpsError("invalid-argument", "Argomento assistenza non valido.");
  const subject = asString(value.subject, "Oggetto", 160);
  const message = asString(value.message, "Messaggio", 2000);
  const orderId = asOptionalString(value.orderId, 120);
  if (value.consent !== true) throw new HttpsError("invalid-argument", "È necessario prendere visione dell’informativa privacy.");

  const ip = String(request.rawRequest?.ip || request.rawRequest?.headers?.["x-forwarded-for"] || "unknown").split(",")[0].trim();
  const rateKey = createHash("sha256").update(`${ip}:${Math.floor(Date.now() / 600000)}`).digest("hex");
  const rateRef = db.collection("support_rate_limits").doc(rateKey);
  await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(rateRef);
    const count = Number(snapshot.data()?.count || 0);
    if (count >= 5) throw new HttpsError("resource-exhausted", "Troppe richieste. Riprova tra qualche minuto.");
    transaction.set(rateRef, { count: count + 1, expiresAt: new Date(Date.now() + 20 * 60 * 1000).toISOString() }, { merge: true });
  });

  const ticketRef = db.collection("support_tickets").doc();
  const reference = `SUP-${ticketRef.id.slice(-8).toUpperCase()}`;
  const now = new Date().toISOString();
  const ticket = { reference, name, email, topic, subject, message, orderId, status: "open", priority: topic === "transport_damage" ? "high" : "normal", customerUid: request.auth?.uid || "", createdAt: admin.firestore.FieldValue.serverTimestamp(), createdAtIso: now, updatedAt: admin.firestore.FieldValue.serverTimestamp(), replies: [], audit: [buildOrderAudit("support_ticket_created", email, { topic, orderId })] };
  await ticketRef.set(ticket);

  const adminHtml = buildEmailLayout({ title: `Nuova pratica ${reference}`, intro: `${name} ha inviato una richiesta di assistenza.`, bodyHtml: `<p><strong>Argomento:</strong> ${escapeEmailHtml(topic)}</p><p><strong>Ordine:</strong> ${escapeEmailHtml(orderId || "Non indicato")}</p><p><strong>Oggetto:</strong> ${escapeEmailHtml(subject)}</p><p>${escapeEmailHtml(message)}</p>`, actionUrl: `${getAppBaseUrl()}/admin`, actionLabel: "Apri Assistenza" });
  const customerHtml = buildEmailLayout({ title: `Richiesta ricevuta: ${reference}`, intro: "Abbiamo registrato la tua richiesta e ti risponderemo normalmente entro due giorni lavorativi.", bodyHtml: `<p><strong>Oggetto:</strong> ${escapeEmailHtml(subject)}</p><p>Conserva il codice <strong>${escapeEmailHtml(reference)}</strong> per le comunicazioni.</p>`, actionUrl: `${getAppBaseUrl()}/assistenza`, actionLabel: "Centro assistenza" });
  const businessEmail = await getBusinessContactEmail();
  await Promise.all([
    sendEmail({ to: businessEmail, subject: `Assistenza ${reference}: ${subject}`, html: adminHtml, text: `Nuova pratica ${reference}\nCliente: ${name} <${email}>\nOrdine: ${orderId || "non indicato"}\n${subject}\n${message}`, event: "support_ticket_admin", orderRef: ticketRef }),
    sendEmail({ to: email, subject: `${reference} - Richiesta ricevuta`, html: customerHtml, text: `Abbiamo ricevuto la richiesta ${reference}. Risponderemo normalmente entro due giorni lavorativi.\n\n${subject}`, event: "support_ticket_customer", orderRef: ticketRef }),
  ]);
  return { ok: true, ticketId: reference };
});

exports.adminManageSupportTicket = onCall({ region: "europe-west1", cors: true, maxInstances: 10, secrets: EMAIL_FUNCTION_SECRETS }, async (request) => {
  const auth = requireAdmin(request);
  const ticketId = asString(request.data?.ticketId, "Pratica", 120);
  const action = asString(request.data?.action, "Azione", 40);
  const value = request.data?.value || {};
  const ticketRef = db.collection("support_tickets").doc(ticketId);
  const snapshot = await ticketRef.get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Pratica non trovata.");
  const ticket = snapshot.data(); const now = new Date().toISOString();
  if (action === "update") {
    const statuses = ["open", "in_progress", "waiting_customer", "resolved", "closed"];
    const priorities = ["low", "normal", "high", "urgent"];
    const status = asString(value.status, "Stato", 40); const priority = asString(value.priority, "Priorità", 40);
    if (!statuses.includes(status) || !priorities.includes(priority)) throw new HttpsError("invalid-argument", "Stato o priorità non validi.");
    await ticketRef.update({ status, priority, updatedAt: admin.firestore.FieldValue.serverTimestamp(), audit: admin.firestore.FieldValue.arrayUnion(buildOrderAudit("support_ticket_updated", auth.token.email, { status, priority })) });
    return { ok: true };
  }
  if (action === "reply") {
    const text = asString(value.text, "Risposta", 2000);
    await ticketRef.update({ status: "waiting_customer", updatedAt: admin.firestore.FieldValue.serverTimestamp(), replies: admin.firestore.FieldValue.arrayUnion({ text, senderRole: "admin", senderEmail: auth.token.email, createdAt: now }), audit: admin.firestore.FieldValue.arrayUnion(buildOrderAudit("support_reply_sent", auth.token.email)) });
    const html = buildEmailLayout({ title: `Aggiornamento pratica ${ticket.reference || ticketId}`, intro: "L’assistenza DÈDICA ha risposto alla tua richiesta.", bodyHtml: `<p>${escapeEmailHtml(text).replace(/\n/g, "<br>")}</p><p style="color:#756e68"><strong>Richiesta:</strong> ${escapeEmailHtml(ticket.subject)}</p>`, actionUrl: ticket.orderId ? `${getAppBaseUrl()}/account` : `${getAppBaseUrl()}/assistenza`, actionLabel: ticket.orderId ? "Apri il mio ordine" : "Centro assistenza" });
    await sendEmail({ to: ticket.email, subject: `${ticket.reference || ticketId} - Risposta assistenza`, html, text: `${ticket.reference || ticketId}\n\n${text}`, event: "support_reply_customer", orderRef: ticketRef });
    return { ok: true };
  }
  throw new HttpsError("invalid-argument", "Azione assistenza non valida.");
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

exports.customerReviewDraft = onCall({
  region: "europe-west1",
  cors: true,
  maxInstances: 10,
  secrets: EMAIL_FUNCTION_SECRETS,
}, async (request) => {
  const auth = requireAuth(request);
  const orderId = asString(request.data?.orderId, "Ordine", 120);
  const action = asString(request.data?.action, "Azione", 40);
  const revisionNote = asOptionalString(request.data?.revisionNote, 800);

  if (!["approve", "request_revision"].includes(action)) {
    throw new HttpsError("invalid-argument", "Azione revisione bozza non valida.");
  }
  if (action === "request_revision" && !revisionNote) {
    throw new HttpsError("invalid-argument", "Inserisci la modifica richiesta.");
  }

  const orderRef = db.collection("orders").doc(orderId);
  const snapshot = await orderRef.get();
  if (!snapshot.exists) {
    throw new HttpsError("not-found", "Ordine non trovato.");
  }

  const order = snapshot.data();
  if (order.customerUid !== auth.uid) {
    throw new HttpsError("permission-denied", "Non puoi modificare questo ordine.");
  }
  if (order.status !== "draft_sent") {
    throw new HttpsError("failed-precondition", "La bozza non è pronta per la revisione.");
  }

  const now = new Date().toISOString();
  const nextStatus = action === "approve" ? "draft_approved" : "revision_requested";
  const auditType = action === "approve" ? "customer_draft_approved" : "customer_revision_requested";
  const updatePayload = {
    status: nextStatus,
    updatedAt: now,
    audit: admin.firestore.FieldValue.arrayUnion(
      buildOrderAudit(auditType, auth.token?.email || auth.uid, action === "approve" ? {} : { note: revisionNote }),
    ),
  };

  if (action === "request_revision") {
    updatePayload.customerRevisionNote = revisionNote;
  }

  await orderRef.update(updatePayload);

  if (action === "request_revision") {
    await orderRef.collection("messages").add({
      text: revisionNote,
      senderUid: auth.uid,
      senderEmail: auth.token?.email || order.email || "",
      senderRole: "customer",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      systemContext: "draft_revision",
    });
  }

  const updatedOrder = { ...order, ...updatePayload, status: nextStatus };
  await Promise.all([
    action === "approve" ? sendStatusEmail(orderId, updatedOrder, "draft_approved") : Promise.resolve(),
    sendAdminDraftReviewEmail(orderId, updatedOrder, action === "approve" ? "approved" : "revision_requested", revisionNote),
  ]);

  return { ok: true, status: nextStatus };
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

    if (
      event.type === "checkout.session.completed"
      || event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object;
      if (session.payment_status === "paid") {
        const orderId = session.metadata?.orderId;
        if (!orderId) throw new Error("Missing orderId metadata");
        const orderRef = db.collection("orders").doc(orderId);
        const result = await markOrderPaidFromSession(
          orderRef,
          session,
          event.type === "checkout.session.async_payment_succeeded"
            ? "stripe_async_payment_succeeded"
            : "stripe_payment_completed",
        );
        paidEmail = result.paidEmail;
      }
    }

    if (event.type === "checkout.session.async_payment_failed") {
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
            status: "payment_failed",
            paymentStatus: "failed",
            updatedAt: new Date().toISOString(),
            audit: admin.firestore.FieldValue.arrayUnion(
              buildOrderAudit("stripe_async_payment_failed", "stripe", { sessionId: session.id }),
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
  requireAuth(request);
  const data = request.data || {};
  const result = await stageImage(data.photo);
  return result;
});

exports.notifyOrderMessageCreated = onDocumentCreated({
  region: "europe-west1",
  document: "orders/{orderId}/messages/{messageId}",
  secrets: EMAIL_FUNCTION_SECRETS,
}, async (event) => {
  const message = event.data?.data();
  const orderId = event.params.orderId;
  if (!message || !orderId || message.systemContext === "draft_revision") return;
  if (!["admin", "customer"].includes(message.senderRole)) return;

  const orderSnapshot = await db.collection("orders").doc(orderId).get();
  if (!orderSnapshot.exists) return;

  const unreadField = message.senderRole === "admin" ? "unreadForCustomer" : "unreadForAdmin";
  await orderSnapshot.ref.update({
    [unreadField]: admin.firestore.FieldValue.increment(1),
    lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
    lastMessagePreview: normalizeText(message.text).slice(0, 160),
    updatedAt: new Date().toISOString(),
  });
  await sendMessageNotificationEmail(orderId, orderSnapshot.data(), message);
});

exports.markOrderMessagesRead = onCall({
  region: "europe-west1",
  cors: true,
  maxInstances: 20,
}, async (request) => {
  const auth = requireAuth(request);
  const orderId = String(request.data?.orderId || "").trim();
  if (!orderId) throw new HttpsError("invalid-argument", "Ordine non valido.");

  const orderRef = db.collection("orders").doc(orderId);
  const snapshot = await orderRef.get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Ordine non trovato.");
  const order = snapshot.data();
  const isAdmin = auth.token?.email === ADMIN_EMAIL;
  if (!isAdmin && order.customerUid !== auth.uid) {
    throw new HttpsError("permission-denied", "Non puoi aprire questa conversazione.");
  }
  await orderRef.update({ [isAdmin ? "unreadForAdmin" : "unreadForCustomer"]: 0 });
  return { ok: true };
});

function extractEmailAddress(value) {
  const text = typeof value === "object" ? value?.email : value;
  const match = String(text || "").toLowerCase().match(/<?([a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+)>?/i);
  return match?.[1] || "";
}

function extractInboundOrderId(email) {
  const address = extractEmailAddress(email);
  const localPart = address.split("@")[0] || "";
  const match = localPart.match(/^ordine\+(.+)$/i);
  return match?.[1] || "";
}

function plainTextFromHtml(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'");
}

function cleanInboundReply(text) {
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  const kept = [];
  for (const line of lines) {
    if (/^\s*>/.test(line)) break;
    if (/^\s*(on .+ wrote:|il giorno .+ ha scritto:|da:|from:)\s*$/i.test(line)) break;
    if (/^\s*-{2,}\s*(original message|messaggio originale)\s*-{2,}/i.test(line)) break;
    kept.push(line);
  }
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 4000);
}

exports.resendInboundWebhook = onRequest({
  region: "europe-west1",
  cors: false,
  maxInstances: 10,
  secrets: [RESEND_API_KEY, RESEND_WEBHOOK_SECRET],
}, async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");
  const rawPayload = req.rawBody?.toString("utf8") || "";
  const resend = getResend();
  if (!resend || !readSecret(RESEND_WEBHOOK_SECRET)) return res.status(503).send("Webhook not configured");

  let event;
  try {
    event = resend.webhooks.verify({
      payload: rawPayload,
      headers: {
        id: req.get("svix-id") || "",
        timestamp: req.get("svix-timestamp") || "",
        signature: req.get("svix-signature") || "",
      },
      webhookSecret: readSecret(RESEND_WEBHOOK_SECRET),
    });
  } catch (error) {
    console.error("Invalid Resend webhook signature", error?.message);
    return res.status(400).send("Invalid signature");
  }
  if (event.type !== "email.received") return res.status(200).json({ received: true, ignored: true });

  const webhookId = req.get("svix-id") || event.data?.email_id || randomUUID();
  const eventRef = db.collection("resend_webhook_events").doc(webhookId);
  try {
    await eventRef.create({ type: event.type, receivedAt: admin.firestore.FieldValue.serverTimestamp() });
  } catch (error) {
    if (error?.code === 6 || String(error?.message).includes("ALREADY_EXISTS")) {
      return res.status(200).json({ received: true, duplicate: true });
    }
    throw error;
  }

  try {
    const emailResult = await resend.emails.receiving.get(event.data.email_id);
    if (emailResult?.error) throw new Error(emailResult.error.message || "Email non recuperabile");
    const email = emailResult?.data || emailResult;
    const recipients = Array.isArray(email.to) ? email.to : [email.to];
    const orderId = recipients.map(extractInboundOrderId).find(Boolean);
    if (!orderId) throw new Error("Destinatario senza riferimento ordine");

    const orderRef = db.collection("orders").doc(orderId);
    const orderSnapshot = await orderRef.get();
    if (!orderSnapshot.exists) throw new Error("Ordine non trovato");
    const order = orderSnapshot.data();
    const senderEmail = extractEmailAddress(email.from || event.data.from);
    if (!senderEmail || senderEmail !== String(order.email || "").trim().toLowerCase()) {
      await eventRef.update({ status: "quarantined", orderId, senderEmail: maskEmail(senderEmail) });
      return res.status(202).json({ received: true, quarantined: true });
    }

    const messageText = cleanInboundReply(email.text || plainTextFromHtml(email.html));
    if (!messageText) throw new Error("Risposta senza testo leggibile");
    await orderRef.collection("messages").add({
      text: messageText,
      senderUid: order.customerUid || "",
      senderEmail,
      senderRole: "customer",
      source: "email",
      providerEmailId: event.data.email_id,
      subject: normalizeText(email.subject || event.data.subject || "").slice(0, 240),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await eventRef.update({ status: "processed", orderId, processedAt: admin.firestore.FieldValue.serverTimestamp() });
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Resend inbound processing failed", { webhookId, message: error?.message });
    await eventRef.update({ status: "failed", error: String(error?.message || "unknown").slice(0, 300) });
    return res.status(500).send("Processing failed");
  }
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
