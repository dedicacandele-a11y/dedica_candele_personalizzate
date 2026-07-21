import { useState } from "react";
import { BrandHeader } from "../components/index.js";
import { PrivacyConsent } from "../components/PrivacyConsent.jsx";
import { AdminApp } from "../features/admin/AdminApp.jsx";
import { AccountPage } from "../pages/AccountPage.jsx";
import { CartPage } from "../pages/CartPage.jsx";
import { ConfiguratorPage } from "../pages/ConfiguratorPage.jsx";
import { HomePage } from "../pages/HomePage.jsx";
import { InfoPage } from "../pages/InfoPage.jsx";
import { LoginPage } from "../pages/LoginPage.jsx";
import { MigrationDashboard } from "../pages/MigrationDashboard.jsx";
import { PaymentResultPage } from "../pages/PaymentResultPage.jsx";
import { ProductPage } from "../pages/ProductPage.jsx";
import { FragrancesPage } from "../pages/FragrancesPage.jsx";
import { AssistancePage } from "../pages/AssistancePage.jsx";
import { CompanyFooter } from "../components/CompanyFooter.jsx";

export function App() {
  const [view, setView] = useState(resolveInitialView);

  function navigate(nextView, productId = "", targetId = "") {
    window.location.hash = nextView === "dashboard" ? "" : productId ? `${nextView}:${productId}` : nextView;
    setView({ name: nextView, productId });
    if (targetId) {
      window.setTimeout(() => {
        document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    }
  }

  function withHeader(content) {
    return (
      <>
        <BrandHeader activeView={view.name} onNavigate={navigate} />
        {content}
        <CompanyFooter onNavigate={navigate} />
        <button className="privacy-settings-button" type="button" onClick={() => window.dispatchEvent(new Event("dedica:privacy-settings"))}>Preferenze privacy</button>
        <PrivacyConsent onOpenPrivacy={() => navigate("privacy")} />
      </>
    );
  }

  if (view.name === "admin") {
    return <AdminApp onBack={() => navigate("home")} />;
  }

  if (view.name === "home") {
    return withHeader(
      <HomePage
        onOpenAdmin={() => navigate("admin")}
        onOpenProduct={(productId) => navigate("product", productId)}
        onOpenConfigurator={(productId) => navigate("configurator", productId)}
        onOpenInfo={(page) => navigate(page)}
        onBack={() => navigate("dashboard")}
      />
    );
  }

  if (view.name === "product") {
    return withHeader(
      <ProductPage
        productId={view.productId}
        onOpenConfigurator={(productId) => navigate("configurator", productId)}
        onOpenHome={() => navigate("home")}
        onBack={() => navigate("dashboard")}
      />
    );
  }

  if (view.name === "configurator") {
    return withHeader(<ConfiguratorPage productId={view.productId} onOpenCart={() => navigate("cart")} onOpenHome={() => navigate("home")} />);
  }

  if (view.name === "cart") {
    return withHeader(<CartPage onOpenHome={() => navigate("home")} />);
  }
  if (view.name === "fragranze") return withHeader(<FragrancesPage onOpenHome={() => navigate("home")} />);

  if (view.name === "account") {
    return withHeader(<AccountPage onOpenHome={() => navigate("home")} />);
  }

  if (view.name === "login") {
    return withHeader(<LoginPage onNavigate={(nextView) => navigate(nextView)} />);
  }

  if (view.name === "payment-success") {
    return withHeader(<PaymentResultPage success onOpenAccount={() => navigate("account")} onOpenCart={() => navigate("cart")} />);
  }

  if (view.name === "payment-cancel") {
    return withHeader(<PaymentResultPage onOpenAccount={() => navigate("account")} onOpenCart={() => navigate("cart")} />);
  }

  if (view.name === "assistenza") return withHeader(<AssistancePage onOpenHome={() => navigate("home")} />);

  if (["privacy", "termini", "spedizioni-resi", "chi-siamo"].includes(view.name)) {
    return withHeader(<InfoPage page={view.name} onOpenHome={() => navigate("home")} />);
  }

  if (view.name === "dashboard") {
    return withHeader(<MigrationDashboard onOpenAdmin={() => navigate("admin")} onOpenHome={() => navigate("home")} onOpenAccount={() => navigate("account")} />);
  }

  return withHeader(
    <HomePage
      onOpenAdmin={() => navigate("admin")}
      onOpenProduct={(productId) => navigate("product", productId)}
      onOpenConfigurator={(productId) => navigate("configurator", productId)}
      onOpenInfo={(page) => navigate(page)}
      onBack={() => navigate("dashboard")}
    />
  );
}

function resolveInitialView() {
  const hash = window.location.hash.replace(/^#/, "");
  if (hash === "admin") return { name: "admin", productId: "" };
  if (hash === "home") return { name: "home", productId: "" };
  if (hash === "cart") return { name: "cart", productId: "" };
  if (hash === "fragranze") return { name: "fragranze", productId: "" };
  if (hash === "account") return { name: "account", productId: "" };
  if (hash === "login") return { name: "login", productId: "" };
  if (hash === "payment-success") return { name: "payment-success", productId: "" };
  if (hash === "payment-cancel") return { name: "payment-cancel", productId: "" };
  if (["assistenza", "privacy", "termini", "spedizioni-resi", "chi-siamo"].includes(hash)) return { name: hash, productId: "" };
  if (hash.startsWith("product:")) return { name: "product", productId: hash.replace("product:", "") };
  if (hash.startsWith("configurator:")) return { name: "configurator", productId: hash.replace("configurator:", "") };
  const pathParts = window.location.pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  if (pathParts.length === 0 || pathParts[0] === "index.html") return { name: "home", productId: "" };
  if (pathParts[0] === "migration") return { name: "dashboard", productId: "" };
  if (pathParts[0] === "admin") return { name: "admin", productId: "" };
  if (pathParts[0] === "cart") return { name: "cart", productId: "" };
  if (pathParts[0] === "fragranze") return { name: "fragranze", productId: "" };
  if (pathParts[0] === "account") return { name: "account", productId: "" };
  if (pathParts[0] === "login") return { name: "login", productId: "" };
  if (pathParts[0] === "payment-success") return { name: "payment-success", productId: "" };
  if (pathParts[0] === "payment-cancel") return { name: "payment-cancel", productId: "" };
  if (pathParts[0] === "product") return { name: "product", productId: pathParts[1] || "" };
  if (pathParts[0] === "configuratore") return { name: "configurator", productId: pathParts[1] || "" };
  if (["assistenza", "privacy", "termini", "spedizioni-resi", "chi-siamo"].includes(pathParts[0])) return { name: pathParts[0], productId: "" };
  return { name: "dashboard", productId: "" };
}
