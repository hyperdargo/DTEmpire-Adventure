import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { importLegacyPlayers } from "../server/legacy.ts";
import type { Db } from "../server/db/db.ts";
import { Client, makeApp } from "./helpers.ts";

// Hashes in the exact format Werkzeug writes (generated with Python's hashlib for the password "legacy-pass-1").
const WERKZEUG_SCRYPT = "scrypt:32768:8:1$AbCdEfGh12345678$f4978b32852bd6885b876e42c6385a15609bf0d9349be0e11b049fb54db7b0098687a052a1a22ef6c6ad544baff7832122c2d637ba9f8f73f2721621ffa917d3";
const WERKZEUG_PBKDF2 = "pbkdf2:sha256:600000$AbCdEfGh12345678$c90e53f4551730a775d5743bbfddb3a8667ea53e0d8d59aa08df98c91a7944fc";

const legacy = {
  "1454_111": {
    username: "OldTimer", name: "Old Timer", email: "old@example.com", password_hash: WERKZEUG_SCRYPT,
    level: 245, coins: 12_000, class_name: "Paladin", class_rarity: "epic", highest_floor: 37, highest_dungeon: 150,
    monsters_killed: 900, bosses_killed: 40, total_wins: 950,
    equipped_weapon: { name: "🔥 Flame Blade", type: "weapon", rarity: "rare", stats: { attack: 35 } },
    inventory: [
      { name: "Healing Potion", type: "potion", rarity: "Common" }, { name: "Healing Potion", type: "potion" },
      { name: "Dragon Scales", type: "material" }, { name: "Mystery Egg", type: "egg" }, "Goblin Steel",
      { name: "Dungeon Epic Gear", type: "weapon", rarity: "epic", stats: { attack: 20 } },
    ],
    pets: ["rare", { name: "Kitsune", rarity: "Rare", level: 5 }],
    skills: { "Power Strike": { level: 3 }, "Iron Wall": { level: 1 }, "Made Up": {} },
    created: 1_780_000_000,
  },
  "1454_222": { username: "g", password_hash: WERKZEUG_PBKDF2, level: 3, coins: 50, class_name: "Unknown Class" },
  "1454_333": "corrupt",
};

let app: FastifyInstance;
let db: Db;
beforeEach(async () => ({ app, db } = await makeApp()));
afterEach(async () => app.close());

describe("legacy import", () => {
  it("dry run changes nothing", () => {
    const r = importLegacyPlayers(db, legacy as never, { dryRun: true });
    expect(r.imported).toBe(2);
    expect(db.get("SELECT COUNT(*) AS n FROM users")).toEqual({ n: 0 });
  });

  it("imports heroes, clamps progress to the new curve, and is idempotent", () => {
    const r = importLegacyPlayers(db, legacy as never);
    expect(r.imported).toBe(2);
    expect(r.skipped).toEqual([{ key: "1454_333", reason: "not an object" }]);
    const p = db.get<{ level: number; class_id: string; class_rarity: string; tower_floor: number; dungeon_best: number; coins: number }>(
      "SELECT pl.* FROM players pl JOIN users u ON u.id = pl.user_id WHERE u.username = 'OldTimer'")!;
    expect(p).toMatchObject({ level: 100, class_id: "paladin", class_rarity: "epic", tower_floor: 37, dungeon_best: 100, coins: 12_000 });
    const items = db.all<{ template_id: string; equipped: number; qty: number }>("SELECT template_id, equipped, qty FROM items i JOIN users u ON u.id = i.owner_id WHERE u.username = 'OldTimer'");
    expect(items.find((i) => i.template_id === "flame_blade")?.equipped).toBe(1);
    expect(items.find((i) => i.template_id === "health_potion")?.qty).toBe(2);
    expect(items.some((i) => i.template_id === "mystery_egg")).toBe(true);
    expect(db.all("SELECT * FROM pets")).toHaveLength(2);
    expect(r.renamed).toEqual([{ from: "g", to: "hero_g" }]);
    expect(importLegacyPlayers(db, legacy as never).imported).toBe(0);
  });

  it("lets imported players sign in with their old password and upgrades the hash", async () => {
    importLegacyPlayers(db, legacy as never);
    const c = new Client(app);
    const bad = await c.postErr("/api/auth/login", { username: "OldTimer", password: "wrong-password" });
    expect(bad.status).toBe(401);
    await c.post("/api/auth/login", { username: "OldTimer", password: "legacy-pass-1" });
    const me = await c.get("/api/me");
    expect(me.hero.level).toBe(100);
    expect(db.get<{ password_hash: string }>("SELECT password_hash FROM users WHERE username = 'OldTimer'")!.password_hash).toMatch(/^scrypt\$/);
    const pb = new Client(app);
    await pb.post("/api/auth/login", { username: "hero_g", password: "legacy-pass-1" });
    expect((await pb.get("/api/me")).hero.class.id).toBe("warrior");
  });
});
