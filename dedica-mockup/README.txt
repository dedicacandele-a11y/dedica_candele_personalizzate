DÈDICA — applicazione React con Firebase e Stripe Checkout

COME AVVIARE
1. Apri un terminale nella cartella del progetto.
2. Esegui `npm install` se non hai ancora installato le dipendenze.
3. Sviluppo: `npm run dev`.
4. Build produzione: `npm run build`.
5. Test end-to-end: `npm run test:e2e`.

ROUTE PRINCIPALI
- `/`: Home e catalogo dinamico.
- `/product/:id`: scheda prodotto.
- `/configuratore/:id?`: configuratore dinamico.
- `/cart`: carrello e checkout.
- `/login`: accesso cliente/admin.
- `/account`: area cliente, ordini, bozze e messaggi.
- `/admin`: pannello amministrativo.
- `/payment-success` / `/payment-cancel`: ritorno da Stripe Checkout.
- `/assistenza`, `/privacy`, `/termini`, `/spedizioni-resi`: pagine informative.

CONTENUTO TECNICO
- `app.html`: entrypoint sorgente Vite.
- `index.html`: entrypoint statico generato da `npm run build`.
- `src/`: applicazione React modulare.
- `functions/`: backend autorevole per ordini, Stripe Checkout e webhook.
- `firestore.rules` / `storage.rules`: regole cloud.
- `firebase.json`: hosting su `dist-react` con rewrite SPA verso `index.html`.

STRIPE TEST MODE
Configura queste variabili d'ambiente nelle Cloud Functions:

STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
APP_BASE_URL=https://tuo-dominio-pubblico.example

Webhook da registrare in Stripe Dashboard:
https://europe-west1-dedica-6642d.cloudfunctions.net/stripeWebhook

Eventi webhook da selezionare:
- checkout.session.completed
- checkout.session.async_payment_succeeded
- checkout.session.async_payment_failed
- checkout.session.expired

Pagamento di prova:
1. Accedi da `/login`.
2. Aggiungi prodotti al carrello.
3. Conferma il checkout: verrai reindirizzato a Stripe Checkout.
4. Usa carta test Stripe: 4242 4242 4242 4242, data futura, CVC qualsiasi.
5. Dopo il ritorno su `/payment-success`, lo stato pagato viene letto dal backend. Solo il webhook può marcare l'ordine come paid.

NOTE
Il totale ordine viene sempre ricalcolato dal backend usando prodotti, quantità, personalizzazioni, sconti e spedizione. Il pagamento usa Stripe Checkout hosted; nessuna chiave segreta viene salvata nel database o inviata al frontend.
