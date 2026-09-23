import {
  ESTATE_HOUSES,
  ESTATE_OBJECTS,
  ESTATE_OBJECT_BY_ID,
  ESTATE_PET_HOUSES,
  HOUSE_BY_ID,
  PET_HOUSE_BY_ID,
  computeEstateStats,
} from "../../shared/data/estate.ts";
import { GameError, notFound } from "../lib/errors.ts";
import { dayKey } from "../lib/time.ts";
import type { GameCtx } from "./context.ts";
import { applyBuff, grantCoins, savePlayer, spendCoins, type Player } from "./player.ts";

export function getEstateView(g: GameCtx, p: Player) {
  const estate = p.state.estate ?? {};
  const currentHouse = estate.houseId ? HOUSE_BY_ID[estate.houseId] ?? null : null;
  const currentPetHouse = estate.petHouseId ? PET_HOUSE_BY_ID[estate.petHouseId] ?? null : null;
  const placedObjects = (estate.objects ?? [])
    .map((id) => ESTATE_OBJECT_BY_ID[id])
    .filter((o): o is typeof ESTATE_OBJECTS[number] => Boolean(o));
  const totalStats = computeEstateStats(estate);
  const today = dayKey(g.clock.now());
  const dailyCollected = estate.lastCollectedDay === today;

  let dailyDividend = 0;
  if (currentHouse) {
    dailyDividend += 500 + Math.round(currentHouse.price * 0.02);
    for (const obj of placedObjects) {
      dailyDividend += Math.round(obj.price * 0.01);
    }
  }

  return {
    estate,
    currentHouse,
    currentPetHouse,
    placedObjects,
    totalStats,
    dailyCollected,
    dailyDividend,
    dailyReward: {
      coins: dailyDividend,
      buffDurationHours: 4,
      xpBonusPct: 10,
      coinBonusPct: 5,
    },
    catalog: {
      houses: ESTATE_HOUSES,
      petHouses: ESTATE_PET_HOUSES,
      objects: ESTATE_OBJECTS,
    },
  };
}

export function buyHouse(g: GameCtx, p: Player, houseId: string) {
  return g.db.tx(() => {
    const def = HOUSE_BY_ID[houseId];
    if (!def) throw notFound("House not found");
    if (p.level < def.minLevel) {
      throw new GameError(`${def.name} requires level ${def.minLevel}.`, { code: "level_locked" });
    }
    const estate = p.state.estate ?? {};
    if (estate.houseId === houseId) {
      throw new GameError("You already own this property.");
    }

    const prevHouse = estate.houseId ? HOUSE_BY_ID[estate.houseId] : null;
    const tradeIn = prevHouse ? prevHouse.sellPrice : 0;
    const netCost = def.price - tradeIn;

    if (netCost > 0) {
      spendCoins(p, netCost, def.name);
    } else if (netCost < 0) {
      grantCoins(g, p, Math.abs(netCost));
    }

    estate.houseId = def.id;

    // If downgrading to fewer rooms, sell excess placed objects
    if (estate.objects && estate.objects.length > def.rooms) {
      const excess = estate.objects.slice(def.rooms);
      estate.objects = estate.objects.slice(0, def.rooms);
      let refund = 0;
      for (const objId of excess) {
        const obj = ESTATE_OBJECT_BY_ID[objId];
        if (obj) refund += obj.sellPrice;
      }
      if (refund > 0) grantCoins(g, p, refund);
    }

    p.state.estate = estate;
    savePlayer(g, p);
    return getEstateView(g, p);
  });
}

export function sellHouse(g: GameCtx, p: Player) {
  return g.db.tx(() => {
    const estate = p.state.estate;
    if (!estate?.houseId) throw new GameError("You do not own any property to sell.");

    const house = HOUSE_BY_ID[estate.houseId];
    let totalRefund = house?.sellPrice ?? 0;
    let petRefund = 0;
    let furnRefund = 0;

    // Refund pet sanctuary if owned
    if (estate.petHouseId) {
      const petHouse = PET_HOUSE_BY_ID[estate.petHouseId];
      if (petHouse) {
        petRefund = petHouse.sellPrice;
        totalRefund += petRefund;
      }
      estate.petHouseId = null;
    }

    // Refund all placed objects
    for (const objId of estate.objects ?? []) {
      const obj = ESTATE_OBJECT_BY_ID[objId];
      if (obj) {
        furnRefund += obj.sellPrice;
        totalRefund += obj.sellPrice;
      }
    }
    estate.objects = [];
    estate.houseId = null;

    grantCoins(g, p, totalRefund);
    p.state.estate = estate;
    savePlayer(g, p);
    return {
      refund: totalRefund,
      houseRefund: house?.sellPrice ?? 0,
      petRefund,
      furnRefund,
      view: getEstateView(g, p),
    };
  });
}

export function buyPetHouse(g: GameCtx, p: Player, petHouseId: string) {
  return g.db.tx(() => {
    const estate = p.state.estate ?? {};
    if (!estate.houseId) {
      throw new GameError("You must purchase a property before constructing a Pet Sanctuary.");
    }
    const def = PET_HOUSE_BY_ID[petHouseId];
    if (!def) throw notFound("Pet sanctuary not found");
    if (estate.petHouseId === petHouseId) {
      throw new GameError("You already have this Pet Sanctuary built.");
    }

    const prev = estate.petHouseId ? PET_HOUSE_BY_ID[estate.petHouseId] : null;
    const tradeIn = prev ? prev.sellPrice : 0;
    const netCost = def.price - tradeIn;

    if (netCost > 0) {
      spendCoins(p, netCost, def.name);
    } else if (netCost < 0) {
      grantCoins(g, p, Math.abs(netCost));
    }

    estate.petHouseId = def.id;
    p.state.estate = estate;
    savePlayer(g, p);
    return getEstateView(g, p);
  });
}

export function sellPetHouse(g: GameCtx, p: Player) {
  return g.db.tx(() => {
    const estate = p.state.estate;
    if (!estate?.petHouseId) throw new GameError("You do not have a Pet Sanctuary to sell.");

    const petHouse = PET_HOUSE_BY_ID[estate.petHouseId];
    const refund = petHouse?.sellPrice ?? 0;
    estate.petHouseId = null;

    grantCoins(g, p, refund);
    p.state.estate = estate;
    savePlayer(g, p);
    return { refund, view: getEstateView(g, p) };
  });
}

export function buyObject(g: GameCtx, p: Player, objectId: string) {
  return g.db.tx(() => {
    const estate = p.state.estate ?? {};
    if (!estate.houseId) {
      throw new GameError("You need a house before buying furnishings and installations.");
    }
    const house = HOUSE_BY_ID[estate.houseId];
    if (!house) throw notFound("House definition not found");

    const currentObjects = estate.objects ?? [];
    if (currentObjects.length >= house.rooms) {
      throw new GameError(`Your ${house.name} is full (${currentObjects.length}/${house.rooms} rooms used). Upgrade your house or sell an existing object first.`);
    }

    const def = ESTATE_OBJECT_BY_ID[objectId];
    if (!def) throw notFound("Object not found");

    spendCoins(p, def.price, def.name);
    currentObjects.push(def.id);
    estate.objects = currentObjects;

    p.state.estate = estate;
    savePlayer(g, p);
    return getEstateView(g, p);
  });
}

export function sellObject(g: GameCtx, p: Player, objectId: string) {
  return g.db.tx(() => {
    const estate = p.state.estate ?? {};
    const objects = estate.objects ?? [];
    const idx = objects.indexOf(objectId);
    if (idx === -1) {
      throw new GameError("That object is not placed in your residence.");
    }

    const def = ESTATE_OBJECT_BY_ID[objectId];
    const refund = def?.sellPrice ?? 0;
    objects.splice(idx, 1);
    estate.objects = objects;

    grantCoins(g, p, refund);
    p.state.estate = estate;
    savePlayer(g, p);
    return { refund, view: getEstateView(g, p) };
  });
}

export function collectDailyEstate(g: GameCtx, p: Player) {
  return g.db.tx(() => {
    const estate = p.state.estate ?? {};
    if (!estate.houseId) throw new GameError("You need a property to collect daily estate dividends.");

    const today = dayKey(g.clock.now());
    if (estate.lastCollectedDay === today) {
      throw new GameError("You have already collected today's estate dividend and rested bonus. Return tomorrow!");
    }

    const house = HOUSE_BY_ID[estate.houseId];
    if (!house) throw notFound("House not found");

    let dividend = 500 + Math.round(house.price * 0.02);
    for (const objId of estate.objects ?? []) {
      const obj = ESTATE_OBJECT_BY_ID[objId];
      if (obj) dividend += Math.round(obj.price * 0.01);
    }

    grantCoins(g, p, dividend);
    // 4 hours of Rested Estate buff (+10% XP, +5% Coins)
    applyBuff(p, "rested_estate", 4 * 3600, { xpPct: 10, coinPct: 5 }, g.clock.now());
    estate.lastCollectedDay = today;
    p.state.estate = estate;
    savePlayer(g, p);

    return { coins: dividend, dividend, view: getEstateView(g, p) };
  });
}
