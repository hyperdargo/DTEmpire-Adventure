import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Client, makeApp } from "./helpers.ts";
import { GEMS } from "../shared/data/gems.ts";
import { itemStats } from "../shared/rules/items.ts";
import { rollVictoryLoot } from "../shared/rules/loot.ts";
import { createRng } from "../shared/rules/rng.ts";

describe("gem socketing", () => {
  let ctx: Awaited<ReturnType<typeof makeApp>>;
  let c: Client;
  let uid: number;
  let gearId: number;
  beforeEach(async () => {
    ctx = await makeApp(); c = new Client(ctx.app);
    await c.signup("gemtester");
    uid = ctx.db.get<{ id: number }>("SELECT id FROM users WHERE username = ?", "gemtester")!.id;
    ctx.db.run("UPDATE players SET coins = 100000 WHERE user_id = ?", uid);
    gearId = ctx.db.get<{ id: number }>("SELECT id FROM items WHERE owner_id = ? AND base != '{}' LIMIT 1", uid)!.id;
    for (const [id, qty] of [["iron_ore", 100], ["mystic_gem", 20], ["gem_ruby_1", 30]] as const) {
      ctx.db.run("INSERT INTO items (owner_id, template_id, rarity, ilvl, upgrade, qty, base, affixes, created_at) VALUES (?, ?, 'common', 1, 0, ?, '{}', '[]', ?)", uid, id, qty, ctx.clock.now());
    }
  });
  afterEach(async () => { await ctx.app.close(); ctx.db.close(); });
  it("catalog has all 24 gems with progressive values", () => {
    expect(GEMS).toHaveLength(24);
    expect(new Set(GEMS.map((g) => g.id)).size).toBe(24);
    expect(itemStats({ base: { atk: 10 }, upgrade: 0, affixes: [], sockets: ["gem_ruby_1"] }).atk).toBe(18);
  });
  it("crafts punches, unlocks two sockets, inserts and returns a gem exactly once", async () => {
    await c.post("/api/gems/punch"); await c.post("/api/gems/unlock", { itemId: gearId });
    await c.post("/api/gems/punch"); await c.post("/api/gems/unlock", { itemId: gearId });
    expect((await c.postErr("/api/gems/unlock", { itemId: gearId })).status).toBe(400);
    const before = ctx.db.get<{ coins: number }>("SELECT coins FROM players WHERE user_id = ?", uid)!.coins;
    await c.post("/api/gems/socket", { itemId: gearId, index: 0, gemId: "gem_ruby_1" });
    expect(ctx.db.get<{ coins: number }>("SELECT coins FROM players WHERE user_id = ?", uid)!.coins).toBe(before);
    expect((await c.postErr("/api/gems/socket", { itemId: gearId, index: 0, gemId: "gem_ruby_1" })).status).toBe(400);
    expect(JSON.parse(ctx.db.get<{ sockets: string }>("SELECT sockets FROM items WHERE id = ?", gearId)!.sockets)).toEqual(["gem_ruby_1", null]);
    await c.post("/api/gems/unsocket", { itemId: gearId, index: 0 });
    expect((await c.postErr("/api/gems/unsocket", { itemId: gearId, index: 0 })).status).toBe(400);
    expect(ctx.db.get<{ qty: number }>("SELECT qty FROM items WHERE owner_id = ? AND template_id = 'gem_ruby_1'", uid)!.qty).toBe(30);
    expect(ctx.db.get<{ coins: number }>("SELECT coins FROM players WHERE user_id = ?", uid)!.coins).toBe(before - 1000);
  });
  it("combines three matching gems and rejects invalid or terminal gems", async () => {
    await c.post("/api/gems/craft", { gemId: "gem_ruby_1" });
    expect(ctx.db.get<{ qty: number }>("SELECT qty FROM items WHERE owner_id = ? AND template_id = 'gem_ruby_1'", uid)!.qty).toBe(27);
    expect((await c.get("/api/gems")).gems.find((g: { id: string }) => g.id === "gem_ruby_2").qty).toBe(1);
    for (const gemId of ["gem_ruby_4", "iron_ore", "gem_sapphire_1"]) expect((await c.postErr("/api/gems/craft", { gemId })).status).toBe(400);
  });
  it("rejects locked, non-gear, escrow, foreign and invalid socket targets without consuming resources", async () => {
    await c.post("/api/gems/punch");
    ctx.db.run("UPDATE items SET locked = 1 WHERE id = ?", gearId);
    expect((await c.postErr("/api/gems/unlock", { itemId: gearId })).status).toBe(400);
    ctx.db.run("UPDATE items SET locked = 0, escrow = 'test' WHERE id = ?", gearId);
    expect((await c.postErr("/api/gems/unlock", { itemId: gearId })).status).toBe(404);
    ctx.db.run("UPDATE items SET escrow = NULL WHERE id = ?", gearId);
    expect((await c.postErr("/api/gems/socket", { itemId: gearId, index: -1, gemId: "gem_ruby_1" })).status).toBe(400);
    const material = ctx.db.get<{ id: number }>("SELECT id FROM items WHERE owner_id = ? AND template_id = 'iron_ore'", uid)!.id;
    expect((await c.postErr("/api/gems/unlock", { itemId: material })).status).toBe(400);
    const other = new Client(ctx.app); await other.signup("othergemuser");
    expect((await other.postErr("/api/gems/unlock", { itemId: gearId })).status).toBe(404);
    expect((await c.get("/api/gems")).punches).toBe(1);
  });
  it("rejects unaffordable crafting without consuming materials", async () => {
    ctx.db.run("UPDATE players SET coins = 0 WHERE user_id = ?", uid);
    expect((await c.postErr("/api/gems/punch")).status).toBe(400);
    expect((await c.postErr("/api/gems/craft", { gemId: "gem_ruby_1" })).status).toBe(400);
    expect((await c.get("/api/gems")).gems.find((g: { id: string }) => g.id === "gem_ruby_1").qty).toBe(30);
  });
  it("awards gems on tower milestones", () => {
    const loot = rollVictoryLoot(createRng(42), { source: "tower", towerFloor: 10, level: 10, baseCoins: 10, baseXp: 10, boss: true });
    expect(loot.drops.some((d) => d.kind === "stack" && d.templateId.startsWith("gem_") && d.qty === 2)).toBe(true);
  });
});
