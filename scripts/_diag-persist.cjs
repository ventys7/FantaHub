const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
  const logs = [];
  page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));

  await page.goto("http://localhost:4173/fp/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);

  // Fill all 11 starter slots: click each EMPTY starter slot, then first picker item.
  for (let i = 0; i < 11; i++) {
    const slot = await page.$("#league-formation-root .formation-slot--starter:has(.formation-shirt--empty)");
    if (!slot) break;
    await slot.click();
    await page.waitForTimeout(250);
    const item = await page.$("#league-formation-root .lf-picker-item");
    if (!item) break;
    await item.click();
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(500);
  const beforeCount = await page.evaluate(() => {
    const sc = document.querySelector("#league-formation-root #starterCount");
    return sc ? sc.textContent : "missing";
  });

  // Reload and check persistence
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  const afterCount = await page.evaluate(() => {
    const sc = document.querySelector("#league-formation-root #starterCount");
    const filled = document.querySelectorAll("#league-formation-root .formation-slot--starter .formation-shirt--selected").length;
    return { starterCount: sc ? sc.textContent : "missing", filledStarterShirts: filled };
  });

  console.log("BEFORE_RELOAD:", beforeCount);
  console.log("AFTER_RELOAD:", JSON.stringify(afterCount, null, 2));
  console.log("LOGS:", logs.join("\n") || "(none)");
  await browser.close();
})().catch((e) => { console.error("ERR", e); process.exit(1); });
