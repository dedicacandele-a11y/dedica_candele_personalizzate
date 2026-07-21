import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, Field, ImageUploader, Input, Textarea, Toast } from "../components/index.js";
import { addCartItem, getQuantityDiscountPercent } from "../services/cart.js";
import { listCategories } from "../services/categories.js";
import { listCatalogOptions } from "../services/catalogOptions.js";
import { getProduct } from "../services/products.js";
import { DEFAULT_SHIPPING_SETTINGS, getFreeShippingMessage, getShippingPriceExplanation, getShippingSettings, quoteShipping } from "../services/shipping.js";
import { uploadPersonalizationImage } from "../services/storage.js";

export function ConfiguratorPage({ productId, onOpenCart, onOpenHome }) {
  const [categories, setCategories] = useState([]);
  const [product, setProduct] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [personalizations, setPersonalizations] = useState({ text: "", generic: "", photo: "" });
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState("");
  const [catalogOptions, setCatalogOptions] = useState([]);
  const [openInfo, setOpenInfo] = useState("");
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [shippingSettings, setShippingSettings] = useState(DEFAULT_SHIPPING_SETTINGS);

  useEffect(() => { getShippingSettings().then(setShippingSettings); }, []);

  useEffect(() => {
    async function loadConfigurator() {
      setLoading(true);
      const [nextCategories, nextProduct, nextCatalogOptions] = await Promise.all([
        listCategories({ includeInactive: false }),
        productId ? getProduct(productId) : null,
        listCatalogOptions()
      ]);
      setCategories(nextCategories);
      setProduct(nextProduct);
      setCatalogOptions(nextCatalogOptions);
      setSelectedOptions(getInitialOptions(nextProduct));
      setColorPickerOpen(false);
      setLoading(false);
    }

    loadConfigurator();
  }, [productId]);

  const category = categories.find(item => item.id === product?.category);
  const customization = normalizeCustomization(product);
  const selectedVariantImage = customization.optionGroups.reduce((image, group) => {
    const selected = group.options.find(option => String(option.value) === String(selectedOptions[group.key]));
    return selected?.image || image;
  }, "");

  const unitPrice = useMemo(() => {
    if (!product) return 0;
    const optionsExtra = customization.optionGroups.reduce((sum, group) => {
      const selected = group.options.find(option => String(option.value) === String(selectedOptions[group.key]));
      return sum + Number(selected?.priceDelta || 0);
    }, 0);
    const personalizationExtra = Object.entries(customization.personalization).reduce((sum, [key, config]) => {
      if (!config.enabled) return sum;
      if (key === "photo" && personalizations.photo) return sum + Number(config.priceDelta || 0);
      if (key !== "photo" && String(personalizations[key] || "").trim()) return sum + Number(config.priceDelta || 0);
      return sum;
    }, 0);

    return Math.max(0, Number(product.price || 0) + optionsExtra + personalizationExtra);
  }, [customization, personalizations, product, selectedOptions]);

  const discount = getQuantityDiscountPercent(qty);
  const total = unitPrice * qty * (1 - discount / 100);
  const shippingQuote = useMemo(() => product ? quoteShipping([{
    qty,
    shippingWeightGrams: Number(product.logistics?.packagedWeightGrams || 500),
    shippingDimensions: {
      lengthCm: Number(product.logistics?.lengthCm || 10),
      widthCm: Number(product.logistics?.widthCm || 10),
      heightCm: Number(product.logistics?.heightCm || 14),
    },
  }], total, shippingSettings) : null, [product, qty, shippingSettings, total]);
  const freeShippingMessage = getFreeShippingMessage(total, shippingQuote, shippingSettings);
  const shippingPriceExplanation = getShippingPriceExplanation(shippingQuote, shippingSettings);

  function updatePersonalization(key, value) {
    setPersonalizations(current => ({ ...current, [key]: value }));
  }

  async function handlePhotoUpload(file) {
    if (!file) return;
    setUploading(true);
    try {
      updatePersonalization("photo", await uploadPersonalizationImage(file));
      setToast("Foto caricata.");
    } catch (error) {
      console.error("Upload foto configuratore fallito:", error);
      setToast("Upload foto non riuscito.");
    } finally {
      setUploading(false);
    }
  }

  function validateRequiredFields() {
    for (const group of customization.optionGroups) {
      if (group.required !== false && !selectedOptions[group.key]) {
        return `Seleziona "${group.label}".`;
      }
    }

    for (const [key, config] of Object.entries(customization.personalization)) {
      if (!config.enabled || !config.required) continue;
      if (key === "photo" && !personalizations.photo) return `Carica "${config.label || "Fotografia"}".`;
      if (key !== "photo" && !String(personalizations[key] || "").trim()) return `Compila "${config.label || "Personalizzazione"}".`;
    }

    return "";
  }

  function handleAddToCart() {
    const validationError = validateRequiredFields();
    if (validationError) {
      setToast(validationError);
      return;
    }

    const selectedDetails = customization.optionGroups.map(group => {
      const selected = group.options.find(option => String(option.value) === String(selectedOptions[group.key]));
      return {
        key: group.key,
        groupLabel: group.label,
        value: selected?.value || "",
        label: selected?.label || "",
        priceDelta: Number(selected?.priceDelta || 0),
        image: selected?.image || ""
      };
    });

    addCartItem({
      id: `react-${Date.now()}`,
      productType: product.id,
      productId: product.id,
      productName: product.name,
      category: product.category,
      occasion: product.occasion,
      image: product.image,
      shippingWeightGrams: Number(product.logistics?.packagedWeightGrams || 500),
      shippingDimensions: { lengthCm: Number(product.logistics?.lengthCm || 10), widthCm: Number(product.logistics?.widthCm || 10), heightCm: Number(product.logistics?.heightCm || 14) },
      photo: personalizations.photo,
      qty,
      unitBasePrice: unitPrice,
      price: unitPrice,
      selectedOptions: selectedDetails,
      personalizations: {
        text: personalizations.text,
        textLabel: customization.personalization.text?.label || "Testo",
        generic: personalizations.generic,
        genericLabel: customization.personalization.generic?.label || "Personalizzazione",
        photoLabel: customization.personalization.photo?.label || "Foto"
      }
    });

    setToast("Candela aggiunta al carrello.");
    setTimeout(onOpenCart, 500);
  }

  if (loading) {
    return <main className="config-react"><EmptyState title="Caricamento configuratore" /></main>;
  }

  if (!product || !category) {
    return (
      <main className="config-react">
        <EmptyState
          title="Prodotto non disponibile"
          description="Il prodotto è stato eliminato o la categoria non è più attiva."
          action={<Button onClick={onOpenHome}>Torna alla Home</Button>}
        />
      </main>
    );
  }

  return (
    <main className="config-react">
      <section className="config-react-layout">
        <Card className="config-react-preview">
          <img key={selectedVariantImage || product.image} className="config-react-product-image" src={personalizations.photo || selectedVariantImage || product.image} alt={product.name} />
          <Badge>{category.name} · {product.occasion}</Badge>
          <h1>{product.name}</h1>
          <p>{customization.intro || product.desc || "Personalizza dedica, stile e dettagli della tua candela."}</p>
        </Card>

        <Card className="config-react-panel">
          <span className="eyebrow">Personalizza la tua candela</span>
          <h2>Scegli i dettagli del regalo</h2>

          {customization.optionGroups.map(group => (
            <Field key={group.key} label={`${group.label}${group.required !== false ? " *" : ""}`}>
              {group.key === "color" ? (
                <div className="wax-color-picker">
                  {(() => {
                    const selected = group.options.find(option => String(option.value) === String(selectedOptions[group.key])) || group.options[0];
                    return <button type="button" className={`wax-color-current${colorPickerOpen ? " open" : ""}`} onClick={() => setColorPickerOpen(current => !current)} aria-expanded={colorPickerOpen}>
                      <span className="wax-color-swatch" style={{ background: getWaxColor(selected?.label) }} aria-hidden="true" />
                      <span><small>Colore selezionato</small><strong>{selected?.label || "Scegli il colore"}</strong></span>
                      <span className="wax-color-chevron" aria-hidden="true">⌄</span>
                    </button>;
                  })()}
                  {colorPickerOpen ? <div className="wax-color-grid">
                    {group.options.map(option => (
                    <button
                      type="button"
                      key={option.value}
                      className={`wax-color-option${String(selectedOptions[group.key]) === String(option.value) ? " active" : ""}`}
                      onClick={() => { setSelectedOptions(current => ({ ...current, [group.key]: option.value })); setColorPickerOpen(false); }}
                      aria-pressed={String(selectedOptions[group.key]) === String(option.value)}
                    >
                      <span className="wax-color-swatch" style={{ background: getWaxColor(option.label) }} aria-hidden="true" />
                      <span>{option.label || option.value}</span>
                    </button>
                    ))}
                  </div> : null}
                </div>
              ) : group.type === "select" && !group.options.some(option => option.image) ? (<>
                <select className="ui-input" value={selectedOptions[group.key] || ""} onChange={(event) => setSelectedOptions(current => ({ ...current, [group.key]: event.target.value }))}>
                  {group.options.map(option => <option key={option.value} value={option.value}>{formatOption(option)}</option>)}
                </select>
                {group.key === "fragrance" ? <FragranceInfo description={findFragranceDescription(group.options.find(option => String(option.value) === String(selectedOptions[group.key])), catalogOptions)} /> : null}
              </>) : (
                <div className={`ui-chip-grid${group.options.some(option => option.image) ? " has-images" : ""}`}>
                  {group.options.map(option => (
                    <div className="ui-chip-with-info" key={option.value}>
                      <button type="button" className={`ui-chip ${option.image ? "ui-variant-card" : ""} ${String(selectedOptions[group.key]) === String(option.value) ? "active" : ""}`} onClick={() => setSelectedOptions(current => ({ ...current, [group.key]: option.value }))}>
                        {option.image ? <img src={option.image} alt={option.label || option.value} /> : null}
                        <span>{formatOption(option)}</span>
                      </button>
                      {group.key === "fragrance" && findFragranceDescription(option, catalogOptions) ? <button type="button" className="fragrance-info-trigger" aria-expanded={openInfo === String(option.value)} onClick={() => setOpenInfo(current => current === String(option.value) ? "" : String(option.value))}>Info</button> : null}
                      {group.key === "fragrance" && openInfo === String(option.value) ? <FragranceInfo description={findFragranceDescription(option, catalogOptions)} /> : null}
                    </div>
                  ))}
                </div>
              )}
            </Field>
          ))}

          <PersonalizationFields
            config={customization.personalization}
            values={personalizations}
            uploading={uploading}
            onChange={updatePersonalization}
            onPhotoUpload={handlePhotoUpload}
          />

          <div className="config-react-total">
            <div>
              <span>Quantità</span>
              <Input type="number" min="1" value={qty} onChange={(event) => setQty(Math.max(1, Number(event.target.value || 1)))} />
            </div>
            <div>
              <span>Totale</span>
              <strong>{total.toFixed(2).replace(".", ",")} €</strong>
              {discount ? <small>Sconto quantità -{discount}%</small> : null}
            </div>
          </div>
          <p className="product-unit-weight">Peso per candela indicato dal produttore: {formatWeightGrams(product.logistics?.packagedWeightGrams || 500)}</p>
          {shippingPriceExplanation ? <p className="shipping-price-explanation">{shippingPriceExplanation}</p> : null}
          {freeShippingMessage ? <p className={`cart-free-shipping-note${shippingQuote?.free ? " achieved" : ""}`} aria-live="polite">{freeShippingMessage}</p> : null}
          <div className="secure-payment-note"><span aria-hidden="true">✦</span><div><strong>Creata su misura per te</strong><small>Essendo personalizzata, non è previsto il reso per semplice ripensamento. Restano sempre valide garanzia legale e tutela per difetti o danni da trasporto. <a href="/spedizioni-resi" target="_blank" rel="noreferrer">Leggi la policy</a>.</small></div></div>

          <div className="ui-actions">
            <Button onClick={handleAddToCart}>Aggiungi al carrello</Button>
            <Button variant="secondary" onClick={onOpenHome}>Torna alla Home</Button>
          </div>
          <div className="secure-payment-note"><span aria-hidden="true">🔒</span><div><strong>Pagamento sicuro</strong><small>Transazione protetta e gestita tramite Stripe.</small></div></div>
        </Card>
      </section>

      <Toast message={toast} />
    </main>
  );
}

function formatWeightGrams(value) {
  const grams = Number(value || 0);
  return grams >= 1000 ? `${(grams / 1000).toFixed(2).replace(".", ",")} kg` : `${Math.round(grams)} g`;
}

function PersonalizationFields({ config, values, uploading, onChange, onPhotoUpload }) {
  return (
    <>
      {config.text?.enabled ? (
        <Field label={`${config.text.label || "Testo"}${config.text.required ? " *" : ""}`} hint={config.text.maxLength ? `Massimo ${config.text.maxLength} caratteri` : ""}>
          <Input value={values.text} maxLength={config.text.maxLength || undefined} placeholder={config.text.placeholder || ""} onChange={(event) => onChange("text", event.target.value)} />
        </Field>
      ) : null}

      {config.generic?.enabled ? (
        <Field label={`${config.generic.label || "Personalizzazione"}${config.generic.required ? " *" : ""}`} hint={config.generic.maxLength ? `Massimo ${config.generic.maxLength} caratteri` : ""}>
          <Textarea rows={3} value={values.generic} maxLength={config.generic.maxLength || undefined} placeholder={config.generic.placeholder || ""} onChange={(event) => onChange("generic", event.target.value)} />
        </Field>
      ) : null}

      {config.photo?.enabled ? (
        <Field label={`${config.photo.label || "Fotografia"}${config.photo.required ? " *" : ""}`}>
          <ImageUploader label={uploading ? "Caricamento..." : "Carica foto"} previewUrl={values.photo} disabled={uploading} onChange={onPhotoUpload} />
        </Field>
      ) : null}
    </>
  );
}

function normalizeCustomization(product) {
  const customization = product?.customization || {};
  return {
    intro: customization.intro || "",
    optionGroups: (customization.optionGroups || [])
      .filter(group => group.key && Array.isArray(group.options) && group.options.length > 0)
      .map(group => group.key === "color" ? { ...group, label: "Colore cera" } : group),
    personalization: {
      text: { enabled: true, required: true, label: "Dedica", placeholder: "", maxLength: 80, priceDelta: 0, ...(customization.personalization?.text || {}) },
      photo: { enabled: false, required: false, label: "Fotografia", priceDelta: 0, ...(customization.personalization?.photo || {}) },
      generic: { enabled: false, required: false, label: "Note", placeholder: "", maxLength: 180, priceDelta: 0, ...(customization.personalization?.generic || {}) }
    }
  };
}

function getInitialOptions(product) {
  const customization = normalizeCustomization(product);
  return Object.fromEntries(customization.optionGroups.map(group => [group.key, group.options[0]?.value || ""]));
}

function formatOption(option) {
  const delta = Number(option.priceDelta || 0);
  const priceLabel = delta ? ` (${delta > 0 ? "+" : ""}${delta.toFixed(2).replace(".", ",")} €)` : "";
  return `${option.label || option.value}${priceLabel}`;
}

function findFragranceDescription(option, catalogOptions) {
  return catalogOptions.find(item => item.type === "fragrance" && item.label.toLowerCase() === String(option?.label || "").toLowerCase())?.description || "";
}

function getWaxColor(label) {
  const colors = {
    bianco: "#f8f6ef", rosso: "#a93432", risso: "#a93432", arancione: "#dd7d35",
    giallo: "#e9c94f", verde: "#55775b", "verde salvia": "#a9b29c", marrone: "#765343",
    beige: "#d4bea0", crema: "#eee2c6", grigio: "#9b9b98", lampone: "#b34262",
    cipria: "#d9aaa0", "rosa cipria": "#dfb8b0", rosa: "#df91a5", lavanda: "#aaa0cf",
    nero: "#242321", lilla: "#c3abd2", viola: "#74558f", blu: "#345b91",
    "blu navy": "#25344f", "blu navi": "#25344f", azzurro: "#87bddd", "azzurro polvere": "#a8bdc8"
  };
  return colors[String(label || "").trim().toLowerCase()] || "#d7d2c8";
}

function FragranceInfo({ description }) {
  return description ? <p className="fragrance-inline-info">{description}</p> : null;
}
