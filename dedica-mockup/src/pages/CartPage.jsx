import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, Field, Input, Toast } from "../components/index.js";
import { getCurrentUser, setLoginRedirect } from "../services/auth.js";
import { calculateCartTotals, clearCart, getCart, getCartLineTotal, getQuantityDiscountPercent, removeCartItem, updateCartItem } from "../services/cart.js";
import { validateDiscountCode } from "../services/discounts.js";
import { isFirebaseLocal } from "../services/firebase.js";
import { saveLocalOrder } from "../services/orders.js";
import { createOrderCheckout } from "../services/payments.js";
import { DEFAULT_SHIPPING_SETTINGS, getFreeShippingMessage, getShippingPriceExplanation, getShippingSettings, quoteShipping } from "../services/shipping.js";
import { EMPTY_CUSTOMER_PROFILE, getCustomerProfile, saveCustomerProfile } from "../services/customerProfile.js";

export function CartPage({ onOpenHome }) {
  const [cart, setCart] = useState(getCart);
  const [promoCode, setPromoCode] = useState("");
  const [activePromo, setActivePromo] = useState(null);
  const [promoStatus, setPromoStatus] = useState({ message: "", tone: "" });
  const [checkingPromo, setCheckingPromo] = useState(false);
  const [customer, setCustomer] = useState(EMPTY_CUSTOMER_PROFILE);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [successOrderId, setSuccessOrderId] = useState("");
  const [toast, setToast] = useState("");
  const [shippingSettings, setShippingSettings] = useState(DEFAULT_SHIPPING_SETTINGS);

  useEffect(() => { getShippingSettings().then(setShippingSettings); }, []);

  const totals = useMemo(
    () => {
      const base = calculateCartTotals(cart, activePromo?.percent || 0);
      const quote = quoteShipping(cart, base.subtotal, shippingSettings);
      return calculateCartTotals(cart, activePromo?.percent || 0, { quote });
    },
    [activePromo, cart, shippingSettings]
  );
  const freeShippingMessage = getFreeShippingMessage(totals.subtotal, totals.shippingQuote, shippingSettings);
  const shippingPriceExplanation = getShippingPriceExplanation(totals.shippingQuote, shippingSettings);

  function changeQty(itemId, qty) {
    setCart(updateCartItem(itemId, { qty: Math.max(1, Number(qty || 1)) }));
  }

  function removeItem(itemId) {
    setCart(removeCartItem(itemId));
    setToast("Articolo rimosso.");
  }

  async function applyPromo(event) {
    event.preventDefault();
    const normalizedCode = promoCode.trim().toUpperCase();
    if (!normalizedCode) {
      setPromoStatus({ message: "Inserisci un codice promozionale.", tone: "error" });
      return;
    }
    setCheckingPromo(true);
    setPromoStatus({ message: "Verifica del codice...", tone: "neutral" });
    try {
      const promo = await validateDiscountCode(normalizedCode);
      if (!promo) {
        setActivePromo(null);
        setPromoStatus({ message: "Codice non valido, scaduto o non attivo.", tone: "error" });
        setToast("Codice promozionale non valido.");
        return;
      }
      setActivePromo(promo);
      setPromoStatus({ message: `${promo.code} applicato: sconto del ${promo.percent}%.`, tone: "success" });
      setToast(`Codice ${promo.code} applicato.`);
    } catch (error) {
      console.error("Verifica codice promo fallita:", error);
      setActivePromo(null);
      setPromoStatus({ message: "Non è stato possibile verificare il codice. Riprova.", tone: "error" });
      setToast("Verifica del codice non riuscita.");
    } finally {
      setCheckingPromo(false);
    }
  }

  function patchCustomer(field, value) {
    setCustomer(current => ({ ...current, [field]: value }));
  }

  async function openCheckout() {
    if (cart.length === 0) {
      setToast("Il carrello è vuoto.");
      return;
    }

    const currentUser = await getCurrentUser();
    if (!isFirebaseLocal && !currentUser) {
      setLoginRedirect("/cart");
      window.location.href = "/login?redirect=/cart";
      return;
    }

    if (currentUser) setCustomer(await getCustomerProfile());
    setCheckoutOpen(true);
  }

  async function submitCheckout(event) {
    event.preventDefault();
    if (cart.length === 0) return;
    const codiceFiscale = String(customer.codiceFiscale || "").trim().toUpperCase();
    if (!/^(?:[A-Z0-9]{16}|[0-9]{11})$/.test(codiceFiscale)) {
      setToast("Inserisci un codice fiscale valido: 16 caratteri oppure 11 cifre.");
      return;
    }
    if (customer.tipoCliente === "azienda" && (!String(customer.ragioneSociale || "").trim() || !/^[0-9]{11}$/.test(String(customer.partitaIva || "").trim()))) {
      setToast("Inserisci ragione sociale e una partita IVA valida di 11 cifre.");
      return;
    }

    setPlacingOrder(true);
    try {
      await saveCustomerProfile(customer);
      if (isFirebaseLocal) {
        const orderId = `DEC-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
        await saveLocalOrder({
          id: orderId,
          ...customer,
          items: cart,
          subtotal: totals.subtotal,
          shipping: totals.shipping,
          discount: totals.discount,
          total: totals.total,
          promoCode: activePromo?.code || "",
          status: "payment_review",
          paymentStatus: "local_only",
          createdAt: new Date().toISOString(),
          createdVia: "react_local_checkout"
        });
        clearCart();
        setCart([]);
        setSuccessOrderId(orderId);
        setCheckoutOpen(false);
        setToast("Ordine registrato. Ti contatteremo per la bozza.");
        return;
      }

      const response = await createOrderCheckout({
        customer,
        items: cart,
        promoCode: activePromo?.code || ""
      });
      if (response.orderId) {
        localStorage.setItem("dedica_pending_order_id", response.orderId);
      }
      if (response.checkoutUrl) {
        window.location.href = response.checkoutUrl;
        return;
      }
      setToast("Pagamento non disponibile in questo momento.");
    } catch (error) {
      console.error("Checkout fallito:", error);
      setToast(error.message || "Checkout non riuscito.");
    } finally {
      setPlacingOrder(false);
    }
  }

  return (
    <main className="cart-react">
      <section className="cart-react-layout">
        <div className="cart-react-list">
          <div className="admin-react-header">
            <div>
              <Badge>Carrello</Badge>
              <h1>Il tuo ordine</h1>
            </div>
            <Button variant="secondary" onClick={onOpenHome}>Continua shopping</Button>
          </div>

          {cart.length === 0 ? (
            <EmptyState title="Carrello vuoto" description="Aggiungi una candela personalizzata per completare l’ordine." />
          ) : (
            cart.map(item => (
              <Card key={item.id} className="cart-react-item">
                <img src={item.photo || item.image || "assets/product-dedica.webp"} alt={item.productName || "Prodotto DÈDICA"} />
                <div>
                  <strong>{item.productName || "Prodotto DÈDICA"}</strong>
                  <small>{formatDetails(item)}</small>
                  <small className="product-unit-weight">Peso per candela: {formatWeightGrams(item.shippingWeightGrams || 500)}</small>
                  <div className="ui-actions">
                    <Input type="number" min="1" value={item.qty || 1} onChange={(event) => changeQty(item.id, event.target.value)} />
                    <Button variant="ghost" onClick={() => removeItem(item.id)}>Rimuovi</Button>
                  </div>
                </div>
                <div className="cart-react-price">
                  <strong>{formatMoney(getCartLineTotal(item))}</strong>
                  {getQuantityDiscountPercent(item.qty) ? <small>-{getQuantityDiscountPercent(item.qty)}% quantità</small> : null}
                </div>
              </Card>
            ))
          )}
        </div>

        <Card className="cart-react-summary">
          <h2>Riepilogo</h2>
          <form className="cart-react-promo" onSubmit={applyPromo}>
            <Input value={promoCode} onChange={(event) => { setPromoCode(event.target.value.toUpperCase()); setPromoStatus({ message: "", tone: "" }); }} placeholder="Codice promo" />
            <Button type="submit" variant="secondary" disabled={checkingPromo}>{checkingPromo ? "Verifica..." : "Applica"}</Button>
          </form>
          {promoStatus.message ? <p className={`cart-promo-status ${promoStatus.tone}`} role="status" aria-live="polite">{promoStatus.message}</p> : null}
          <SummaryLine label="Subtotale" value={formatMoney(totals.subtotal)} />
          <SummaryLine label="Spedizione" value={totals.shipping ? formatMoney(totals.shipping) : "Gratis"} />
          {totals.shippingQuote ? <small>{totals.shippingQuote.label} · {(totals.shippingQuote.weightGrams / 1000).toFixed(2).replace(".", ",")} kg · {totals.shippingQuote.quantity} pezzi{totals.shippingQuote.deliveryTime ? ` · ${totals.shippingQuote.deliveryTime}` : ""}</small> : null}
          {totals.shippingQuote ? <ShippingWeightBreakdown cart={cart} quote={totals.shippingQuote} /> : null}
          {shippingPriceExplanation ? <p className="shipping-price-explanation">{shippingPriceExplanation}</p> : null}
          {freeShippingMessage ? <p className={`cart-free-shipping-note${totals.shippingQuote?.free ? " achieved" : ""}`} aria-live="polite">{freeShippingMessage}</p> : null}
          {activePromo ? <SummaryLine label={`Promo ${activePromo.code}`} value={`-${formatMoney(totals.discount)}`} /> : null}
          <div className="cart-react-total-line">
            <span>Totale</span>
            <strong>{formatMoney(totals.total)}</strong>
          </div>
          <Button disabled={cart.length === 0 || placingOrder} onClick={openCheckout}>Procedi al checkout</Button>
          <div className="secure-payment-note"><span aria-hidden="true">🔒</span><div><strong>Pagamento sicuro con Stripe</strong><small>I dati della carta non vengono memorizzati da DÈDICA.</small></div></div>
        </Card>
      </section>

      {checkoutOpen ? (
        <CheckoutOverlay
          customer={customer}
          totals={totals}
          placingOrder={placingOrder}
          onChange={patchCustomer}
          onClose={() => setCheckoutOpen(false)}
          onSubmit={submitCheckout}
        />
      ) : null}

      {successOrderId ? (
        <div className="ui-overlay">
          <Card className="cart-react-checkout">
            <Badge>Ordine registrato</Badge>
            <h2>{successOrderId}</h2>
            <p>Abbiamo registrato la richiesta. Riceverai aggiornamenti sulla bozza e sulla produzione.</p>
            <div className="ui-actions">
              <Button onClick={onOpenHome}>Torna alla Home</Button>
              <Button variant="secondary" onClick={() => setSuccessOrderId("")}>Chiudi</Button>
            </div>
          </Card>
        </div>
      ) : null}

      <Toast message={toast} />
    </main>
  );
}

function formatWeightGrams(value) {
  const grams = Number(value || 0);
  return grams >= 1000 ? `${(grams / 1000).toFixed(2).replace(".", ",")} kg` : `${Math.round(grams)} g`;
}

function ShippingWeightBreakdown({ cart, quote }) {
  return <div className="shipping-weight-breakdown">
    <strong>Come viene calcolato il peso</strong>
    {cart.map(item => <span key={item.id}>{Number(item.qty || 1)} × {formatWeightGrams(item.shippingWeightGrams || 500)} ({item.productName || "candela"}) = {formatWeightGrams(Number(item.qty || 1) * Number(item.shippingWeightGrams || 500))}</span>)}
    <span>Imballaggio dell’ordine = {formatWeightGrams(quote.packagingWeightGrams)}</span>
    <span>Peso reale del pacco = {formatWeightGrams(quote.actualParcelWeightGrams)}</span>
    <span>Peso volumetrico del pacco = {formatWeightGrams(quote.volumetricParcelWeightGrams)}</span>
    <b>Peso usato per la tariffa = {formatWeightGrams(quote.weightGrams)} ({quote.weightBasis === "volumetric" ? "il volume è maggiore" : "il peso reale è maggiore"})</b>
  </div>;
}

function CheckoutOverlay({ customer, totals, placingOrder, onChange, onClose, onSubmit }) {
  return (
    <div className="ui-overlay">
      <Card className="cart-react-checkout">
        <header>
          <div>
            <Badge>Checkout</Badge>
            <h2>Dati spedizione</h2>
          </div>
          <Button variant="ghost" onClick={onClose}>Chiudi</Button>
        </header>
        <form className="admin-react-form" onSubmit={onSubmit}>
          <Field label="Email">
            <Input type="email" required value={customer.email} onChange={(event) => onChange("email", event.target.value)} />
          </Field>
          <div className="ui-two-col">
            <Field label="Nome">
              <Input required value={customer.nome} onChange={(event) => onChange("nome", event.target.value)} />
            </Field>
            <Field label="Cognome">
              <Input required value={customer.cognome} onChange={(event) => onChange("cognome", event.target.value)} />
            </Field>
          </div>
          <Field label="Telefono">
            <Input type="tel" required value={customer.telefono} onChange={(event) => onChange("telefono", event.target.value)} />
          </Field>
          <div className="ui-two-col">
          <Field label="Via / Piazza">
            <Input required value={customer.indirizzo} onChange={(event) => onChange("indirizzo", event.target.value)} />
          </Field>
          <Field label="Numero civico">
            <Input required value={customer.civico} onChange={(event) => onChange("civico", event.target.value)} />
          </Field>
          </div>
          <Field label="Interno, scala o presso" hint="Facoltativo">
            <Input value={customer.indirizzo2} onChange={(event) => onChange("indirizzo2", event.target.value)} />
          </Field>
          <div className="ui-two-col">
            <Field label="Città">
              <Input required value={customer.citta} onChange={(event) => onChange("citta", event.target.value)} />
            </Field>
            <Field label="Provincia">
              <Input required value={customer.provincia} onChange={(event) => onChange("provincia", event.target.value.toUpperCase())} maxLength="2" />
            </Field>
          </div>
          <Field label="Istruzioni per la consegna" hint="Facoltativo · massimo 300 caratteri">
            <Input maxLength="300" value={customer.noteConsegna} onChange={(event) => onChange("noteConsegna", event.target.value)} placeholder="Es. citofono Rossi, lasciare al portiere" />
          </Field>
          <div className="cart-react-billing"><h3>Dati obbligatori per la fattura</h3><p>La fattura viene emessa per ogni ordine usando l’indirizzo indicato sopra.</p><div className="ui-two-col"><Field label="Tipo cliente"><select className="ui-input" value={customer.tipoCliente} onChange={(event) => onChange("tipoCliente", event.target.value)}><option value="privato">Privato</option><option value="azienda">Azienda</option></select></Field>{customer.tipoCliente === "azienda" ? <Field label="Ragione sociale"><Input required value={customer.ragioneSociale} onChange={(event) => onChange("ragioneSociale", event.target.value)} /></Field> : null}</div><div className="ui-two-col"><Field label="Codice fiscale"><Input required={customer.tipoCliente === "privato"} value={customer.codiceFiscale} onChange={(event) => onChange("codiceFiscale", event.target.value.toUpperCase())} /></Field>{customer.tipoCliente === "azienda" ? <Field label="Partita IVA"><Input required value={customer.partitaIva} onChange={(event) => onChange("partitaIva", event.target.value)} /></Field> : null}</div>{customer.tipoCliente === "azienda" ? <div className="ui-two-col"><Field label="Codice destinatario"><Input value={customer.codiceDestinatario} onChange={(event) => onChange("codiceDestinatario", event.target.value.toUpperCase())} /></Field><Field label="PEC"><Input type="email" value={customer.pec} onChange={(event) => onChange("pec", event.target.value)} /></Field></div> : null}</div>
          <div className="ui-two-col">
            <Field label="CAP">
              <Input required value={customer.cap} onChange={(event) => onChange("cap", event.target.value)} />
            </Field>
            <Field label="Paese">
              <Input value="Italia" disabled />
            </Field>
          </div>
          <div className="cart-react-total-line">
            <span>Totale da pagare</span>
            <strong>{formatMoney(totals.total)}</strong>
          </div>
          <div className="secure-payment-note compact"><span aria-hidden="true">✦</span><div><strong>Prodotto personalizzato</strong><small>Non è previsto il recesso per semplice ripensamento. Garanzia legale, difetti e danni da trasporto restano sempre tutelati. <a href="/spedizioni-resi" target="_blank" rel="noreferrer">Resi e garanzia</a>.</small></div></div>
          <label className="ui-check"><input type="checkbox" required /> Confermo di aver letto la <a href="#privacy" target="_blank">privacy policy</a> e la <a href="/spedizioni-resi" target="_blank" rel="noreferrer">policy su resi e garanzia</a>. Il trattamento necessario all’ordine si basa sul contratto, non sul consenso.</label>
          <Button type="submit" disabled={placingOrder}>{placingOrder ? "Elaborazione..." : isFirebaseLocal ? "Conferma ordine" : "Vai al pagamento sicuro"}</Button>
          {!isFirebaseLocal ? <div className="secure-payment-note compact"><span aria-hidden="true">🛡️</span><div><strong>Checkout sicuro Stripe</strong><small>DÈDICA non accede ai dati completi della carta.</small></div></div> : null}
        </form>
      </Card>
    </div>
  );
}

function SummaryLine({ label, value }) {
  return (
    <div className="cart-react-summary-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatMoney(value) {
  return `${Number(value || 0).toFixed(2).replace(".", ",")} €`;
}

function formatDetails(item) {
  const options = (item.selectedOptions || []).map(option => `${option.groupLabel}: ${option.label}`);
  const personalizations = [
    item.personalizations?.text ? `${item.personalizations.textLabel}: ${item.personalizations.text}` : null,
    item.personalizations?.generic ? `${item.personalizations.genericLabel}: ${item.personalizations.generic}` : null,
    item.photo ? `${item.personalizations?.photoLabel || "Foto"} caricata` : null
  ].filter(Boolean);

  return [...options, ...personalizations].join(" · ") || "Personalizzazione standard";
}
