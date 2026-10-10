import { describe, expect, it } from "vitest";
import { GUILD_SHOP_BY_ID, GUILD_SHOP_ITEMS } from "../shared/data/guildShop.ts";
import { JOB_COMMISSIONS, getJobRank } from "../shared/data/meta.ts";
import { makeApp, Client } from "./helpers.ts";

describe("Professions & Artisan Career Mastery", () => {
  it("computes career rank accurately from shifts completed", () => {
    expect(getJobRank(0).name).toBe("Apprentice");
    expect(getJobRank(4).name).toBe("Apprentice");
    expect(getJobRank(5).name).toBe("Journeyman");
    expect(getJobRank(5).wageBonusPct).toBe(15);
    expect(getJobRank(14).name).toBe("Journeyman");
    expect(getJobRank(15).name).toBe("Artisan");
    expect(getJobRank(15).wageBonusPct).toBe(30);
    expect(getJobRank(30).name).toBe("Master");
    expect(getJobRank(30).wageBonusPct).toBe(50);
    expect(getJobRank(55).name).toBe("Grandmaster");
    expect(getJobRank(55).wageBonusPct).toBe(75);
  });

  it("defines commissions for all standard professions", () => {
    expect(JOB_COMMISSIONS["farmer"]).toBeDefined();
    expect(JOB_COMMISSIONS["miner"]).toBeDefined();
    expect(JOB_COMMISSIONS["blacksmith"]).toBeDefined();
    expect(JOB_COMMISSIONS["alchemist"]).toBeDefined();
    expect(JOB_COMMISSIONS["cook"]).toBeDefined();
    expect(JOB_COMMISSIONS["fisher"]).toBeDefined();
    expect(JOB_COMMISSIONS["guard"]).toBeDefined();
    expect(JOB_COMMISSIONS["merchant"]).toBeDefined();
    expect(JOB_COMMISSIONS["knight"]).toBeDefined();
    expect(JOB_COMMISSIONS["wizard"]).toBeDefined();
  });

  it("handles taking jobs, commissions, and collecting shifts", async () => {
    const { app, db, clock } = await makeApp();
    const c = new Client(app);

    await c.post("/api/auth/register", {
      username: "artisan_hero",
      password: "password123",
      heroName: "ArtisanHero",
      classId: "warrior",
    });
    await c.post("/api/hero");

    // Bump hero level to 35 to take blacksmith job
    db.run("UPDATE players SET level = 35, coins = 10000 WHERE user_id = (SELECT id FROM users WHERE username = 'artisan_hero')");

    // Take blacksmith job
    const takeRes = await c.post("/api/jobs/take", { jobId: "blacksmith" });
    expect(takeRes).toBeDefined();

    // Verify job status
    const meRes = await c.get<{ hero: { jobStatus: { jobId: string; rank: { name: string } } } }>("/api/me");
    expect(meRes.hero.jobStatus.jobId).toBe("blacksmith");
    expect(meRes.hero.jobStatus.rank.name).toBe("Apprentice");

    // Execute Trade Commission
    const commRes = await c.post<{ result: { success: boolean; materials: Record<string, number> } }>("/api/jobs/commission", {});
    expect(commRes.result.success).toBe(true);
    expect(commRes.result.materials).toBeDefined();

    // Verify cooldown is active
    const commErr = await c.postErr("/api/jobs/commission", {});
    expect(commErr.status).toBe(400);

    // Start shift
    const startRes = await c.post("/api/jobs/start", {});
    expect(startRes).toBeDefined();

    // Advance clock past 8 hours
    clock.advance(9 * 3600 * 1000);

    // Collect shift
    const collectRes = await c.post<{ result: { coins: number; shiftsCompleted: number } }>("/api/jobs/collect", {});
    expect(collectRes.result.coins).toBeGreaterThan(0);
    expect(collectRes.result.shiftsCompleted).toBe(2); // 1 commission bump + 1 shift bump
  });
});

describe("Guild Armory & Clan Quartermaster", () => {
  it("contains defined items spanning multiple clan levels", () => {
    expect(GUILD_SHOP_ITEMS.length).toBeGreaterThanOrEqual(6);
    expect(GUILD_SHOP_BY_ID["guild_banner"]).toBeDefined();
    expect(GUILD_SHOP_BY_ID["guild_vanguard_blade"]).toBeDefined();
    expect(GUILD_SHOP_BY_ID["guild_sovereign_crest"]).toBeDefined();
    expect(GUILD_SHOP_BY_ID["guild_soVEREIGN_crest"?.toLowerCase()]).toBeDefined();
  });

  it("handles armory catalog listing and requisitions", async () => {
    const { app, db } = await makeApp();
    const c = new Client(app);

    await c.post("/api/auth/register", {
      username: "guild_master",
      password: "password123",
      heroName: "GuildMaster",
      classId: "paladin",
    });
    await c.post("/api/hero");

    // Level up hero to allow creating guild and buying items
    db.run("UPDATE players SET level = 50, coins = 500000 WHERE user_id = (SELECT id FROM users WHERE username = 'guild_master')");

    // Create a guild
    const createRes = await c.post("/api/guilds", {
      name: "The Iron Vanguard",
      tag: "VANG",
      emblem: "🛡️",
    });
    expect(createRes).toBeDefined();

    // Bump guild level to 5 and give member contribution
    db.run("UPDATE guilds SET level = 5 WHERE tag = 'VANG'");
    db.run("UPDATE guild_members SET contribution = 1500 WHERE role = 'leader'");

    // Query Guild Shop
    interface ShopResponse {
      inGuild: boolean;
      guildLevel: number;
      contribution: number;
      items: { id: string; unlocked: boolean }[];
    }
    const shopRes = await c.get<ShopResponse>("/api/guild/shop");
    expect(shopRes.inGuild).toBe(true);
    expect(shopRes.guildLevel).toBe(5);
    expect(shopRes.contribution).toBe(1500);

    const bannerItem = shopRes.items.find((i) => i.id === "guild_banner");
    expect(bannerItem?.unlocked).toBe(true);

    const mythicItem = shopRes.items.find((i) => i.id === "guild_sovereign_crest");
    expect(mythicItem?.unlocked).toBe(false); // Requires level 10

    // Buy guild banner (consumable)
    const buyBannerRes = await c.post<{ result: { success: boolean; rewardContribution: number } }>("/api/guild/shop/buy", {
      itemId: "guild_banner",
      qty: 2,
    });
    expect(buyBannerRes.result.success).toBe(true);
    expect(buyBannerRes.result.rewardContribution).toBe(90);

    // Buy guild blade (oathbound gear)
    const buyGearRes = await c.post<{ result: { success: boolean } }>("/api/guild/shop/buy", {
      itemId: "guild_vanguard_blade",
      qty: 1,
    });
    expect(buyGearRes.result.success).toBe(true);

    // Verify inventory contains banner and sword
    interface InventoryResponse {
      items: { templateId: string }[];
    }
    const invRes = await c.get<InventoryResponse>("/api/inventory");
    expect(invRes.items.some((i) => i.templateId === "guild_banner")).toBe(true);
    expect(invRes.items.some((i) => i.templateId === "guild_vanguard_blade")).toBe(true);

    // Verify purchase achievement tracking
    const heroRes = await c.get<{ hero: { counters: { guildArmoryPurchases: number } } }>("/api/me");
    expect(heroRes.hero.counters.guildArmoryPurchases).toBe(3); // 2 banners + 1 blade
  });
});
