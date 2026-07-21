const { test, expect } = require("@playwright/test");

test("opzioni centralizzate e specifiche diventano scelte del configuratore", async ({ page }) => {
  await page.route("https://www.gstatic.com/firebasejs/**", route => route.abort());
  await page.goto("/admin");
  await page.locator(".admin-sidebar-nav").getByRole("button", { name: /Opzioni catalogo/ }).click();
  await page.getByLabel("Nome").fill("Gelsomino test");
  await page.getByRole("button", { name: "Aggiungi", exact: true }).click();
  await expect(page.getByText("Gelsomino test")).toBeVisible();

  await page.locator(".admin-sidebar-nav").getByRole("button", { name: /Prodotti/ }).click();
  await page.getByRole("button", { name: /Nuovo prodotto/ }).click();
  await page.getByLabel("Nome prodotto").fill("Candela Opzioni Test");
  await page.getByLabel("Prezzo base").fill("25");
  await page.getByLabel("Descrizione").fill("Verifica opzioni centralizzate.");
  await page.getByRole("button", { name: /Idee regalo/ }).click();
  await page.getByRole("button", { name: "Compleanno" }).click();
  await page.getByRole("button", { name: /3. Dettagli/ }).click();
  await page.getByText("Gelsomino test", { exact: true }).click();
  await page.getByText("Bianco", { exact: true }).click();
  await page.getByLabel("Nuova cere personalizzata").fill("Cera d'api test");
  await page.locator(".product-attribute-selector").filter({ hasText: "Cere" }).getByRole("button", { name: "Aggiungi" }).click();
  await page.getByRole("button", { name: "Crea prodotto" }).click();

  const product = await page.evaluate(() => JSON.parse(localStorage.getItem("dedica_products_db"))["candela-opzioni-test"]);
  expect(product.details.fragrances).toContain("Gelsomino test");
  expect(product.details.colors).toContain("Bianco");
  expect(product.details.waxes).toContain("Cera d'api test");
  expect(product.customization.optionGroups.find(group => group.key === "fragrance").options[0].label).toBe("Gelsomino test");
  expect(product.customization.optionGroups.find(group => group.key === "color").options[0].label).toBe("Bianco");

  await page.getByRole("button", { name: "Modifica" }).last().click();
  await page.getByRole("button", { name: /3. Dettagli/ }).click();
  await expect(page.locator(".product-attribute-selector").filter({ hasText: "Colori" }).getByText("1 selezionate")).toBeVisible();

  await page.getByRole("button", { name: /1. Informazioni/ }).click();
  await page.getByRole("button", { name: /Candele per evento/ }).click();
  await page.getByRole("button", { name: "Matrimonio" }).click();
  await page.getByRole("button", { name: "Salva modifiche" }).click();

  const updatedProduct = await page.evaluate(() => JSON.parse(localStorage.getItem("dedica_products_db"))["candela-opzioni-test"]);
  expect(updatedProduct.category).toBe("event");
  expect(updatedProduct.occasion).toBe("Matrimonio");
  expect(updatedProduct.details.colors).toContain("Bianco");
});
