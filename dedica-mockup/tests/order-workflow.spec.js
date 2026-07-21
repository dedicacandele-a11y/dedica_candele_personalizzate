const { test, expect } = require("@playwright/test");

test("ordine segue pagamento, bozza, approvazione, produzione e spedizione", async ({ page }) => {
  await page.route("https://www.gstatic.com/firebasejs/**", route => route.abort());
  await page.addInitScript(() => !localStorage.getItem("dedica_placed_orders") && localStorage.setItem("dedica_placed_orders", JSON.stringify([{
    id: "DEC-FLOW-001",
    email: "cliente@example.it",
    nome: "Cliente",
    total: 29,
    items: [{ productName: "Candela test", qty: 1 }],
    status: "payment_review",
    paymentStatus: "local_only",
    createdAt: new Date().toISOString()
  }])));

  await page.goto("/admin");
  await page.locator(".admin-sidebar-nav").getByRole("button", { name: /Ordini/ }).click();
  await page.getByRole("button", { name: "Apri ordine DEC-FLOW-001" }).click();
  await page.getByRole("button", { name: "Conferma pagamento" }).click();
  await expect(page.locator(".ui-badge", { hasText: "Pagato / bozza da preparare" }).first()).toBeVisible();

  await page.getByText("Usa invece un collegamento esterno").click();
  await page.getByLabel("URL bozza").fill("https://example.com/bozza-001.pdf");
  await page.getByRole("button", { name: "Invia bozza al cliente" }).click();
  await expect(page.locator(".ui-badge", { hasText: "Bozza inviata" }).first()).toBeVisible();

  await page.goto("/account");
  await expect(page.getByRole("link", { name: /Visualizza la bozza/ })).toHaveAttribute("href", "https://example.com/bozza-001.pdf");
  await page.getByRole("button", { name: "Approva e avvia la produzione" }).click();
  await expect(page.locator(".ui-badge", { hasText: "Bozza approvata" })).toBeVisible();

  await page.goto("/admin");
  await page.locator(".admin-sidebar-nav").getByRole("button", { name: /Ordini/ }).click();
  await page.getByRole("button", { name: "Apri ordine DEC-FLOW-001" }).click();
  await page.getByRole("button", { name: "Avvia produzione" }).click();
  await expect(page.locator(".ui-badge", { hasText: "In produzione" }).first()).toBeVisible();
  await page.getByLabel("Corriere assegnato").fill("BRT");
  await page.getByLabel("Codice tracking").fill("TRACK-001");
  await page.getByRole("button", { name: "Segna come spedito" }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("dedica_placed_orders") || "[]")[0]?.status)).toBe("shipped");
});
