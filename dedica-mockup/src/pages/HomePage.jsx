import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, Toast } from "../components/index.js";
import { listCategories } from "../services/categories.js";
import { listProducts } from "../services/products.js";
import { subscribeNewsletter } from "../services/newsletter.js";

export function HomePage({ onOpenProduct, onOpenConfigurator, onOpenInfo }) {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeCategory, setActiveCategory] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [newsletterConsent, setNewsletterConsent] = useState(false);

  useEffect(() => {
    Promise.all([listCategories({ includeInactive: false }), listProducts()]).then(([nextCategories, nextProducts]) => {
      setCategories(nextCategories);
      setProducts(nextProducts);
      setLoading(false);
    });
  }, []);

  const visibleProducts = useMemo(() => products.filter((product) => {
    const category = categories.find((item) => item.id === product.category);
    return category?.active && (!activeCategory || product.category === activeCategory);
  }), [activeCategory, categories, products]);

  const giftCategory = categories.find((category) => /regalo|gift/i.test(`${category.id} ${category.name}`)) || categories[0];
  const eventCategory = categories.find((category) => /evento|event|matrimonio|battesimo/i.test(`${category.id} ${category.name}`)) || categories[1];
  const featuredProduct = visibleProducts[0] || products[0];

  function scrollToProducts() {
    document.getElementById("prodotti")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openCategory(category) {
    setActiveCategory(category?.id || "");
    window.setTimeout(scrollToProducts, 0);
  }

  async function handleNewsletterSubmit(event) {
    event.preventDefault();
    try {
      if (!newsletterConsent) throw new Error("Per iscriverti devi prestare il consenso alla newsletter.");
      await subscribeNewsletter(email, { consentVersion: "privacy-2026-07-18" });
      setEmail("");
      setNewsletterConsent(false);
      setToast("Iscrizione newsletter registrata.");
    } catch (error) {
      setToast(error.message || "Newsletter non disponibile.");
    }
  }

  return (
    <main className="home-react">
      <section className="home-react-hero">
        <div className="home-react-hero-copy">
          <span className="eyebrow">Fatta per qualcuno, non per tutti</span>
          <h1>Una candela.<br />La tua dedica.</h1>
          <p>Trasforma parole importanti in un regalo creato su misura.</p>
          <div className="ui-actions">
            <Button onClick={scrollToProducts}>Scopri le candele</Button>
            <Button variant="ghost" onClick={scrollToProducts}>Scegli la tua →</Button>
          </div>
          <div className="home-react-hero-proof">
            <span>Bozza digitale inclusa</span><span>Confezione regalo</span><span>Creata in Italia</span>
          </div>
        </div>
        <div className="home-react-hero-art">
          <img src="/assets/hero.webp" alt="Candela DÈDICA personalizzata in un ambiente elegante" />
          <div className="home-react-hero-caption"><span>Collezione DÈDICA</span><strong>Parole che restano</strong></div>
        </div>
      </section>

      <section className="home-react-split" aria-label="Esplora le collezioni">
        <CategoryStory eyebrow="Idee regalo" title="Un pensiero che parla di voi." image="/assets/gift.webp" count={products.filter((p) => p.category === giftCategory?.id).length} onOpen={() => openCategory(giftCategory)} />
        <CategoryStory eyebrow="Candele evento" title="Il dettaglio che rende unico il giorno." image="/assets/event.webp" count={products.filter((p) => p.category === eventCategory?.id).length} onOpen={() => openCategory(eventCategory)} />
      </section>

      <section className="home-react-manifesto">
        <div className="home-react-manifesto-image"><img src="/assets/manifesto.webp" alt="Dettaglio artigianale di una candela DÈDICA" /></div>
        <div className="home-react-manifesto-copy">
          <span className="eyebrow">Il nostro modo di creare</span>
          <h2>Prima il significato.<br />Poi la candela.</h2>
          <p>Ogni DÈDICA nasce dalle tue parole. Noi le trasformiamo in un oggetto essenziale, curato e irripetibile.</p>
          <Button variant="secondary" onClick={() => onOpenInfo("chi-siamo")}>Scopri come lavoriamo</Button>
        </div>
      </section>

      <section className="home-react-process" aria-label="Come funziona">
        {[['01', 'Scegli', 'La candela e l’occasione.'], ['02', 'Personalizza', 'Parole, stile e fragranza.'], ['03', 'Approva', 'Ricevi la bozza digitale.'], ['04', 'Regala', 'Noi creiamo e confezioniamo.']].map(([step, title, text]) => (
          <Card key={step} className="home-react-process-card"><span>{step}</span><h3>{title}</h3><p>{text}</p></Card>
        ))}
      </section>

      <section className="home-react-section" id="prodotti">
        <div className="admin-react-header">
          <div><span className="eyebrow">Le più amate</span><h2>Scegli da dove iniziare</h2><p>{loading ? "Caricamento catalogo..." : `${visibleProducts.length} proposte personalizzabili`}</p></div>
          {activeCategory && <Button variant="ghost" onClick={() => setActiveCategory("")}>Mostra tutto</Button>}
        </div>
        {visibleProducts.length === 0 ? <EmptyState title="Nessuna candela trovata" description="Nuove creazioni sono in arrivo." /> : (
          <div className="home-react-product-grid">
            {visibleProducts.slice(0, 6).map((product) => {
              const category = categories.find((item) => item.id === product.category);
              return <Card key={product.id} className="home-react-product-card">
                <button className="home-react-product-image" onClick={() => onOpenProduct(product.id)}><img src={product.image} alt={product.name} /></button>
                <Badge>{product.badge || category?.name || "DÈDICA"}</Badge>
                <div className="home-react-product-title"><h3>{product.name}</h3><strong>{product.price.toFixed(2).replace(".", ",")} €</strong></div>
                <Button variant="secondary" onClick={() => onOpenConfigurator(product.id)}>Personalizza</Button>
              </Card>;
            })}
          </div>
        )}
      </section>

      <section className="home-react-newsletter">
        <div><span className="eyebrow">Dal nostro atelier</span><h2>Nuove storie da dedicare.</h2><p>Collezioni, ispirazioni e occasioni speciali. Solo quando ne vale la pena.</p></div>
        <form onSubmit={handleNewsletterSubmit}><div className="newsletter-email-row"><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="La tua email" aria-label="Indirizzo email per la newsletter" required /><Button type="submit">Iscriviti</Button></div><label className="newsletter-consent"><input type="checkbox" checked={newsletterConsent} onChange={(event) => setNewsletterConsent(event.target.checked)} required /><span>Acconsento alla newsletter e ho letto la <button type="button" onClick={() => onOpenInfo("privacy")}>privacy policy</button>.</span></label></form>
      </section>

      <section className="home-payment-trust" aria-label="Informazioni sul pagamento">
        <div><span aria-hidden="true">🔒</span><p><strong>Pagamento sicuro</strong><small>Checkout protetto tramite Stripe</small></p></div>
        <div><span aria-hidden="true">🛡️</span><p><strong>Dati protetti</strong><small>Non memorizziamo i dati completi della carta</small></p></div>
        <div><span aria-hidden="true">✓</span><p><strong>Riepilogo trasparente</strong><small>Totale e spedizione sempre visibili</small></p></div>
      </section>

      <Toast message={toast} />
    </main>
  );
}

function CategoryStory({ eyebrow, title, image, count, onOpen }) {
  return <article className="home-react-story-card">
    <img src={image} alt="" />
    <div className="home-react-story-overlay"><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><span>{count} proposte</span><Button variant="secondary" onClick={onOpen}>Esplora →</Button></div>
  </article>;
}
