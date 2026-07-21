const { test, expect } = require("@playwright/test");

async function forceLocalMode(page) {
  await page.route("https://www.gstatic.com/firebasejs/**", (route) => route.abort());
  await page.route("https://www.googletagmanager.com/**", (route) => route.abort());
}

test.beforeEach(async ({ page }) => {
  await forceLocalMode(page);
});

test("homepage non espone placeholder e registra newsletter in fallback locale", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: "DÈDICA Home" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Carrello/ })).toBeVisible();
  await expect(page.locator("[data-pending]")).toHaveCount(0);
  await expect(page.locator('a[href="#"]')).toHaveCount(0);
  await page.getByPlaceholder("La tua email").fill("news@example.com");
  await page.getByRole("checkbox", { name: /Acconsento alla newsletter/ }).check();
  await page.getByRole("button", { name: "Iscriviti" }).click();
  await expect(page.locator(".ui-toast")).toContainText("Iscrizione newsletter registrata");

  const subscribers = await page.evaluate(() => JSON.parse(localStorage.getItem("dedica_newsletter_subscribers") || "[]"));
  expect(subscribers.some(item => item.email === "news@example.com")).toBeTruthy();
});

test("pagine fiducia principali sono raggiungibili", async ({ page }) => {
  for (const url of ["/assistenza", "/spedizioni-resi", "/privacy", "/termini"]) {
    await page.goto(url);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("funzione in preparazione");
  }
});

test("policy resi distingue personalizzazione, garanzia e danni da trasporto", async ({ page }) => {
  await page.goto("/spedizioni-resi");
  await expect(page.getByRole("heading", { name: "Prodotti artigianali, tutele chiare." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Candele personalizzate" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Garanzia legale di conformità" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Danni durante il trasporto" })).toBeVisible();
  await expect(page.getByText(/48 ore agevola la pratica.*non limita i diritti/)).toBeVisible();
});

test("account e admin hanno fallback chiaro senza Firebase", async ({ page }) => {
  await page.goto("/account");
  await expect(page.locator("body")).toContainText("Area cliente");
  await expect(page.locator("body")).toContainText("Nessun ordine");

  await page.goto("/admin");
  await expect(page.locator("body")).toContainText("Pannello amministrativo");
  await expect(page.locator("body")).toContainText("Categorie");
});

test("login e pagamento sostituiscono le vecchie pagine HTML", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("body")).toContainText("Accesso cliente non disponibile nell’anteprima locale");

  await page.goto("/payment-cancel");
  await expect(page.locator("body")).toContainText("Pagamento non completato");
});

test("un amministratore autenticato può rientrare nel pannello dalla navigazione", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("admin_logged", "true"));
  await page.goto("/home");
  await page.getByRole("button", { name: "Admin", exact: true }).click();
  await expect(page).toHaveURL(/#admin$/);
  await expect(page.getByRole("heading", { name: "Panoramica" })).toBeVisible();
});
