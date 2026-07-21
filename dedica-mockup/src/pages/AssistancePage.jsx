import { useState } from "react";
import { Badge, Button, Card, Field, Input, Textarea, Toast } from "../components/index.js";
import { createSupportTicket } from "../services/support.js";

const topics = [
  ["order", "Ordine e pagamento"], ["draft", "Bozza e personalizzazione"], ["shipping", "Spedizione e tracking"],
  ["transport_damage", "Prodotto danneggiato"], ["returns", "Resi e garanzia"], ["other", "Altro"],
];

const faqs = [
  ["Quando riceverò la bozza?", "Dopo la conferma del pagamento prepariamo la bozza digitale. La troverai nell’Area personale e riceverai un avviso via email."],
  ["Posso modificare una bozza?", "Sì. Prima dell’approvazione puoi richiedere una modifica direttamente dall’ordine. Dopo l’approvazione la produzione può essere già iniziata."],
  ["Come controllo la spedizione?", "Quando l’ordine viene spedito, corriere e tracking compaiono nell’Area personale."],
  ["La candela è arrivata danneggiata: cosa faccio?", "Non accenderla. Conserva prodotto, pacco ed etichetta e apri una pratica scegliendo “Prodotto danneggiato”. Ti chiederemo le fotografie utili."],
  ["Posso restituire una candela personalizzata?", "Non per semplice ripensamento, perché è realizzata su misura. Restano validi tutti i diritti in caso di difetto, non conformità o danno da trasporto."],
  ["Quanto tempo impiega l’assistenza?", "Rispondiamo normalmente entro due giorni lavorativi. I casi di sicurezza e danno da trasporto ricevono priorità."],
];

const emptyForm = { name: "", email: "", orderId: "", topic: "order", subject: "", message: "", consent: false, website: "" };

export function AssistancePage({ onOpenHome }) {
  const [form, setForm] = useState(emptyForm);
  const [sending, setSending] = useState(false);
  const [ticketId, setTicketId] = useState("");
  const [toast, setToast] = useState("");

  function patch(field, value) { setForm(current => ({ ...current, [field]: value })); }

  async function submit(event) {
    event.preventDefault();
    if (!form.consent) return setToast("Conferma di aver letto l’informativa privacy.");
    setSending(true);
    try {
      const result = await createSupportTicket(form);
      setTicketId(result.ticketId);
      setForm(emptyForm);
      setToast("Richiesta inviata correttamente.");
    } catch (error) { setToast(error.message || "Invio della richiesta non riuscito."); }
    finally { setSending(false); }
  }

  return <main className="support-page">
    <section className="support-hero"><div><Badge>Centro assistenza</Badge><h1>Come possiamo aiutarti?</h1><p>Segui un ordine, trova una risposta oppure apri una pratica: ogni richiesta resta tracciata fino alla soluzione.</p><div className="ui-actions"><Button as="a" href="/account">Apri i miei ordini</Button><Button variant="secondary" onClick={onOpenHome}>Torna alla Home</Button></div></div><aside><strong>Tempi di risposta</strong><span>Entro 2 giorni lavorativi</span><small>Danni e problemi di sicurezza hanno priorità.</small></aside></section>

    <section className="support-shortcuts" aria-label="Azioni rapide">
      <a href="/account"><span>01</span><strong>Segui un ordine</strong><small>Stato, bozza, messaggi e tracking</small></a>
      <a href="/spedizioni-resi"><span>02</span><strong>Resi e garanzia</strong><small>Difetti, danni e prodotti personalizzati</small></a>
      <a href="#apri-pratica"><span>03</span><strong>Apri una pratica</strong><small>Ricevi un codice di assistenza</small></a>
    </section>

    <section className="support-main">
      <div className="support-faq"><span className="eyebrow">Risposte rapide</span><h2>Domande frequenti</h2>{faqs.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>

      <Card className="support-ticket-card" id="apri-pratica">
        {ticketId ? <div className="support-ticket-success"><span>✓</span><Badge>Richiesta ricevuta</Badge><h2>Pratica {ticketId}</h2><p>Abbiamo inviato una conferma all’indirizzo indicato. Conserva questo codice per le comunicazioni.</p><Button onClick={() => setTicketId("")}>Apri un’altra pratica</Button></div> : <form onSubmit={submit}>
          <span className="eyebrow">Contatta DÈDICA</span><h2>Apri una pratica</h2><p>Se la richiesta riguarda un ordine, inserisci il numero per aiutarci a rispondere più velocemente.</p>
          <div className="ui-two-col"><Field label="Nome e cognome"><Input required maxLength="160" value={form.name} onChange={e => patch("name", e.target.value)} /></Field><Field label="Email"><Input required type="email" maxLength="180" value={form.email} onChange={e => patch("email", e.target.value)} /></Field></div>
          <div className="ui-two-col"><Field label="Argomento"><select className="ui-input" value={form.topic} onChange={e => patch("topic", e.target.value)}>{topics.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Numero ordine" hint="Facoltativo"><Input maxLength="120" value={form.orderId} onChange={e => patch("orderId", e.target.value)} placeholder="Es. DEC-..." /></Field></div>
          <Field label="Oggetto"><Input required maxLength="160" value={form.subject} onChange={e => patch("subject", e.target.value)} /></Field>
          <Field label="Descrivi il problema" hint="Massimo 2.000 caratteri"><Textarea required rows="6" maxLength="2000" value={form.message} onChange={e => patch("message", e.target.value)} placeholder="Indica cosa è successo e quando. Per un danno, conserva pacco ed etichetta di spedizione." /></Field>
          <label className="support-honeypot" aria-hidden="true">Sito web<input tabIndex="-1" autoComplete="off" value={form.website} onChange={e => patch("website", e.target.value)} /></label>
          <label className="ui-check"><input type="checkbox" checked={form.consent} onChange={e => patch("consent", e.target.checked)} required /> Confermo di aver letto la <a href="/privacy" target="_blank" rel="noreferrer">privacy policy</a>. Il trattamento necessario a gestire la richiesta si basa sull’esecuzione del servizio e non sul consenso.</label>
          <Button type="submit" disabled={sending}>{sending ? "Invio in corso..." : "Invia richiesta"}</Button>
        </form>}
      </Card>
    </section>
    <Toast message={toast} />
  </main>;
}
