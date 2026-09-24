import { randomBytes } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { dayKey } from "../lib/time.ts";
import { ACHIEVEMENTS, AI_DUELISTS, ARENA_DAILY_RANKED, BLESSINGS, JOBS, EXPEDITION_DURATIONS, MASTERY_TIERS, masteryBonus } from "../../shared/data/meta.ts";
import { CONSUMABLE_BY_ID, RECIPES } from "../../shared/data/items.ts";
import { REGIONS, STORY_CHAPTERS, isTowerBossFloor, towerLevelReq, TOWER_FLOORS, chapterForFloor } from "../../shared/data/regions.ts";
import type { BattleAction } from "../../shared/data/types.ts";
import { upgradeCost } from "../../shared/rules/items.ts";
import { requireUser } from "../app.ts";
import type { SessionUser } from "../auth.ts";
import { GameError } from "../lib/errors.ts";
import { act, autoResolve, battleView, forfeit, getActiveBattle } from "../game/battles.ts";
import type { GameCtx } from "../game/context.ts";
import * as daily from "../game/daily.ts";
import * as eco from "../game/economy.ts";
import * as events from "../game/events.ts";
import * as abyss from "../game/abyss.ts";
import * as hero from "../game/hero.ts";
import * as inv from "../game/inventory.ts";
import { meSnapshot } from "../game/me.ts";
import * as modes from "../game/modes.ts";
import { currentRealmModifier, realmModifierEndsAt } from "../../shared/data/realm.ts";
import { type Player, bumpMission, findPlayer, loadPlayer, refreshPower, savePlayer, takeStack } from "../game/player.ts";
import * as pve from "../game/pve.ts";
import * as estate from "../game/estate.ts";

const id = z.coerce.number().int().positive();
const actionSchema: z.ZodType<BattleAction> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("attack") }),
  z.object({ type: z.literal("guard") }),
  z.object({ type: z.literal("flee") }),
  z.object({ type: z.literal("skill"), skillId: z.string().max(40) }),
  z.object({ type: z.literal("item"), itemId: id }),
]);

/** Runs a mutation on the signed-in hero and returns the result with fresh shell state. */
export function mutate<T>(g: GameCtx, user: SessionUser, fn: (p: Player) => T) {
  return g.db.tx(() => {
    const p = loadPlayer(g, user.id);
    const result = fn(p);
    refreshPower(g, p);
    const me = meSnapshot(g, user, p);
    savePlayer(g, p);
    return { result, notices: p.notices, me };
  });
}

export function readMe(g: GameCtx, user: SessionUser) {
  return g.db.tx(() => {
    const p = findPlayer(g, user.id);
    if (!p) return meSnapshot(g, user);
    p.lastSeenAt = g.clock.now();
    const me = meSnapshot(g, user, p);
    savePlayer(g, p);
    return me;
  });
}

const parse = <T extends z.ZodTypeAny>(schema: T, req: FastifyRequest): z.infer<T> => schema.parse(req.body ?? {});

export async function registerGameRoutes(app: FastifyInstance) {
  const g = app.game;
  const u = requireUser;

  // ── Shell ──
  app.get("/api/me", async (req) => (req.user ? readMe(g, req.user) : { user: null, hero: null }));

  app.post("/api/hero", async (req) => {
    const user = u(req);
    const cls = hero.createHero(g, user.id, user.username);
    return { class: cls, me: readMe(g, user) };
  });

  app.post("/api/settings", async (req) => {
    const body = parse(z.object({ autoSalvageCommon: z.boolean().optional(), quickBattleDefault: z.boolean().optional(), autoResolveAdventure: z.boolean().optional(), autoResolvePotions: z.boolean().optional() }), req);
    return mutate(g, u(req), (p) => {
      p.state.settings = { ...p.state.settings, ...body };
    });
  });

  app.post("/api/profile", async (req) => {
    const body = parse(z.object({ bio: z.string().max(160).optional(), title: z.string().max(40).nullable().optional() }), req);
    return mutate(g, u(req), (p) => {
      if (body.bio !== undefined) p.bio = body.bio.replace(/[\p{Cc}\p{Cf}]/gu, " ").trim() || null;
      if (body.title !== undefined) {
        if (body.title && !(p.state.titles ?? []).includes(body.title)) throw new GameError("You haven't earned that title.");
        p.title = body.title;
      }
    });
  });

  app.post("/api/profile/avatar", { config: { rateLimit: { max: 10, timeWindow: "1 hour" } } }, async (req) => {
    const user = u(req);
    const file = await req.file();
    if (!file) throw new GameError("Choose an image to upload.");
    const buf = await file.toBuffer();
    const ext = sniffImage(buf);
    if (!ext) throw new GameError("Avatars must be PNG, JPEG or WebP images under 1 MB.");
    const name = `${user.id}-${randomBytes(8).toString("hex")}.${ext}`;
    await writeFile(join(g.config.uploadDir, name), buf);
    const res = mutate(g, user, (p) => {
      const old = p.avatar;
      p.avatar = `/uploads/${name}`;
      return old;
    });
    if (res.result?.startsWith("/uploads/")) await unlink(join(g.config.uploadDir, res.result.slice(9))).catch(() => {});
    return res;
  });

  // ── Class ──
  app.post("/api/class/reroll", async (req) => mutate(g, u(req), (p) => hero.rerollClass(g, p)));
  app.post("/api/class/ascend", async (req) => mutate(g, u(req), (p) => hero.ascendClass(g, p)));
  app.post("/api/class/dual", async (req) => mutate(g, u(req), (p) => hero.unlockDualClass(g, p)));
  app.post("/api/hero/ascend", async (req) => mutate(g, u(req), (p) => hero.ascendParagon(g, p)));
  app.post("/api/hero/paragon", async (req) => mutate(g, u(req), (p) => hero.ascendParagon(g, p)));

  // ── Skills ──
  app.get("/api/skills", async (req) => ({ skills: hero.listSkills(g, u(req).id) }));
  app.post("/api/skills/learn", async (req) => {
    const { skillId } = parse(z.object({ skillId: z.string().max(40) }), req);
    return mutate(g, u(req), (p) => hero.learnSkill(g, p, skillId));
  });
  app.post("/api/skills/rank", async (req) => {
    const { skillId } = parse(z.object({ skillId: z.string().max(40) }), req);
    return mutate(g, u(req), (p) => hero.rankUpSkill(g, p, skillId));
  });
  app.post("/api/skills/loadout", async (req) => {
    const { skillIds } = parse(z.object({ skillIds: z.array(z.string().max(40)).max(4) }), req);
    return mutate(g, u(req), (p) => hero.setLoadout(g, p, skillIds));
  });

  // ── Inventory ──
  app.get("/api/inventory", async (req) => ({ items: inv.listItems(g, u(req).id) }));
  app.post("/api/inventory/equip", async (req) => {
    const { itemId } = parse(z.object({ itemId: id }), req);
    return mutate(g, u(req), (p) => inv.equip(g, p, itemId));
  });
  app.post("/api/inventory/unequip", async (req) => {
    const { slot } = parse(z.object({ slot: z.enum(["weapon", "armor", "helmet", "boots", "accessory"]) }), req);
    return mutate(g, u(req), (p) => inv.unequip(g, p, slot));
  });
  app.post("/api/inventory/lock", async (req) => {
    const { itemId, locked } = parse(z.object({ itemId: id, locked: z.boolean() }), req);
    return mutate(g, u(req), (p) => inv.setLocked(g, p.userId, itemId, locked));
  });
  app.post("/api/inventory/sell", async (req) => {
    const { itemId, qty } = parse(z.object({ itemId: id, qty: z.number().int().min(1).max(9999).default(1) }), req);
    return mutate(g, u(req), (p) => ({ coins: inv.sell(g, p, itemId, qty) }));
  });
  app.post("/api/inventory/salvage", async (req) => {
    const { itemId } = parse(z.object({ itemId: id }), req);
    return mutate(g, u(req), (p) => ({ materials: inv.salvage(g, p, itemId) }));
  });
  app.post("/api/inventory/bulk", async (req) => {
    const { mode, maxRarity } = parse(z.object({ mode: z.enum(["sell", "salvage"]), maxRarity: z.enum(["common", "uncommon", "rare", "epic"]) }), req);
    return mutate(g, u(req), (p) => inv.bulkDispose(g, p, mode, maxRarity));
  });
  app.post("/api/inventory/use", async (req) => {
    const { itemId } = parse(z.object({ itemId: id }), req);
    return mutate(g, u(req), (p) => {
      const item = inv.getOwnedItem(g, p.userId, itemId);
      const c = CONSUMABLE_BY_ID[item.templateId];
      if (c?.kind === "egg") return { kind: "pet" as const, pet: eco.hatchEgg(g, p, item.templateId) };
      if (item.templateId === "skill_book") {
        takeStack(g, p.userId, "skill_book", 1, "Skill Book");
        return { kind: "skill" as const, ...hero.readSkillBook(g, p) };
      }
      return { kind: "consumable" as const, ...inv.useConsumable(g, p, itemId) };
    });
  });

  // ── Pets ──
  app.get("/api/pets", async (req) => ({ pets: eco.listPets(g, u(req).id) }));
  app.post("/api/pets/active", async (req) => {
    const { petId } = parse(z.object({ petId: id.nullable() }), req);
    return mutate(g, u(req), (p) => eco.setActivePet(g, p, petId));
  });
  app.post("/api/pets/rename", async (req) => {
    const { petId, name } = parse(z.object({ petId: id, name: z.string().max(40) }), req);
    return mutate(g, u(req), (p) => eco.renamePet(g, p.userId, petId, name));
  });
  app.post("/api/pets/fuse", async (req) => {
    const { petIds } = parse(z.object({ petIds: z.array(id).max(5) }), req);
    return mutate(g, u(req), (p) => eco.fusePets(g, p, petIds));
  });
  app.post("/api/pets/release", async (req) => {
    const { petId } = parse(z.object({ petId: id }), req);
    return mutate(g, u(req), (p) => ({ coins: eco.releasePet(g, p, petId) }));
  });

  // ── Blacksmith ──
  app.get("/api/smithy", async (req) => {
    const user = u(req);
    const items = inv.listItems(g, user.id);
    return { recipes: RECIPES, upgradeCosts: Object.fromEntries(items.filter((i) => i.kind !== "potion" && i.kind !== "material" && i.kind !== "egg" && i.kind !== "book").map((i) => [i.id, upgradeCost({ rarity: i.rarity, ilvl: i.ilvl, upgrade: i.upgrade })])) };
  });
  app.post("/api/smithy/craft", async (req) => {
    const { recipeId } = parse(z.object({ recipeId: z.string().max(60) }), req);
    return mutate(g, u(req), (p) => eco.craft(g, p, recipeId));
  });
  app.post("/api/smithy/upgrade", async (req) => {
    const { itemId } = parse(z.object({ itemId: id }), req);
    return mutate(g, u(req), (p) => eco.upgradeItem(g, p, itemId));
  });
  app.post("/api/smithy/forge", async (req) => {
    const { aId, bId } = parse(z.object({ aId: id, bId: id }), req);
    return mutate(g, u(req), (p) => eco.forge(g, p, aId, bId));
  });

  // ── Market ──
  app.get("/api/market", async (req) => {
    const user = u(req);
    return g.db.tx(() => {
      const p = loadPlayer(g, user.id);
      const bought = (p.state as { marketBought?: { day: string; ids: string[] } }).marketBought;
      return { offers: eco.marketOffers(g, p), bought: bought?.ids ?? [] };
    });
  });
  app.post("/api/market/buy", async (req) => {
    const { offerId, qty } = parse(z.object({ offerId: z.string().max(200), qty: z.number().int().min(1).max(99).default(1) }), req);
    return mutate(g, u(req), (p) => eco.buyOffer(g, p, offerId, qty));
  });

  // ── Estate / Housing ──
  app.get("/api/estate", async (req) => estate.getEstateView(g, loadPlayer(g, u(req).id)));
  app.post("/api/estate/house/buy", async (req) => {
    const { houseId } = parse(z.object({ houseId: z.string().max(40) }), req);
    return mutate(g, u(req), (p) => estate.buyHouse(g, p, houseId));
  });
  app.post("/api/estate/house/sell", async (req) => mutate(g, u(req), (p) => estate.sellHouse(g, p)));
  app.post("/api/estate/pethouse/buy", async (req) => {
    const { petHouseId } = parse(z.object({ petHouseId: z.string().max(40) }), req);
    return mutate(g, u(req), (p) => estate.buyPetHouse(g, p, petHouseId));
  });
  app.post("/api/estate/pethouse/sell", async (req) => mutate(g, u(req), (p) => estate.sellPetHouse(g, p)));
  app.post("/api/estate/object/buy", async (req) => {
    const { objectId } = parse(z.object({ objectId: z.string().max(40) }), req);
    return mutate(g, u(req), (p) => estate.buyObject(g, p, objectId));
  });
  app.post("/api/estate/object/sell", async (req) => {
    const { objectId } = parse(z.object({ objectId: z.string().max(40) }), req);
    return mutate(g, u(req), (p) => estate.sellObject(g, p, objectId));
  });
  app.post("/api/estate/collect", async (req) => mutate(g, u(req), (p) => estate.collectDailyEstate(g, p)));

  // ── Mail ──
  app.get("/api/mail", async (req) => ({ mail: eco.listMail(g, u(req).id) }));
  app.post("/api/mail/claim", async (req) => {
    const { mailId } = parse(z.object({ mailId: id }), req);
    return mutate(g, u(req), (p) => eco.claimMail(g, p, mailId));
  });
  app.post("/api/mail/claim-all", async (req) => mutate(g, u(req), (p) => eco.claimAllMail(g, p)));
  app.post("/api/mail/clean", async (req) => mutate(g, u(req), (p) => ({ removed: eco.deleteReadMail(g, p.userId) })));

  // ── Adventure / Tower ──
  app.get("/api/adventure", async (req) => {
    const p = loadPlayer(g, u(req).id);
    return {
      regions: REGIONS.map((r) => ({
        id: r.id, name: r.name, icon: r.icon, description: r.description, minLevel: r.minLevel, maxLevel: r.maxLevel,
        unlocked: p.level >= r.minLevel, kills: p.state.regionKills?.[r.id] ?? 0, bossUnlockKills: r.bossUnlockKills,
        boss: { name: r.boss.name, icon: r.boss.icon }, monsters: r.monsters.map((m) => ({ id: m.id, name: m.name, icon: m.icon })),
      })),
    };
  });
  app.post("/api/adventure/start", async (req) => {
    const { regionId, boss } = parse(z.object({ regionId: z.string().max(60), boss: z.boolean().default(false) }), req);
    return mutate(g, u(req), (p) => battleView(pve.startAdventure(g, p, regionId, boss)));
  });

  app.post("/api/adventure/auto-resolve", async (req) => {
    const { enabled, usePotions } = parse(z.object({ enabled: z.boolean().optional(), usePotions: z.boolean().optional() }), req);
    return mutate(g, u(req), (p) => {
      const current = p.state.autoResolveAdventure ?? p.state.settings?.autoResolveAdventure ?? false;
      const nextVal = enabled !== undefined ? enabled : !current;
      p.state.autoResolveAdventure = nextVal;
      p.state.settings = { ...p.state.settings, autoResolveAdventure: nextVal };
      if (usePotions !== undefined) {
        p.state.autoResolvePotions = usePotions;
        p.state.settings.autoResolvePotions = usePotions;
      }
      return { autoResolveAdventure: nextVal, autoResolvePotions: p.state.autoResolvePotions ?? true };
    });
  });

  app.get("/api/tower", async (req) => {
    const p = loadPlayer(g, u(req).id);
    const next = Math.min(TOWER_FLOORS, p.towerFloor + 1);
    return {
      cleared: p.towerFloor, next, nextLevelReq: towerLevelReq(next), nextIsBoss: isTowerBossFloor(next), complete: p.towerFloor >= TOWER_FLOORS,
      chapter: chapterForFloor(next).chapter,
      chapters: STORY_CHAPTERS.map((c) => {
        const unlocked = p.towerFloor >= (c.chapter - 1) * 5 + 1 || c.chapter === 1;
        const complete = p.towerFloor >= c.chapter * 5;
        return { chapter: c.chapter, title: c.title, subtitle: c.subtitle, floors: `${(c.chapter - 1) * 5 + 1}-${c.chapter * 5}`, unlocked, complete,
          text: unlocked ? c.text : null, lore: complete ? c.lore : null, boss: unlocked ? c.boss : null, enemies: unlocked ? c.enemies : null, skills: c.skills };
      }),
    };
  });
  app.post("/api/tower/start", async (req) => mutate(g, u(req), (p) => battleView(pve.startTower(g, p))));

  // ── Dungeon ──
  app.get("/api/dungeon", async (req) => ({ ...modes.dungeonView(loadPlayer(g, u(req).id)), boons: modes.BOONS }));
  app.post("/api/dungeon/start", async (req) => {
    const { fromFloor } = parse(z.object({ fromFloor: z.number().int().min(1).max(100) }), req);
    return mutate(g, u(req), (p) => modes.startRun(g, p, fromFloor));
  });
  app.post("/api/dungeon/fight", async (req) => mutate(g, u(req), (p) => battleView(modes.fightFloor(g, p))));
  app.post("/api/dungeon/boon", async (req) => {
    const { boonId } = parse(z.object({ boonId: z.string().max(40) }), req);
    return mutate(g, u(req), (p) => modes.chooseBoon(g, p, boonId));
  });
  app.post("/api/dungeon/leave", async (req) => mutate(g, u(req), (p) => modes.leaveRun(g, p)));

  // ── Battles ──
  app.get("/api/battle", async (req) => {
    const b = getActiveBattle(g, u(req).id);
    return { battle: b ? battleView(b) : null };
  });
  app.post("/api/battle/:battleId/act", { config: { rateLimit: { max: 240, timeWindow: "1 minute" } } }, async (req) => {
    const user = u(req);
    const { battleId } = z.object({ battleId: z.string().max(40) }).parse(req.params);
    const { action } = parse(z.object({ action: actionSchema }), req);
    const r = act(g, user.id, battleId, action);
    return { battle: battleView(r.battle), rounds: r.rounds, outcome: r.outcome ?? null, notices: r.notices, me: readMe(g, user) };
  });
  app.post("/api/battle/:battleId/auto", async (req) => {
    const user = u(req);
    const { battleId } = z.object({ battleId: z.string().max(40) }).parse(req.params);
    const { usePotions } = parse(z.object({ usePotions: z.boolean().default(false) }), req);
    const r = autoResolve(g, user.id, battleId, { usePotions });
    return { battle: battleView(r.battle), rounds: r.rounds, outcome: r.outcome ?? null, notices: r.notices, me: readMe(g, user) };
  });
  app.post("/api/battle/:battleId/forfeit", async (req) => {
    const user = u(req);
    const { battleId } = z.object({ battleId: z.string().max(40) }).parse(req.params);
    const r = forfeit(g, user.id, battleId);
    return { battle: battleView(r.battle), rounds: r.rounds, outcome: r.outcome ?? null, notices: r.notices, me: readMe(g, user) };
  });

  // ── Duels / arena / world boss ──
  app.get("/api/duels", async (req) => {
    const user = u(req);
    const p = loadPlayer(g, user.id);
    return {
      ai: AI_DUELISTS.map((d) => ({ ...d, wins: (p.counters as Record<string, number>)[`duel_${d.id}`] ?? 0 })),
      rating: p.arenaRating, history: modes.arenaHistory(g, user.id),
      rankedLeft: Math.max(0, ARENA_DAILY_RANKED - (p.state.arena?.day === dayKey(g.clock.now()) ? p.state.arena.ranked : 0)),
      live: app.duels.roomFor(user.id),
    };
  });
  app.post("/api/duels/ai", async (req) => {
    const { duelistId } = parse(z.object({ duelistId: z.string().max(40) }), req);
    return mutate(g, u(req), (p) => battleView(pve.startAiDuel(g, p, duelistId)));
  });
  app.post("/api/arena/ranked", async (req) => mutate(g, u(req), (p) => battleView(modes.startRanked(g, p))));
  app.post("/api/duels/live/challenge", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (req) => {
    const { userId } = parse(z.object({ userId: id }), req);
    return { challengeId: app.duels.challenge(u(req).id, userId) };
  });
  app.post("/api/duels/live/respond", async (req) => {
    const { challengeId, accept } = parse(z.object({ challengeId: z.string().max(40), accept: z.boolean() }), req);
    return { roomId: app.duels.respond(u(req).id, challengeId, accept) };
  });
  app.post("/api/duels/live/act", async (req) => {
    const { roomId, action } = parse(z.object({ roomId: z.string().max(40), action: actionSchema }), req);
    app.duels.act(u(req).id, roomId, action);
    return { ok: true };
  });
  app.post("/api/duels/live/forfeit", async (req) => {
    app.duels.forfeit(u(req).id);
    return { ok: true };
  });

  app.get("/api/worldboss", async (req) => {
    const user = u(req);
    return g.db.tx(() => modes.worldBossView(g, loadPlayer(g, user.id)));
  });
  app.post("/api/worldboss/strike", async (req) => mutate(g, u(req), (p) => battleView(modes.strikeWorldBoss(g, p))));

  // ── Daily loop ──
  app.get("/api/daily", async (req) => {
    const user = u(req);
    return g.db.tx(() => {
      const p = loadPlayer(g, user.id);
      const now = g.clock.now();
      const day = new Date(now).toISOString().slice(0, 10);
      const view = {
        realm: { modifier: currentRealmModifier(now), endsAt: realmModifierEndsAt(now) },
        daily: daily.dailyStatus(g, p),
        contracts: daily.contractView(g, p),
        missions: daily.ensureMissions(g, p),
        job: { ...daily.jobStatus(g, p), jobs: JOBS },
        expedition: { current: p.state.expedition ?? null, durations: EXPEDITION_DURATIONS },
        temple: { blessings: BLESSINGS, offeringsLeft: 5 - (p.state.offerings?.day === day ? p.state.offerings.count : 0) },
        lucky: { spinsUsed: p.state.lucky?.day === day ? p.state.lucky.spins : 0 },
      };
      savePlayer(g, p);
      return view;
    });
  });

  // ── Endless Abyss ──
  app.get("/api/abyss", async (req) => {
    const user = u(req);
    return g.db.tx(() => abyss.abyssView(g, loadPlayer(g, user.id)));
  });
  app.post("/api/abyss/start", async (req) => mutate(g, u(req), (p) => abyss.startAbyssRun(g, p)));
  app.post("/api/abyss/fight", async (req) => mutate(g, u(req), (p) => battleView(abyss.fightAbyssWave(g, p))));
  app.post("/api/abyss/boon", async (req) => {
    const { boonId } = parse(z.object({ boonId: z.string().min(1).max(50) }), req);
    return mutate(g, u(req), (p) => abyss.chooseAbyssBoon(g, p, boonId));
  });
  app.post("/api/abyss/leave", async (req) => mutate(g, u(req), (p) => abyss.leaveAbyss(g, p)));
  app.post("/api/abyss/buy", async (req) => {
    const { shopId } = parse(z.object({ shopId: z.string().min(1).max(50) }), req);
    return mutate(g, u(req), (p) => abyss.buyAbyssShop(g, p, shopId));
  });
  app.post("/api/daily/claim", async (req) => mutate(g, u(req), (p) => daily.claimDaily(g, p)));
  app.post("/api/contracts/claim", async (req) => {
    const { index } = parse(z.object({ index: z.number().int().min(0).max(10) }), req);
    return mutate(g, u(req), (p) => daily.claimContract(g, p, index));
  });
  app.post("/api/missions/claim", async (req) => {
    const { index } = parse(z.object({ index: z.number().int().min(0).max(10) }), req);
    return mutate(g, u(req), (p) => daily.claimMission(g, p, index));
  });
  app.post("/api/missions/chest", async (req) => mutate(g, u(req), (p) => daily.claimMissionChest(g, p)));
  app.post("/api/jobs/take", async (req) => {
    const { jobId } = parse(z.object({ jobId: z.string().max(40) }), req);
    return mutate(g, u(req), (p) => daily.takeJob(g, p, jobId));
  });
  app.post("/api/jobs/start", async (req) => mutate(g, u(req), (p) => daily.startShift(g, p)));
  app.post("/api/jobs/collect", async (req) => mutate(g, u(req), (p) => daily.collectShift(g, p)));
  app.post("/api/temple/pray", async (req) => {
    const { blessingId } = parse(z.object({ blessingId: z.string().max(40) }), req);
    return mutate(g, u(req), (p) => daily.pray(g, p, blessingId));
  });
  app.post("/api/temple/offer", async (req) => {
    const { tier } = parse(z.object({ tier: z.union([z.literal(1), z.literal(2), z.literal(3)]) }), req);
    return mutate(g, u(req), (p) => daily.offer(g, p, tier));
  });
  app.post("/api/inn/rest", async (req) => mutate(g, u(req), (p) => daily.rest(g, p)));
  app.post("/api/lucky/spin", { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (req) => mutate(g, u(req), (p) => daily.luckyRoll(g, p)));
  app.post("/api/lucky/highroller", { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } }, async (req) => {
    const input = parse(
      z.object({
        game: z.enum(["coin", "dice", "slots"]),
        stake: z.number().int().positive(),
        choice: z.string().max(20).optional(),
      }),
      req
    );
    return mutate(g, u(req), (p) => daily.highRollerGamble(g, p, input));
  });
  app.post("/api/expedition/start", async (req) => {
    const { regionId, durationId } = parse(z.object({ regionId: z.string().max(60), durationId: z.string().max(20) }), req);
    return mutate(g, u(req), (p) => daily.startExpedition(g, p, regionId, durationId));
  });
  app.post("/api/expedition/collect", async (req) => mutate(g, u(req), (p) => daily.collectExpedition(g, p)));

  // ── Seasonal event ──
  app.get("/api/event", async (req) => {
    const user = u(req);
    return g.db.tx(() => {
      const p = loadPlayer(g, user.id);
      const view = events.eventView(g, p);
      savePlayer(g, p);
      return view;
    });
  });
  app.post("/api/event/fight", async (req) => mutate(g, u(req), (p) => battleView(events.startEventBattle(g, p))));
  app.post("/api/event/buy", async (req) => {
    const { entryId } = parse(z.object({ entryId: z.string().max(60) }), req);
    return mutate(g, u(req), (p) => events.buyEventItem(g, p, entryId));
  });

  // ── Records ──
  app.get("/api/bestiary", async (req) => {
    const p = loadPlayer(g, u(req).id);
    const kills = p.state.bestiary ?? {};
    const mastery = p.state.mastery ?? {};
    return {
      tiers: MASTERY_TIERS,
      regions: REGIONS.map((r) => ({
        id: r.id, name: r.name, icon: r.icon, minLevel: r.minLevel,
        creatures: [...r.monsters.map((m) => ({ ...m, boss: false })), { ...r.boss, boss: true }].map((m) => {
          const key = `${r.id}:${m.id}`;
          const rank = mastery[key] ?? 0;
          return { key, id: m.id, name: kills[key] ? m.name : null, icon: kills[key] ? m.icon : null, boss: m.boss, kills: kills[key] ?? 0, rank, bonus: masteryBonus(rank) };
        }),
      })),
    };
  });
  app.get("/api/achievements", async (req) => {
    const p = loadPlayer(g, u(req).id);
    const done = new Set(p.state.achievements ?? []);
    return { achievements: ACHIEVEMENTS.map((a) => ({ ...a, progress: Math.min(a.goal, p.counters[a.counter] ?? 0), done: done.has(a.id) })), titles: p.state.titles ?? [], active: p.title };
  });

  void bumpMission;
}

function sniffImage(buf: Buffer): "png" | "jpg" | "webp" | null {
  if (buf.length < 12 || buf.length > 1024 * 1024) return null;
  if (buf[0] === 0x89 && buf.toString("ascii", 1, 4) === "PNG") return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}
