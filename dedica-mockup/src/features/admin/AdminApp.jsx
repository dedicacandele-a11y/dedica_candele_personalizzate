import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card } from "../../components/index.js";
import { signOutUser, watchCurrentUser } from "../../services/auth.js";
import { isFirebaseLocal } from "../../services/firebase.js";
import { listAdminOrders, getOrderStatusLabel } from "../../services/orders.js";
import { listProducts } from "../../services/products.js";
import { AdminCategoriesPage } from "./categories/AdminCategoriesPage.jsx";
import { AdminDiscountsPage } from "./discounts/AdminDiscountsPage.jsx";
import { AdminOrdersPage } from "./orders/AdminOrdersPage.jsx";
import { AdminPaymentsPage } from "./payments/AdminPaymentsPage.jsx";
import { AdminProductsPage } from "./products/AdminProductsPage.jsx";
import { AdminFinancePage } from "./finance/AdminFinancePage.jsx";
import { AdminCatalogOptionsPage } from "./options/AdminCatalogOptionsPage.jsx";
import { AdminShippingPage } from "./shipping/AdminShippingPage.jsx";
import { AdminUsersPage } from "./users/AdminUsersPage.jsx";
import { AdminBusinessPage } from "./business/AdminBusinessPage.jsx";
import { AdminSupportPage } from "./support/AdminSupportPage.jsx";

const navGroups = [
  { label: "Gestione", items: [{ id: "overview", label: "Panoramica", icon: "⌂" }, { id: "orders", label: "Ordini", icon: "□" }, { id: "support", label: "Assistenza", icon: "?" }, { id: "users", label: "Utenti", icon: "◎" }, { id: "shipping", label: "Spedizioni", icon: "➜" }, { id: "products", label: "Prodotti", icon: "◇" }, { id: "categories", label: "Categorie", icon: "▦" }, { id: "options", label: "Opzioni catalogo", icon: "≡" }] },
  { label: "Vendite", items: [{ id: "finance", label: "Finanze", icon: "◒" }, { id: "discounts", label: "Promozioni", icon: "%" }, { id: "payments", label: "Pagamenti", icon: "€" }] },
  { label: "Impostazioni", items: [{ id: "business", label: "Dati aziendali", icon: "▤" }] }
];

export function AdminApp({ onBack }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let unsubscribe = () => {};
    watchCurrentUser((nextUser) => { setUser(nextUser); setAuthReady(true); }).then((nextUnsubscribe) => { unsubscribe = nextUnsubscribe; });
    Promise.all([listAdminOrders(), listProducts()]).then(([nextOrders, nextProducts]) => { setOrders(nextOrders); setProducts(nextProducts); }).catch(() => {});
    return () => unsubscribe();
  }, []);

  const actionCount = useMemo(() => orders.filter(order => ["paid", "revision_requested", "draft_approved", "in_production"].includes(order.status)).length, [orders]);

  function navigateAdmin(tab) { setActiveTab(tab); setMobileOpen(false); }
  async function handleSignOut() { await signOutUser(); setUser(null); onBack(); }

  return <main className={`admin-react-shell${collapsed ? " is-collapsed" : ""}${mobileOpen ? " mobile-open" : ""}`}>
    <button className="admin-mobile-toggle" onClick={() => setMobileOpen(open => !open)} aria-label="Apri menu amministrazione">☰ <span>Menu</span></button>
    {mobileOpen ? <button className="admin-sidebar-scrim" onClick={() => setMobileOpen(false)} aria-label="Chiudi menu" /> : null}
    <aside className="admin-react-sidebar">
      <div className="admin-sidebar-brand"><strong>DÈDICA</strong><span>Pannello amministrativo</span><button onClick={() => setCollapsed(value => !value)} aria-label={collapsed ? "Espandi sidebar" : "Riduci sidebar"}>{collapsed ? "›" : "‹"}</button></div>
      <nav className="admin-sidebar-nav" aria-label="Navigazione amministrazione">
        {navGroups.map(group => <section key={group.label}><span className="admin-sidebar-group-label">{group.label}</span>{group.items.map(item => <button key={item.id} className={activeTab === item.id ? "active" : ""} onClick={() => navigateAdmin(item.id)} title={collapsed ? item.label : undefined}><i>{item.icon}</i><span>{item.label}</span>{item.id === "orders" && actionCount > 0 ? <b>{actionCount}</b> : null}</button>)}</section>)}
      </nav>
      <div className="admin-sidebar-footer">
        <div className="admin-sidebar-profile"><span>{getInitials(user?.email)}</span><div><strong>{displayName(user)}</strong><small>Amministratore</small></div></div>
        <button onClick={onBack}><i>↗</i><span>Vai al sito</span></button>
        {user ? <button onClick={handleSignOut}><i>↪</i><span>Esci</span></button> : null}
        <small className="admin-sidebar-connection">{authReady ? (isFirebaseLocal ? "Modalità locale" : "Connesso") : "Connessione..."}</small>
      </div>
    </aside>

    <section className="admin-react-content">
      <div className="admin-context-bar">
        <span>Stai lavorando nel pannello amministrativo</span>
        <Button variant="secondary" onClick={onBack}>← Torna al sito</Button>
      </div>
      {activeTab === "overview" ? <AdminOverview orders={orders} products={products} onNavigate={navigateAdmin} /> : null}
      {activeTab === "categories" ? <AdminCategoriesPage /> : null}
      {activeTab === "products" ? <AdminProductsPage /> : null}
      {activeTab === "orders" ? <AdminOrdersPage onNavigate={navigateAdmin} /> : null}
      {activeTab === "discounts" ? <AdminDiscountsPage /> : null}
      {activeTab === "payments" ? <AdminPaymentsPage /> : null}
      {activeTab === "finance" ? <AdminFinancePage /> : null}
      {activeTab === "options" ? <AdminCatalogOptionsPage /> : null}
      {activeTab === "shipping" ? <AdminShippingPage /> : null}
      {activeTab === "users" ? <AdminUsersPage /> : null}
      {activeTab === "business" ? <AdminBusinessPage /> : null}
      {activeTab === "support" ? <AdminSupportPage /> : null}
    </section>
  </main>;
}

function AdminOverview({ orders, products, onNavigate }) {
  const cards = [
    ["Bozze da preparare", orders.filter(order => order.status === "paid").length, "orders"],
    ["Revisioni richieste", orders.filter(order => order.status === "revision_requested").length, "orders"],
    ["In produzione", orders.filter(order => ["draft_approved", "in_production"].includes(order.status)).length, "orders"],
    ["Prodotti attivi", products.length, "products"]
  ];
  return <div className="admin-react-stack"><header className="admin-react-header"><div><span className="eyebrow">Oggi</span><h2>Panoramica</h2><p>Le attività che richiedono attenzione nel flusso DÈDICA.</p></div></header><div className="admin-overview-grid">{cards.map(([label, value, target]) => <Card key={label} onClick={() => onNavigate(target)}><span>{label}</span><strong>{value}</strong><button type="button">Apri →</button></Card>)}</div><Card className="admin-overview-recent"><div className="admin-react-card-head"><div><strong>Ordini recenti</strong><small>Ultimi aggiornamenti</small></div><Button variant="secondary" onClick={() => onNavigate("orders")}>Tutti gli ordini</Button></div><div className="admin-overview-orders">{orders.slice(0, 5).map(order => <div key={order.id}><strong className="admin-overview-order-id" title={order.id}>#{order.id}</strong><span className="admin-overview-order-email">{order.email || "Cliente"}</span><Badge>{getOrderStatusLabel(order.status)}</Badge></div>)}{orders.length === 0 ? <p>Nessun ordine disponibile.</p> : null}</div></Card></div>;
}

function getInitials(email = "") { return email ? email.slice(0, 2).toUpperCase() : "AD"; }
function displayName(user) { if (user?.isLocalAdmin) return "Admin locale"; return user?.email?.split("@")[0]?.replace(/[._-]/g, " ") || "Amministratore"; }
