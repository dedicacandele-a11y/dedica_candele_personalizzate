const { test, expect } = require("@playwright/test");

test("spedizione cambia in base a quantità e peso", async ({ page }) => {
  await page.route("https://www.gstatic.com/firebasejs/**", route => route.abort());
  await page.addInitScript(() => localStorage.setItem("dedica_shipping_settings", JSON.stringify({
    packagingWeightGrams: 300,
    freeRules: [{ id: "free-standard", minAmount: 79, maxQuantity: 10, maxWeightGrams: 5000, active: true }],
    carriers: [{ id: "gls", name: "GLS" }],
    rates: [{ id: "legacy", label: "Vecchio listino", carrierId: "gls", maxWeightGrams: 30000, price: 24.9, active: true }],
  })));
  await page.addInitScript(() => localStorage.setItem("dedica_cart", JSON.stringify([{ id: "shipping-test", productName: "Candela test", qty: 10, unitBasePrice: 10, shippingWeightGrams: 500 }] )));
  await page.goto("/cart");
  await expect(page.getByText("Spediamo.it 5–15 kg")).toBeVisible();
  await expect(page.getByText("Peso per candela: 500 g")).toBeVisible();
  await expect(page.getByText("10 × 500 g (Candela test) = 5,00 kg")).toBeVisible();
  await expect(page.getByText("Imballaggio dell’ordine = 300 g")).toBeVisible();
  await expect(page.getByText(/Peso usato per la tariffa = 5,30 kg/)).toBeVisible();
  await expect(page.locator(".cart-react-summary-line").filter({ hasText: "Spedizione" })).toContainText("10,59 €");
  await expect(page.getByText(/Le 10 candele vengono raggruppate in un unico pacco/)).toBeVisible();
  await expect(page.getByText(/Il peso o la quantità attuale supera il limite/)).toBeVisible();
  await page.getByRole("spinbutton").first().fill("30");
  await expect(page.getByText("Spediamo.it 15–25 kg")).toBeVisible();
  await expect(page.locator(".cart-react-summary-line").filter({ hasText: "Spedizione" })).toContainText("12,59 €");
});
