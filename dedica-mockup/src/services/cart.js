export const CART_KEY = "dedica_cart";

export function getCart() {
  return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
}

export function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(Array.isArray(cart) ? cart : []));
  notifyCartChange();
}

export function addCartItem(item) {
  const cart = getCart();
  cart.push({
    id: item.id || `item-${Date.now()}`,
    qty: Number(item.qty || 1),
    ...item
  });
  saveCart(cart);
  return cart;
}

export function updateCartItem(itemId, patch) {
  const cart = getCart().map(item => item.id === itemId ? { ...item, ...patch } : item);
  saveCart(cart);
  return cart;
}

export function removeCartItem(itemId) {
  const cart = getCart().filter(item => item.id !== itemId);
  saveCart(cart);
  return cart;
}

export function clearCart() {
  localStorage.removeItem(CART_KEY);
  notifyCartChange();
}

function notifyCartChange() {
  window.dispatchEvent(new CustomEvent("dedica:cart-change"));
}

export function getQuantityDiscountPercent(qty) {
  if (qty >= 100) return 35;
  if (qty >= 50) return 25;
  if (qty >= 20) return 15;
  return 0;
}

export function calculateCartTotals(cart, promoDiscountPercent = 0, shippingSettings) {
  const subtotal = cart.reduce((sum, item) => sum + getCartLineTotal(item), 0);
  const shippingQuote = shippingSettings ? shippingSettings.quote : null;
  const shipping = shippingQuote ? shippingQuote.price : (subtotal >= 59 || subtotal === 0 ? 0 : 4.9);
  const discount = subtotal * (promoDiscountPercent / 100);
  return {
    subtotal,
    shipping,
    discount,
    total: Math.max(0, subtotal + shipping - discount),
    shippingQuote
  };
}

export function getCartLineTotal(item) {
  const unitBasePrice = Number(item.unitBasePrice ?? item.price ?? 0);
  const qty = Number(item.qty ?? 1);
  const baseTotal = unitBasePrice * qty;
  return baseTotal - (baseTotal * getQuantityDiscountPercent(qty) / 100);
}
