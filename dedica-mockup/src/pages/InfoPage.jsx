import { Badge, Button, Card } from "../components/index.js";

const pageContent = {
  assistenza: { eyebrow: "Assistenza", title: "Supporto clienti e tempi di produzione.", sections: [["Tempi", "Ogni candela personalizzata richiede preparazione, bozza e conferma prima della produzione."], ["Contatti", "Per domande su ordini, bozze o spedizioni scrivici indicando nome, email e numero ordine."], ["FAQ", "Dall’area cliente puoi seguire lo stato dell’ordine, leggere i messaggi e approvare la bozza."]] },
  "spedizioni-resi": { eyebrow: "Spedizioni e resi", title: "Consegna chiara per prodotti personalizzati.", sections: [["Spedizione", "Il costo viene calcolato nel carrello; sopra la soglia indicata la spedizione è gratuita."], ["Resi", "Le candele personalizzate non sono rivendibili, ma difetti o errori di produzione vengono gestiti dall’assistenza."], ["Stato ordine", "Riceverai aggiornamenti su pagamento, bozza, produzione e spedizione direttamente nell’area cliente."]] },
  privacy: { eyebrow: "Privacy", title: "Dati raccolti solo per ordine, pagamento e assistenza.", sections: [["Dati", "Usiamo dati di contatto, spedizione, personalizzazioni, immagini e messaggi solo per gestire l’ordine."], ["Pagamenti", "I dati di pagamento vengono trattati dal provider; DÈDICA non salva i dati completi della carta."], ["Diritti", "Puoi richiedere accesso, rettifica o cancellazione dei dati scrivendoci con l’email usata per l’ordine."]] },
  termini: { eyebrow: "Termini", title: "Condizioni per ordini personalizzati DÈDICA.", sections: [["Ordini", "L’ordine viene confermato dopo pagamento e validazione dei dati necessari alla produzione."], ["Bozze", "La bozza digitale può essere approvata o revisionata dall’area cliente."], ["Produzione", "Dopo l’approvazione della bozza il prodotto entra in lavorazione."]] }
};

const sources = [
  { code: "GPSR", title: "Regolamento (UE) 2023/988", text: "Richiede che siano immessi sul mercato soltanto prodotti sicuri e prevede analisi dei rischi e documentazione tecnica del fabbricante.", url: "https://eur-lex.europa.eu/eli/reg/2023/988/oj?locale=it" },
  { code: "CLP", title: "Guida ECHA per le candele", text: "Le candele sono miscele ai fini del CLP. Fragranze e altri componenti possono determinare classificazione, pittogrammi, avvertenze e ulteriori obblighi.", url: "https://echa.europa.eu/documents/10162/17240/candle_fact_sheet_en.pdf/8cb8384d-7366-bc8c-f530-16c7e32c2180" },
  { code: "UFI", title: "Identificatore di formula", text: "Per una miscela pericolosa soggetta a notifica, l’UFI collega il prodotto alle informazioni disponibili ai centri antiveleni.", url: "https://poisoncentres.echa.europa.eu/generate-and-apply-the-ufi" },
  { code: "UNI EN", title: "Norme tecniche per candele", text: "UNI EN 15493 riguarda la sicurezza antincendio, UNI EN 15494 le etichette di sicurezza e UNI EN 15426 il comportamento alla fuliggine.", url: "https://store.uni.com/uni-en-15493-2019" }
];

export function InfoPage({ page = "assistenza", onOpenHome }) {
  if (page === "chi-siamo") return <HowWeWorkPage onOpenHome={onOpenHome} />;
  if (page === "privacy") return <PrivacyPage onOpenHome={onOpenHome} />;
  if (page === "spedizioni-resi") return <ReturnsPolicyPage onOpenHome={onOpenHome} />;
  const content = pageContent[page] || pageContent.assistenza;
  return <main className="info-react">
    <section className="info-react-hero"><Badge>{content.eyebrow}</Badge><h1>{content.title}</h1><Button variant="secondary" onClick={onOpenHome}>Torna alla Home</Button></section>
    <section className="info-react-grid">{content.sections.map(([title, description]) => <Card key={title}><h2>{title}</h2><p>{description}</p></Card>)}</section>
  </main>;
}

function ReturnsPolicyPage({ onOpenHome }) {
  return <main className="privacy-policy returns-policy">
    <Badge>Resi e garanzia · versione 20 luglio 2026</Badge>
    <h1>Prodotti artigianali, tutele chiare.</h1>
    <p>Questa policy distingue il semplice ripensamento dai difetti di conformità e dai danni avvenuti durante il trasporto. I diritti inderogabili riconosciuti al consumatore restano sempre validi.</p>

    <section><h2>Candele personalizzate</h2><p>Le candele realizzate con dedica, fotografia, iniziali, colori, quantità o altre caratteristiche scelte dal cliente sono beni confezionati su misura o chiaramente personalizzati. Per tali prodotti non si applica il diritto di recesso per semplice ripensamento previsto per gli acquisti a distanza, ai sensi dell’art. 59, comma 1, lettera c), del Codice del consumo. Questa esclusione non limita i diritti in caso di prodotto difettoso, non conforme all’ordine o danneggiato durante il trasporto.</p></section>

    <section><h2>Approvazione della bozza</h2><p>Prima della produzione il cliente può controllare testo, nomi, date e impaginazione. L’approvazione autorizza DÈDICA ad avviare la lavorazione secondo la bozza mostrata. Un errore chiaramente presente nella bozza approvata non costituisce difetto di produzione; resta invece responsabilità di DÈDICA consegnare un prodotto corrispondente alla bozza e alle opzioni ordinate.</p></section>

    <section><h2>Prodotti non personalizzati</h2><p>Per gli eventuali prodotti standard non personalizzati il consumatore può comunicare il recesso entro 14 giorni dalla consegna, secondo gli artt. 52 e seguenti del Codice del consumo. Il costo diretto della restituzione è a carico del cliente, previa corretta informazione ai sensi dell’art. 57. DÈDICA rimborsa i pagamenti dovuti, compreso il costo della consegna standard originaria, secondo l’art. 56 e può attendere la restituzione del bene o la prova della sua spedizione. Il cliente risponde dell’eventuale diminuzione di valore causata da un uso superiore a quello necessario per verificare il prodotto.</p></section>

    <section><h2>Garanzia legale di conformità</h2><p>I prodotti nuovi sono coperti dalla garanzia legale di conformità per due anni dalla consegna, ai sensi degli artt. 128 e seguenti del Codice del consumo. In presenza di un difetto il cliente può richiedere il ripristino della conformità mediante riparazione o sostituzione senza spese secondo gli artt. 135-bis e 135-ter. Quando tali rimedi non siano praticabili nelle condizioni previste dalla legge, possono applicarsi una riduzione del prezzo o la risoluzione del contratto. La garanzia legale non può essere esclusa o limitata, come stabilito dall’art. 135-sexies.</p><ul><li>Dedica, foto, fragranza, colore, formato o quantità diversi dall’ordine.</li><li>Prodotto significativamente diverso dalla descrizione o dalla bozza approvata.</li><li>Contenitore rotto, instabile o difettoso.</li><li>Stoppino o componenti che impediscono il normale utilizzo.</li><li>Confezione o parti dell’ordine mancanti.</li></ul></section>

    <section><h2>Caratteristiche della lavorazione artigianale</h2><p>Piccole variazioni di tonalità, texture, superficie o posizione delle decorazioni possono derivare dalla lavorazione manuale e non costituiscono di per sé un difetto quando non compromettono estetica complessiva, funzionalità, sicurezza o corrispondenza con l’ordine. Non sono coperti i danni causati da urti successivi alla consegna, esposizione a fonti di calore, conservazione impropria o utilizzo contrario alle istruzioni di sicurezza.</p></section>

    <section><h2>Danni durante il trasporto</h2><p>In applicazione dell’art. 63 del Codice del consumo, DÈDICA risponde della perdita e dei danni fino alla consegna fisica al cliente quando il vettore è incaricato da DÈDICA. Il cliente non deve risolvere autonomamente la controversia con il corriere. In caso di pacco o candela danneggiati, non utilizzare il prodotto e inviare la segnalazione dall’Area personale indicando il numero d’ordine.</p><p>Per velocizzare la verifica chiediamo, possibilmente entro 48 ore, fotografie dell’imballaggio esterno, dell’etichetta di spedizione, dell’interno del pacco e del prodotto. Il termine di 48 ore agevola la pratica con il vettore e non limita i diritti previsti dalla garanzia legale.</p></section>

    <section><h2>Soluzione della segnalazione</h2><p>DÈDICA conferma la presa in carico e risponde normalmente entro due giorni lavorativi. Quando il danno o la non conformità sono confermati, la soluzione viene scelta nel rispetto della legge e può consistere in sostituzione gratuita, riparazione quando appropriata, riduzione del prezzo o rimborso. Le eventuali spese necessarie al rientro di un prodotto difettoso o danneggiato sono sostenute da DÈDICA.</p></section>

    <section><h2>Come contattarci</h2><p>Apri l’ordine nella tua Area personale e usa “Messaggi sull’ordine”, specificando il problema e quando è stato rilevato. In alternativa utilizza i recapiti aziendali riportati nel footer. Conserva prodotto, confezione ed etichetta di spedizione finché la pratica non è conclusa.</p></section>

    <section><h2>Riferimenti normativi e fonti ufficiali</h2><ul><li><a href="https://www.normattiva.it/eli/id/2005/10/08/005G0232/CONSOLIDATED/20250521" target="_blank" rel="noreferrer">D.lgs. 6 settembre 2005, n. 206 — Codice del consumo (testo consolidato) ↗</a></li><li><a href="https://www.mimit.gov.it/it/mercato-e-consumatori/tutela-del-consumatore/diritti-del-consumatore/diritto-di-recesso" target="_blank" rel="noreferrer">MIMIT — Diritto di recesso ↗</a></li><li><a href="https://www.mimit.gov.it/it/mercato-e-consumatori/tutela-del-consumatore/diritti-del-consumatore/garanzia-legale" target="_blank" rel="noreferrer">MIMIT — Garanzia legale di conformità ↗</a></li><li><a href="https://europa.eu/youreurope/citizens/consumers/shopping/shipping-delivery/index_it.htm" target="_blank" rel="noreferrer">Unione europea — Spedizione, consegna e merci danneggiate ↗</a></li></ul><p>In particolare: artt. 49 e 52–59 sulle informazioni e sul recesso; art. 63 sul passaggio del rischio; artt. 128–135-septies sulla conformità dei beni e sui rimedi del consumatore.</p></section>

    <aside className="craft-note"><strong>Sicurezza</strong><p>Non accendere né utilizzare una candela con contenitore incrinato, rotto o instabile. Interrompi immediatamente l’uso se il contenitore o la fiamma mostrano un comportamento anomalo.</p></aside>
    <Button variant="secondary" onClick={onOpenHome}>Torna alla Home</Button>
  </main>;
}

function PrivacyPage({ onOpenHome }) {
  return <main className="privacy-policy">
    <Badge>Privacy e cookie policy · versione 18 luglio 2026</Badge><h1>Dati raccolti solo per ordine, assistenza e scelte facoltative</h1>
    <p>Informativa ai sensi degli articoli 12 e 13 del Regolamento (UE) 2016/679. Il titolare è DÈDICA. Prima della pubblicazione vanno completati i dati identificativi e il contatto privacy indicati nella checklist GDPR del progetto.</p>
    <section><h2>Dati, finalità e basi giuridiche</h2><ul><li><strong>Account:</strong> email e identificativi, per creare e proteggere l’area personale; contratto e misure precontrattuali.</li><li><strong>Ordini:</strong> contatti, indirizzi, dati fiscali, dediche, immagini e messaggi; esecuzione del contratto.</li><li><strong>Pagamenti e contabilità:</strong> esiti e identificativi della transazione, non i dati completi della carta; contratto e obblighi di legge.</li><li><strong>Assistenza e sicurezza:</strong> nome, email, numero d’ordine, contenuto della richiesta, risposte e log necessari a gestire la pratica; contratto, obblighi di legge e legittimo interesse alla sicurezza e difesa dei diritti.</li><li><strong>Newsletter:</strong> email e prova del consenso; consenso revocabile.</li><li><strong>Analytics:</strong> uso del sito tramite Firebase Analytics, soltanto dopo consenso.</li></ul></section>
    <section><h2>Destinatari e trasferimenti</h2><p>I dati possono essere comunicati, nei limiti necessari, a Google/Firebase, Stripe, Resend, Spediamo.it, vettori, consulenti fiscali e fornitori tecnici. Gli eventuali trasferimenti extra SEE devono fondarsi su decisioni di adeguatezza o garanzie degli articoli 44–49 GDPR; il titolare deve verificare e conservare DPA e configurazioni effettive.</p></section>
    <section><h2>Conservazione</h2><ul><li>Dati fiscali e documenti contabili: 10 anni, salvo contenzioso.</li><li>Ordini e pratiche di assistenza collegate: durata del rapporto e fino a 10 anni per tutela contrattuale; immagini eliminate prima quando non più necessarie.</li><li>Richieste generiche non collegate a un ordine: fino a 24 mesi dalla chiusura, salvo necessità di ulteriore conservazione.</li><li>Account inattivi senza ordini: 24 mesi.</li><li>Newsletter: fino a revoca o 24 mesi di inattività.</li><li>Preferenze cookie: 6 mesi; retention analytics da verificare nella console Firebase.</li></ul></section>
    <section><h2>Cookie e memoria locale</h2><p>Carrello, sessione, sicurezza e preferenze usano strumenti tecnici necessari. Firebase Analytics resta bloccato fino al consenso. Puoi cambiare scelta dal pulsante “Preferenze privacy”.</p></section>
    <section><h2>I tuoi diritti</h2><p>Puoi chiedere accesso, rettifica, cancellazione, limitazione e portabilità, opporti, revocare il consenso e proporre reclamo al Garante. Invia la richiesta al contatto privacy ufficiale del titolare, da inserire prima della pubblicazione. La risposta è fornita di norma entro un mese.</p></section>
    <section><h2>Conferimento e automazione</h2><p>I dati obbligatori servono a concludere e consegnare l’ordine. Newsletter e analytics sono facoltativi. Non adottiamo decisioni esclusivamente automatizzate con effetti giuridici o analogamente significativi.</p></section>
    <Button variant="secondary" onClick={onOpenHome}>Torna alla Home</Button>
  </main>;
}

function HowWeWorkPage({ onOpenHome }) {
  return <main className="craft-page">
    <section className="craft-hero">
      <img src="/assets/manifesto.webp" alt="Lavorazione artigianale di una candela DÈDICA" />
      <div><span className="eyebrow">Dentro l’atelier</span><h1>Fatta a mano.<br />Pensata per te.</h1><p>Ogni candela nasce in piccole lavorazioni: dalla composizione alla finitura, fino alla dedica che la rende soltanto tua.</p><Button variant="secondary" onClick={onOpenHome}>Torna alla Home</Button></div>
    </section>

    <section className="craft-intro"><span>Il nostro processo</span><h2>L’artigianalità non è improvvisazione.</h2><p>È attenzione ripetuta in ogni passaggio: materie prime tracciabili, ricetta controllata, stoppino adatto al formato, finitura manuale e informazioni d’uso chiare.</p></section>

    <section className="craft-steps">
      {[['01', 'Prepariamo', 'Selezioniamo contenitore, cera, stoppino e fragranza in base al progetto.'], ['02', 'Coliamo', 'Ogni pezzo viene colato e rifinito a mano, rispettando tempi e temperature della composizione.'], ['03', 'Personalizziamo', 'La dedica approvata diventa parte dell’etichetta e dell’identità della candela.'], ['04', 'Controlliamo', 'Prima del confezionamento verifichiamo aspetto, finitura, etichetta e corrispondenza con l’ordine.']].map(([n, title, text]) => <article key={n}><span>{n}</span><h3>{title}</h3><p>{text}</p></article>)}
    </section>

    <section className="craft-gallery"><img src="/assets/gallery-top.webp" alt="Dettagli delle candele DÈDICA" /><img src="/assets/gallery-pastel.webp" alt="Candele personalizzate in tonalità pastello" /><img src="/assets/config-candle.webp" alt="Dettaglio di una candela personalizzata" /></section>

    <section className="craft-safety">
      <div className="craft-safety-heading"><span className="eyebrow">Sicurezza e trasparenza</span><h2>Le regole fanno parte del progetto.</h2><p>Essere realizzata a mano non esonera una candela dagli obblighi di sicurezza. Questi sono i principali riferimenti europei applicabili da valutare prodotto per prodotto.</p></div>
      <div className="craft-source-list">{sources.map((source) => <a key={source.code} href={source.url} target="_blank" rel="noreferrer"><small>{source.code}</small><strong>{source.title}</strong><p>{source.text}</p><span>Consulta la fonte ufficiale ↗</span></a>)}</div>
    </section>

    <aside className="craft-note"><strong>Nota di trasparenza</strong><p>Le norme tecniche sono riferimenti per progettazione e prova; non equivalgono da sole a una certificazione. La classificazione CLP dipende dalla formula effettiva e dalle informazioni dei fornitori. Questa pagina descrive il quadro di riferimento, non sostituisce una valutazione tecnica o legale del singolo prodotto.</p></aside>
  </main>;
}
