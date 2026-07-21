import { db, firebaseReady, isFirebaseLocal } from "./firebase.js";

const LOCAL_KEY = "dedica_shipping_settings";
export const DEFAULT_SHIPPING_SETTINGS = {
  packagingWeightGrams: 300,
  volumetricDivisor: 4545.45,
  pricingSource: "https://spediamo.it/tariffe",
  pricingUpdatedAt: "2026-07-20",
  freeRules: [{ id: "free-standard", label: "Gratis sopra 79 € fino a 10 pezzi", minAmount: 79, maxQuantity: 10, maxWeightGrams: 5000, active: true }],
  carriers: [{ id: "spediamo", name: "Spediamo.it", service: "Nazionale", deliveryTime: "1–2 giorni lavorativi", active: true }],
  rates: [
    { id: "spediamo-3", label: "Spediamo.it 0–3 kg", carrierId: "spediamo", minQuantity: 1, maxWeightGrams: 3000, price: 6.78, active: true },
    { id: "spediamo-5", label: "Spediamo.it 3–5 kg", carrierId: "spediamo", minQuantity: 1, maxWeightGrams: 5000, price: 8.49, active: true },
    { id: "spediamo-15", label: "Spediamo.it 5–15 kg", carrierId: "spediamo", minQuantity: 1, maxWeightGrams: 15000, price: 10.59, active: true },
    { id: "spediamo-25", label: "Spediamo.it 15–25 kg", carrierId: "spediamo", minQuantity: 1, maxWeightGrams: 25000, price: 12.59, active: true },
    { id: "spediamo-30", label: "Spediamo.it 25–30 kg", carrierId: "spediamo", minQuantity: 1, maxWeightGrams: 30000, price: 17.89, active: true },
    { id: "spediamo-50", label: "Spediamo.it 30–50 kg", carrierId: "spediamo", minQuantity: 1, maxWeightGrams: 50000, price: 20.89, active: true },
    { id: "spediamo-100", label: "Spediamo.it 50–100 kg", carrierId: "spediamo", minQuantity: 1, maxWeightGrams: 100000, price: 39.16, active: true }
  ]
};

function withCurrentSpediamoPricing(settings) {
  if (String(settings?.pricingUpdatedAt || "") >= DEFAULT_SHIPPING_SETTINGS.pricingUpdatedAt) return settings;
  return {
    ...settings,
    volumetricDivisor: DEFAULT_SHIPPING_SETTINGS.volumetricDivisor,
    pricingSource: DEFAULT_SHIPPING_SETTINGS.pricingSource,
    pricingUpdatedAt: DEFAULT_SHIPPING_SETTINGS.pricingUpdatedAt,
    carriers: DEFAULT_SHIPPING_SETTINGS.carriers,
    rates: DEFAULT_SHIPPING_SETTINGS.rates,
  };
}

export async function getShippingSettings() {
  await firebaseReady;
  if (isFirebaseLocal || !db) return withCurrentSpediamoPricing(JSON.parse(localStorage.getItem(LOCAL_KEY) || JSON.stringify(DEFAULT_SHIPPING_SETTINGS)));
  const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  const snapshot = await getDoc(doc(db, "shipping_settings", "default"));
  return snapshot.exists() ? withCurrentSpediamoPricing(snapshot.data()) : DEFAULT_SHIPPING_SETTINGS;
}

export async function saveShippingSettings(settings) {
  const normalized = { ...settings, updatedAt: new Date().toISOString() };
  await firebaseReady;
  if (isFirebaseLocal || !db) { localStorage.setItem(LOCAL_KEY, JSON.stringify(normalized)); return normalized; }
  const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  await setDoc(doc(db, "shipping_settings", "default"), normalized);
  return normalized;
}

export function quoteShipping(cart, subtotal, settings = DEFAULT_SHIPPING_SETTINGS) {
  const quantity = cart.reduce((sum, item) => sum + Number(item.qty || 1), 0);
  const parcelWeights = cart.reduce((totals, item) => {
    const qty = Number(item.qty || 1); const dimensions = item.shippingDimensions || {};
    const actual = Number(item.shippingWeightGrams || 500) * qty;
    const volumetric = (Number(dimensions.lengthCm || 0) * Number(dimensions.widthCm || 0) * Number(dimensions.heightCm || 0) / Number(settings.volumetricDivisor || 5000)) * 1000 * qty;
    return { actual: totals.actual + actual, volumetric: totals.volumetric + volumetric };
  }, { actual: 0, volumetric: 0 });
  const packagingWeightGrams = Number(settings.packagingWeightGrams || 0);
  const weightGrams = packagingWeightGrams + Math.max(parcelWeights.actual, parcelWeights.volumetric);
  const weightDetails = {
    actualProductWeightGrams: parcelWeights.actual,
    volumetricProductWeightGrams: parcelWeights.volumetric,
    packagingWeightGrams,
    actualParcelWeightGrams: parcelWeights.actual + packagingWeightGrams,
    volumetricParcelWeightGrams: parcelWeights.volumetric + packagingWeightGrams,
    weightBasis: parcelWeights.volumetric > parcelWeights.actual ? "volumetric" : "actual",
  };
  if (!quantity) return { price: 0, quantity: 0, weightGrams: 0, label: "Nessuna spedizione" };
  const freeRule = (settings.freeRules || []).find(rule => rule.active !== false && subtotal >= Number(rule.minAmount || 0) && (!rule.maxQuantity || quantity <= rule.maxQuantity) && (!rule.maxWeightGrams || weightGrams <= rule.maxWeightGrams));
  if (freeRule) return { price: 0, quantity, weightGrams, ...weightDetails, label: freeRule.label, free: true, ruleId: freeRule.id };
  const rate = (settings.rates || []).filter(item => item.active !== false && quantity >= Number(item.minQuantity || 1) && (!item.maxQuantity || quantity <= item.maxQuantity) && (!item.maxWeightGrams || weightGrams <= item.maxWeightGrams)).sort((a, b) => Number(a.price) - Number(b.price))[0];
  if (!rate) return { price: 0, quantity, weightGrams, label: "Spedizione da calcolare", requiresQuote: true };
  const carrier = (settings.carriers || []).find(item => item.id === rate.carrierId);
  return { price: Number(rate.price), quantity, weightGrams, ...weightDetails, label: rate.label, rateId: rate.id, carrierId: rate.carrierId, carrierName: carrier?.name || "Corriere", deliveryTime: carrier?.deliveryTime || "" };
}

export function getShippingPriceExplanation(shippingQuote, settings = DEFAULT_SHIPPING_SETTINGS) {
  if (!shippingQuote?.quantity || shippingQuote.requiresQuote) return "";
  const weight = `${(Number(shippingQuote.weightGrams || 0) / 1000).toFixed(2).replace(".", ",")} kg`;
  const subject = shippingQuote.quantity === 1 ? "La candela viene preparata" : `Le ${shippingQuote.quantity} candele vengono raggruppate`;
  if (shippingQuote.free) return `${subject} in un’unica spedizione (${weight}). La spedizione è gratuita perché l’ordine rispetta i requisiti previsti.`;

  const firstRate = (settings.rates || []).filter(rate => rate.active !== false).sort((a, b) => Number(a.maxWeightGrams || Infinity) - Number(b.maxWeightGrams || Infinity))[0];
  if (firstRate && shippingQuote.rateId !== firstRate.id) {
    return `${subject} in un unico pacco: il peso tassabile complessivo è ${weight}. Il costo varia perché il pacco passa alla fascia ${shippingQuote.label.replace(/^Spediamo\.it\s*/i, "")}.`;
  }
  return `${subject} in un unico pacco. La tariffa è calcolata sul peso tassabile complessivo di ${weight}.`;
}

export function getFreeShippingMessage(subtotal, shippingQuote, settings = DEFAULT_SHIPPING_SETTINGS) {
  const rule = (settings.freeRules || []).find(item => item.active !== false);
  if (!rule || !shippingQuote?.quantity) return "";
  if (shippingQuote.free) return "Hai ottenuto la spedizione gratuita.";

  const conditions = [];
  if (rule.maxQuantity) conditions.push(`massimo ${rule.maxQuantity} pezzi`);
  if (rule.maxWeightGrams) conditions.push(`peso massimo ${(Number(rule.maxWeightGrams) / 1000).toLocaleString("it-IT")} kg`);
  const suffix = conditions.length ? `, con ${conditions.join(" e ")}` : "";
  const remaining = Math.max(0, Number(rule.minAmount || 0) - Number(subtotal || 0));
  const money = value => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);
  if (remaining > 0) return `Ti mancano ${money(remaining)} per la spedizione gratuita${suffix}.`;
  return `La spedizione gratuita è disponibile da ${money(rule.minAmount)}${suffix}. Il peso o la quantità attuale supera il limite.`;
}
