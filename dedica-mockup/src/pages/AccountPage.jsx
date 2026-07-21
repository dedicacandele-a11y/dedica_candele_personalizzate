import { useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, Field, Input, Textarea, Toast } from "../components/index.js";
import { getCurrentUser, resendCurrentUserVerification, setLoginRedirect, signOutUser } from "../services/auth.js";
import { isFirebaseLocal } from "../services/firebase.js";
import { getOrderStatusLabel, listCustomerOrders, listOrderMessages, markOrderMessagesRead, reviewDraft, sendCustomerMessage } from "../services/orders.js";
import { retryOrderPayment } from "../services/payments.js";
import { EMPTY_CUSTOMER_PROFILE, getCustomerProfile, saveCustomerProfile } from "../services/customerProfile.js";

const timeline = [
  ["pending_payment", "Ordine creato"],
  ["paid", "Pagato"],
  ["draft_sent", "Bozza inviata"],
  ["draft_approved", "Approvata"],
  ["in_production", "Realizzazione"],
  ["shipped", "Spedizione"]
];

export function AccountPage({ onOpenHome }) {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [revisionNotes, setRevisionNotes] = useState({});
  const [messages, setMessages] = useState({});
  const [conversation, setConversation] = useState({});
  const [openConversation, setOpenConversation] = useState("");
  const [sendingMessage, setSendingMessage] = useState("");
  const [reviewingDraft, setReviewingDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [profile, setProfile] = useState(EMPTY_CUSTOMER_PROFILE);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const notice = sessionStorage.getItem("dedica_account_notice");
    if (notice) {
      setToast(notice);
      sessionStorage.removeItem("dedica_account_notice");
    }
    refreshAccount();
  }, []);

  async function refreshAccount() {
    setLoading(true);
    const currentUser = await getCurrentUser();
    setUser(currentUser);
    if (currentUser || isFirebaseLocal) setProfile(await getCustomerProfile());

    if (!isFirebaseLocal && !currentUser) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setOrders(await listCustomerOrders());
    setLoading(false);
  }

  function requireLogin() {
    setLoginRedirect("/account");
    window.location.href = "/login?redirect=/account";
  }

  async function handleSignOut() {
    await signOutUser();
    setUser(null);
    setOrders([]);
  }

  async function handleProfileSave(event) {
    event.preventDefault();
    try { setProfile(await saveCustomerProfile(profile)); setProfileOpen(false); setToast("Indirizzi salvati. Saranno precompilati nel prossimo ordine."); }
    catch (error) { setToast(error.message || "Impossibile salvare gli indirizzi."); }
  }

  async function handleReview(orderId, action) {
    const revisionNote = revisionNotes[orderId] || "";
    try {
      setReviewingDraft(`${orderId}:${action}`);
      await reviewDraft(orderId, action, revisionNote);
      setToast(action === "approve" ? "Bozza approvata." : "Richiesta modifica inviata.");
      await refreshAccount();
    } catch (error) {
      setToast(error.message || "Azione bozza non riuscita.");
    } finally {
      setReviewingDraft("");
    }
  }

  async function handleMessage(event, orderId) {
    event.preventDefault();
    try {
      setSendingMessage(orderId);
      await sendCustomerMessage(orderId, messages[orderId] || "");
      setMessages(current => ({ ...current, [orderId]: "" }));
      const history = await listOrderMessages(orderId);
      setConversation(current => ({ ...current, [orderId]: history }));
      setToast("Messaggio inviato.");
      await refreshAccount();
    } catch (error) {
      setToast(error.message || "Messaggio non inviato.");
    } finally {
      setSendingMessage("");
    }
  }

  async function toggleConversation(orderId) {
    if (openConversation === orderId) return setOpenConversation("");
    setOpenConversation(orderId);
    const history = await listOrderMessages(orderId);
    setConversation(current => ({ ...current, [orderId]: history }));
    await markOrderMessagesRead(orderId);
    setOrders(current => current.map(order => order.id === orderId ? { ...order, unreadForCustomer: 0 } : order));
  }

  async function handleRetryPayment(orderId) {
    try {
      const result = await retryOrderPayment(orderId);
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      }
    } catch (error) {
      setToast(error.message || "Pagamento non disponibile.");
    }
  }

  async function resendVerification() {
    try {
      await resendCurrentUserVerification();
      setToast("Email di verifica inviata. Controlla anche Spam e Promozioni.");
    } catch (error) {
      setToast(error.message || "Invio della verifica non riuscito.");
    }
  }

  return (
    <main className="account-react">
      <section className="account-react-head">
        <div>
          <Badge>Area cliente</Badge>
          <h1>Ordini, bozze e messaggi.</h1>
          <p>Segui ogni ordine, approva la bozza digitale o scrivici se vuoi modificare un dettaglio.</p>
        </div>
        <div className="ui-actions">
          {!isFirebaseLocal && !user ? <Button onClick={requireLogin}>Accedi</Button> : null}
          {user ? <Button variant="secondary" onClick={handleSignOut}>Esci</Button> : null}
          <Button variant="ghost" onClick={onOpenHome}>Home</Button>
        </div>
      </section>

      {loading ? <EmptyState title="Caricamento ordini" /> : null}

      {!loading && user && !user.emailVerified ? <Card className="account-email-verification"><div><Badge>Email da verificare</Badge><strong>Conferma {user.email}</strong><p>Serve per ricevere correttamente comunicazioni, bozze e aggiornamenti degli ordini.</p></div><Button variant="secondary" onClick={resendVerification}>Invia di nuovo</Button></Card> : null}

      {!loading && !isFirebaseLocal && !user ? (
        <EmptyState title="Accesso richiesto" description="Accedi per vedere solo i tuoi ordini e gestire le bozze." action={<Button onClick={requireLogin}>Vai al login</Button>} />
      ) : null}

      {!loading && (isFirebaseLocal || user) && orders.length === 0 ? (
        <EmptyState title="Nessun ordine" description="Quando completerai un acquisto, lo troverai qui con stato, bozza e messaggi." />
      ) : null}

      {!loading && (isFirebaseLocal || user) ? <Card className="account-profile-card">
        <header><div><Badge>Profilo cliente</Badge><h2>Spedizione e fatturazione</h2><p>{profile.indirizzo ? `${profile.indirizzo} ${profile.civico}, ${profile.cap} ${profile.citta}` : "Completa i dati una volta: li troverai già pronti nel checkout."}</p></div><Button variant="secondary" onClick={() => setProfileOpen(value => !value)}>{profileOpen ? "Chiudi" : profile.indirizzo ? "Modifica" : "Completa profilo"}</Button></header>
        {profileOpen ? <form className="admin-react-form" onSubmit={handleProfileSave}>
          <div className="ui-two-col"><Field label="Nome"><Input required value={profile.nome} onChange={e => setProfile(p => ({...p,nome:e.target.value}))} /></Field><Field label="Cognome"><Input required value={profile.cognome} onChange={e => setProfile(p => ({...p,cognome:e.target.value}))} /></Field></div>
          <div className="ui-two-col"><Field label="Telefono"><Input type="tel" required value={profile.telefono} onChange={e => setProfile(p => ({...p,telefono:e.target.value}))} /></Field><Field label="Email"><Input type="email" value={profile.email || user?.email || ""} disabled /></Field></div>
          <div className="ui-two-col"><Field label="Via / Piazza"><Input required value={profile.indirizzo} onChange={e => setProfile(p => ({...p,indirizzo:e.target.value}))} /></Field><Field label="Numero civico"><Input required value={profile.civico} onChange={e => setProfile(p => ({...p,civico:e.target.value}))} /></Field></div>
          <Field label="Interno, scala o presso" hint="Facoltativo"><Input value={profile.indirizzo2} onChange={e => setProfile(p => ({...p,indirizzo2:e.target.value}))} /></Field>
          <div className="ui-two-col"><Field label="Città"><Input required value={profile.citta} onChange={e => setProfile(p => ({...p,citta:e.target.value}))} /></Field><Field label="Provincia"><Input required maxLength="2" value={profile.provincia} onChange={e => setProfile(p => ({...p,provincia:e.target.value.toUpperCase()}))} /></Field></div>
          <div className="ui-two-col"><Field label="CAP"><Input required value={profile.cap} onChange={e => setProfile(p => ({...p,cap:e.target.value}))} /></Field><Field label="Paese"><Input value="Italia" disabled /></Field></div>
          <Field label="Istruzioni per la consegna" hint="Facoltativo"><Textarea maxLength="300" rows="2" value={profile.noteConsegna} onChange={e => setProfile(p => ({...p,noteConsegna:e.target.value}))} /></Field>
          <label className="ui-check"><input type="checkbox" checked={profile.billingSameAsShipping} onChange={e => setProfile(p => ({...p,billingSameAsShipping:e.target.checked}))} /> Dati di fatturazione uguali alla spedizione</label>
          {!profile.billingSameAsShipping ? <div className="account-profile-billing"><h3>Fatturazione</h3><div className="ui-two-col"><Field label="Tipo cliente"><select className="ui-input" value={profile.tipoCliente} onChange={e => setProfile(p => ({...p,tipoCliente:e.target.value}))}><option value="privato">Privato</option><option value="azienda">Azienda</option></select></Field>{profile.tipoCliente === "azienda" ? <Field label="Ragione sociale"><Input required value={profile.ragioneSociale} onChange={e => setProfile(p => ({...p,ragioneSociale:e.target.value}))} /></Field> : null}</div><div className="ui-two-col"><Field label="Codice fiscale"><Input value={profile.codiceFiscale} onChange={e => setProfile(p => ({...p,codiceFiscale:e.target.value.toUpperCase()}))} /></Field>{profile.tipoCliente === "azienda" ? <Field label="Partita IVA"><Input required value={profile.partitaIva} onChange={e => setProfile(p => ({...p,partitaIva:e.target.value}))} /></Field> : null}</div></div> : null}
          <Button type="submit">Salva indirizzi</Button>
        </form> : null}
      </Card> : null}

      <div className="account-react-orders">
        {orders.map(order => (
          <Card key={order.id} className="account-react-order">
            <header>
              <div>
                <Badge>{getOrderStatusLabel(order.status)}</Badge>
                <h2>#{order.id}</h2>
                <p>{order.email} · {formatMoney(order.total)}</p>
              </div>
              {["pending_payment", "payment_failed", "payment_expired"].includes(order.status) && !isFirebaseLocal ? (
                <Button onClick={() => handleRetryPayment(order.id)}>Riprendi pagamento</Button>
              ) : null}
            </header>

            <ol className="account-react-timeline">
              {timeline.map(([status, label]) => (
                <li key={status} className={isTimelineActive(order.status, status) ? "active" : ""}>{label}</li>
              ))}
            </ol>

            <div className="account-react-grid">
              <section>
                <h3>Articoli</h3>
                {(order.items || []).map((item, index) => (
                  <p key={`${order.id}-${index}`}><strong>{item.productName || item.name || "Prodotto DÈDICA"}</strong> × {item.qty || 1}</p>
                ))}
              </section>

              <section className={`account-draft-card is-${order.status}`}>
                <div className="account-draft-heading"><h3>Bozza digitale</h3><Badge>{draftStatusLabel(order)}</Badge></div>
                {order.draft?.url ? (
                  <>
                    <p>{order.draft.note || "La tua bozza è pronta per la revisione."}</p>
                    <Button as="a" href={order.draft.url} target="_blank" rel="noreferrer" variant="secondary">Visualizza la bozza ↗</Button>
                  </>
                ) : <div className="account-draft-pending"><span>⌛</span><p>{order.status === "pending_payment" ? "La bozza verrà preparata dopo il pagamento." : "Stiamo preparando la tua proposta. Riceverai una notifica appena sarà pronta."}</p></div>}
              </section>
            </div>

            {order.shipment ? <section className="account-shipment"><div><h3>Spedizione</h3><p>{order.shipment.carrierName} · tracking {order.shipment.trackingCode}</p></div>{order.shipment.trackingUrl ? <Button as="a" href={order.shipment.trackingUrl} target="_blank" rel="noreferrer" variant="secondary">Segui la spedizione ↗</Button> : null}</section> : null}

            {order.status === "draft_sent" ? (
              <div className="account-react-review">
                <div><strong>La bozza è corretta?</strong><small>Controlla attentamente testo, nomi e impaginazione prima di approvare.</small></div>
                <Button disabled={Boolean(reviewingDraft)} onClick={() => handleReview(order.id, "approve")}>{reviewingDraft === `${order.id}:approve` ? "Approvazione..." : "Approva e avvia la produzione"}</Button>
                <Field label="Richiedi modifica">
                  <Textarea rows={2} value={revisionNotes[order.id] || ""} onChange={(event) => setRevisionNotes(current => ({ ...current, [order.id]: event.target.value }))} placeholder="Es. Correggere il nome da Sara a Sarah..." />
                </Field>
                <Button disabled={Boolean(reviewingDraft) || !(revisionNotes[order.id] || "").trim()} variant="secondary" onClick={() => handleReview(order.id, "request_revision")}>{reviewingDraft === `${order.id}:request_revision` ? "Invio richiesta..." : "Invia richiesta di modifica"}</Button>
              </div>
            ) : null}

            <section className="account-order-conversation">
              <p className="admin-order-automation-note"><strong>Prodotto danneggiato o non conforme?</strong> Scrivici qui indicando il problema. Conserva confezione ed etichetta; per i danni da trasporto ti chiederemo le fotografie necessarie. <a href="/spedizioni-resi" target="_blank" rel="noreferrer">Consulta resi e garanzia</a>.</p>
              <button type="button" className="account-conversation-toggle" onClick={() => toggleConversation(order.id)}>
                <span><strong>Messaggi sull’ordine</strong><small>Le risposte via email compariranno anche qui.</small></span>
                <span>{Number(order.unreadForCustomer || 0) > 0 ? `${order.unreadForCustomer} nuovi` : openConversation === order.id ? "Chiudi" : "Apri"}</span>
              </button>
              {openConversation === order.id ? <><div className="account-conversation-thread" aria-live="polite">
                {(conversation[order.id] || []).length ? (conversation[order.id] || []).map(message => <article key={message.id} className={message.senderRole === "customer" ? "customer" : "admin"}>
                  <strong>{message.senderRole === "customer" ? "Tu" : "DÈDICA"}</strong>
                  <p>{message.text}</p>
                  <small>{formatMessageDate(message.createdAt)}{message.source === "email" ? " · ricevuto via email" : ""}</small>
                </article>) : <p className="account-conversation-empty">Non ci sono ancora messaggi.</p>}
              </div><form className="account-react-message" onSubmit={(event) => handleMessage(event, order.id)}>
                <Input maxLength="800" value={messages[order.id] || ""} onChange={(event) => setMessages(current => ({ ...current, [order.id]: event.target.value }))} placeholder="Scrivi un messaggio relativo a questo ordine..." />
                <Button type="submit" variant="secondary" disabled={sendingMessage === order.id || !(messages[order.id] || "").trim()}>{sendingMessage === order.id ? "Invio..." : "Invia messaggio"}</Button>
              </form></> : null}
            </section>
          </Card>
        ))}
      </div>

      <Toast message={toast} />
    </main>
  );
}

function isTimelineActive(currentStatus, stepStatus) {
  const normalizedStatus = currentStatus === "revision_requested" ? "draft_sent" : currentStatus;
  const currentIndex = timeline.findIndex(([status]) => status === normalizedStatus);
  const stepIndex = timeline.findIndex(([status]) => status === stepStatus);
  return currentIndex >= 0 && stepIndex <= currentIndex;
}

function formatMoney(value) {
  return `${Number(value || 0).toFixed(2).replace(".", ",")} €`;
}

function draftStatusLabel(order) {
  if (order.status === "draft_sent") return "Da approvare";
  if (order.status === "revision_requested") return "Modifica richiesta";
  if (["draft_approved", "in_production", "shipped"].includes(order.status)) return "Approvata";
  return order.draft?.url ? "Disponibile" : "In preparazione";
}

function formatMessageDate(value) {
  if (!value) return "Adesso";
  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
}
