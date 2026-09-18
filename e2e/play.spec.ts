import { expect, test } from "@playwright/test";

const newName = (p: string) => `${p}${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`;

test("a guest can draw a class, fight, and claim the daily reward", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /draw your fate/i })).toBeVisible();
  await page.getByRole("button", { name: /play now, no signup/i }).click();

  await page.getByRole("button", { name: /draw your class/i }).click();
  await expect(page.getByRole("button", { name: /take your seat/i })).toBeVisible();
  await page.getByRole("button", { name: /take your seat/i }).click();

  await expect(page.getByRole("button", { name: /draw encounter/i })).toBeVisible();
  await page.getByRole("button", { name: /draw encounter/i }).click();

  // The battle table: play a round, then finish the fight.
  await expect(page.getByRole("button", { name: /^Attack/ })).toBeVisible();
  await page.getByRole("button", { name: /^Attack/ }).click();
  await page.getByRole("button", { name: /auto-resolve/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /back to the table|leave/i }).click();

  // The daily reward is one of the cards in your hand.
  await page.goto("/quests");
  await page.getByRole("button", { name: /claim daily reward/i }).click();
  await expect(page.getByRole("button", { name: /claimed today/i })).toBeVisible();

  expect(errors).toEqual([]);
});

test("a guest can save the account and then sign back in", async ({ page, context }) => {
  const username = newName("e2e");
  const password = "e2e-password-1";

  await page.goto("/");
  await page.getByRole("button", { name: /play now, no signup/i }).click();
  await page.getByRole("button", { name: /draw your class/i }).click();
  await page.getByRole("button", { name: /take your seat/i }).click();

  await page.goto("/settings");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: /save my hero/i }).click();
  await expect(page.getByText(/your hero is saved/i)).toBeVisible();

  await context.clearCookies();
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page.getByRole("button", { name: /draw encounter/i })).toBeVisible();
});

test("the app ships a manifest and a service worker", async ({ page, request }) => {
  await page.goto("/");
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBeTruthy();
  const json = await manifest.json();
  expect(json.name).toBe("DTEmpire Adventure");
  expect(json.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBeTruthy();
  expect((await request.get("/sw.js")).ok()).toBeTruthy();
  expect(await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => !!r))).toBeTruthy();
});
