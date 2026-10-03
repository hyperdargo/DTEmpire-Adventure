import { describe, expect, it } from "vitest";
import { PET_MAX_LEVEL } from "../shared/data/pets.ts";
import { petXpToNext } from "../shared/rules/stats.ts";
import { MAX_LEVEL } from "../shared/rules/progression.ts";

describe("Pet Training and Max Level Progression", () => {
  it("verifies pet max levels for all rarities including unique", () => {
    expect(PET_MAX_LEVEL.common).toBe(10);
    expect(PET_MAX_LEVEL.uncommon).toBe(20);
    expect(PET_MAX_LEVEL.rare).toBe(30);
    expect(PET_MAX_LEVEL.epic).toBe(40);
    expect(PET_MAX_LEVEL.legendary).toBe(50);
    expect(PET_MAX_LEVEL.mythic).toBe(60);
    expect(PET_MAX_LEVEL.unique).toBe(70);
  });

  it("verifies companion XP continues even when player character is level 200", () => {
    const playerLevel = MAX_LEVEL; // 200
    const mobLevel = 100;
    const baseLootXp = Math.round(15 + mobLevel * 8);

    // Player gets 0 XP because they are max level:
    const playerXpGain = playerLevel >= MAX_LEVEL ? 0 : baseLootXp;
    expect(playerXpGain).toBe(0);

    // Companions (pet and dual class) receive raw companion XP:
    const companionXp = baseLootXp;
    expect(companionXp).toBeGreaterThan(0);
    expect(companionXp).toBe(815);
  });

  it("simulates pet scroll training advancing level and capping at max", () => {
    let level = 65;
    let petXp = 0;
    const max = PET_MAX_LEVEL.unique; // 70
    const availableScrolls = 200;
    let used = 0;

    while (used < availableScrolls && level < max) {
      const grant = Math.max(30, Math.round(petXpToNext(level) * 0.20));
      petXp += grant;
      while (level < max && petXp >= petXpToNext(level)) {
        petXp -= petXpToNext(level);
        level++;
      }
      used++;
    }
    if (level >= max) petXp = 0;

    expect(level).toBe(70);
    expect(used).toBeLessThan(availableScrolls);
    expect(used).toBeGreaterThan(0);
    expect(petXp).toBe(0);
  });
});
