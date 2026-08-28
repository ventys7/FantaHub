const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
  const logs = [];
  page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));

  await page.goto("http://localhost:4173/fp/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);

  await page.screenshot({ path: "/tmp/formation-react.png", fullPage: true });

  const snapshot = await page.evaluate(() => {
    const root = document.querySelector("#league-formation-root");
    const slots = document.querySelectorAll("#league-formation-root .formation-slot");
    const starters = document.querySelectorAll("#league-formation-root .formation-slot--starter");
    const bench = document.querySelectorAll("#league-formation-root .formation-slot--bench");
    const firstSlot = document.querySelector("#league-formation-root .formation-slot--starter");
    const box = firstSlot ? firstSlot.getBoundingClientRect() : null;
    const controlsStatic = document.querySelector("#formationControls");
    const reactControls = document.querySelector("#league-formation-root .controls");
    const starterCount = document.querySelector("#league-formation-root #starterCount");
    const benchCount = document.querySelector("#league-formation-root #benchCount");
    return {
      reactFormationFlag: window.reactFormationFlag,
      rootChildren: root ? root.children.length : -1,
      slotCount: slots.length,
      starterCount: starters.length,
      benchCountElems: bench.length,
      firstSlotSize: box ? { w: Math.round(box.width), h: Math.round(box.height) } : null,
      lfWrappers: document.querySelectorAll("#league-formation-root .lf-formation, #league-formation-root .lf-controls, #league-formation-root .lf-starters").length,
      staticControlsDisplay: controlsStatic ? getComputedStyle(controlsStatic).display : "missing",
      reactControlsPresent: !!reactControls,
      starterCountText: starterCount ? starterCount.textContent : "missing",
      benchCountText: benchCount ? benchCount.textContent : "missing"
    };
  });
  console.log("SNAPSHOT:", JSON.stringify(snapshot, null, 2));

  // Click first starter slot -> picker should open
  const slot = await page.$("#league-formation-root .formation-slot--starter");
  let pickerInfo = "no starter slot found";
  let afterAssign = "n/a";
  if (slot) {
    await slot.click();
    await page.waitForTimeout(800);
    pickerInfo = await page.evaluate(() => {
      const items = document.querySelectorAll("#league-formation-root .lf-picker-item");
      const modal = document.querySelector("#league-formation-root .lf-picker-modal");
      return {
        pickerItems: items.length,
        pickerVisible: !!modal,
        firstItemNames: Array.from(items).slice(0, 5).map((i) => i.textContent.replace(/\s+/g, " ").trim())
      };
    });
    await page.screenshot({ path: "/tmp/formation-picker.png", fullPage: true });

    // Assign first picker item
    const item = await page.$("#league-formation-root .lf-picker-item");
    if (item) {
      await item.click();
      await page.waitForTimeout(800);
      afterAssign = await page.evaluate(() => {
        const first = document.querySelector("#league-formation-root .formation-slot--starter");
        const sel = document.querySelector("#league-formation-root .formation-slot--starter .formation-shirt--selected");
        const sc = document.querySelector("#league-formation-root #starterCount");
        return {
          firstName: first ? first.textContent.replace(/\s+/g, " ").trim() : "missing",
          selectedShirt: !!sel,
          starterCount: sc ? sc.textContent : "missing"
        };
      });
    }
  }

  console.log("PICKER:", JSON.stringify(pickerInfo, null, 2));
  console.log("AFTER_ASSIGN:", JSON.stringify(afterAssign, null, 2));
  console.log("LOGS:", logs.join("\n") || "(none)");
  await browser.close();
})().catch((e) => { console.error("ERR", e); process.exit(1); });
