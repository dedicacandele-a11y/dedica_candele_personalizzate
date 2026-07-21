import { useEffect, useState } from "react";
import { Badge, Button, Card, Field, Input, Textarea, Toast } from "../../../components/index.js";
import { deleteCatalogOption, listCatalogOptions, OPTION_TYPES, saveCatalogOption } from "../../../services/catalogOptions.js";

export function AdminCatalogOptionsPage() {
  const [items, setItems] = useState([]);
  const [type, setType] = useState("fragrance");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [toast, setToast] = useState("");
  useEffect(() => { refresh(); }, []);
  async function refresh() { setItems(await listCatalogOptions({ includeInactive: true })); }
  async function submit(event) { event.preventDefault(); try { await saveCatalogOption({ type, label, description, active: true }); setLabel(""); setDescription(""); await refresh(); setToast("Opzione aggiunta al catalogo."); } catch (error) { setToast(error.message); } }
  async function remove(id) { if (!confirm("Eliminare questa opzione centralizzata? I prodotti già salvati manterranno il valore.")) return; await deleteCatalogOption(id); await refresh(); setToast("Opzione eliminata."); }
  return <div className="admin-react-stack">
    <header className="admin-react-header"><div><span className="eyebrow">Archivio centralizzato</span><h2>Fragranze, cere e formati</h2><p>Crea una volta le opzioni riutilizzabili e selezionale nei singoli prodotti.</p></div></header>
    <Card><form className="catalog-option-create" onSubmit={submit}><Field label="Tipo"><select className="ui-input" value={type} onChange={event => setType(event.target.value)}>{Object.entries(OPTION_TYPES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></Field><Field label="Nome"><Input required value={label} onChange={event => setLabel(event.target.value)} /></Field><Field label="Descrizione" hint="Facoltativa"><Textarea rows="3" value={description} onChange={event => setDescription(event.target.value)} /></Field><Button type="submit">Aggiungi</Button></form></Card>
    <div className="catalog-option-columns">{Object.entries(OPTION_TYPES).map(([typeId, name]) => <Card key={typeId}><div className="admin-react-card-head"><strong>{name}</strong><Badge>{items.filter(item => item.type === typeId).length}</Badge></div><div className="catalog-option-list">{items.filter(item => item.type === typeId).map(item => <div key={item.id}><span><strong>{item.label}</strong>{item.description ? <small>{item.description}</small> : null}</span><Button variant="ghost" onClick={() => remove(item.id)}>Elimina</Button></div>)}{items.filter(item => item.type === typeId).length === 0 ? <p>Nessuna voce.</p> : null}</div></Card>)}</div><Toast message={toast} />
  </div>;
}
