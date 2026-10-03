import { describe, expect, it } from "vitest";
import { MERCHANT_OFFERS, MERCHANT_OFFER_BY_ID, STACK_PAWN_RATES } from "../shared/data/merchant.ts";
import { CONSUMABLE_BY_ID, GEAR_BY_ID } from "../shared/data/items.ts";

describe("Wandering Grand Merchant System", () => {
  it("stocks items across all categories with valid templates", () => {
    expect(MERCHANT_OFFERS.length).toBeGreaterThanOrEqual(20);

    for (const offer of MERCHANT_OFFERS) {
      expect(offer.id).toBeDefined();
      expect(offer.buyPrice).toBeGreaterThan(0);
      expect(offer.pawnPrice).toBeGreaterThan(0);
      expect(offer.buyPrice).toBeGreaterThan(offer.pawnPrice);

      if (offer.kind === "stack") {
        const c = CONSUMABLE_BY_ID[offer.templateId];
        expect(c).toBeDefined();
      } else {
        const g = GEAR_BY_ID[offer.templateId];
        expect(g).toBeDefined();
      }
    }
  });

  it("sells valuable items like Mystic Gem and Star Essence at high premium prices", () => {
    const mysticGem = MERCHANT_OFFER_BY_ID["m_mystic_gem"]!;
    expect(mysticGem).toBeDefined();
    expect(mysticGem.templateId).toBe("mystic_gem");
    expect(mysticGem.buyPrice).toBe(150_000);
    expect(mysticGem.pawnPrice).toBe(50_000);

    const starEssence = MERCHANT_OFFER_BY_ID["m_star_essence"]!;
    expect(starEssence).toBeDefined();
    expect(starEssence.templateId).toBe("star_essence");
    expect(starEssence.buyPrice).toBe(350_000);
    expect(starEssence.pawnPrice).toBe(120_000);

    const dragonScales = MERCHANT_OFFER_BY_ID["m_dragon_scales"]!;
    expect(dragonScales).toBeDefined();
    expect(dragonScales.buyPrice).toBe(50_000);
    expect(dragonScales.pawnPrice).toBe(16_000);
  });

  it("defines high buyback pawn rates for all key crafting reagents", () => {
    expect(STACK_PAWN_RATES["mystic_gem"]).toBe(50_000);
    expect(STACK_PAWN_RATES["star_essence"]).toBe(120_000);
    expect(STACK_PAWN_RATES["dragon_scales"]).toBe(16_000);
    expect(STACK_PAWN_RATES["abyss_shard"]).toBe(25_000);
    expect(STACK_PAWN_RATES["undead_bones"]).toBe(4_500);
    expect(STACK_PAWN_RATES["silk_cloth"]).toBe(1_500);
    expect(STACK_PAWN_RATES["iron_ore"]).toBe(400);

    // Event eggs & tomes
    expect(STACK_PAWN_RATES["lunar_egg"]).toBe(25_000);
    expect(STACK_PAWN_RATES["soul_egg"]).toBe(25_000);
    expect(STACK_PAWN_RATES["abyss_egg"]).toBe(35_000);
    expect(STACK_PAWN_RATES["skill_book"]).toBe(35_000);
    expect(STACK_PAWN_RATES["xp_scroll"]).toBe(10_000);
    expect(STACK_PAWN_RATES["void_reforger"]).toBe(150_000);
  });

  it("stocks high-tier pet eggs up to celestial tier", () => {
    const eggOffers = MERCHANT_OFFERS.filter((o) => o.category === "eggs");
    expect(eggOffers.length).toBeGreaterThanOrEqual(6);

    const celestialEgg = MERCHANT_OFFER_BY_ID["m_celestial_egg"]!;
    expect(celestialEgg).toBeDefined();
    expect(celestialEgg.buyPrice).toBe(20_000_000);

    const phoenixEgg = MERCHANT_OFFER_BY_ID["m_phoenix_egg"]!;
    expect(phoenixEgg).toBeDefined();
    expect(phoenixEgg.buyPrice).toBe(8_000_000);
  });

  it("stocks Level 100 to 200 Transcendent relics and gear", () => {
    const gearOffers = MERCHANT_OFFERS.filter((o) => o.category === "gear");
    expect(gearOffers.length).toBeGreaterThanOrEqual(8);

    const voidAnnihilator = MERCHANT_OFFER_BY_ID["m_void_annihilator"]!;
    expect(voidAnnihilator).toBeDefined();
    expect(voidAnnihilator.templateId).toBe("void_annihilator_200");
    expect(voidAnnihilator.buyPrice).toBe(18_000_000);

    const celestialAegis = MERCHANT_OFFER_BY_ID["m_celestial_aegis"]!;
    expect(celestialAegis).toBeDefined();
    expect(celestialAegis.templateId).toBe("celestial_aegis_200");
    expect(celestialAegis.buyPrice).toBe(20_000_000);

    const crownCosmos = MERCHANT_OFFER_BY_ID["m_crown_of_the_cosmos"]!;
    expect(crownCosmos).toBeDefined();
    expect(crownCosmos.templateId).toBe("crown_of_the_cosmos_200");
    expect(crownCosmos.buyPrice).toBe(25_000_000);
  });
});
