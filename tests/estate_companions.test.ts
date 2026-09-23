import { describe, expect, it } from "vitest";
import { makeApp, Client } from "./helpers.ts";
import { HOUSE_BY_ID } from "../shared/data/estate.ts";
import { ensureCompanions, tickCompanions } from "../server/game/companions.ts";

describe("estate and housing system", () => {
  it("allows buying, furnishing, collecting dividends, and selling real estate", async () => {
    const { app } = await makeApp();
    const c = new Client(app);
    await c.signup("LandlordHero");

    // Give player coins and level for testing
    const db = app.game.db;
    db.run("UPDATE players SET coins = 500000, level = 50 WHERE name = 'LandlordHero'");

    // 1. Initial estate view should be empty
    const initView = await c.get<any>("/api/estate");
    expect(initView.currentHouse).toBeNull();
    expect(initView.currentPetHouse).toBeNull();
    expect(initView.placedObjects).toHaveLength(0);

    // 2. Buy Woodland Cabin (id: "woodland_cabin")
    const cabinPrice = HOUSE_BY_ID.woodland_cabin?.price ?? 25000;
    const buyCabin = await c.post<any>("/api/estate/house/buy", { houseId: "woodland_cabin" });
    expect(buyCabin.result.currentHouse.id).toBe("woodland_cabin");
    expect(buyCabin.me.hero.coins).toBe(500000 - cabinPrice);

    // 3. Buy Pet House (requires owning house)
    const buyPetHouse = await c.post<any>("/api/estate/pethouse/buy", { petHouseId: "cozy_kennel" });
    expect(buyPetHouse.result.currentPetHouse.id).toBe("cozy_kennel");

    // 4. Buy Furnishings / Objects (woodland_cabin has 3 rooms)
    await c.post<any>("/api/estate/object/buy", { objectId: "training_dummy" });
    await c.post<any>("/api/estate/object/buy", { objectId: "feather_hearth" });
    await c.post<any>("/api/estate/object/buy", { objectId: "alchemist_alembic" });

    const estateAfterFurnish = await c.get<any>("/api/estate");
    expect(estateAfterFurnish.placedObjects).toHaveLength(3);
    expect(estateAfterFurnish.totalStats.flatHp).toBeGreaterThan(0);
    expect(estateAfterFurnish.totalStats.flatAtk).toBeGreaterThan(0);

    // 5. Exceeding room capacity should throw error (Cabin has 3 rooms, 4th object fails)
    const overCapacity = await c.req("POST", "/api/estate/object/buy", { objectId: "gilded_vault" });
    expect(overCapacity.statusCode).toBe(400);

    // 6. Collect daily dividend
    const collectRes = await c.post<any>("/api/estate/collect", {});
    expect(collectRes.result.coins).toBeGreaterThan(0);
    expect(collectRes.me.hero.buffs.some((b: any) => b.id === "rested_estate")).toBe(true);

    // Second collect today must fail
    const collectTwice = await c.req("POST", "/api/estate/collect", {});
    expect(collectTwice.statusCode).toBe(400);

    // 7. Selling an object
    const sellObj = await c.post<any>("/api/estate/object/sell", { objectId: "training_dummy" });
    expect(sellObj.result.view.placedObjects).toHaveLength(2);

    // 8. Selling the house
    const sellHouse = await c.post<any>("/api/estate/house/sell", {});
    expect(sellHouse.result.view.currentHouse).toBeNull();
    expect(sellHouse.result.view.placedObjects).toHaveLength(0);
    expect(sellHouse.result.view.currentPetHouse).toBeNull();
  });
});

describe("AI companion players", () => {
  it("initializes 10 online companion players and simulates actions", async () => {
    const { app } = await makeApp();
    const companionIds = await ensureCompanions(app.game);

    expect(companionIds).toHaveLength(10);
    expect(app.game.hub.onlineCount()).toBeGreaterThanOrEqual(5);

    const c = new Client(app);
    await c.signup("RealFriend");

    // Real friend sends friend request to companion 1
    const companion1Id = companionIds[0]!;
    await c.post<any>("/api/friends/request", { userId: companion1Id });

    // Tick companions: should auto-accept friend request and simulate activities
    tickCompanions(app.game);

    const friendsRes = await c.get<any>("/api/friends");
    const companionFriend = friendsRes.friends.find((f: any) => f.userId === companion1Id);
    expect(companionFriend).toBeDefined();
    expect(companionFriend.status).toBe("friend");
  });
});
