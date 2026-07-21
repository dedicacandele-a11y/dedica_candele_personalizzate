import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, Field, Input, Textarea, Toast } from "../../../components/index.js";
import { listSupportTickets, manageSupportTicket } from "../../../services/support.js";

const statusLabels = { open: "Nuova", in_progress: "In lavorazione", waiting_customer: "In attesa cliente", resolved: "Risolta", closed: "Chiusa" };
const priorityLabels = { low: "Bassa", normal: "Normale", high: "Alta", urgent: "Urgente" };
const topicLabels = { order: "Ordine e pagamento", draft: "Bozza e personalizzazione", shipping: "Spedizione e tracking", transport_damage: "Prodotto danneggiato", returns: "Resi e garanzia", other: "Altro" };

export function AdminSupportPage() {
  const [tickets, setTickets] = useState([]); const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState("active"); const [search, setSearch] = useState(""); const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [toast, setToast] = useState("");
  useEffect(() => { refresh(); }, []);
  async function refresh() { setLoading(true); try { setTickets(await listSupportTickets()); } catch (error) { setToast(error.message || "Caricamento assistenza non riuscito."); } finally { setLoading(false); } }
  const selected = tickets.find(item => item.id === selectedId) || null;
  const visible = useMemo(() => tickets.filter(ticket => {
    const matchesText = `${ticket.id} ${ticket.reference} ${ticket.name} ${ticket.email} ${ticket.orderId} ${ticket.subject}`.toLowerCase().includes(search.toLowerCase());
    return matchesText && (filter === "all" || (filter === "active" ? !["resolved", "closed"].includes(ticket.status) : ticket.status === filter));
  }), [tickets, search, filter]);
  async function update(value) { if (!selected) return; setSaving(true); try { await manageSupportTicket(selected.id, "update", value); setToast("Pratica aggiornata."); await refresh(); } catch (error) { setToast(error.message || "Aggiornamento non riuscito."); } finally { setSaving(false); } }
  async function sendReply(event) { event.preventDefault(); if (!selected || !reply.trim()) return; setSaving(true); try { await manageSupportTicket(selected.id, "reply", { text: reply }); setReply(""); setToast("Risposta inviata al cliente via email."); await refresh(); } catch (error) { setToast(error.message || "Risposta non inviata."); } finally { setSaving(false); } }

  return <div className="admin-orders-workspace">
    <header className="admin-react-header"><div><span className="eyebrow">Post-vendita</span><h2>Assistenza clienti</h2><p>Pratiche, priorità e risposte in un’unica coda operativa.</p></div><Button variant="secondary" onClick={refresh}>Aggiorna</Button></header>
    <Card className="admin-order-toolbar"><Input aria-label="Cerca pratiche" placeholder="Cerca pratica, cliente, ordine..." value={search} onChange={e => setSearch(e.target.value)} /><select aria-label="Filtra pratiche" className="ui-input" value={filter} onChange={e => setFilter(e.target.value)}><option value="active">Da gestire</option><option value="open">Nuove</option><option value="in_progress">In lavorazione</option><option value="waiting_customer">In attesa cliente</option><option value="resolved">Risolte</option><option value="closed">Chiuse</option><option value="all">Tutte</option></select><span className="admin-order-work-count"><strong>{tickets.filter(t => !["resolved", "closed"].includes(t.status)).length}</strong> aperte</span></Card>
    <div className="admin-order-master-detail"><section className="admin-order-master">
      {loading ? <EmptyState title="Caricamento pratiche" /> : null}{!loading && !visible.length ? <EmptyState title="Nessuna pratica" description="Non ci sono richieste per questo filtro." /> : null}
      {visible.map(ticket => <button key={ticket.id} className={selectedId === ticket.id ? "active" : ""} onClick={() => setSelectedId(ticket.id)} aria-label={`Apri pratica ${ticket.reference || ticket.id}`}><div><Badge>{statusLabels[ticket.status] || ticket.status}</Badge><strong>{ticket.subject}</strong><small>{ticket.reference || ticket.id} · {ticket.name} · {formatDate(ticket.createdAt)}</small></div><div><Badge>{priorityLabels[ticket.priority] || ticket.priority}</Badge><small>{ticket.orderId || "Senza ordine"}</small><span>{topicLabels[ticket.topic] || ticket.topic}</span></div></button>)}
    </section><section className="admin-order-detail">
      {!selected ? <Card className="admin-order-placeholder"><span>?</span><h3>Seleziona una pratica</h3><p>Apri una richiesta per leggerla, rispondere e aggiornarne lo stato.</p></Card> : <>
        <Card className="admin-order-detail-head"><div><Badge>{statusLabels[selected.status]}</Badge><h2>{selected.reference || selected.id}</h2><p>{selected.name} · {selected.email}</p></div><div><Badge>{priorityLabels[selected.priority]}</Badge><small>{formatDate(selected.createdAt, true)}</small></div></Card>
        <div className="admin-order-detail-grid"><Card><h3>Richiesta</h3><dl className="admin-order-data"><div><dt>Argomento</dt><dd>{topicLabels[selected.topic]}</dd></div><div><dt>Ordine</dt><dd>{selected.orderId || "Non indicato"}</dd></div><div><dt>Oggetto</dt><dd>{selected.subject}</dd></div></dl><p className="support-admin-message">{selected.message}</p></Card><Card><h3>Gestione</h3><Field label="Stato"><select className="ui-input" value={selected.status} disabled={saving} onChange={e => update({ status: e.target.value, priority: selected.priority })}>{Object.entries(statusLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Priorità"><select className="ui-input" value={selected.priority} disabled={saving} onChange={e => update({ status: selected.status, priority: e.target.value })}>{Object.entries(priorityLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></Field></Card></div>
        {(selected.replies || []).length ? <Card><h3>Risposte inviate</h3><div className="admin-react-message-list">{selected.replies.map((item, index) => <article className="admin" key={index}><div><strong>Assistenza DÈDICA</strong><small>{formatDate(item.createdAt, true)}</small></div><p>{item.text}</p></article>)}</div></Card> : null}
        <Card><form onSubmit={sendReply}><Field label="Rispondi al cliente"><Textarea rows="5" maxLength="2000" value={reply} onChange={e => setReply(e.target.value)} placeholder="Scrivi una risposta chiara con i prossimi passaggi..." /></Field><Button type="submit" disabled={saving || !reply.trim()}>{saving ? "Invio..." : "Invia risposta via email"}</Button></form></Card>
      </>}
    </section></div><Toast message={toast} />
  </div>;
}
function formatDate(value, time = false) { if (!value) return "—"; const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value); return date.toLocaleString("it-IT", time ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "short" }); }
