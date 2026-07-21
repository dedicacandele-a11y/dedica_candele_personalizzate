import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Field, InfoTip, Input, Toast } from "../../../components/index.js";
import { listAdminOrders } from "../../../services/orders.js";
import { deleteExpense, EXPENSE_AREAS, getFinanceSettings, listExpenses, saveExpense, saveFinanceSettings } from "../../../services/finance.js";

const emptyExpense = () => ({ description: "", amount: "", date: new Date().toISOString().slice(0, 10), area: "production", subareas: [], paidBy: "company", notes: "" });

export function AdminFinancePage() {
  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [settings, setSettings] = useState({ productionShare: 50, digitalShare: 50 });
  const [form, setForm] = useState(emptyExpense);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    if (!showExpenseForm) return undefined;
    const closeOnEscape = event => { if (event.key === "Escape") setShowExpenseForm(false); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [showExpenseForm]);
  async function refresh() { const [nextOrders, nextExpenses, nextSettings] = await Promise.all([listAdminOrders(), listExpenses(), getFinanceSettings()]); setOrders(nextOrders); setExpenses(nextExpenses); setSettings(nextSettings); }

  const periodExpenses = useMemo(() => expenses.filter(item => String(item.date).startsWith(period)), [expenses, period]);
  const revenue = useMemo(() => orders.filter(order => ["paid", "draft_sent", "revision_requested", "draft_approved", "in_production", "shipped"].includes(order.status) && orderDate(order).startsWith(period)).reduce((sum, order) => sum + Number(order.total || order.totals?.total || 0), 0), [orders, period]);
  const costs = periodExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const profit = revenue - costs;
  const distributable = Math.max(0, profit);
  const productionAmount = distributable * Number(settings.productionShare || 0) / 100;
  const digitalAmount = distributable * Number(settings.digitalShare || 0) / 100;

  function patch(field, value) { setForm(current => ({ ...current, [field]: value })); }
  function toggleSubarea(value) { setForm(current => ({ ...current, subareas: current.subareas.includes(value) ? current.subareas.filter(item => item !== value) : [...current.subareas, value] })); }

  async function submitExpense(event) { event.preventDefault(); try { await saveExpense(form); setForm(emptyExpense()); setShowExpenseForm(false); setToast("Spesa registrata IVA inclusa."); setExpenses(await listExpenses()); } catch (error) { setToast(error.message); } }
  async function removeExpense(id) { if (!confirm("Eliminare questa spesa?")) return; await deleteExpense(id); setExpenses(await listExpenses()); setToast("Spesa eliminata."); }
  async function updateShares(event) { event.preventDefault(); try { setSettings(await saveFinanceSettings(settings)); setToast("Percentuali aggiornate."); } catch (error) { setToast(error.message); } }

  return <div className="admin-react-stack finance-admin">
    <header className="admin-react-header"><div><span className="eyebrow">Controllo di gestione</span><h2>Finanze</h2><p>Ricavi e costi IVA inclusa, con ripartizione dell’utile secondo il Modello A.</p></div><div className="ui-actions"><Input type="month" value={period} onChange={event => setPeriod(event.target.value)} aria-label="Periodo finanziario" /><Button onClick={() => setShowExpenseForm(true)}>+ Registra spesa</Button></div></header>

    <section className="finance-summary-grid">
      <Metric label="Ricavi" value={revenue} help="Totale degli ordini pagati nel periodo, IVA inclusa." />
      <Metric label="Spese" value={costs} help="Costi registrati nel periodo, sempre IVA inclusa." negative />
      <Metric label="Utile distribuibile" value={distributable} help="Ricavi meno spese. Se il risultato è negativo, non viene distribuito nulla." />
      <Metric label="Margine" value={revenue ? profit / revenue * 100 : 0} help="Percentuale di utile rispetto ai ricavi." percent />
    </section>

    <section className="finance-split">
      <Card><div className="finance-share-heading"><div><Badge>Produzione</Badge><strong>{money(productionAmount)}</strong></div><span>{settings.productionShare}%</span></div><div className="finance-share-bar"><i style={{ width: `${settings.productionShare}%` }} /></div></Card>
      <Card><div className="finance-share-heading"><div><Badge>Digital e promozione</Badge><strong>{money(digitalAmount)}</strong></div><span>{settings.digitalShare}%</span></div><div className="finance-share-bar digital"><i style={{ width: `${settings.digitalShare}%` }} /></div></Card>
    </section>

    <Card><form className="finance-share-form" onSubmit={updateShares}><div><strong>Ripartizione utile</strong><p>Le percentuali sono modificabili, ma devono sempre sommare al 100%.</p></div><Field label="Produzione %" help="Quota dell’utile destinata al reparto che realizza le candele." example="50%"><Input type="number" min="0" max="100" value={settings.productionShare} onChange={event => setSettings(current => ({ ...current, productionShare: Number(event.target.value), digitalShare: 100 - Number(event.target.value) }))} /></Field><Field label="Digital %" help="Quota dell’utile destinata a sito, social e attività promozionali." example="50%"><Input type="number" min="0" max="100" value={settings.digitalShare} onChange={event => setSettings(current => ({ ...current, digitalShare: Number(event.target.value), productionShare: 100 - Number(event.target.value) }))} /></Field><Button type="submit">Salva percentuali</Button></form></Card>

    {showExpenseForm ? <div className="ui-overlay finance-expense-overlay" role="dialog" aria-modal="true" aria-labelledby="new-expense-title" onMouseDown={event => { if (event.target === event.currentTarget) setShowExpenseForm(false); }}><Card className="finance-expense-modal"><form className="admin-react-form finance-expense-form" onSubmit={submitExpense}><div className="admin-react-card-head"><div><Badge>IVA inclusa</Badge><h3 id="new-expense-title">Registra una nuova spesa</h3><small>Il costo sarà incluso nel rendiconto del mese selezionato dalla data.</small></div><Button type="button" variant="ghost" onClick={() => setShowExpenseForm(false)} aria-label="Chiudi registrazione spesa">×</Button></div><div className="ui-two-col"><Field label="Descrizione" help="Indica chiaramente cosa è stato acquistato." example="Cera vegetale 20 kg"><Input autoFocus required value={form.description} onChange={event => patch("description", event.target.value)} /></Field><Field label="Importo" help="Inserisci il totale effettivamente pagato, IVA compresa." example="148,50 €"><Input required type="number" min="0.01" step="0.01" value={form.amount} onChange={event => patch("amount", event.target.value)} /></Field></div><div className="ui-two-col"><Field label="Data"><Input required type="date" value={form.date} onChange={event => patch("date", event.target.value)} /></Field><Field label="Macro-area"><select className="ui-input" value={form.area} onChange={event => setForm(current => ({ ...current, area: event.target.value, subareas: [] }))}>{Object.entries(EXPENSE_AREAS).map(([id, area]) => <option key={id} value={id}>{area.label}</option>)}</select></Field></div><Field label="Sotto-aree" help="Spunta una o più voci per classificare meglio la spesa. Sono facoltative." example="Materie prime + Materiali di consumo" as="div"><div className="finance-subareas">{EXPENSE_AREAS[form.area].subareas.map(item => <label key={item}><input type="checkbox" checked={form.subareas.includes(item)} onChange={() => toggleSubarea(item)} /> {item}</label>)}</div></Field><Field label="Pagata da" help="Serve a distinguere un costo aziendale da una spesa anticipata da un reparto."><select className="ui-input" value={form.paidBy} onChange={event => patch("paidBy", event.target.value)}><option value="company">Società</option><option value="production">Anticipo Produzione</option><option value="digital">Anticipo Digital</option></select></Field><div className="finance-modal-actions"><Button type="button" variant="secondary" onClick={() => setShowExpenseForm(false)}>Annulla</Button><Button type="submit">Registra spesa</Button></div></form></Card></div> : null}

    <Card><div className="admin-react-card-head"><div><strong>Spese del periodo</strong><small>{periodExpenses.length} movimenti · {money(costs)}</small></div></div><div className="finance-expense-list">{periodExpenses.map(expense => <div key={expense.id}><span className="finance-expense-icon">{EXPENSE_AREAS[expense.area]?.label.slice(0, 1)}</span><div><strong>{expense.description}</strong><small>{EXPENSE_AREAS[expense.area]?.label} · {expense.subareas.join(", ") || "Nessuna sotto-area"} · {expense.date}</small></div><Badge>{expense.paidBy === "company" ? "Società" : `Anticipo ${expense.paidBy}`}</Badge><strong>{money(expense.amount)}</strong><Button variant="ghost" onClick={() => removeExpense(expense.id)}>Elimina</Button></div>)}{periodExpenses.length === 0 ? <p className="admin-react-help">Nessuna spesa registrata per questo periodo.</p> : null}</div></Card>
    <Toast message={toast} />
  </div>;
}

function Metric({ label, value, help, percent = false, negative = false }) { return <Card><span>{label} <InfoTip title={label}>{help}</InfoTip></span><strong className={negative ? "negative" : ""}>{percent ? `${Number(value).toFixed(1).replace(".", ",")}%` : money(value)}</strong></Card>; }
function money(value) { return `${Number(value || 0).toFixed(2).replace(".", ",")} €`; }
function orderDate(order) { const value = order.paidAt || order.createdAt || ""; return typeof value?.toDate === "function" ? value.toDate().toISOString() : String(value); }
