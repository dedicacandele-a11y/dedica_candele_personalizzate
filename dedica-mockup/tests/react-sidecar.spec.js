const { test, expect } = require("@playwright/test");

async function forceLocalMode(page) {
  await page.route("https://www.gstatic.com/firebasejs/**", (route) => route.abort());
  await page.route("https://www.googletagmanager.com/**", (route) => route.abort());
}

test.beforeEach(async ({ page }) => {
  await forceLocalMode(page);
  await page.addInitScript(() => {
    localStorage.setItem("dedica_products_db", JSON.stringify({
      react_test: {
        id: "react_test",
        name: "Candela React Test",
        price: 18,
        desc: "Prodotto test dalla fonte admin.",
        badge: "Test",
        category: "gift",
        occasion: "Natale",
        image: "assets/product-dedica.webp",
        customization: {
          intro: "Configura dal test.",
          optionGroups: [
            {
              key: "formato",
              label: "Formato",
              type: "choice",
              required: true,
              options: [
                { label: "180 g", value: "180", priceDelta: 0 },
                { label: "300 g", value: "300", priceDelta: 6 }
              ]
            }
          ],
          personalization: {
            text: { enabled: true, required: true, label: "Dedica", placeholder: "Sempre con te", maxLength: 80, priceDelta: 0 },
            photo: { enabled: false, required: false, label: "Foto", priceDelta: 0 },
            generic: { enabled: false, required: false, label: "Note", maxLength: 180, priceDelta: 0 }
          }
        }
      }
    }));
  });
});

test("storefront usa catalogo, configuratore, carrello e checkout locale", async ({ page }) => {
  await page.goto("/");
  const privacyChoice = page.getByRole("button", { name: "Rifiuta analytics" });
  if (await privacyChoice.isVisible()) await privacyChoice.click();

  await expect(page.getByRole("heading", { name: "Candela React Test" })).toBeVisible();
  await page.locator("#prodotti").getByRole("button", { name: "Personalizza" }).click();
  await expect(page.getByText("Peso per candela indicato dal produttore: 500 g")).toBeVisible();
  await expect(page.getByText("Personalizza la tua candela")).toBeVisible();
  await page.getByLabel("Dedica *").fill("Per te");
  await page.getByRole("button", { name: "Aggiungi al carrello" }).click();
  await expect(page.getByRole("heading", { name: "Riepilogo" })).toBeVisible();

  await page.getByRole("button", { name: "Procedi al checkout" }).click();
  await page.getByLabel("Email").fill("cliente-react@example.com");
  await page.getByRole("textbox", { name: "Nome", exact: true }).fill("Ada");
  await page.getByRole("textbox", { name: "Cognome", exact: true }).fill("Lovelace");
  await page.getByLabel("Telefono").fill("3331234567");
  await page.getByLabel("Codice fiscale").fill("LVLDAA85T50H501Z");
  await page.getByLabel("Via / Piazza").fill("Via React");
  await page.getByLabel("Numero civico").fill("1");
  await page.getByLabel("Città").fill("Napoli");
  await page.getByLabel("Provincia").fill("NA");
  await page.getByLabel("CAP").fill("80100");
  await page.getByRole("checkbox", { name: /Confermo di aver letto la privacy policy/ }).check();
  await page.getByRole("button", { name: "Conferma ordine" }).click();

  await expect(page.getByText("Ordine registrato", { exact: true })).toBeVisible();
  const orders = await page.evaluate(() => JSON.parse(localStorage.getItem("dedica_placed_orders") || "[]"));
  expect(orders[0].email).toBe("cliente-react@example.com");
  expect(orders[0].items[0].productName).toBe("Candela React Test");
});

test("configuratore mostra il progresso verso la spedizione gratuita", async ({ page }) => {
  await page.goto("/");
  await page.locator("#prodotti").getByRole("button", { name: "Personalizza" }).click();
  await expect(page.getByText(/Ti mancano .* per la spedizione gratuita/)).toBeVisible();
  await page.locator(".config-react-total input").fill("20");
  await expect(page.getByText(/Le 20 candele vengono raggruppate in un unico pacco.*fascia 5–15 kg/)).toBeVisible();
});

test("Routing diretto funziona con fallback hosting", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByText("Dati raccolti solo per ordine")).toBeVisible();

  await page.goto("/product/react_test");
  await expect(page.getByText("Candela React Test")).toBeVisible();
});
