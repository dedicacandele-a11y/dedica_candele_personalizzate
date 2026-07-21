import { Field, Input, Textarea } from "./FormControls.jsx";

export function PersonalizationBuilder({ value = {}, onChange }) {
  const personalization = {
    text: { enabled: false, required: false, label: "Dedica", placeholder: "", maxLength: 80, priceDelta: 0 },
    photo: { enabled: false, required: false, label: "Fotografia", priceDelta: 0 },
    generic: { enabled: false, required: false, label: "Note", placeholder: "", maxLength: 180, priceDelta: 0 },
    ...value
  };

  const updateSection = (section, patch) => {
    onChange({ ...personalization, [section]: { ...personalization[section], ...patch } });
  };

  return (
    <div className="ui-builder">
      <PersonalizationSection title="Testo" section={personalization.text} onChange={(patch) => updateSection("text", patch)} />
      <PersonalizationSection title="Foto" section={personalization.photo} onChange={(patch) => updateSection("photo", patch)} hidePlaceholder />
      <PersonalizationSection title="Box note" section={personalization.generic} onChange={(patch) => updateSection("generic", patch)} />
    </div>
  );
}

function PersonalizationSection({ title, section, onChange, hidePlaceholder = false }) {
  return (
    <article className="ui-builder-row">
      <header className="ui-builder-head">
        <strong>{title}</strong>
        <label><input type="checkbox" checked={section.enabled} onChange={(event) => onChange({ enabled: event.target.checked })} /> Abilitato</label>
        <label><input type="checkbox" checked={section.required} onChange={(event) => onChange({ required: event.target.checked })} /> Obbligatorio</label>
      </header>
      <Field label="Etichetta" help="Nome del campo mostrato al cliente." example={title === "Testo" ? "La tua dedica" : title === "Foto" ? "Carica una fotografia" : "Indicazioni speciali"}>
        <Input value={section.label || ""} onChange={(event) => onChange({ label: event.target.value })} />
      </Field>
      {!hidePlaceholder ? (
        <Field label="Placeholder" help="Testo di esempio visualizzato nel campo vuoto." example="Sempre con te">
          <Textarea rows={2} value={section.placeholder || ""} onChange={(event) => onChange({ placeholder: event.target.value })} />
        </Field>
      ) : null}
      <div className="ui-two-col">
        <Field label="Limite caratteri" help="Numero massimo di caratteri che il cliente può inserire." example="80">
          <Input type="number" value={section.maxLength || 0} onChange={(event) => onChange({ maxLength: Number(event.target.value || 0) })} />
        </Field>
        <Field label="Extra prezzo" help="Supplemento aggiunto quando questa personalizzazione viene utilizzata." example="4,00 €">
          <Input type="number" step="0.01" value={section.priceDelta || 0} onChange={(event) => onChange({ priceDelta: Number(event.target.value || 0) })} />
        </Field>
      </div>
    </article>
  );
}
