const { test, expect } = require("@playwright/test");

test("Admin allega una fattura ed esporta archivio ordini", async ({ page }) => {
  await page.route("https://www.gstatic.com/firebasejs/**", route => route.abort());
  await page.addInitScript(() => localStorage.setItem("dedica_placed_orders", JSON.stringify([{
    id: "DEC-FISCAL-001", createdAt: "2026-07-20T10:00:00.000Z", status: "paid", paymentStatus: "paid", stripeMode: "test",
    tipoCliente: "privato", nome: "Ada", cognome: "Lovelace", codiceFiscale: "LVLDAA85T50H501Z",
    indirizzo: "Via Roma", civico: "10", cap: "00100", citta: "Roma", provincia: "RM", paese: "Italia",
    email: "ada@example.com", total: 25, subtotal: 20, shipping: 5, discount: 0, items: [{ productName: "Candela", qty: 1, lineTotal: 20 }],
  }])));
  await page.goto("/admin");
  await page.locator(".admin-sidebar-nav").getByRole("button", { name: /Ordini/ }).click();
  await page.getByRole("button", { name: /Apri ordine/ }).click();
  await expect(page.getByText("LVLDAA85T50H501Z")).toBeVisible();
  await page.locator("label").filter({ hasText: "Allega fattura o ricevuta" }).locator('input[type="file"]').setInputFiles({ name: "fattura-001.pdf", mimeType: "application/pdf", buffer: Buffer.from("fattura test") });
  await expect(page.getByText("Fattura allegata all’ordine.")).toBeVisible();
  const invoice = await page.evaluate(() => JSON.parse(localStorage.getItem("dedica_placed_orders"))[0].invoice);
  expect(invoice.fileName).toBe("fattura-001.pdf");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Esporta ordini e fatture" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^dedica-archivio-ordini-.*\.zip$/);

  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Elimina definitivamente l’ordine" }).click();
  await expect(page.getByText(/Ordine #FISCAL-001 eliminato definitivamente/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Apri ordine/ })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("dedica_placed_orders") || "[]"))).toEqual([]);
});
