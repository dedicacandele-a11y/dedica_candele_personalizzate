import { useEffect, useState } from "react";
import { enableAnalyticsAfterConsent } from "../services/firebase.js";

const KEY = "dedica_privacy_preferences_v1";

export function PrivacyConsent({ onOpenPrivacy }) {
  const [preferences, setPreferences] = useState(() => readPreferences());
  const [open, setOpen] = useState(() => !readPreferences());

  useEffect(() => {
    if (preferences?.analytics) enableAnalyticsAfterConsent().catch(() => {});
  }, [preferences]);

  function save(analytics) {
    const next = { necessary: true, analytics, version: 1, decidedAt: new Date().toISOString() };
    localStorage.setItem(KEY, JSON.stringify(next));
    setPreferences(next);
    setOpen(false);
  }

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("dedica:privacy-settings", handler);
    return () => window.removeEventListener("dedica:privacy-settings", handler);
  }, []);

  if (!open) return null;
  return <div className="privacy-banner" role="dialog" aria-modal="true" aria-labelledby="privacy-title">
    <div><strong id="privacy-title">La tua privacy, senza scorciatoie</strong><p>Usiamo strumenti tecnici necessari al funzionamento. Firebase Analytics resta disattivato finché non lo accetti; puoi cambiare scelta in qualsiasi momento.</p><button type="button" onClick={onOpenPrivacy}>Leggi privacy e cookie policy</button></div>
    <div className="privacy-banner-actions"><button type="button" onClick={() => save(false)}>Rifiuta analytics</button><button type="button" onClick={() => save(true)}>Accetta analytics</button></div>
  </div>;
}

function readPreferences() {
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
}
