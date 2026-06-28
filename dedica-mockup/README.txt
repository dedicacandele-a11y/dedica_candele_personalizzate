DÈDICA — e-commerce statico con Firebase e Stripe Checkout

COME AVVIARE
1. Apri un terminale nella cartella del progetto.
2. Esegui start-server.cmd.
3. Home: http://localhost:5173/
4. Account cliente: http://localhost:5173/login.html
5. Admin: http://localhost:5173/admin

CONTENUTO
- index.html: homepage e catalogo
- product.html: pagina prodotto
- configuratore.html: configuratore prodotto
- cart.html: carrello con checkout Stripe
- login.html / account.html: accesso cliente, ordini, bozze e comunicazioni
- payment-success.html / payment-cancel.html: ritorno da Stripe Checkout
- admin.html: pannello amministrativo protetto da Firebase Auth
- functions/: backend autorevole per ordini, Stripe Checkout e webhook
- firestore.rules / storage.rules: regole cloud

STRIPE TEST MODE
Configura queste variabili d'ambiente nelle Cloud Functions:

STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
APP_BASE_URL=http://localhost:5173

Per ambiente Firebase v2 puoi impostarle da Google Cloud/Firebase come environment variables della funzione, oppure usare la configurazione supportata dal tuo workflow di deploy.

Webhook da registrare in Stripe Dashboard:
https://europe-west1-dedica-6642d.cloudfunctions.net/stripeWebhook

Eventi webhook da selezionare:
- checkout.session.completed
- checkout.session.expired

Pagamento di prova:
1. Crea o accedi con un account cliente da /login.html.
2. Aggiungi prodotti al carrello.
3. Conferma il checkout: verrai reindirizzato a Stripe Checkout.
4. Usa carta test Stripe: 4242 4242 4242 4242, data futura, CVC qualsiasi.
5. Dopo il ritorno su payment-success.html, lo stato pagato viene letto dal backend. Solo il webhook può marcare l'ordine come paid.

PASSAGGIO IN PRODUZIONE
1. Sostituisci STRIPE_SECRET_KEY e STRIPE_PUBLISHABLE_KEY con chiavi live.
2. Registra un webhook live con lo stesso URL.
3. Aggiorna STRIPE_WEBHOOK_SECRET con il segreto live.
4. Imposta APP_BASE_URL sul dominio pubblico reale.
5. Verifica da Admin > Pagamenti > Stripe.

NOTE
Il totale ordine viene sempre ricalcolato dal backend usando prodotti, quantità, personalizzazioni, sconti e spedizione. Il pagamento usa Stripe Checkout hosted; nessuna chiave segreta viene salvata nel database o inviata al frontend.
