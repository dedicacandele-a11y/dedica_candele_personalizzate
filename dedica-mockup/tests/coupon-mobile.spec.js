const { test, expect } = require("@playwright/test");

test("il coupon mostra un riscontro e applica lo sconto su mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("https://www.gstatic.com/firebasejs/**", route => route.abort());
  await page.addInitScript(() => localStorage.setItem("dedica_cart", JSON.stringify([
    { id: "coupon-test", productName: "Candela test", qty: 1, unitBasePrice: 100, price: 100, shippingWeightGrams: 500 }
  ])));
  await page.goto("/cart");
  await page.getByPlaceholder("Codice promo").fill("BENVENUTO10");
  await page.getByRole("button", { name: "Applica" }).click();
  await expect(page.getByRole("status")).toContainText("sconto del 10%");
  await expect(page.locator(".cart-react-summary-line").filter({ hasText: "Promo BENVENUTO10" })).toContainText("10,00 €");
});
