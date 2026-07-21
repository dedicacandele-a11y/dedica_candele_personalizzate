const { test, expect } = require("@playwright/test");

async function forceLocalMode(page) {
  await page.route("https://www.gstatic.com/firebasejs/**", (route) => route.abort());
  await page.route("https://www.googletagmanager.com/**", (route) => route.abort());
}

test.beforeEach(async ({ page }) => {
  await forceLocalMode(page);
});

test("dati aziendali Admin vengono pubblicati nel footer", async ({ page }) => {
  await page.goto("/admin");
  await page.getByRole("button", { name: "Dati aziendali" }).click();
  await page.getByLabel("Ragione sociale").fill("DÈDICA Test S.r.l.");
  await page.getByLabel("Partita IVA").fill("12345678901");
  await page.getByLabel("Indirizzo sede").fill("Via Roma 10");
  await page.getByLabel("CAP").fill("00100");
  await page.getByLabel("Città").fill("Roma");
  await page.getByLabel("Provincia").fill("RM");
  await page.getByRole("button", { name: "Salva e pubblica" }).click();
  await expect(page.getByText("Dati aziendali salvati e pubblicati nel footer.")).toBeVisible();
  await page.getByRole("button", { name: "Vai al sito" }).click();
  await expect(page.getByText("DÈDICA Test S.r.l.")).toBeVisible();
  await expect(page.getByText(/P\. IVA 12345678901/)).toBeVisible();
  await expect(page.getByText(/Via Roma 10, 00100 Roma, RM, Italia/)).toBeVisible();
});

test("Admin React crea categoria/prodotto e la Home riflette eliminazione", async ({ page }) => {
  await page.goto("/admin");
  await page.evaluate(() => {
    localStorage.removeItem("dedica_categories_db");
    localStorage.removeItem("dedica_products_db");
  });
  await page.reload();
  await page.getByRole("button", { name: "Categorie" }).click();

  await page.getByLabel("Nome categoria").fill("Test Occasioni");
  await page.getByLabel("Slug").fill("test-occasioni");
  await page.getByLabel("Descrizione").fill("Categoria creata dal test admin.");
  await page.getByRole("button", { name: "Aggiungi sottocategoria" }).click();
  await page.getByLabel("Sottocategoria 1").fill("Laurea");
  await page.getByRole("button", { name: "Aggiungi sottocategoria" }).click();
  await page.getByLabel("Sottocategoria 2").fill("Comunione");
  await page.getByRole("button", { name: "Crea categoria" }).click();
  await expect(page.getByText("Categoria salvata.")).toBeVisible();

  await page.getByRole("button", { name: "Prodotti" }).click();
  await page.getByRole("button", { name: "Nuovo prodotto" }).click();
  await page.getByLabel("Nome prodotto").fill("Candela Admin Flow");
  await page.getByLabel("Prezzo base").fill("24");
  await page.getByLabel("Descrizione").fill("Creata dal pannello admin React.");
  await page.getByRole("button", { name: /Test Occasioni/ }).click();
  await page.locator(".ui-chip").filter({ hasText: "Laurea" }).click();
  await page.getByRole("button", { name: "Crea prodotto" }).click();
  await expect(page.getByText("Prodotto salvato correttamente.")).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Candela Admin Flow" })).toBeVisible();

  await page.goto("/admin");
  await page.getByRole("button", { name: "Prodotti" }).click();
  page.once("dialog", dialog => dialog.accept());
  await page.getByTestId("delete-product-candela-admin-flow").click();
  await expect(page.getByText("Prodotto eliminato.")).toBeVisible();

  await page.goto("/");
  await expect(page.getByText("Candela Admin Flow")).toHaveCount(0);
});

test("una categoria può essere creata senza sottocategorie", async ({ page }) => {
  await page.goto("/admin");
  await page.getByRole("button", { name: "Categorie" }).click();
  await page.getByLabel("Nome categoria").fill("Edizione limitata");
  await page.getByRole("button", { name: "Crea categoria" }).click();
  await expect(page.getByText("Categoria salvata.")).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("dedica_categories_db") || "[]"));
  const category = stored.find(item => item.name === "Edizione limitata");
  expect(category).toBeTruthy();
  expect(category.subcategories).toEqual([]);
});
