import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, Field, Input, Textarea, Toast } from "../../../components/index.js";
import { adminEditOrder, attachOrderInvoice, getAllowedAdminStatuses, getOrderStatusLabel, listAdminOrders, listOrderMessages, markOrderMessagesRead, sendAdminMessage, sendOrderDraft, updateOrderShipment, updateOrderStatus } from "../../../services/orders.js";
import { isFirebaseLocal } from "../../../services/firebase.js";
import { deleteOrderInvoiceFile, getOrderInvoiceBlob, uploadOrderDraft, uploadOrderInvoice } from "../../../services/storage.js";

const filters = [
  ["all", "Tutti"], ["action", "Da lavorare"], ["payment", "Pagamento"], ["draft", "Bozza"],
  ["production", "Produzione"], ["shipping", "Spedizione"], ["closed", "Conclusi"],
];
const timeline = [["pending_payment", "Ordine"], ["paid", "Pagamento"], ["draft_sent", "Bozza"], ["draft_approved", "Approvazione"], ["in_production", "Produzione"], ["shipped", "Spedizione"]];

export function AdminOrdersPage({ onNavigate }) {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState({ url: "", note: "" });
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [shipment, setShipment] = useState({ carrierName: "", trackingCode: "", trackingUrl: "", actualCost: "" });
  const [editingDelivery, setEditingDelivery] = useState(false);
  const [delivery, setDelivery] = useState({});
  const [cancelReason, setCancelReason] = useState("");
  const [uploadingDraft, setUploadingDraft] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sendingDraft, setSendingDraft] = useState(false);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { refresh(); }, []);

  const visibleOrders = useMemo(() => orders.filter(order => {
    const text = `${order.id} ${order.nome} ${order.cognome} ${order.email} ${order.telefono}`.toLowerCase();
    return text.includes(search.toLowerCase()) && matchesFilter(order.status, filter);
  }), [orders, search, filter]);
  const selected = orders.find(order => order.id === selectedId) || null;
  const stats = useMemo(() => ({
    action: orders.filter(order => ["payment_review", "paid", "revision_requested", "draft_approved", "in_production"].includes(order.status)).length,
    drafts: orders.filter(order => ["paid", "revision_requested"].includes(order.status)).length,
    production: orders.filter(order => ["draft_approved", "in_production"].includes(order.status)).length,
    shipping: orders.filter(order => order.status === "in_production").length,
  }), [orders]);

  async function refresh() { setLoading(true); const data = await listAdminOrders(); setOrders(data); setLoading(false); }
  async function openOrder(order) {
    setSelectedId(order.id);
    setDraft({ url: order.draft?.url || "", note: order.draft?.note || "" });
    setShipment(order.shipment || { carrierName: "", trackingCode: "", trackingUrl: "", actualCost: "" });
    setDelivery({ nome: order.nome || "", cognome: order.cognome || "", telefono: order.telefono || "", indirizzo: order.indirizzo || "", civico: order.civico || "", indirizzo2: order.indirizzo2 || "", cap: order.cap || "", citta: order.citta || "", provincia: order.provincia || "", noteConsegna: order.noteConsegna || "" });
    setEditingDelivery(false); setCancelReason("");
    setMessages(await listOrderMessages(order.id));
    await markOrderMessagesRead(order.id);
    setOrders(current => current.map(item => item.id === order.id ? { ...item, unreadForAdmin: 0 } : item));
  }
  async function changeStatus(status) {
    try { await updateOrderStatus(selected.id, status); setToast("Stato ordine aggiornato."); await refresh(); }
    catch (error) { setToast(error.message || "Passaggio di stato non consentito."); }
  }
  async function submitDraft(event) {
    event.preventDefault();
    if (!draft.url.trim()) return setToast("Inserisci il collegamento alla bozza digitale.");
    try { setSendingDraft(true); await sendOrderDraft(selected.id, draft.url, draft.note); setToast("Bozza inviata: cliente avvisato nell’Area personale e via email."); await refresh(); }
    catch (error) { setToast(error.message || "Invio bozza non riuscito."); }
    finally { setSendingDraft(false); }
  }
  async function handleDraftUpload(event) {
    const file = event.target.files?.[0]; if (!file || !selected) return;
    setUploadingDraft(true);
    try { const url = await uploadOrderDraft(selected.id, file); setDraft(value => ({ ...value, url })); setToast("Bozza caricata. Ora puoi aggiungere una nota e inviarla."); }
    catch (error) { setToast(error.message || "Caricamento bozza non riuscito."); }
    finally { setUploadingDraft(false); event.target.value = ""; }
  }
  async function submitMessage(event) {
    event.preventDefault(); if (!messageText.trim()) return;
    try { setSendingMessage(true); await sendAdminMessage(selected.id, messageText); setMessageText(""); setMessages(await listOrderMessages(selected.id)); setToast("Messaggio inviato e notifica email richiesta."); }
    catch (error) { setToast(error.message || "Messaggio non inviato."); }
    finally { setSendingMessage(false); }
  }
  async function submitShipment(event) {
    event.preventDefault();
    if (!shipment.carrierName.trim() || !shipment.trackingCode.trim()) return setToast("Inserisci corriere e codice tracking.");
    try { await updateOrderShipment(selected.id, { ...shipment, actualCost: Number(shipment.actualCost || 0) }); setToast("Spedizione registrata e cliente aggiornato."); await refresh(); }
    catch (error) { setToast(error.message || "Registrazione spedizione non riuscita."); }
  }
  async function updateExistingShipment(event) {
    event.preventDefault();
    try { await adminEditOrder(selected.id, "update_shipment", { value: shipment }); setToast("Tracking e spedizione aggiornati."); await refresh(); }
    catch (error) { setToast(error.message || "Aggiornamento tracking non riuscito."); }
  }
  async function saveDelivery(event) {
    event.preventDefault();
    try { await adminEditOrder(selected.id, "update_delivery", { value: delivery }); setEditingDelivery(false); setToast("Dati di consegna aggiornati."); await refresh(); }
    catch (error) { setToast(error.message || "Modifica ordine non riuscita."); }
  }
  async function cancelOrder() {
    if (!cancelReason.trim()) return setToast("Indica il motivo dell’annullamento.");
    if (!window.confirm("Confermi l’annullamento amministrativo? Rimborso Stripe e cancellazione del corriere restano separati.")) return;
    try { await adminEditOrder(selected.id, "cancel", { reason: cancelReason }); setToast("Ordine annullato e operazione registrata."); await refresh(); }
    catch (error) { setToast(error.message || "Annullamento non riuscito."); }
  }
  async function deleteTestOrder() {
    if (!selected || (!isFirebaseLocal && selected.stripeMode !== "test" && selected.status !== "cancelled")) return setToast("Puoi eliminare definitivamente gli ordini di test o annullati.");
    if (!window.confirm(`Eliminare definitivamente l’ordine #${shortId(selected.id)}? Verranno rimossi anche messaggi, bozza e fattura. L’operazione non è reversibile.`)) return;
    try {
      const deletedId = selected.id;
      await adminEditOrder(deletedId, "delete_test");
      setSelectedId("");
      setToast(`Ordine #${shortId(deletedId)} eliminato definitivamente.`);
      await refresh();
    } catch (error) { setToast(error.message || "Eliminazione definitiva non riuscita."); }
  }
  async function handleInvoiceUpload(event) {
    const file = event.target.files?.[0]; if (!file || !selected) return;
    setUploadingInvoice(true);
    try {
      const previousInvoice = selected.invoice;
      const invoice = await uploadOrderInvoice(selected.id, file);
      await attachOrderInvoice(selected.id, invoice);
      try { await deleteOrderInvoiceFile(previousInvoice); } catch (cleanupError) { console.warn("Pulizia fattura sostituita non riuscita:", cleanupError); }
      setToast("Fattura allegata all’ordine."); await refresh();
    }
    catch (error) { setToast(error.message || "Caricamento fattura non riuscito."); }
    finally { setUploadingInvoice(false); event.target.value = ""; }
  }
  async function exportArchive() {
    setExporting(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      zip.file("ordini.csv", buildOrdersCsv(orders));
      const errors = [];
      for (const order of orders) {
        if (!hasInvoice(order.invoice)) continue;
        try {
          zip.file(`fatture/${safeFileName(order.id)}_${safeFileName(order.invoice.fileName || "fattura")}`, await getOrderInvoiceBlob(order.invoice));
        } catch (error) { errors.push(`${order.id}: ${error.message}`); }
      }
      if (errors.length) zip.file("allegati_non_scaricati.txt", errors.join("\n"));
      downloadBlob(await zip.generateAsync({ type: "blob" }), `dedica-archivio-ordini-${new Date().toISOString().slice(0, 10)}.zip`);
      setToast(`Archivio esportato: ${orders.length} ordini.`);
    } catch (error) { setToast(error.message || "Esportazione non riuscita."); }
    finally { setExporting(false); }
  }

  async function downloadInvoice() {
    if (!selected?.invoice) return;
    try { downloadBlob(await getOrderInvoiceBlob(selected.invoice), selected.invoice.fileName || `fattura-${selected.id}`); }
    catch (error) { setToast(error.message || "Download fattura non riuscito."); }
  }

  return <div className="admin-orders-workspace">
    <header className="admin-react-header">
      <div><span className="eyebrow">Centro operativo</span><h2>Gestione ordini</h2><p>Dal pagamento alla consegna: priorità, cliente, bozza, produzione e spedizione.</p></div>
      <div className="ui-actions"><Button variant="secondary" disabled={exporting} onClick={exportArchive}>{exporting ? "Esportazione..." : "Esporta ordini e fatture"}</Button><Button variant="secondary" onClick={refresh}>Aggiorna</Button></div>
    </header>

    <Card className="admin-order-toolbar">
      <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cerca ordine, cliente, email o telefono..." aria-label="Cerca ordini" />
      <select className="ui-input" value={filter} onChange={event => setFilter(event.target.value)} aria-label="Filtra ordini">{filters.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
      <span className="admin-order-work-count"><strong>{stats.action}</strong> da lavorare</span>
    </Card>
    <p className="admin-order-automation-note"><strong>Avanzamento:</strong> Stripe conferma automaticamente il pagamento; il cliente approva la bozza; tu avvii produzione e registri la spedizione con tracking.</p>

    <div className="admin-order-master-detail">
      <section className="admin-order-master">
        {loading ? <EmptyState title="Caricamento ordini" /> : null}
        {!loading && visibleOrders.length === 0 ? <EmptyState title="Nessun ordine" description="Non ci sono ordini per questo filtro." /> : null}
        {visibleOrders.map(order => <button key={order.id} aria-label={`Apri ordine ${shortId(order.id)}`} className={selectedId === order.id ? "active" : ""} onClick={() => openOrder(order)}>
          <div><Badge>{getOrderStatusLabel(order.status)}</Badge>{Number(order.unreadForAdmin || 0) > 0 ? <Badge>{order.unreadForAdmin} nuovi messaggi</Badge> : null}<strong>{order.nome || "Cliente"} {order.cognome || ""}</strong><small>#{shortId(order.id)} · {formatDate(order.createdAt)}</small></div>
          <div><strong>{formatCurrency(order.total)}</strong><small>{quantity(order)} pezzi</small><span>{nextAction(order.status)}</span></div>
        </button>)}
      </section>

      <section className="admin-order-detail">
        {!selected ? <Card className="admin-order-placeholder"><span>↗</span><h3>Seleziona un ordine</h3><p>Apri un ordine per vedere tutte le informazioni e le azioni operative.</p></Card> : <>
          <Card className="admin-order-detail-head">
            <div><Badge>{getOrderStatusLabel(selected.status)}</Badge><h2>Ordine #{shortId(selected.id)}</h2><p>{selected.nome} {selected.cognome} · {selected.email}</p></div>
            <div><strong>{formatCurrency(selected.total)}</strong><small>{formatDate(selected.createdAt, true)}</small></div>
            <ol className="admin-react-order-timeline">{timeline.map(([status, label]) => <li key={status} className={isTimelineActive(selected.status, status) ? "active" : ""}>{label}</li>)}</ol>
            <div className="admin-order-next-action"><div><span>Prossima azione</span><strong>{nextAction(selected.status)}</strong></div><div className="ui-actions">{getAllowedAdminStatuses(selected.status, { local: isFirebaseLocal }).filter(status => status !== "shipped").map(status => <Button key={status} variant={status === "cancelled" ? "ghost" : "primary"} onClick={() => changeStatus(status)}>{status === "paid" ? "Conferma pagamento" : status === "in_production" ? "Avvia produzione" : getOrderStatusLabel(status)}</Button>)}</div></div>
          </Card>

          <div className="admin-order-detail-grid">
            <Card><div className="admin-react-card-head"><h3>Cliente e consegna</h3><Button variant="ghost" onClick={() => setEditingDelivery(value => !value)}>{editingDelivery ? "Chiudi" : "Modifica"}</Button></div>{editingDelivery ? <form className="admin-order-edit-form" onSubmit={saveDelivery}><div className="ui-two-col"><Field label="Nome"><Input required value={delivery.nome} onChange={e => setDelivery(v => ({...v,nome:e.target.value}))} /></Field><Field label="Cognome"><Input required value={delivery.cognome} onChange={e => setDelivery(v => ({...v,cognome:e.target.value}))} /></Field></div><Field label="Telefono"><Input required value={delivery.telefono} onChange={e => setDelivery(v => ({...v,telefono:e.target.value}))} /></Field><div className="ui-two-col"><Field label="Indirizzo"><Input required value={delivery.indirizzo} onChange={e => setDelivery(v => ({...v,indirizzo:e.target.value}))} /></Field><Field label="Civico"><Input required value={delivery.civico} onChange={e => setDelivery(v => ({...v,civico:e.target.value}))} /></Field></div><div className="ui-two-col"><Field label="CAP"><Input required value={delivery.cap} onChange={e => setDelivery(v => ({...v,cap:e.target.value}))} /></Field><Field label="Città"><Input required value={delivery.citta} onChange={e => setDelivery(v => ({...v,citta:e.target.value}))} /></Field></div><Field label="Provincia"><Input required maxLength="2" value={delivery.provincia} onChange={e => setDelivery(v => ({...v,provincia:e.target.value.toUpperCase()}))} /></Field><Button type="submit">Salva modifiche</Button></form> : <dl className="admin-order-data"><div><dt>Cliente</dt><dd>{selected.nome} {selected.cognome}</dd></div><div><dt>Telefono</dt><dd>{selected.telefono || "Non indicato"}</dd></div><div><dt>Email</dt><dd>{selected.email}</dd></div><div><dt>Destinazione</dt><dd>{formatAddress(selected)}</dd></div>{selected.noteConsegna ? <div><dt>Note corriere</dt><dd>{selected.noteConsegna}</dd></div> : null}</dl>}</Card>
            <Card><h3>Riepilogo economico</h3><dl className="admin-order-data"><div><dt>Prodotti</dt><dd>{formatCurrency(selected.subtotal)}</dd></div><div><dt>Spedizione cliente</dt><dd>{selected.shipping ? formatCurrency(selected.shipping) : "Gratuita"}</dd></div><div><dt>Sconto</dt><dd>-{formatCurrency(selected.discount)}</dd></div><div className="total"><dt>Totale</dt><dd>{formatCurrency(selected.total)}</dd></div><div><dt>Pagamento</dt><dd>{selected.paymentStatus || "Non disponibile"} · Stripe {selected.stripeMode || "—"}</dd></div></dl></Card>
          </div>

          <Card><div className="admin-react-card-head"><div><Badge>Fatturazione obbligatoria</Badge><h3>Dati fiscali e fattura</h3></div>{hasInvoice(selected.invoice) ? <Button variant="ghost" onClick={downloadInvoice}>Scarica fattura</Button> : null}</div><dl className="admin-order-data"><div><dt>Intestatario</dt><dd>{selected.tipoCliente === "azienda" ? selected.ragioneSociale : `${selected.nome} ${selected.cognome}`}</dd></div><div><dt>Codice fiscale</dt><dd>{selected.codiceFiscale || "Non presente"}</dd></div>{selected.tipoCliente === "azienda" ? <><div><dt>Partita IVA</dt><dd>{selected.partitaIva}</dd></div><div><dt>SDI / PEC</dt><dd>{selected.codiceDestinatario || selected.pec || "0000000"}</dd></div></> : null}<div><dt>Residenza / sede</dt><dd>{formatAddress(selected)}</dd></div></dl><label className="admin-order-draft-upload"><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={uploadingInvoice} onChange={handleInvoiceUpload} /><strong>{uploadingInvoice ? "Caricamento..." : hasInvoice(selected.invoice) ? "Sostituisci fattura" : "Allega fattura o ricevuta"}</strong><small>PDF, JPG, PNG o WebP · massimo 10 MB · visibile solo agli amministratori</small></label></Card>

          <Card><div className="admin-react-card-head"><div><h3>Prodotti e personalizzazioni</h3><small>{quantity(selected)} unità complessive</small></div></div><div className="admin-order-items">{(selected.items || []).map((item, index) => <article key={`${selected.id}-${index}`}><img src={item.image || item.photo || "/assets/product-dedica.webp"} alt="" /><div><strong>{item.productName || item.name || "Prodotto DÈDICA"} × {item.qty || 1}</strong><p>{item.personalizations?.text || item.dedica || "Nessun testo indicato"}</p><small>{(item.selectedOptions || []).map(option => `${option.groupLabel}: ${option.label}`).join(" · ")}</small></div><strong>{formatCurrency(item.lineTotal || 0)}</strong></article>)}</div></Card>

          {["paid", "draft_sent", "revision_requested"].includes(selected.status) ? <Card><form className="admin-order-operation" onSubmit={submitDraft}><div><Badge>Bozza digitale</Badge><h3>{selected.status === "revision_requested" ? "Il cliente ha richiesto una modifica" : "Carica e invia la bozza"}</h3><p>Carica direttamente un PDF o un’immagine. Il cliente riceverà il collegamento via email e lo troverà nella sua Area personale.</p>{selected.customerRevisionNote ? <p className="admin-order-alert">Richiesta cliente: {selected.customerRevisionNote}</p> : null}</div><label className="admin-order-draft-upload"><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={uploadingDraft} onChange={handleDraftUpload} /><strong>{uploadingDraft ? "Caricamento..." : draft.url ? "Sostituisci il file" : "Carica bozza"}</strong><small>PDF, JPG, PNG o WebP · massimo 10 MB</small></label>{draft.url ? <div className="admin-order-draft-ready"><span>File pronto</span><a href={draft.url} target="_blank" rel="noreferrer">Apri anteprima ↗</a></div> : null}<details><summary>Usa invece un collegamento esterno</summary><Field label="URL bozza"><Input type="url" value={draft.url} onChange={event => setDraft(value => ({ ...value, url: event.target.value }))} placeholder="https://..." /></Field></details><Field label="Messaggio per il cliente"><Textarea rows="2" value={draft.note} onChange={event => setDraft(value => ({ ...value, note: event.target.value }))} placeholder="Es. Ecco la prima proposta. Controlla testo e impaginazione." /></Field><Button type="submit" disabled={!draft.url || uploadingDraft}>Invia bozza al cliente</Button></form></Card> : null}

          {["in_production", "shipped"].includes(selected.status) ? <Card className="admin-order-shipment"><div className="admin-react-card-head"><div><Badge>{selected.status === "shipped" ? "Spedito · modificabile" : "Ultimo passaggio"}</Badge><h3>Spedizione e tracking</h3><small>Puoi correggere questi dati anche dopo la spedizione.</small></div><Button variant="ghost" onClick={() => onNavigate("shipping")}>Apri modulo Spedizioni</Button></div><form className="admin-order-shipment-form" onSubmit={selected.status === "shipped" ? updateExistingShipment : submitShipment}><Field label="Corriere assegnato"><Input required value={shipment.carrierName} onChange={event => setShipment(value => ({ ...value, carrierName: event.target.value }))} placeholder="Es. BRT" /></Field><Field label="Codice tracking"><Input required value={shipment.trackingCode} onChange={event => setShipment(value => ({ ...value, trackingCode: event.target.value }))} /></Field><Field label="URL tracking"><Input type="url" value={shipment.trackingUrl} onChange={event => setShipment(value => ({ ...value, trackingUrl: event.target.value }))} /></Field><Field label="Costo reale IVA inclusa"><Input type="number" min="0" step="0.01" value={shipment.actualCost} onChange={event => setShipment(value => ({ ...value, actualCost: event.target.value }))} /></Field><Button type="submit">{selected.status === "shipped" ? "Aggiorna tracking" : "Segna come spedito"}</Button></form></Card> : null}

          {selected.status !== "cancelled" ? <Card className="admin-order-danger"><h3>Annulla ordine</h3><p>L’ordine verrà chiuso nello storico. Rimborso Stripe e cancellazione della spedizione non sono automatici.</p><div className="admin-order-cancel-form"><Input value={cancelReason} onChange={event => setCancelReason(event.target.value)} placeholder="Motivo obbligatorio..." /><Button variant="ghost" onClick={cancelOrder}>Annulla ordine</Button></div></Card> : <Card><Badge>Annullato</Badge><p>{selected.cancellation?.reason || "Motivo non disponibile"}</p></Card>}

          {(isFirebaseLocal || selected.stripeMode === "test" || selected.status === "cancelled") ? <Card className="admin-order-danger"><Badge>{selected.status === "cancelled" ? "Ordine annullato" : "Solo modalità test"}</Badge><h3>Elimina definitivamente</h3><p>Rimuove l’ordine dalla lista insieme a messaggi, bozza e fattura. Questa operazione non può essere annullata.</p><Button variant="ghost" onClick={deleteTestOrder}>Elimina definitivamente l’ordine</Button></Card> : null}

          <Card className="admin-order-chat"><div className="admin-react-card-head"><div><Badge>Conversazione ordine</Badge><h3>Cliente e DÈDICA</h3></div><small>{messages.length} messaggi</small></div><p className="admin-order-automation-note">I messaggi inviati dall’Area personale restano qui. Le risposte alle notifiche email arrivano invece alla casella configurata nei Dati aziendali.</p><div className="admin-react-message-list" aria-live="polite">{messages.length ? messages.map((message, index) => <article key={message.id || index} className={message.senderRole === "admin" ? "admin" : "customer"}><div><strong>{message.senderRole === "admin" ? "Tu" : selected.nome || "Cliente"}</strong><small>{formatDate(message.createdAt, true)}{message.source === "email" ? " · via email" : ""}</small></div><p>{message.text}</p></article>) : <div className="admin-chat-empty"><span>✉</span><strong>Nessun messaggio</strong><small>Scrivi il primo aggiornamento relativo a questo ordine.</small></div>}</div><form className="admin-react-message-form" onSubmit={submitMessage}><Input maxLength="800" value={messageText} onChange={event => setMessageText(event.target.value)} placeholder="Scrivi un aggiornamento al cliente..." /><Button type="submit" variant="secondary" disabled={sendingMessage || !messageText.trim()}>{sendingMessage ? "Invio..." : "Invia e notifica"}</Button></form></Card>
        </>}
      </section>
    </div>
    <Toast message={toast} />
  </div>;
}

function matchesFilter(status, filter) { const groups = { action: ["payment_review", "paid", "revision_requested", "draft_approved", "in_production"], payment: ["pending_payment", "payment_review", "payment_failed", "payment_expired"], draft: ["paid", "draft_sent", "revision_requested"], production: ["draft_approved", "in_production"], shipping: ["in_production", "shipped"], closed: ["shipped", "cancelled"] }; return filter === "all" || (groups[filter] || []).includes(status); }
function nextAction(status) { return { pending_payment: "Attendi il pagamento", payment_review: "Verifica il pagamento", payment_failed: "Cliente deve riprovare", payment_expired: "Pagamento scaduto", paid: "Prepara la bozza", draft_sent: "Attendi il cliente", revision_requested: "Correggi la bozza", draft_approved: "Avvia la produzione", in_production: "Prepara la spedizione", shipped: "Monitora la consegna", cancelled: "Ordine annullato" }[status] || "Verifica ordine"; }
function quantity(order) { return (order.items || []).reduce((sum, item) => sum + Number(item.qty || 1), 0); }
function shortId(id = "") { return id.length > 12 ? id.slice(-10).toUpperCase() : id; }
function formatAddress(order) { return [order.indirizzo, order.civico, order.indirizzo2, `${order.cap || ""} ${order.citta || ""}`.trim(), order.provincia, order.paese].filter(Boolean).join(", ") || "Indirizzo non disponibile"; }
function isTimelineActive(current, step) { const normalized = current === "revision_requested" ? "draft_sent" : current; return timeline.findIndex(([value]) => value === step) <= timeline.findIndex(([value]) => value === normalized); }
function formatCurrency(value) { return `${Number(value || 0).toFixed(2).replace(".", ",")} €`; }
function formatDate(value, time = false) { if (!value) return "Data non disponibile"; const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value); return date.toLocaleString("it-IT", time ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "short" }); }
function csv(value) { const raw = String(value ?? ""); const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw; return `"${safe.replace(/"/g, '""')}"`; }
function csvDate(value) { if (!value) return ""; const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value); return Number.isNaN(date.getTime()) ? "" : date.toISOString(); }
function hasInvoice(invoice) { return Boolean(invoice?.url || invoice?.storagePath); }
function buildOrdersCsv(orders) { const headers = ["ordine","data","stato","tipo_cliente","nome","cognome","ragione_sociale","codice_fiscale","partita_iva","indirizzo","civico","cap","citta","provincia","email","totale","fattura_allegata","nome_file_fattura"]; return [headers.join(","), ...orders.map(order => [order.id, csvDate(order.createdAt), order.status, order.tipoCliente, order.nome, order.cognome, order.ragioneSociale, order.codiceFiscale, order.partitaIva, order.indirizzo, order.civico, order.cap, order.citta, order.provincia, order.email, Number(order.total || 0).toFixed(2), hasInvoice(order.invoice) ? "si" : "no", order.invoice?.fileName || ""].map(csv).join(","))].join("\r\n"); }
function safeFileName(value) { return String(value || "file").replace(/[^a-z0-9._-]/gi, "_"); }
function downloadBlob(blob, name) { const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
