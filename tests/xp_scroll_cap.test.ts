import { describe, expect, it } from "vitest";
import { MAX_LEVEL, applyXp, xpToNext } from "../shared/rules/progression.ts";

describe("XP Scroll Capping at Level 200", () => {
  it("stops granting XP and increments when player hits MAX_LEVEL", () => {
    let level = 198;
    let xp = 0;
    const scrollXpPct = 0.15; // 15% of level per scroll
    const totalScrolls = 500;
    let scrollsUsed = 0;

    for (let i = 0; i < totalScrolls; i++) {
      if (level >= MAX_LEVEL) {
        break;
      }
      const gain = Math.round(xpToNext(Math.min(level, MAX_LEVEL - 1)) * scrollXpPct);
      const res = applyXp(level, xp, gain);
      level = res.level;
      xp = res.xp;
      scrollsUsed++;
    }

    expect(level).toBe(MAX_LEVEL);
    // At 15% per scroll, going from level 198 to 200 takes around 14 scrolls, not 500!
    expect(scrollsUsed).toBeLessThan(totalScrolls);
    expect(scrollsUsed).toBeGreaterThan(0);
    expect(scrollsUsed).toBeLessThan(30);

    const scrollsSaved = totalScrolls - scrollsUsed;
    expect(scrollsSaved).toBeGreaterThan(450);
  });

  it("calculates zero gain for level 200", () => {
    expect(xpToNext(MAX_LEVEL)).toBe(0);
    const gain = applyXp(MAX_LEVEL, 0, 100_000);
    expect(gain.level).toBe(MAX_LEVEL);
    expect(gain.gained).toBe(0);
  });
});
