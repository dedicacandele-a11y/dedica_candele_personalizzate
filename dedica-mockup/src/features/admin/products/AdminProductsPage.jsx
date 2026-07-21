import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  CategoryPicker,
  EmptyState,
  Field,
  ImageUploader,
  InfoTip,
  Input,
  OptionBuilder,
  PersonalizationBuilder,
  ProductAttributeSelector,
  SubcategoryPicker,
  Textarea,
  Toast
} from "../../../components/index.js";
import { listCategories } from "../../../services/categories.js";
import { deleteProduct, listProducts, saveProduct } from "../../../services/products.js";
import { uploadCatalogImage } from "../../../services/storage.js";
import { listCatalogOptions } from "../../../services/catalogOptions.js";
import { emptyProductForm, formToProduct, productToForm } from "./productFormModel.js";

const PRODUCT_DRAFT_PREFIX = "dedica_product_draft_";

export function AdminProductsPage() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [catalogOptions, setCatalogOptions] = useState([]);
  const [form, setForm] = useState(emptyProductForm);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorSection, setEditorSection] = useState("info");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [draftStatus, setDraftStatus] = useState("");
  const [pendingDraft, setPendingDraft] = useState(null);
  const [autosavePaused, setAutosavePaused] = useState(false);

  const selectedCategory = useMemo(
    () => categories.find(category => category.id === form.category) || categories[0],
    [categories, form.category]
  );
  const filteredProducts = useMemo(() => products.filter(product => {
    const matchesSearch = `${product.name} ${product.desc}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (categoryFilter === "all" || product.category === categoryFilter);
  }), [categoryFilter, products, search]);

  useEffect(() => {
    refreshData();
  }, []);

  useEffect(() => {
    if (!editorOpen || autosavePaused) return undefined;
    setDraftStatus("Salvataggio bozza...");
    const timer = window.setTimeout(() => {
      const key = getDraftKey(form.id);
      localStorage.setItem(key, JSON.stringify({ form, savedAt: new Date().toISOString() }));
      setDraftStatus("Bozza salvata");
    }, 800);
    return () => window.clearTimeout(timer);
  }, [autosavePaused, editorOpen, form]);

  useEffect(() => {
    if (!editorOpen) return undefined;
    const warnBeforeExit = event => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warnBeforeExit);
    return () => window.removeEventListener("beforeunload", warnBeforeExit);
  }, [editorOpen]);

  async function refreshData() {
    setLoading(true);
    const [nextCategories, nextProducts, nextOptions] = await Promise.all([
      listCategories({ includeInactive: false }),
      listProducts(),
      listCatalogOptions()
    ]);
    setCategories(nextCategories);
    setProducts(nextProducts);
    setCatalogOptions(nextOptions);
    setForm(productToForm(null, nextCategories));
    setLoading(false);
  }

  function patchForm(patch) {
    setForm(current => ({ ...current, ...patch }));
  }

  function patchCustomization(patch) {
    setForm(current => ({
      ...current,
      customization: {
        ...current.customization,
        ...patch
      }
    }));
  }

  function patchDetails(patch) {
    setForm(current => ({
      ...current,
      details: {
        ...current.details,
        ...patch
      }
    }));
  }
  function patchLogistics(patch) { setForm(current => ({ ...current, logistics: { ...current.logistics, ...patch } })); }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.category || (selectedCategory?.subcategories?.length > 0 && !form.occasion)) {
      setToast("Seleziona categoria e sottocategoria.");
      return;
    }

    try {
      const requested = formToProduct(form);
      const saved = await saveProduct(requested);
      const nextProducts = await listProducts();
      const persisted = nextProducts.find(product => product.id === saved.id);
      if (!persisted) throw new Error("Il prodotto non risulta nel catalogo dopo il salvataggio.");
      if (persisted.category !== requested.category || persisted.occasion !== requested.occasion) {
        throw new Error("Categoria o sottocategoria non sono state salvate. Riprova.");
      }

      const sameSelections = key => {
        const expected = [...(requested.details?.[key] || [])].sort();
        const actual = [...(persisted.details?.[key] || [])].sort();
        return JSON.stringify(expected) === JSON.stringify(actual);
      };
      if (!["fragrances", "colors", "waxes"].every(sameSelections)) {
        throw new Error("Alcune opzioni del prodotto non sono state salvate. Riprova.");
      }
      localStorage.removeItem(getDraftKey(form.id));
      setProducts(nextProducts);
      setForm(productToForm(null, categories));
      setEditorOpen(false);
      setToast("Prodotto salvato correttamente.");
    } catch (error) {
      console.error("Salvataggio prodotto fallito:", error);
      setToast(error.message || "Salvataggio non riuscito. Riprova.");
    }
  }

  async function handleImageUpload(file) {
    if (!file) return;
    setUploading(true);

    try {
      const imageUrl = await uploadCatalogImage(file);
      patchForm({
        image: imageUrl
      });
      setToast("Immagine caricata e collegata al prodotto.");
    } catch (error) {
      console.error("Upload immagine prodotto fallito:", error);
      setToast("Upload non riuscito. Riprova o usa un URL.");
    } finally {
      setUploading(false);
    }
  }

  async function handleGalleryUpload(files) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const imageUrls = await Promise.all(files.map(uploadCatalogImage));
      patchForm({ gallery: [...form.gallery, ...imageUrls].filter((item, index, items) => item && items.indexOf(item) === index) });
      setToast(`${imageUrls.length} ${imageUrls.length === 1 ? "immagine aggiunta" : "immagini aggiunte"} alla galleria.`);
    } catch (error) {
      console.error("Upload galleria prodotto fallito:", error);
      setToast("Upload della galleria non riuscito.");
    } finally {
      setUploading(false);
    }
  }

  function removeGalleryImage(imageUrl) {
    patchForm({ gallery: form.gallery.filter(item => item !== imageUrl) });
  }

  async function removeProduct(productId) {
    if (!confirm("Eliminare questo prodotto?")) return;
    await deleteProduct(productId);
    setToast("Prodotto eliminato.");
    setProducts(await listProducts());
  }

  function editProduct(product) {
    openEditorWithDraft(productToForm(product, categories), product.id);
    setEditorSection("info");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function createProduct() {
    openEditorWithDraft(productToForm(null, categories), "new");
    setEditorSection("info");
  }

  function closeEditor() {
    setForm(productToForm(null, categories));
    setEditorOpen(false);
    setPendingDraft(null);
    setDraftStatus("");
  }

  function openEditorWithDraft(cleanForm, id) {
    const key = getDraftKey(id);
    const stored = localStorage.getItem(key);
    setForm(cleanForm);
    setEditorOpen(true);
    setDraftStatus("");
    if (stored) {
      try { setPendingDraft({ key, ...JSON.parse(stored) }); setAutosavePaused(true); }
      catch { localStorage.removeItem(key); setPendingDraft(null); setAutosavePaused(false); }
    } else { setPendingDraft(null); setAutosavePaused(false); }
  }

  function resumeDraft() {
    setForm(productToForm(pendingDraft.form, categories));
    setPendingDraft(null);
    setAutosavePaused(false);
    setDraftStatus("Bozza ripristinata");
  }

  function discardDraft() {
    if (pendingDraft?.key) localStorage.removeItem(pendingDraft.key);
    setPendingDraft(null);
    setAutosavePaused(false);
    setDraftStatus("Nuovo editor pulito");
  }

  function changeCategory(categoryId) {
    const category = categories.find(item => item.id === categoryId);
    patchForm({
      category: categoryId,
      occasion: category?.subcategories?.[0] || "Generale"
    });
  }

  if (loading) {
    return <EmptyState title="Caricamento prodotti" />;
  }

  return (
    <div className="admin-react-stack admin-products-page">
      <header className="admin-react-header">
        <div><span className="eyebrow">Catalogo</span><h2>{editorOpen ? (form.id ? "Modifica prodotto" : "Nuovo prodotto") : "Prodotti"}</h2><p>{editorOpen ? "Completa una sezione alla volta. Le modifiche vengono salvate soltanto alla conferma." : "Gestisci il catalogo, cerca un prodotto o creane uno nuovo."}</p></div>
        {editorOpen ? <Button variant="secondary" onClick={closeEditor}>← Torna ai prodotti</Button> : <Button onClick={createProduct}>+ Nuovo prodotto</Button>}
      </header>

      {editorOpen ? <>
        <nav className="admin-product-editor-nav" aria-label="Sezioni prodotto">
          {[["info", "1. Informazioni"], ["images", "2. Immagini"], ["details", "3. Dettagli"], ["customization", "4. Personalizzazione"]].map(([id, label]) => <button key={id} type="button" className={editorSection === id ? "active" : ""} onClick={() => setEditorSection(id)}>{label}</button>)}
        </nav>
        {pendingDraft ? <div className="admin-product-draft-banner" role="status"><div><strong>È disponibile una bozza automatica</strong><span>Salvata {formatDraftDate(pendingDraft.savedAt)}. Puoi riprenderla oppure iniziare con i dati originali.</span></div><div className="ui-actions"><Button type="button" onClick={resumeDraft}>Riprendi bozza</Button><Button type="button" variant="secondary" onClick={discardDraft}>Elimina bozza</Button></div></div> : null}
        <Card className="admin-product-editor-card">
        <form className="admin-react-form" onSubmit={handleSubmit}>
          {editorSection === "info" ? <section className="admin-product-editor-section">
            <header><span>01</span><div><h3>Informazioni principali</h3><p>Identità commerciale, prezzo e posizione nel catalogo.</p></div></header>
          <div className="ui-two-col">
            <Field label="Nome prodotto" help="Nome mostrato in catalogo, scheda prodotto e carrello." example="Candela Dedica Classica">
              <Input required value={form.name} onChange={(event) => patchForm({ name: event.target.value })} />
            </Field>
            <Field label="Prezzo base" help="Prezzo iniziale prima di supplementi, quantità e promozioni." example="24,00 €">
              <Input type="number" step="0.01" required value={form.price} onChange={(event) => patchForm({ price: Number(event.target.value || 0) })} />
            </Field>
          </div>

          <Field label="Descrizione" help="Descrivi brevemente destinatario, occasione e caratteristica principale." example="Candela personalizzata con dedica e confezione regalo.">
            <Textarea required rows={3} value={form.desc} onChange={(event) => patchForm({ desc: event.target.value })} />
          </Field>

          <Field label="Badge" help="Etichetta breve facoltativa evidenziata sul prodotto." example="Bestseller"><Input value={form.badge} onChange={(event) => patchForm({ badge: event.target.value })} placeholder="Es. Bestseller" /></Field>

          <Field label="Categoria" help="Percorso principale nel quale verrà mostrato il prodotto." example="Idee regalo" as="div">
            <CategoryPicker categories={categories} value={form.category} onChange={changeCategory} />
          </Field>

          <Field label="Sottocategoria" help="Occasione o raggruppamento interno. Non serve se la categoria non ne ha." example="Compleanno" hint={selectedCategory?.subcategories?.length ? "Seleziona una voce." : "Questa categoria non richiede sottocategorie."} as="div">
            {selectedCategory?.subcategories?.length ? <SubcategoryPicker
              subcategories={selectedCategory?.subcategories || []}
              value={form.occasion}
              onChange={(occasion) => patchForm({ occasion })}
            /> : <div className="admin-react-no-subcategory">I prodotti verranno inseriti direttamente in “{selectedCategory?.name || "Categoria"}”.</div>}
          </Field>
          </section> : null}

          {editorSection === "images" ? <section className="admin-product-editor-section">
            <header><span>02</span><div><h3>Immagini <InfoTip title="Immagini prodotto" example="Copertina frontale + dettagli e ambientazione">La copertina appare nel catalogo; la galleria completa la scheda prodotto.</InfoTip></h3><p>Copertina del catalogo e fotografie della scheda prodotto.</p></div></header>
            <div className="admin-product-cover-grid">
              <ImageUploader label={uploading ? "Caricamento..." : "Carica copertina"} previewUrl={form.image} disabled={uploading} hint="Rapporto 4:5 · 1600 × 2000 px" onChange={handleImageUpload} />
              <Field label="URL immagine" help="Alternativa al caricamento: percorso del file o indirizzo pubblico." example="assets/candela.webp"><Input value={form.image} onChange={(event) => patchForm({ image: event.target.value })} placeholder="assets/prodotto.webp oppure URL" /></Field>
            </div>
            <div className="admin-react-subsection"><h3>Galleria <small>{form.gallery.length}/8</small></h3><p className="admin-react-help">Puoi selezionare più fotografie contemporaneamente.</p>
              <ImageUploader label={uploading ? "Caricamento..." : "Aggiungi immagini"} disabled={uploading || form.gallery.length >= 8} multiple hint="JPG, PNG o WebP" onChange={(files) => handleGalleryUpload(files.slice(0, Math.max(0, 8 - form.gallery.length)))} />
              {form.gallery.length > 0 ? <div className="admin-react-gallery-editor">{form.gallery.map((imageUrl, index) => <div key={`${imageUrl}-${index}`}><img src={imageUrl} alt={`Immagine galleria ${index + 1}`} /><span>{index + 1}</span><button type="button" onClick={() => removeGalleryImage(imageUrl)} aria-label={`Rimuovi immagine ${index + 1}`}>×</button></div>)}</div> : <div className="admin-react-no-subcategory">Nessuna immagine aggiuntiva.</div>}
            </div>
          </section> : null}

          {editorSection === "details" ? <section className="admin-product-editor-section">
            <header><span>03</span><div><h3>Dettagli ecommerce</h3><p>Informazioni che aiutano il cliente a scegliere.</p></div></header>
            <div className="ui-two-col admin-product-attributes-grid">
              <ProductAttributeSelector label="Fragranze" options={catalogOptions.filter(item => item.type === "fragrance")} value={form.details?.fragrances || []} onChange={(fragrances) => patchDetails({ fragrances })} />
              <ProductAttributeSelector label="Colori" options={catalogOptions.filter(item => item.type === "color")} value={form.details?.colors || []} onChange={(colors) => patchDetails({ colors })} />
              <ProductAttributeSelector label="Cere" options={catalogOptions.filter(item => item.type === "wax")} value={form.details?.waxes || []} onChange={(waxes) => patchDetails({ waxes })} />
            </div>
            <section className="admin-react-subsection"><h3>Dati logistici</h3><p className="admin-react-help">Usa peso e dimensioni del prodotto già confezionato.</p><div className="ui-two-col"><Field label="Peso confezionato (g)" help="Peso unitario comprensivo della confezione del prodotto." example="500"><Input type="number" min="1" value={form.logistics?.packagedWeightGrams || 0} onChange={event => patchLogistics({ packagedWeightGrams: Number(event.target.value) })} /></Field><Field label="Massimo pezzi per collo" help="Oltre questa quantità il sistema considera più pacchi." example="10"><Input type="number" min="1" value={form.logistics?.maxUnitsPerParcel || 1} onChange={event => patchLogistics({ maxUnitsPerParcel: Number(event.target.value) })} /></Field></div><div className="ui-two-col"><Field label="Lunghezza (cm)"><Input type="number" min="1" value={form.logistics?.lengthCm || 0} onChange={event => patchLogistics({ lengthCm: Number(event.target.value) })} /></Field><Field label="Larghezza (cm)"><Input type="number" min="1" value={form.logistics?.widthCm || 0} onChange={event => patchLogistics({ widthCm: Number(event.target.value) })} /></Field></div><div className="ui-two-col"><Field label="Altezza (cm)"><Input type="number" min="1" value={form.logistics?.heightCm || 0} onChange={event => patchLogistics({ heightCm: Number(event.target.value) })} /></Field><label className="admin-react-toggle"><input type="checkbox" checked={form.logistics?.fragile !== false} onChange={event => patchLogistics({ fragile: event.target.checked })} /> Prodotto fragile</label></div></section>
            <div className="ui-two-col">
              <Field label="Durata stimata" help="Intervallo indicativo di combustione nelle condizioni previste." example="35–40 ore">
                <Input value={form.details?.burnTime || ""} onChange={(event) => patchDetails({ burnTime: event.target.value })} placeholder="35-40 ore" />
              </Field>
              <ProductAttributeSelector label="Formati" options={catalogOptions.filter(item => item.type === "size")} value={form.details?.sizes || []} onChange={(sizes) => patchDetails({ sizes })} />
            </div>
            <div className="ui-two-col">
              <Field label="Tempi produzione" help="Tempo dopo l’approvazione della bozza, esclusa la spedizione." example="3–5 giorni lavorativi">
                <Input value={form.details?.productionTime || ""} onChange={(event) => patchDetails({ productionTime: event.target.value })} placeholder="3-5 giorni lavorativi" />
              </Field>
              <Field label="Confezione" help="Descrivi ciò che il cliente riceve insieme alla candela." example="Scatola regalo inclusa">
                <Input value={form.details?.packaging || ""} onChange={(event) => patchDetails({ packaging: event.target.value })} placeholder="Scatola regalo inclusa" />
              </Field>
            </div>
          </section> : null}

          {editorSection === "customization" ? <section className="admin-product-editor-section">
            <header><span>04</span><div><h3>Personalizzazione <InfoTip title="Personalizzazione" example="Dedica obbligatoria, foto facoltativa">Attiva soltanto i campi necessari per realizzare questo prodotto.</InfoTip></h3><p>Configura ciò che il cliente può scegliere o inviare.</p></div></header>
            <div className="ui-two-col">
            <Field label="Introduzione configuratore" help="Testo iniziale che guida il cliente prima delle scelte." example="Scrivi la dedica e scegli lo stile.">
              <Textarea rows={3} value={form.customization.intro || ""} onChange={(event) => patchCustomization({ intro: event.target.value })} />
            </Field>
            <Field label="Guida personalizzazione" help="Suggerimenti brevi mostrati durante la configurazione." example="Usa massimo due righe" hint="Una riga per suggerimento.">
              <Textarea
                rows={3}
                value={(form.customization.designBrief || []).join("\n")}
                onChange={(event) => patchCustomization({ designBrief: event.target.value.split(/\r?\n/).map(item => item.trim()).filter(Boolean) })}
              />
            </Field>
            </div>

          <section className="admin-react-subsection custom-options-section">
            <div className="custom-options-intro"><div><h3>Scelte specifiche del prodotto</h3><p>Per esempio: colore del vaso, colore del fiocco o tipo di confezione.</p></div></div>
            <OptionBuilder
              groups={(form.customization.optionGroups || []).filter(group => !["fragrance", "color", "wax"].includes(group.key))}
              onChange={(customGroups) => patchCustomization({
                optionGroups: [
                  ...(form.customization.optionGroups || []).filter(group => ["fragrance", "color", "wax"].includes(group.key)),
                  ...customGroups
                ]
              })}
              onImageUpload={uploadCatalogImage}
            />
          </section>

          <section className="admin-react-subsection">
            <h3>Campi personalizzazione</h3>
            <PersonalizationBuilder
              value={form.customization.personalization}
              onChange={(personalization) => patchCustomization({ personalization })}
            />
          </section>
          </section> : null}

          <div className="admin-product-savebar">
            <span>{draftStatus || (form.id ? `Modifica di “${form.name || "Prodotto"}”` : "Nuovo prodotto non ancora salvato")}</span>
            <div className="ui-actions">
            <Button type="button" variant="secondary" onClick={closeEditor}>Annulla</Button>
            <Button type="submit">{form.id ? "Salva modifiche" : "Crea prodotto"}</Button>
            </div>
          </div>
        </form>
      </Card></> : <>
        <Card className="admin-product-toolbar"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cerca per nome o descrizione..." aria-label="Cerca prodotti" /><select className="ui-input" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filtra categoria"><option value="all">Tutte le categorie</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select><span>{filteredProducts.length} prodotti</span></Card>

      {filteredProducts.length === 0 ? (
        <EmptyState title="Nessun prodotto" description="Crea il primo prodotto dal form." />
      ) : (
        <div className="admin-product-list">
          {filteredProducts.map(product => (
            <Card key={product.id} className="admin-product-list-item">
              <img src={product.image} alt="" />
              <div className="admin-product-list-copy"><div className="admin-product-list-title"><div><strong>{product.name}</strong><small>{categories.find(category => category.id === product.category)?.name || product.category} · {product.occasion}</small></div><strong>{product.price.toFixed(2).replace(".", ",")} €</strong></div><p>{product.desc || "Nessuna descrizione."}</p></div><div className="ui-actions"><Button type="button" variant="secondary" onClick={() => editProduct(product)}>Modifica</Button><Button type="button" variant="ghost" data-testid={`delete-product-${product.id}`} onClick={() => removeProduct(product.id)}>Elimina</Button></div>
            </Card>
          ))}
        </div>
      )}</>}

      <Toast message={toast} />
    </div>
  );
}

function getDraftKey(id = "new") { return `${PRODUCT_DRAFT_PREFIX}${id || "new"}`; }
function formatDraftDate(value) { if (!value) return "in precedenza"; return new Date(value).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" }); }
