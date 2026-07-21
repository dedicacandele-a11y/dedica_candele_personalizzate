import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState } from "../components/index.js";
import { listCategories } from "../services/categories.js";
import { getProduct } from "../services/products.js";

export function ProductPage({ productId, onBack, onOpenHome, onOpenConfigurator }) {
  const [categories, setCategories] = useState([]);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    async function loadProduct() {
      setLoading(true);
      const [nextCategories, nextProduct] = await Promise.all([
        listCategories({ includeInactive: false }),
        productId ? getProduct(productId) : null
      ]);
      setCategories(nextCategories);
      setProduct(nextProduct);
      setLoading(false);
    }

    loadProduct();
  }, [productId]);

  useEffect(() => setActiveImage(0), [productId]);

  const category = useMemo(
    () => categories.find(item => item.id === product?.category),
    [categories, product]
  );

  const gallery = useMemo(() => {
    if (!product) return [];
    return [product.image, ...(product.gallery || [])].filter(Boolean).filter((item, index, items) => items.indexOf(item) === index);
  }, [product]);

  if (loading) {
    return (
      <main className="product-react">
        <EmptyState title="Caricamento prodotto" />
      </main>
    );
  }

  if (!product || !category) {
    return (
      <main className="product-react">
        <Card className="product-react-unavailable">
          <Badge>Non disponibile</Badge>
          <h1>Questo prodotto non è più a catalogo.</h1>
          <p>Potrebbe essere esaurito o rimosso dalla collezione. Torna allo shop per scoprire le alternative disponibili.</p>
          <div className="ui-actions">
            <Button onClick={onOpenHome}>Torna al catalogo</Button>
            <Button variant="ghost" onClick={onOpenHome}>Home</Button>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="product-react">
      <section className="product-react-layout">
        <div className="product-react-gallery">
          <div className="product-react-main-image"><img src={gallery[activeImage]} alt={`${product.name}, vista ${activeImage + 1}`} /></div>
          {gallery.length > 1 && <div className="product-react-thumbnails" aria-label="Galleria prodotto">
            {gallery.map((imageUrl, index) => <button key={`${imageUrl}-${index}`} type="button" className={activeImage === index ? "active" : ""} onClick={() => setActiveImage(index)} aria-label={`Mostra immagine ${index + 1}`}><img src={imageUrl} alt="" /></button>)}
          </div>}
        </div>

        <Card className="product-react-summary">
          <Badge>{product.badge || category.name}</Badge>
          <h1>{product.name}</h1>
          <p>{product.desc || "Candela personalizzabile dal configuratore."}</p>
          <div className="product-react-meta">
            <span>Categoria</span>
            <strong>{category.name}</strong>
            <span>Sottocategoria</span>
            <strong>{product.occasion}</strong>
            <span>Prezzo base</span>
            <strong>{product.price.toFixed(2).replace(".", ",")} €</strong>
          </div>
          <ProductDetails product={product} />
          <div className="product-react-trust">
            <strong>Incluso con ogni ordine</strong>
            <ul>
              <li>Bozza digitale prima della produzione</li>
              <li>Confezione curata e pronta da regalare</li>
              <li>Assistenza per dediche, foto e dettagli grafici</li>
            </ul>
          </div>
          <div className="ui-actions">
            <Button onClick={() => onOpenConfigurator(product.id)}>Personalizza</Button>
            <Button variant="secondary" onClick={onOpenHome}>Torna al catalogo</Button>
          </div>
        </Card>
      </section>
    </main>
  );
}

function ProductDetails({ product }) {
  const details = [
    ["Fragranza", product.details?.fragrance || "Personalizzabile dove disponibile"],
    ["Cera", product.details?.wax || "Miscela selezionata per colata artigianale"],
    ["Durata", product.details?.burnTime || "Variabile in base al formato scelto"],
    ["Formato", product.details?.size || "Scegli il formato nel configuratore"],
    ["Produzione", product.details?.productionTime || "Preparata su richiesta dopo approvazione bozza"],
    ["Confezione", product.details?.packaging || "Packaging regalo disponibile"]
  ];

  return (
    <div className="product-react-details">
      {details.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}
