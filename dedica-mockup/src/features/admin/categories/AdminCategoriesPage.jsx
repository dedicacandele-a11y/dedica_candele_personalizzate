import { useEffect, useMemo, useState } from "react";
import { Button, Card, EmptyState, Field, Input, Textarea, Toast } from "../../../components/index.js";
import { deleteCategory, listCategories, saveCategory } from "../../../services/categories.js";
import { normalizeCategory, slugify } from "../../../../catalog-taxonomy.js";

const emptyForm = {
  id: "",
  name: "",
  slug: "",
  description: "",
  subcategories: [],
  active: true,
  sortOrder: 0
};

export function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [categories]
  );

  useEffect(() => {
    refreshCategories();
  }, []);

  async function refreshCategories() {
    setLoading(true);
    const nextCategories = await listCategories({ includeInactive: true });
    setCategories(nextCategories);
    setLoading(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const category = normalizeCategory({
      id: form.id || slugify(form.slug || form.name),
      name: form.name,
      slug: form.slug || form.name,
      description: form.description,
      subcategories: form.subcategories.map(item => item.trim()).filter(Boolean),
      active: form.active,
      sortOrder: Number(form.sortOrder || 0)
    });

    await saveCategory(category);
    setToast("Categoria salvata.");
    setForm(emptyForm);
    await refreshCategories();
  }

  function editCategory(category) {
    setForm({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description || "",
      subcategories: category.subcategories || [],
      active: category.active,
      sortOrder: category.sortOrder || 0
    });
  }

  async function removeCategory(categoryId) {
    if (!confirm("Eliminare questa categoria?")) return;
    await deleteCategory(categoryId);
    setToast("Categoria eliminata.");
    await refreshCategories();
  }

  function addSubcategory() {
    setForm(current => ({ ...current, subcategories: [...current.subcategories, ""] }));
  }

  function updateSubcategory(index, value) {
    setForm(current => ({ ...current, subcategories: current.subcategories.map((item, itemIndex) => itemIndex === index ? value : item) }));
  }

  function removeSubcategory(index) {
    setForm(current => ({ ...current, subcategories: current.subcategories.filter((_, itemIndex) => itemIndex !== index) }));
  }

  return (
    <div className="admin-react-stack">
      <header className="admin-react-header">
        <div>
          <span className="eyebrow">Catalogo centralizzato</span>
          <h2>Categorie e sottocategorie</h2>
          <p>Queste voci alimentano prodotti, homepage e configuratore.</p>
        </div>
      </header>

      <Card>
        <form className="admin-react-form" onSubmit={handleSubmit}>
          <div className="ui-two-col">
            <Field label="Nome categoria">
              <Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </Field>
            <Field label="Slug">
              <Input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder={slugify(form.name)} />
            </Field>
          </div>
          <Field label="Descrizione">
            <Textarea rows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </Field>
          <Field label="Sottocategorie" hint="Facoltative. Aggiungile soltanto quando aiutano a organizzare i prodotti." as="div">
            <div className="admin-react-subcategory-editor">
              {form.subcategories.length === 0 ? <p>Nessuna sottocategoria. La categoria potrà contenere direttamente i prodotti.</p> : null}
              {form.subcategories.map((subcategory, index) => <div key={index}>
                <Input value={subcategory} onChange={(event) => updateSubcategory(index, event.target.value)} placeholder={`Sottocategoria ${index + 1}`} aria-label={`Sottocategoria ${index + 1}`} />
                <Button type="button" variant="ghost" onClick={() => removeSubcategory(index)}>Rimuovi</Button>
              </div>)}
              <Button type="button" variant="secondary" onClick={addSubcategory}>+ Aggiungi sottocategoria</Button>
            </div>
          </Field>
          <div className="ui-two-col">
            <Field label="Ordine">
              <Input type="number" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value || 0) })} />
            </Field>
            <label className="admin-react-toggle">
              <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
              Attiva nel front
            </label>
          </div>
          <div className="ui-actions">
            <Button type="submit">{form.id ? "Salva modifiche" : "Crea categoria"}</Button>
            <Button type="button" variant="secondary" onClick={() => setForm(emptyForm)}>Annulla</Button>
          </div>
        </form>
      </Card>

      {loading ? <EmptyState title="Caricamento categorie" /> : null}
      {!loading && sortedCategories.length === 0 ? <EmptyState title="Nessuna categoria" description="Crea la prima categoria per alimentare il catalogo." /> : null}

      <div className="admin-react-category-grid">
        {sortedCategories.map(category => (
          <Card key={category.id}>
            <div className="admin-react-card-head">
              <div>
                <strong>{category.name}</strong>
                <small>{category.active ? "Attiva" : "Nascosta"} · ordine {category.sortOrder}</small>
              </div>
              <div className="ui-actions">
                <Button type="button" variant="secondary" onClick={() => editCategory(category)}>Modifica</Button>
                <Button type="button" variant="ghost" onClick={() => removeCategory(category.id)}>Elimina</Button>
              </div>
            </div>
            <p>{category.description || "Nessuna descrizione."}</p>
            <div className="ui-chip-grid">
              {category.subcategories.map(subcategory => (
                <span className="ui-chip" key={subcategory}>{subcategory}</span>
              ))}
              {category.subcategories.length === 0 ? <span className="ui-chip">Nessuna sottocategoria</span> : null}
            </div>
          </Card>
        ))}
      </div>

      <Toast message={toast} />
    </div>
  );
}
