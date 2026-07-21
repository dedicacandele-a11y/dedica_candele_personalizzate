import { useEffect, useState } from "react";
import { Badge, Button, Card, Field, Input, Toast } from "../../../components/index.js";
import { getShippingSettings, saveShippingSettings } from "../../../services/shipping.js";
import { listAdminOrders, updateOrderShipment } from "../../../services/orders.js";
import { checkSpediamoConnection } from "../../../services/spediamo.js";

export function AdminShippingPage() {
  const [settings, setSettings] = useState(null);
  const [orders, setOrders] = useState([]);
  const [section, setSection] = useState("shipments");
  const [forms, setForms] = useState({});
  const [toast, setToast] = useState("");
  const [spediamo, setSpediamo] = useState({ checking: false, result: null });

  useEffect(() => {
    Promise.all([getShippingSettings(), listAdminOrders()]).then(([shippingSettings, adminOrders]) => {
      setSettings(shippingSettings);
      setOrders(adminOrders);
    });
  }, []);

  if (!settings) return <p>Caricamento spedizioni...</p>;

  function patchRate(index, patch) {
    setSettings(current => ({
      ...current,
      rates: current.rates.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    }));
  }

  function patchFree(patch) {
    setSettings(current => ({
      ...current,
      freeRules: current.freeRules.map((item, index) => index === 0 ? { ...item, ...patch } : item),
    }));
  }

  async function save() {
    setSettings(await saveShippingSettings(settings));
    setToast("Regole di spedizione salvate.");
  }

  async function checkConnection() {
    setSpediamo({ checking: true, result: null });
    try {
      const result = await checkSpediamoConnection();
      setSpediamo({ checking: false, result });
      setToast(result.connected ? "Spediamo.it è collegato correttamente." : result.message);
    } catch (error) {
      setSpediamo({ checking: false, result: { connected: false } });
      setToast(error?.message || "Connessione a Spediamo.it non riuscita.");
    }
  }

  async function ship(order) {
    const data = forms[order.id] || {};
    if (!data.carrierName || !data.trackingCode) return setToast("Inserisci corriere e tracking riportati da Spediamo.it.");
    await updateOrderShipment(order.id, {
      ...data,
      trackingUrl: data.trackingUrl || "",
      actualCost: Number(data.actualCost || 0),
    });
    setOrders(await listAdminOrders());
    setToast("Ordine spedito e tracking registrato.");
  }

  const readyOrders = orders.filter(order => ["draft_approved", "in_production"].includes(order.status));
  const remoteDrafts = spediamo.result?.drafts || [];

  return <div className="admin-react-stack">
    <header className="admin-react-header">
      <div>
        <span className="eyebrow">Logistica</span>
        <h2>Spedizioni</h2>
        <p>Spediamo.it gestisce corrieri e spedizioni; qui definisci soltanto le regole del negozio.</p>
        {spediamo.result?.connected ? <small>Spediamo.it collegato · {spediamo.result.draftCount} bozze</small> : null}
      </div>
      <div className="ui-actions">
        <Button variant={section === "shipments" ? "primary" : "secondary"} onClick={() => setSection("shipments")}>Da spedire</Button>
        <Button variant={section === "settings" ? "primary" : "secondary"} onClick={() => setSection("settings")}>Regole e costi</Button>
        <Button variant="secondary" disabled={spediamo.checking} onClick={checkConnection}>{spediamo.checking ? "Verifica..." : "Verifica Spediamo.it"}</Button>
      </div>
    </header>

    {section === "settings" ? <>
      <Card>
        <div className="admin-react-card-head">
          <div>
            <Badge>Gestito automaticamente</Badge>
            <h3>Corrieri e servizi</h3>
            <p>Non devi configurare GLS, BRT o altri corrieri. Saranno determinati dalla spedizione acquistata su Spediamo.it.</p>
          </div>
        </div>
      </Card>
      <Card>
        <h3>Spedizione gratuita</h3>
        <p>Regola commerciale applicata al cliente nel checkout.</p>
        <div className="ui-two-col">
          <Field label="Importo minimo"><Input type="number" value={settings.freeRules[0]?.minAmount || 0} onChange={event => patchFree({ minAmount: Number(event.target.value) })} /></Field>
          <Field label="Quantità massima"><Input type="number" value={settings.freeRules[0]?.maxQuantity || 0} onChange={event => patchFree({ maxQuantity: Number(event.target.value) })} /></Field>
          <Field label="Peso massimo (g)"><Input type="number" value={settings.freeRules[0]?.maxWeightGrams || 0} onChange={event => patchFree({ maxWeightGrams: Number(event.target.value) })} /></Field>
          <Field label="Peso imballaggio ordine (g)"><Input type="number" value={settings.packagingWeightGrams || 0} onChange={event => setSettings(current => ({ ...current, packagingWeightGrams: Number(event.target.value) }))} /></Field>
        </div>
      </Card>
      <Card>
        <h3>Costi mostrati al cliente · IVA inclusa</h3>
        <p>Queste fasce restano attive finché Spediamo.it non fornisce un endpoint documentato per i preventivi in tempo reale.</p>
        <div className="shipping-rate-editor">
          {settings.rates.map((rate, index) => <div key={rate.id}>
            <Field label="Nome fascia"><Input value={rate.label} onChange={event => patchRate(index, { label: event.target.value })} /></Field>
            <Field label="Quantità max"><Input type="number" value={rate.maxQuantity} onChange={event => patchRate(index, { maxQuantity: Number(event.target.value) })} /></Field>
            <Field label="Peso max (g)"><Input type="number" value={rate.maxWeightGrams} onChange={event => patchRate(index, { maxWeightGrams: Number(event.target.value) })} /></Field>
            <Field label="Costo IVA inclusa"><Input type="number" step="0.01" value={rate.price} onChange={event => patchRate(index, { price: Number(event.target.value) })} /></Field>
          </div>)}
        </div>
        <Button onClick={save}>Salva regole e costi</Button>
      </Card>
    </> : <div className="admin-react-order-list">
      <Card>
        <div className="admin-react-card-head"><div><Badge>Spediamo.it</Badge><h3>Bozze sul tuo account</h3><p>{spediamo.result?.connected ? `${remoteDrafts.length} bozze lette dalle API.` : "Usa Verifica Spediamo.it per sincronizzare le bozze."}</p></div><Button variant="secondary" disabled={spediamo.checking} onClick={checkConnection}>{spediamo.checking ? "Sincronizzazione..." : "Sincronizza bozze"}</Button></div>
        {remoteDrafts.length ? <div className="spediamo-draft-list">{remoteDrafts.map((draft, index) => { const matchedOrder = orders.find(order => draft.reference && (draft.reference.includes(order.id) || order.id.includes(draft.reference))); return <div key={draft.id || index}><div><strong>{draft.recipientName || `Bozza ${draft.id || index + 1}`}</strong><small>{draft.recipientCity || "Località non disponibile"} · {draft.reference || "Nessun riferimento ordine"}</small></div>{matchedOrder ? <Badge>Ordine #{matchedOrder.id.slice(-8)}</Badge> : <span>Non associata</span>}</div>; })}</div> : null}
      </Card>
      {readyOrders.map(order => <Card key={order.id}>
        <div className="admin-react-card-head">
          <div><Badge>Da spedire</Badge><strong>#{order.id}</strong><small>{order.email} · {order.items?.reduce((sum, item) => sum + Number(item.qty || 1), 0)} pezzi</small></div>
          <strong>{Number(order.shipping || 0).toFixed(2).replace(".", ",")} € addebitati</strong>
        </div>
        <p>Copia questi dati dalla spedizione acquistata nel pannello Spediamo.it. L’importazione automatica sarà attivata quando saranno disponibili gli endpoint completi.</p>
        <div className="shipping-fulfillment-form">
          <Field label="Corriere assegnato"><Input value={forms[order.id]?.carrierName || ""} onChange={event => setForms(current => ({ ...current, [order.id]: { ...current[order.id], carrierName: event.target.value } }))} /></Field>
          <Field label="Codice tracking"><Input value={forms[order.id]?.trackingCode || ""} onChange={event => setForms(current => ({ ...current, [order.id]: { ...current[order.id], trackingCode: event.target.value } }))} /></Field>
          <Field label="URL tracking"><Input value={forms[order.id]?.trackingUrl || ""} onChange={event => setForms(current => ({ ...current, [order.id]: { ...current[order.id], trackingUrl: event.target.value } }))} /></Field>
          <Field label="Costo reale IVA inclusa"><Input type="number" step="0.01" value={forms[order.id]?.actualCost || ""} onChange={event => setForms(current => ({ ...current, [order.id]: { ...current[order.id], actualCost: event.target.value } }))} /></Field>
          <Button onClick={() => ship(order)}>Conferma spedizione</Button>
        </div>
      </Card>)}
      {readyOrders.length === 0 ? <Card><p>Nessun ordine pronto per la spedizione.</p></Card> : null}
    </div>}
    <Toast message={toast} />
  </div>;
}
