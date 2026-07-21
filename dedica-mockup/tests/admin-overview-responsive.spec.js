const { test, expect } = require("@playwright/test");

const longOrder = {
  id: "ImVcOXTFq3ntwTsXTZZ-order-reference-with-extra-characters",
  email: "debora.bellucci.with.a.long.address@example-company-domain.it",
  status: "pending_payment"
};

async function openOverview(page, width) {
  await page.setViewportSize({ width, height: 900 });
  await page.route("https://www.gstatic.com/firebasejs/**", route => route.abort());
  await page.route("https://www.googletagmanager.com/**", route => route.abort());
  await page.addInitScript(order => {
    localStorage.setItem("dedica_placed_orders", JSON.stringify([order]));
  }, longOrder);
  await page.goto("/admin");
  await expect(page.locator(".admin-overview-order-id")).toBeVisible();
}

for (const width of [1440, 800, 390]) {
  test(`gli ordini recenti non si sovrappongono a ${width}px`, async ({ page }) => {
    await openOverview(page, width);

    const layout = await page.locator(".admin-overview-orders > div").evaluate(row => {
      const id = row.querySelector(".admin-overview-order-id").getBoundingClientRect();
      const email = row.querySelector(".admin-overview-order-email").getBoundingClientRect();
      const overlapX = id.left < email.right && id.right > email.left;
      const overlapY = id.top < email.bottom && id.bottom > email.top;
      return {
        textOverlaps: overlapX && overlapY,
        pageOverflows: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        overflow: `${document.documentElement.scrollWidth}/${document.documentElement.clientWidth}`,
        offenders: [...document.querySelectorAll("body *")]
          .filter(element => element.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
          .slice(0, 5)
          .map(element => `${element.className || element.tagName}:${Math.round(element.getBoundingClientRect().right)}`)
      };
    });

    expect(layout.textOverlaps).toBe(false);
    expect(layout.pageOverflows, `${layout.overflow} ${layout.offenders.join(", ")}`).toBe(false);
  });
}
