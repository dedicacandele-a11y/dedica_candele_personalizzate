const { test, expect } = require("@playwright/test");

test("finanze salva percentuali e spese IVA inclusa con sotto-aree", async ({ page }) => {
  await page.route("https://www.gstatic.com/firebasejs/**", route => route.abort());
  await page.goto("/admin");
  await page.locator(".admin-sidebar-nav").getByRole("button", { name: /Finanze/ }).click();

  await page.getByLabel("Produzione %").fill("60");
  await expect(page.getByLabel("Digital %")).toHaveValue("40");
  await page.getByRole("button", { name: "Salva percentuali" }).click();
  await expect(page.locator(".ui-toast")).toContainText("Percentuali aggiornate");

  await page.getByRole("button", { name: "Registra spesa" }).click();
  await page.getByLabel("Descrizione").fill("Cera vegetale test");
  await page.getByLabel("Importo").fill("120.50");
  await page.getByText("Materie prime", { exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Registra spesa", exact: true }).click();
  await expect(page.getByText("Cera vegetale test")).toBeVisible();

  const data = await page.evaluate(() => ({ settings: JSON.parse(localStorage.getItem("dedica_finance_settings")), expenses: JSON.parse(localStorage.getItem("dedica_finance_expenses")) }));
  expect(data.settings.productionShare).toBe(60);
  expect(data.settings.digitalShare).toBe(40);
  expect(data.expenses[0].vatIncluded).toBe(true);
  expect(data.expenses[0].subareas).toContain("Materie prime");
});
