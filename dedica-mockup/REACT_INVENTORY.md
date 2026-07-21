# Inventario React DÈDICA

La piattaforma è ora una SPA React con un solo entrypoint HTML:

- `index.html`: entrypoint Vite/React.
- `/`: Home e catalogo dinamico.
- `/product/:id`: scheda prodotto.
- `/configuratore/:id?`: configuratore.
- `/cart`: carrello e checkout.
- `/login`: accesso cliente/admin.
- `/account`: area cliente.
- `/admin`: pannello amministrativo.
- `/payment-success` e `/payment-cancel`: ritorno Stripe.
- `/assistenza`, `/privacy`, `/termini`, `/spedizioni-resi`: pagine informative.

Gli HTML legacy sono stati rimossi. La logica statica precedente è stata sostituita da componenti React in `src/`, servizi condivisi in `src/services/` e hosting Firebase con rewrite verso `index.html`.
