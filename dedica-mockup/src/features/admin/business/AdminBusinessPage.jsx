import { useEffect, useState } from "react";
import { Badge, Button, Card, Field, Input, Toast } from "../../../components/index.js";
import { EMPTY_BUSINESS_SETTINGS, getBusinessSettings, saveBusinessSettings } from "../../../services/businessSettings.js";

export function AdminBusinessPage() {
  const [form, setForm] = useState(EMPTY_BUSINESS_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => { getBusinessSettings().then(setForm).finally(() => setLoading(false)); }, []);
  function patch(key, value) { setForm(current => ({ ...current, [key]: value })); }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      setForm(await saveBusinessSettings(form));
      setToast("Dati aziendali salvati e pubblicati nel footer.");
    } catch (error) {
      setToast(error?.message || "Salvataggio non riuscito.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Caricamento dati aziendali...</p>;
  return <div className="admin-react-stack">
    <header className="admin-react-header"><div><span className="eyebrow">Impostazioni</span><h2>Dati aziendali</h2><p>Questi dati vengono mostrati nel footer pubblico del sito.</p></div></header>
    <Card>
      <form className="admin-react-form" onSubmit={submit}>
        <Badge>Identità fiscale</Badge>
        <Field label="Ragione sociale"><Input required value={form.businessName} onChange={event => patch("businessName", event.target.value)} placeholder="Es. DÈDICA di Mario Rossi" /></Field>
        <div className="ui-two-col">
          <Field label="Partita IVA"><Input required value={form.vatNumber} onChange={event => patch("vatNumber", event.target.value)} /></Field>
          <Field label="Codice fiscale"><Input value={form.taxCode} onChange={event => patch("taxCode", event.target.value)} /></Field>
        </div>
        <Field label="Indirizzo sede"><Input required value={form.address} onChange={event => patch("address", event.target.value)} placeholder="Via e numero civico" /></Field>
        <div className="ui-two-col">
          <Field label="CAP"><Input required value={form.postalCode} onChange={event => patch("postalCode", event.target.value)} /></Field>
          <Field label="Città"><Input required value={form.city} onChange={event => patch("city", event.target.value)} /></Field>
        </div>
        <div className="ui-two-col">
          <Field label="Provincia"><Input required maxLength="2" value={form.province} onChange={event => patch("province", event.target.value.toUpperCase())} /></Field>
          <Field label="Paese"><Input required value={form.country} onChange={event => patch("country", event.target.value)} /></Field>
        </div>
        <Badge>Contatti e registrazione</Badge>
        <div className="ui-two-col">
          <Field label="Email"><Input type="email" value={form.email} onChange={event => patch("email", event.target.value)} /></Field>
          <Field label="Telefono"><Input type="tel" value={form.phone} onChange={event => patch("phone", event.target.value)} /></Field>
        </div>
        <div className="ui-two-col">
          <Field label="PEC"><Input type="email" value={form.pec} onChange={event => patch("pec", event.target.value)} /></Field>
          <Field label="REA"><Input value={form.rea} onChange={event => patch("rea", event.target.value)} /></Field>
        </div>
        <Button type="submit" disabled={saving}>{saving ? "Salvataggio..." : "Salva e pubblica"}</Button>
      </form>
    </Card>
    <Toast message={toast} />
  </div>;
}
