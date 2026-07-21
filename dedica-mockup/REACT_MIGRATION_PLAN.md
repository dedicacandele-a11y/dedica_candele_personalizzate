# Piano migrazione DÈDICA a React

Obiettivo: trasformare gradualmente l’attuale sito statico in una applicazione React moderna, modulare e manutenibile, senza rompere Firebase, Stripe, carrello, configuratore, admin e fallback locale.

Legenda:
- `[ ]` Da fare
- `[x]` Completato
- `Verifica` indica il controllo minimo da fare prima di passare alla fase successiva

---

## 1. Preparazione progetto

- [ ] Creare branch dedicato alla migrazione React.
- [x] Verificare stato Git e salvare eventuali modifiche importanti.
- [x] Installare Vite + React nel progetto `dedica-mockup`.
- [x] Definire struttura cartelle iniziale:
  - [x] `src/app`
  - [x] `src/pages`
  - [x] `src/components`
  - [x] `src/features`
  - [x] `src/services`
  - [x] `src/styles`
  - [x] `src/utils`
- [x] Configurare build output compatibile con deploy attuale.
- [x] Mantenere temporaneamente gli HTML esistenti come fallback.

**Verifica**
- [x] `npm install` completato senza errori.
- [x] `npm run dev` avvia l’app React.
- [x] `npm run build` genera output senza errori.
- [x] Le pagine statiche attuali restano raggiungibili.

---

## 2. Inventario funzionale esistente

- [x] Mappare tutte le pagine attuali:
  - [x] `index.html`
  - [x] `product.html`
  - [x] `configuratore.html`
  - [x] `cart.html`
  - [x] `account.html`
  - [x] `admin.html`
  - [x] pagine legali / assistenza
- [x] Mappare tutti gli script:
  - [x] `script.js`
  - [x] `admin.js`
  - [x] `admin-categories.js`
  - [x] `catalog-taxonomy.js`
  - [x] `account.js`
  - [x] `auth.js`
  - [x] `payment-result.js`
- [x] Separare logica da UI:
  - [x] catalogo
  - [x] categorie
  - [x] prodotti
  - [x] configuratore
  - [x] carrello
  - [x] ordini
  - [x] pagamenti
  - [x] account
  - [x] admin

**Verifica**
- [x] Documento di mapping completo.
- [x] Nessuna funzione critica non censita.
- [x] Flussi principali identificati end-to-end.

---

## 3. Servizi condivisi

- [x] Creare `src/services/firebase.ts` o `.js`.
- [x] Spostare inizializzazione Firebase da `firebase-config.js`.
- [x] Creare `src/services/categories`.
- [x] Creare `src/services/products`.
- [x] Creare `src/services/cart`.
- [x] Creare `src/services/orders`.
- [x] Creare `src/services/payments`.
- [x] Creare `src/services/auth`.
- [x] Mantenere compatibilità con:
  - [x] Firestore cloud
  - [x] localStorage fallback
  - [x] Firebase Auth
  - [x] Firebase Storage
  - [x] Firebase Functions

**Verifica**
- [x] I servizi leggono categorie da Firestore/localStorage.
- [x] I servizi leggono prodotti da Firestore/localStorage.
- [x] Il carrello esistente viene letto senza perdere dati.
- [x] Nessuna chiave sensibile viene esposta.

---

## 4. Design system React

- [x] Definire componenti base:
  - [x] `Button`
  - [x] `Input`
  - [x] `Textarea`
  - [x] `Card`
  - [x] `Badge`
  - [x] `Modal`
  - [x] `Drawer`
  - [x] `Tabs`
  - [x] `Toast`
  - [x] `EmptyState`
  - [x] `ConfirmDialog`
- [x] Definire componenti form evoluti:
  - [x] `CategoryPicker`
  - [x] `SubcategoryPicker`
  - [x] `OptionBuilder`
  - [x] `PersonalizationBuilder`
  - [x] `ImageUploader`
- [x] Portare variabili CSS esistenti in un sistema più ordinato.
- [x] Eliminare gradualmente CSS inline.

**Verifica**
- [x] Componenti riusabili funzionano isolatamente.
- [x] UI coerente su desktop e mobile.
- [x] Nessun form usa più select/input vecchi quando serve una scelta guidata.

---

## 5. Migrazione Admin React

Priorità alta: l’admin è la parte più complessa e quella che oggi soffre di più.

- [x] Creare layout admin React:
  - [x] sidebar
  - [x] header
  - [x] area contenuto
  - [x] gestione stato login
- [x] Migrare modulo categorie:
  - [x] lista categorie
  - [x] creazione categoria
  - [x] modifica categoria
  - [x] eliminazione categoria
  - [x] gestione sottocategorie
  - [x] ordinamento
  - [x] stato attivo/nascosto
- [x] Migrare modulo prodotti:
  - [x] lista prodotti
  - [x] creazione prodotto
  - [x] modifica prodotto
  - [x] eliminazione prodotto
  - [x] scelta categoria da modulo centralizzato
  - [x] scelta sottocategoria da modulo centralizzato
  - [x] upload immagine
- [x] Migrare personalizzazione prodotto:
  - [x] builder formati
  - [x] builder contenitori/colorazioni
  - [x] builder fragranze
  - [x] builder stili grafici
  - [x] builder confezioni
  - [x] builder campi personalizzati
  - [x] gestione extra prezzo
  - [x] gestione obbligatorietà
- [x] Migrare ordini:
  - [x] lista ordini
  - [x] filtri stato
  - [x] dettagli ordine
  - [x] timeline stato
  - [x] invio bozza
  - [x] messaggi cliente/admin
  - [x] cambio stato ordine
- [x] Migrare codici promo.
- [x] Migrare pannello Stripe.

**Verifica**
- [x] Admin React mostra categorie reali.
- [x] Admin React crea/modifica/elimina categorie.
- [x] Admin React crea prodotto usando solo categorie configurate.
- [x] Admin React salva personalizzazioni avanzate.
- [x] Admin React elimina prodotto e il front non lo mostra più.
- [x] Admin React gestisce ordini come prima.
- [x] Test e2e admin passano.

---

## 6. Migrazione Home React

- [x] Creare `HomePage`.
- [x] Migrare hero.
- [x] Migrare percorsi principali da categorie centralizzate.
- [x] Migrare griglia prodotti.
- [x] Aggiungere filtri categoria/sottocategoria.
- [x] Migrare sezioni marketing.
- [x] Migrare newsletter.
- [x] Rimuovere prodotti hardcoded da HTML.

**Verifica**
- [x] Home legge categorie da admin.
- [x] Home legge prodotti reali.
- [x] Prodotti eliminati non compaiono.
- [x] Filtri categoria/sottocategoria funzionano.
- [x] Newsletter funziona in cloud e fallback locale.

---

## 7. Migrazione pagina prodotto React

- [x] Creare `ProductPage`.
- [x] Leggere prodotto da route/query.
- [x] Mostrare stato “prodotto non disponibile” se eliminato.
- [x] Mostrare categoria e sottocategoria.
- [x] Mostrare gallery.
- [x] Mostrare prezzo base.
- [x] Collegare CTA al configuratore.

**Verifica**
- [x] Prodotto esistente si apre correttamente.
- [x] Prodotto eliminato mostra messaggio corretto.
- [x] CTA porta al configuratore con prodotto giusto.

---

## 8. Migrazione configuratore React

- [x] Creare `ConfiguratorPage`.
- [x] Leggere configurazione prodotto da admin.
- [x] Generare dinamicamente varianti prodotto.
- [x] Generare dinamicamente campi personalizzazione.
- [x] Gestire preview live.
- [x] Gestire upload foto.
- [x] Calcolare prezzo con extra.
- [x] Calcolare sconti quantità.
- [x] Validare campi obbligatori.
- [x] Aggiungere item al carrello.

**Verifica**
- [x] Configuratore cambia in base al prodotto.
- [x] Campi obbligatori bloccano invio.
- [x] Extra prezzo vengono calcolati.
- [x] Foto viene compressa e salvata correttamente.
- [x] Item carrello contiene tutte le personalizzazioni.

---

## 9. Migrazione carrello React

- [x] Creare `CartPage`.
- [x] Leggere carrello da localStorage.
- [x] Mostrare righe ordine.
- [x] Gestire quantità.
- [x] Gestire rimozione item.
- [x] Gestire codici promo.
- [x] Calcolare totali.
- [x] Gestire checkout.
- [x] Integrare login richiesto.
- [x] Integrare Stripe Checkout.

**Verifica**
- [x] Carrello conserva dati già presenti.
- [x] Totali corretti.
- [x] Codici promo funzionano.
- [x] Checkout crea ordine e sessione Stripe.
- [ ] Pagamento completato aggiorna ordine.

---

## 10. Migrazione account cliente React

- [x] Creare `AccountPage`.
- [x] Gestire login/logout.
- [x] Mostrare ordini cliente.
- [x] Mostrare stato ordine.
- [x] Mostrare bozze.
- [x] Approvare bozza.
- [x] Richiedere revisione.
- [x] Messaggistica cliente/admin.
- [x] Riprendere pagamento se necessario.

**Verifica**
- [x] Cliente vede solo i propri ordini.
- [x] Timeline ordine corretta.
- [x] Approvazione/revisione funziona.
- [x] Messaggi sincronizzati.

---

## 11. Routing e build finale

- [x] Scegliere routing:
  - [ ] React Router
  - [x] oppure routing statico compatibile con hosting attuale
- [x] Definire route:
  - [x] `/`
  - [x] `/product/:id`
  - [x] `/configuratore/:id?`
  - [x] `/cart`
  - [x] `/account`
  - [x] `/admin`
  - [x] `/assistenza`
  - [x] `/privacy`
  - [x] `/termini`
- [x] Configurare fallback hosting.
- [x] Aggiornare `firebase.json` / `vercel.json` se necessario.

**Verifica**
- [x] Refresh diretto su ogni route funziona.
- [x] Build deployabile.
- [x] Link interni corretti.
- [x] Nessun vecchio HTML necessario per i flussi principali.

---

## 12. Test e qualità

- [x] Aggiornare test Playwright.
- [x] Aggiungere test:
  - [x] creazione categoria admin
  - [x] creazione prodotto con categoria
  - [x] prodotto visibile in home
  - [x] prodotto eliminato non visibile
  - [x] configuratore dinamico
  - [x] carrello
  - [x] checkout
  - [x] account ordine
- [ ] Aggiungere lint.
- [ ] Aggiungere format.
- [x] Verificare accessibilità base:
  - [x] label form
  - [x] focus states
  - [x] navigazione tastiera
  - [x] contrasto

**Verifica**
- [x] `npm run build` OK.
- [x] `npm run test:e2e` OK.
- [x] Nessun errore console critico.
- [ ] Lighthouse base accettabile.

---

## 13. Cutover

- [x] Congelare modifiche sulla versione statica.
- [ ] Fare backup dati Firestore.
- [ ] Verificare regole Firestore.
- [ ] Deploy staging.
- [ ] Test end-to-end su staging.
- [ ] Deploy produzione.
- [ ] Monitorare errori e ordini.

**Verifica**
- [ ] Admin produzione funzionante.
- [ ] Home produzione funzionante.
- [ ] Configuratore produzione funzionante.
- [ ] Checkout produzione funzionante.
- [ ] Account cliente funzionante.
- [ ] Nessun prodotto eliminato ricompare.

---

## Ordine consigliato

1. Admin React
2. Categorie centralizzate
3. Builder prodotti/personalizzazioni
4. Configuratore React
5. Carrello React
6. Home React
7. Account React
8. Pagine secondarie
9. Cutover completo
