import { useEffect, useState } from "react";
import { getCart } from "../services/cart.js";
import { isAdminUser, signOutUser, watchCurrentUser } from "../services/auth.js";
import { Button } from "./Button.jsx";
import { watchCustomerUnread } from "../services/orders.js";

export function BrandHeader({ activeView, onNavigate }) {
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartCount, setCartCount] = useState(getCartCount);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let unsubscribe = () => {};
    let unsubscribeUnread = () => {};
    watchCurrentUser(async currentUser => {
      setUser(currentUser);
      unsubscribeUnread();
      unsubscribeUnread = () => {};
      if (currentUser) unsubscribeUnread = await watchCustomerUnread(setUnreadCount);
      else setUnreadCount(0);
    }).then((nextUnsubscribe) => {
      unsubscribe = nextUnsubscribe;
    });

    const refreshCart = () => setCartCount(getCartCount());
    window.addEventListener("storage", refreshCart);
    window.addEventListener("dedica:cart-change", refreshCart);
    window.addEventListener("focus", refreshCart);
    return () => {
      unsubscribe();
      unsubscribeUnread();
      window.removeEventListener("storage", refreshCart);
      window.removeEventListener("dedica:cart-change", refreshCart);
      window.removeEventListener("focus", refreshCart);
    };
  }, []);

  function navigate(view, productId = "") {
    setMenuOpen(false);
    onNavigate(view, productId);
  }

  function navigateHomeSection(sectionId) {
    setMenuOpen(false);
    onNavigate("home", "", sectionId);
  }

  async function logout() {
    await signOutUser();
    setUser(null);
    navigate("home");
  }

  const accountLabel = user ? "Account" : "Login";
  const adminLoggedIn = isAdminUser(user);

  return (
    <header className="brand-header">
      <div className="brand-header-inner">
        <nav className="brand-nav brand-nav-left" aria-label="Navigazione principale">
          <button className={activeView === "home" ? "active" : ""} onClick={() => navigate("home")}>Home</button>
          <button onClick={() => navigateHomeSection("prodotti")}>Shop</button>
          <button className={activeView === "fragranze" ? "active" : ""} onClick={() => navigate("fragranze")}>Fragranze</button>
          <button className={activeView === "configurator" ? "active" : ""} onClick={() => navigateHomeSection("personalizza")}>Personalizza</button>
        </nav>

        <button className="brand-logo" onClick={() => navigate("home")} aria-label="DÈDICA Home">
          <img src="/assets/logo.svg" alt="DÈDICA" />
          <span>Fatta per qualcuno, non per tutti.</span>
        </button>

        <div className="brand-actions">
          {adminLoggedIn ? <button className="brand-link muted" onClick={() => navigate("admin")}>Admin</button> : null}
          {user ? <button className="brand-notifications" onClick={() => navigate("account")} aria-label={`${unreadCount} notifiche non lette`} title="Messaggi e aggiornamenti ordini">&#128276;{unreadCount > 0 ? <span>{unreadCount}</span> : null}</button> : null}
          <button className="brand-link" onClick={() => navigate(user ? "account" : "login")}>{accountLabel}</button>
          <button className="brand-cart" onClick={() => navigate("cart")} aria-label={`Carrello, ${cartCount} articoli`}>
            ♡
            <span>{cartCount}</span>
          </button>
          {user ? <Button variant="ghost" onClick={logout}>Esci</Button> : null}
          <button className="brand-menu-toggle" onClick={() => setMenuOpen(open => !open)} aria-label="Menu">☰</button>
        </div>
      </div>

      {menuOpen ? (
        <nav className="brand-mobile-menu" aria-label="Menu mobile">
          <button onClick={() => navigate("home")}>Home</button>
          <button onClick={() => navigateHomeSection("prodotti")}>Shop</button>
          <button onClick={() => navigate("fragranze")}>Fragranze</button>
          <button onClick={() => navigateHomeSection("personalizza")}>Personalizza</button>
          <button onClick={() => navigate("cart")}>Carrello ({cartCount})</button>
          {user ? <button onClick={() => navigate("account")}>Notifiche ({unreadCount})</button> : null}
          {adminLoggedIn ? <button onClick={() => navigate("admin")}>Pannello Admin</button> : null}
          <button onClick={() => navigate(user ? "account" : "login")}>{accountLabel}</button>
        </nav>
      ) : null}
    </header>
  );
}

function getCartCount() {
  return getCart().reduce((sum, item) => sum + Number(item.qty || 0), 0);
}
