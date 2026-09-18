// Visual QA: drives a fresh account through the main screens at desktop and phone sizes,
// saving screenshots to .impeccable/review and failing loudly on console errors.
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:8081";
const OUT = ".impeccable/review";
mkdirSync(OUT, { recursive: true });

const errors: string[] = [];
const watch = (page: Page, tag: string) => {
  page.on("console", (m) => { if (m.type() === "error") errors.push(`[${tag}] ${m.text()}`); });
  page.on("pageerror", (e) => errors.push(`[${tag}] pageerror ${e.message}`));
};

const shot = async (page: Page, name: string, fullPage = false) => {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
};

async function run() {
  const browser = await chromium.launch({ channel: process.env.QA_BROWSER ?? "msedge", headless: true });
  const user = `qa_${Date.now().toString(36)}`;

  // Landing (signed out)
  const anon = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const lp = await anon.newPage();
  watch(lp, "landing");
  await lp.goto(BASE);
  await shot(lp, "landing-desktop");
  await anon.close();

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  watch(page, "desktop");
  await page.goto(`${BASE}/register`);
  await page.fill('input[name="username"]', user);
  await page.fill('input[name="password"]', "qa-password-1");
  await page.fill('input[name="confirm"]', "qa-password-1");
  await page.click('button[type="submit"]');
  await page.waitForSelector("text=Draw your class");
  await shot(page, "onboard-before");
  await page.click("text=Draw your class");
  await page.waitForSelector("text=Take your seat");
  await page.waitForTimeout(900);
  await shot(page, "onboard-after");
  await page.click("text=Take your seat");
  await page.waitForSelector("text=Draw encounter");
  await shot(page, "table-desktop");

  await page.click("button:has-text('Draw encounter')");
  await page.waitForSelector(".battle__hand");
  await shot(page, "battle-desktop");
  for (let i = 0; i < 3; i++) {
    const done = await page.locator(".outcome").count();
    if (done) break;
    await page.keyboard.press(i === 1 ? "2" : "1");
    await page.waitForTimeout(1200);
  }
  await shot(page, "battle-mid-desktop");
  if (!(await page.locator(".outcome").count())) await page.click("text=Auto-resolve");
  await page.waitForSelector(".outcome", { timeout: 15000 });
  await page.waitForTimeout(900);
  await shot(page, "battle-outcome-desktop");
  await page.click(".outcome >> text=Back to the table");

  for (const path of ["adventure", "tower", "hero", "bag", "quests", "town", "market", "smithy", "pets", "chat", "ranks", "records", "mail", "settings", "lucky", "guild"]) {
    await page.goto(`${BASE}/${path}`);
    await page.waitForLoadState("networkidle");
    await shot(page, `${path}-desktop`, true);
  }

  // Phone
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, storageState: await ctx.storageState() });
  const pp = await phone.newPage();
  watch(pp, "mobile");
  for (const path of ["", "adventure", "tower", "hero", "bag", "quests", "chat"]) {
    await pp.goto(`${BASE}/${path}`);
    await pp.waitForLoadState("networkidle");
    await shot(pp, `${path || "table"}-mobile`);
  }
  await pp.goto(`${BASE}/`);
  await pp.click("button:has-text('Draw encounter')");
  await pp.waitForSelector(".battle__hand");
  await shot(pp, "battle-mobile");

  await browser.close();
  console.log(errors.length ? `CONSOLE ERRORS:\n${errors.join("\n")}` : "No console errors.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
