const { test, expect } = require("@playwright/test");

test("editor prodotto salva e ripristina una bozza automatica", async ({ page }) => {
  await page.route("https://www.gstatic.com/firebasejs/**", route => route.abort());
  await page.goto("/admin");
  await page.locator(".admin-sidebar-nav").getByRole("button", { name: /Prodotti/ }).click();
  await page.getByRole("button", { name: /Nuovo prodotto/ }).click();
  await page.getByLabel("Nome prodotto").fill("Prodotto in bozza");
  await expect(page.getByText("Bozza salvata", { exact: true })).toBeVisible();
  const draft = await page.evaluate(() => JSON.parse(localStorage.getItem("dedica_product_draft_new")));
  expect(draft.form.name).toBe("Prodotto in bozza");

  await page.getByRole("button", { name: /Torna ai prodotti/ }).click();
  await page.getByRole("button", { name: /Nuovo prodotto/ }).click();
  await expect(page.getByText("È disponibile una bozza automatica")).toBeVisible();
  await page.getByRole("button", { name: "Riprendi bozza" }).click();
  await expect(page.getByLabel("Nome prodotto")).toHaveValue("Prodotto in bozza");
});
