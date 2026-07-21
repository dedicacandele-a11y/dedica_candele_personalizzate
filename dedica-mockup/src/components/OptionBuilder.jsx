import { useState } from "react";
import { Button } from "./Button.jsx";
import { ImageUploader } from "./ImageUploader.jsx";
import { Field, Input } from "./FormControls.jsx";

const slugify = value => String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

export function OptionBuilder({ groups = [], onChange, onImageUpload }) {
  const updateGroup = (index, patch) => onChange(groups.map((group, groupIndex) => groupIndex === index ? { ...group, ...patch } : group));
  const addGroup = () => onChange([...groups, {
    key: `personalizzazione_${Date.now()}`,
    label: "",
    type: "choice",
    required: true,
    options: [{ label: "", value: "", priceDelta: 0, image: "" }]
  }]);

  return (
    <div className="ui-builder custom-options-builder">
      {!groups.length ? <div className="custom-options-empty"><strong>Nessuna scelta aggiuntiva</strong><p>Aggiungila solo se questo prodotto ha, per esempio, un vaso, un fiocco o una confezione personalizzabile.</p></div> : null}
      {groups.map((group, index) => (
        <article className="ui-builder-row" key={`${group.key}-${index}`}>
          <header className="ui-builder-head">
            <div><small>PERSONALIZZAZIONE {index + 1}</small><strong>{group.label || "Nuova personalizzazione"}</strong></div>
            <Button type="button" variant="ghost" onClick={() => onChange(groups.filter((_, groupIndex) => groupIndex !== index))}>Elimina</Button>
          </header>
          <Field label="Cosa deve scegliere il cliente?" help="Scrivi un titolo semplice, visibile nel configuratore." example="Colore del vaso">
            <Input placeholder="Es. Colore del vaso" value={group.label || ""} onChange={(event) => updateGroup(index, { label: event.target.value })} />
          </Field>
          <label className="admin-react-toggle">
            <input type="checkbox" checked={group.required !== false} onChange={(event) => updateGroup(index, { required: event.target.checked })} />
            Il cliente deve scegliere obbligatoriamente una variante
          </label>
          <OptionsEditor options={group.options || []} onChange={(options) => updateGroup(index, { options })} onImageUpload={onImageUpload} />
        </article>
      ))}
      <Button type="button" variant="secondary" onClick={addGroup}>+ Aggiungi una personalizzazione</Button>
    </div>
  );
}

function OptionsEditor({ options, onChange, onImageUpload }) {
  const [uploadingIndex, setUploadingIndex] = useState(-1);
  const updateOption = (index, patch) => onChange(options.map((option, optionIndex) => optionIndex === index ? { ...option, ...patch } : option));
  const updateLabel = (index, label) => updateOption(index, { label, value: slugify(label) || `variante_${index + 1}` });

  const uploadOptionImage = async (index, file) => {
    if (!file || !onImageUpload) return;
    setUploadingIndex(index);
    try { updateOption(index, { image: await onImageUpload(file) }); }
    finally { setUploadingIndex(-1); }
  };

  return (
    <div className="ui-option-list">
      <div className="custom-options-heading"><strong>Varianti disponibili</strong><small>La fotografia è facoltativa</small></div>
      {options.map((option, index) => (
        <div className="ui-option-line" key={index}>
          <span className="variant-number">{index + 1}</span>
          <Field label="Nome variante"><Input placeholder="Es. Vaso beige" value={option.label || ""} onChange={(event) => updateLabel(index, event.target.value)} /></Field>
          <Field label="Supplemento (€)" hint="Lascia 0 se incluso"><Input type="number" min="0" step="0.01" value={option.priceDelta || 0} onChange={(event) => updateOption(index, { priceDelta: Number(event.target.value || 0) })} /></Field>
          <ImageUploader label={uploadingIndex === index ? "Caricamento..." : option.image ? "Cambia fotografia" : "Carica fotografia"} hint="JPG, PNG o WebP" previewUrl={option.image || ""} disabled={uploadingIndex >= 0} onChange={(file) => uploadOptionImage(index, file)} />
          <div className="variant-actions">
            {option.image ? <Button type="button" variant="ghost" onClick={() => updateOption(index, { image: "" })}>Rimuovi foto</Button> : null}
            <Button type="button" variant="ghost" onClick={() => onChange(options.filter((_, optionIndex) => optionIndex !== index))}>Elimina variante</Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="ghost" onClick={() => onChange([...options, { label: "", value: `variante_${options.length + 1}`, priceDelta: 0, image: "" }])}>+ Aggiungi variante</Button>
    </div>
  );
}
