import { useState } from "react";
import { Button } from "./Button.jsx";
import { Input } from "./FormControls.jsx";

export function ProductAttributeSelector({ label, options = [], value = [], onChange }) {
  const [custom, setCustom] = useState("");
  const [openDescription, setOpenDescription] = useState("");
  function toggle(item) { onChange(value.includes(item) ? value.filter(current => current !== item) : [...value, item]); }
  function addCustom() { const next = custom.trim(); if (!next) return; if (!value.includes(next)) onChange([...value, next]); setCustom(""); }
  const specific = value.filter(item => !options.some(option => option.label === item));
  return <div className="product-attribute-selector">
    <div className="product-attribute-head"><strong>{label}</strong><div><small>{value.length} selezionate</small>{options.length ? <button type="button" onClick={() => onChange(options.every(option => value.includes(option.label)) ? [] : options.map(option => option.label))}>{options.every(option => value.includes(option.label)) ? "Deseleziona tutte" : "Seleziona tutte"}</button> : null}</div></div>
    <div className="product-attribute-options">{options.map(option => <div key={option.id} className={`product-attribute-option${value.includes(option.label) ? " active" : ""}`}><label><input type="checkbox" checked={value.includes(option.label)} onChange={() => toggle(option.label)} /><span>{option.label}</span></label>{option.description ? <button type="button" className="product-attribute-info" aria-label={`Informazioni su ${option.label}`} aria-expanded={openDescription === option.id} onClick={() => setOpenDescription(current => current === option.id ? "" : option.id)}>i</button> : null}{openDescription === option.id ? <p>{option.description}</p> : null}</div>)}</div>
    <div className="product-attribute-custom"><Input value={custom} onChange={event => setCustom(event.target.value)} placeholder={`Nuova ${label.toLowerCase()} solo per questo prodotto`} aria-label={`Nuova ${label.toLowerCase()} personalizzata`} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addCustom(); } }} /><Button type="button" variant="secondary" onClick={addCustom}>Aggiungi</Button></div>
    {specific.length ? <div className="product-attribute-specific">{specific.map(item => <button type="button" key={item} onClick={() => toggle(item)}>{item} ×</button>)}</div> : null}
  </div>;
}
