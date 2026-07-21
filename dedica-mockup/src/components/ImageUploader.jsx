export function ImageUploader({ label = "Carica immagine", previewUrl, disabled = false, multiple = false, hint = "JPG, PNG o WebP", onChange }) {
  return (
    <label className={`ui-uploader${disabled ? " is-disabled" : ""}`}>
      {previewUrl ? <img src={previewUrl} alt="" /> : <span>+</span>}
      <strong>{label}</strong>
      <small>{hint}</small>
      <input disabled={disabled} type="file" accept="image/jpeg,image/png,image/webp" multiple={multiple} onChange={(event) => onChange?.(multiple ? Array.from(event.target.files || []) : event.target.files?.[0] || null)} />
    </label>
  );
}
