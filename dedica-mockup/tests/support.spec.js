const { test, expect } = require("@playwright/test");

test("cliente apre una pratica e Admin la gestisce", async ({ page }) => {
  await page.route("https://www.gstatic.com/firebasejs/**", route => route.abort());
  await page.goto("/assistenza");
  const privacyChoice = page.getByRole("button", { name: "Rifiuta analytics" });
  if (await privacyChoice.isVisible()) await privacyChoice.click();

  await expect(page.getByRole("heading", { name: "Come possiamo aiutarti?" })).toBeVisible();
  await page.getByLabel("Nome e cognome").fill("Ada Lovelace");
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByLabel("Argomento").selectOption("transport_damage");
  await page.getByLabel("Numero ordine").fill("DEC-TEST-001");
  await page.getByLabel("Oggetto").fill("Candela arrivata rotta");
  await page.getByLabel("Descrivi il problema").fill("Il contenitore è rotto e ho conservato il pacco.");
  await page.getByRole("checkbox", { name: /Confermo di aver letto la privacy policy/ }).check();
  await page.getByRole("button", { name: "Invia richiesta" }).click();
  await expect(page.getByText(/Pratica SUP-/)).toBeVisible();

  await page.goto("/admin");
  await page.getByRole("button", { name: "Assistenza" }).click();
  await page.getByRole("button", { name: /Apri pratica SUP-/ }).click();
  await expect(page.getByRole("definition").filter({ hasText: "Candela arrivata rotta" })).toBeVisible();
  await expect(page.getByLabel("Priorità")).toHaveValue("high");
  await page.getByLabel("Rispondi al cliente").fill("Grazie, inviaci le fotografie del pacco e del prodotto.");
  await page.getByRole("button", { name: "Invia risposta via email" }).click();
  await expect(page.getByText("Risposta inviata al cliente via email.")).toBeVisible();
  await expect(page.getByText("Grazie, inviaci le fotografie del pacco e del prodotto.")).toBeVisible();
});
