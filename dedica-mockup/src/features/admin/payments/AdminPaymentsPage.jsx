import { useState } from "react";
import { Button, Card, EmptyState } from "../../../components/index.js";
import { app, firebaseReady, isFirebaseLocal } from "../../../services/firebase.js";

export function AdminPaymentsPage() {
  const [status, setStatus] = useState("Premi verifica per controllare lo stato Stripe.");
  const [checking, setChecking] = useState(false);

  async function checkStripe() {
    setChecking(true);
    await firebaseReady;

    if (isFirebaseLocal || !app) {
      setStatus("Modalità locale: Stripe non verificabile da questa sessione.");
      setChecking(false);
      return;
    }

    try {
      const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");
      const checkStripeConfig = httpsCallable(getFunctions(app, "europe-west1"), "checkStripeConfig");
      const result = await checkStripeConfig({});
      const data = result.data || {};
      setStatus(formatStripeStatus(data));
    } catch (error) {
      console.error(error);
      setStatus(error.code === "functions/permission-denied"
        ? "Accesso negato: devi essere autenticato come admin per verificare Stripe."
        : `Errore durante la verifica Stripe: ${error.message || "controlla Functions e secrets."}`);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="admin-react-stack">
      <header className="admin-react-header">
        <div>
          <span className="eyebrow">Pagamenti</span>
          <h2>Stripe</h2>
          <p>Controllo configurazione pagamenti lato React.</p>
        </div>
        <Button onClick={checkStripe} disabled={checking}>{checking ? "Verifica..." : "Verifica collegamento"}</Button>
      </header>

      <Card>
        <EmptyState title="Stato Stripe" description={status} />
      </Card>
    </div>
  );
}

function formatStripeStatus(data) {
  const checks = [
    data.secretConfigured ? "secret key presente" : "secret key mancante",
    data.publishableConfigured ? "publishable key presente" : "publishable key mancante",
    data.webhookConfigured ? "webhook secret presente" : "webhook secret mancante",
    data.appBaseUrlConfigured ? `APP_BASE_URL: ${data.appBaseUrl}` : "APP_BASE_URL mancante"
  ];

  return `${data.connected ? "Stripe collegato" : "Stripe non completo"} · modalità ${data.mode || "n/d"} · ${checks.join(" · ")}`;
}
