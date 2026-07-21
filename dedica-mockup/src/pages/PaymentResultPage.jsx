import { useEffect, useState } from "react";
import { Badge, Button, Card } from "../components/index.js";
import { setLoginRedirect } from "../services/auth.js";
import { getPaymentResult } from "../services/payments.js";

export function PaymentResultPage({ success = false, onOpenAccount, onOpenCart }) {
  const [message, setMessage] = useState(success ? "Verifica pagamento in corso..." : "Pagamento annullato.");
  const [loading, setLoading] = useState(success);

  useEffect(() => {
    if (!success) return;
    verifyPayment();
  }, [success]);

  async function verifyPayment() {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("order_id") || localStorage.getItem("dedica_pending_order_id") || "";
    const sessionId = params.get("session_id") || "";

    if (!orderId) {
      setMessage("Ordine non trovato.");
      setLoading(false);
      return;
    }

    try {
      const result = await getPaymentResult(orderId, sessionId);
      if (result?.paymentStatus === "paid" || result?.status === "paid") {
        localStorage.removeItem("dedica_cart");
        localStorage.removeItem("dedica_pending_order_id");
        setMessage(`Pagamento confermato per l’ordine #${result.displayOrderId || orderId}.`);
      } else {
        setMessage(`Pagamento non ancora confermato. Stato: ${result?.status || "in verifica"}.`);
      }
    } catch (error) {
      setLoginRedirect(`/payment-success?order_id=${encodeURIComponent(orderId)}&session_id=${encodeURIComponent(sessionId)}`);
      setMessage(error.message || "Non riesco a verificare il pagamento. Accedi e riprova dall’account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-react">
      <Card className="login-react-card">
        <Badge>{success ? "Pagamento" : "Checkout annullato"}</Badge>
        <h1>{success ? "Risultato pagamento" : "Pagamento non completato"}</h1>
        <p>{message}</p>
        <div className="ui-actions">
          <Button onClick={onOpenAccount} disabled={loading}>Apri area cliente</Button>
          {!success ? <Button variant="secondary" onClick={onOpenCart}>Torna al carrello</Button> : null}
        </div>
      </Card>
    </main>
  );
}
