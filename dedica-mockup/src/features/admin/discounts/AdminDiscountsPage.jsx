import { useEffect, useState } from "react";
import { Button, Card, EmptyState, Field, Input, Toast } from "../../../components/index.js";
import { deleteDiscount, listDiscounts, saveDiscount } from "../../../services/discounts.js";

const emptyDiscount = { code: "", value: 10, active: true };

export function AdminDiscountsPage() {
  const [discounts, setDiscounts] = useState([]);
  const [form, setForm] = useState(emptyDiscount);
  const [toast, setToast] = useState("");

  useEffect(() => {
    refreshDiscounts();
  }, []);

  async function refreshDiscounts() {
    setDiscounts(await listDiscounts());
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await saveDiscount(form);
    setToast("Codice promo salvato.");
    setForm(emptyDiscount);
    await refreshDiscounts();
  }

  async function removeDiscount(code) {
    await deleteDiscount(code);
    setToast("Codice promo eliminato.");
    await refreshDiscounts();
  }

  return (
    <div className="admin-react-stack">
      <header className="admin-react-header">
        <div>
          <span className="eyebrow">Promozioni</span>
          <h2>Codici promo</h2>
          <p>Gestione React iniziale dei codici percentuali.</p>
        </div>
      </header>

      <Card>
        <form className="admin-react-form" onSubmit={handleSubmit}>
          <div className="ui-two-col">
            <Field label="Codice">
              <Input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} />
            </Field>
            <Field label="Sconto %">
              <Input type="number" min="1" max="90" required value={form.value} onChange={(event) => setForm({ ...form, value: Number(event.target.value || 0) })} />
            </Field>
          </div>
          <label className="admin-react-toggle">
            <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
            Codice attivo
          </label>
          <div className="ui-actions">
            <Button type="submit">Salva codice</Button>
            <Button type="button" variant="secondary" onClick={() => setForm(emptyDiscount)}>Annulla</Button>
          </div>
        </form>
      </Card>

      {discounts.length === 0 ? <EmptyState title="Nessun codice promo" /> : null}
      <div className="admin-react-category-grid">
        {discounts.map(discount => (
          <Card key={discount.code}>
            <div className="admin-react-card-head">
              <div>
                <strong>{discount.code}</strong>
                <small>{discount.value}% · {discount.active ? "attivo" : "disattivato"}</small>
              </div>
              <div className="ui-actions">
                <Button type="button" variant="secondary" onClick={() => setForm(discount)}>Modifica</Button>
                <Button type="button" variant="ghost" onClick={() => removeDiscount(discount.code)}>Elimina</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Toast message={toast} />
    </div>
  );
}
