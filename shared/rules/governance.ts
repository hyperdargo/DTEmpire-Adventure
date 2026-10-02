export interface GovernanceTaxInfo {
  baseTaxPct: number;
  effectiveTaxPct: number;
  guildDiscountPct: number;
  charterDiscountPct: number;
  estateDiscountPct: number;
  paragonDiscountPct: number;
  titleDiscountPct: number;
  hasCharter: boolean;
  charterCost: number;
  waysToCutTax: {
    category: string;
    discount: string;
    active: boolean;
    description: string;
  }[];
}

export function computeGovernanceTax(
  guildLevel: number,
  hasTaxCharter: boolean,
  houseId: string | null | undefined,
  paragonRank: number,
  title: string | null | undefined,
  extraVaultDiscountPct: number = 0
): GovernanceTaxInfo {
  const baseTaxPct = 20;
  const guildDiscountPct = Math.min(10, Math.max(0, guildLevel)); // 1% per guild level, max 10%
  const charterDiscountPct = (hasTaxCharter ? 5 : 0) + extraVaultDiscountPct; // Guild Tax Haven Charter + Treasury Vault

  // Estate discount
  let estateDiscountPct = 0;
  if (houseId) {
    if (["celestial_citadel", "astral_palace", "sovereign_sky_empire", "cosmic_pantheon"].includes(houseId)) {
      estateDiscountPct = 6;
    } else if (houseId === "arcane_sanctum") {
      estateDiscountPct = 5;
    } else if (houseId === "grand_estate") {
      estateDiscountPct = 4;
    } else if (houseId === "river_manor") {
      estateDiscountPct = 3;
    } else if (houseId === "stone_homestead") {
      estateDiscountPct = 2;
    } else if (houseId === "woodland_cabin") {
      estateDiscountPct = 1;
    }
  }

  // Paragon rank discount: 0.5% per rank, max 5%
  const paragonDiscountPct = Math.min(5, Math.floor((paragonRank || 0) * 0.5));

  // Title discount
  const lowerTitle = (title ?? "").toLowerCase();
  const hasNobleTitle = [
    "imperial",
    "sovereign",
    "lord",
    "governor",
    "noble",
    "diplomat",
    "grand",
    "transcendent",
    "midas",
    "kingpin",
  ].some((w) => lowerTitle.includes(w));
  const titleDiscountPct = hasNobleTitle ? 3 : 0;

  const totalDiscount = guildDiscountPct + charterDiscountPct + estateDiscountPct + paragonDiscountPct + titleDiscountPct;
  const effectiveTaxPct = Math.max(2, baseTaxPct - totalDiscount); // 2% minimum floor

  return {
    baseTaxPct,
    effectiveTaxPct,
    guildDiscountPct,
    charterDiscountPct,
    estateDiscountPct,
    paragonDiscountPct,
    titleDiscountPct,
    hasCharter: hasTaxCharter,
    charterCost: 250_000,
    waysToCutTax: [
      {
        category: "Guild Level",
        discount: `-${guildDiscountPct}% (max -10%)`,
        active: guildDiscountPct > 0,
        description: `Each guild level provides -1% tax relief (Current Lv.${guildLevel}: -${guildDiscountPct}%).`,
      },
      {
        category: "Imperial Tax Haven Charter",
        discount: "-5%",
        active: hasTaxCharter,
        description: hasTaxCharter
          ? "Enacted: Your guild possesses the Imperial Haven Charter."
          : "Guild officers can enact this charter from the vault for 250,000 coins.",
      },
      {
        category: "Noble Estate",
        discount: `-${estateDiscountPct}% (max -6%)`,
        active: estateDiscountPct > 0,
        description: houseId
          ? `Your estate tier grants -${estateDiscountPct}% diplomatic tax exemption.`
          : "Purchase property in the Estate District to earn diplomatic tax exemption.",
      },
      {
        category: "Paragon Ascension",
        discount: `-${paragonDiscountPct}% (max -5%)`,
        active: paragonDiscountPct > 0,
        description: `Each Paragon rank provides -0.5% tax cut (Rank ${paragonRank}: -${paragonDiscountPct}%).`,
      },
      {
        category: "Diplomatic Title",
        discount: "-3%",
        active: hasNobleTitle,
        description: hasNobleTitle
          ? `Title '${title}' recognized by the Imperial Court.`
          : "Equip an Imperial, Sovereign, Lord, or Noble title for court immunity.",
      },
    ],
  };
}
