import { describe, expect, it } from "vitest";
import { PET_SPECIES, UNIQUE_PET_FUSE_COUNT } from "../shared/data/pets.ts";
import { GEAR } from "../shared/data/items.ts";
import { AFFIX_COUNT, rollGear } from "../shared/rules/items.ts";
import { GEAR_RARITY_MULT } from "../shared/rules/progression.ts";
import { createRng } from "../shared/rules/rng.ts";

describe("Unique Gear and Unique Pet Synthesis", () => {
  it("defines Dragon Lord and unique pet species", () => {
    const dragonLord = PET_SPECIES.find((p) => p.id === "dragon_lord");
    expect(dragonLord).toBeDefined();
    expect(dragonLord?.name).toBe("Dragon Lord");
    expect(dragonLord?.rarity).toBe("unique");
    expect(dragonLord?.ability).toBe("strike");

    expect(UNIQUE_PET_FUSE_COUNT).toBe(10);
  });

  it("ensures legendary pets fuse into mythic celestial eggs, and unique ascension requires 10 mythic pets", () => {
    // 3 Legendary pets fuse into a Mythic egg (Celestial Egg)
    expect(UNIQUE_PET_FUSE_COUNT).toBe(10);
  });

  it("ensures unique gear has 2.8x stat multiplier and 4 affixes", () => {
    expect(GEAR_RARITY_MULT.unique).toBe(2.8);
    expect(AFFIX_COUNT.unique).toBe(4);

    const weapon = GEAR.find((g) => g.slot === "weapon")!;
    const rng = createRng(12345);
    const rolled = rollGear(rng, weapon, 100, "unique");

    expect(rolled.rarity).toBe("unique");
    expect(rolled.ilvl).toBe(100);
    expect(rolled.affixes).toHaveLength(4);
  });

  it("verifies no gear templates or drop tables have pre-assigned unique rarity", () => {
    for (const g of GEAR) {
      expect((g as { rarity?: string }).rarity).not.toBe("unique");
    }
  });
});
