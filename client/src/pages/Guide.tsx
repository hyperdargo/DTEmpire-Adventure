import { Search, Swords, Hammer, PawPrint, Home, Shield, Sparkles, Filter, Coins, ArrowRight, Building2 } from "lucide-react";
import { useMemo, useState } from "react";
import { REGIONS, type Region } from "../../../shared/data/regions.ts";
import { CONSUMABLE_BY_ID, GEAR_BY_ID, RECIPES } from "../../../shared/data/items.ts";
import { PET_SPECIES, PET_MAX_LEVEL } from "../../../shared/data/pets.ts";
import { CLASSES } from "../../../shared/data/classes.ts";
import { ESTATE_HOUSES, ESTATE_OBJECTS, ESTATE_PET_HOUSES } from "../../../shared/data/estate.ts";
import { PageHead, Panel, Tabs, Chip, RarityChip } from "../components/ui.tsx";
import type { Rarity } from "../../../shared/data/types.ts";

export default function GuidePage() {
  const [tab, setTab] = useState<"mobs" | "crafting" | "pets" | "estate" | "classes">("mobs");
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");

  return (
    <div>
      <PageHead
        title="Adventurer's Codex & Guide"
        actions={
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <div style={{ position: "relative", display: "inline-block" }}>
              <Search size={16} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#666" }} />
              <input
                type="text"
                placeholder="Search guide..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  background: "#141414",
                  border: "1px solid #333",
                  color: "#eee",
                  borderRadius: "6px",
                  padding: "6px 12px 6px 32px",
                  fontSize: "0.85rem",
                  width: "180px",
                }}
              />
            </div>
          </div>
        }
      >
        Complete encyclopedic reference on monster habitats, regional loot tables, Blacksmith recipes, gear fusion, pet breeding, and estate mechanics.
      </PageHead>

      <Tabs
        label="Guide Sections"
        value={tab}
        onChange={setTab}
        options={[
          { value: "mobs", label: <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><Swords size={16} /> Bestiary & Mobs</span> },
          { value: "crafting", label: <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><Hammer size={16} /> Crafting & Fusion</span> },
          { value: "pets", label: <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><PawPrint size={16} /> Pets & Breeding</span> },
          { value: "estate", label: <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><Home size={16} /> Estate & Housing</span> },
          { value: "classes", label: <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><Shield size={16} /> Classes & Skills</span> },
        ]}
      />

      <div style={{ marginTop: "var(--s-5)" }}>
        {tab === "mobs" && <MobsGuide search={search} levelFilter={levelFilter} onLevelFilterChange={setLevelFilter} />}
        {tab === "crafting" && <CraftingGuide search={search} />}
        {tab === "pets" && <PetsGuide search={search} />}
        {tab === "estate" && <EstateGuide search={search} />}
        {tab === "classes" && <ClassesGuide search={search} />}
      </div>
    </div>
  );
}

// ── Tab 1: Mobs & Bestiary by Level ─────────────────────────────────────
function MobsGuide({ search, levelFilter, onLevelFilterChange }: { search: string; levelFilter: string; onLevelFilterChange: (f: string) => void }) {
  const filtered = useMemo(() => {
    return REGIONS.filter((r) => {
      if (levelFilter === "1-15" && (r.minLevel > 15 || r.maxLevel < 1)) return false;
      if (levelFilter === "16-30" && (r.minLevel > 30 || r.maxLevel < 16)) return false;
      if (levelFilter === "31-50" && (r.minLevel > 50 || r.maxLevel < 31)) return false;
      if (levelFilter === "51-75" && (r.minLevel > 75 || r.maxLevel < 51)) return false;
      if (levelFilter === "76-100" && r.maxLevel < 76) return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      if (r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)) return true;
      if (r.boss.name.toLowerCase().includes(q)) return true;
      return r.monsters.some((m) => m.name.toLowerCase().includes(q));
    });
  }, [levelFilter, search]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Level filter bar */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: "0.85rem", color: "#888", display: "flex", alignItems: "center", gap: "4px" }}>
          <Filter size={14} /> Level:
        </span>
        {[
          { key: "all", label: "All Levels (1–100)" },
          { key: "1-15", label: "Lv 1–15 (Early)" },
          { key: "16-30", label: "Lv 16–30 (Mid)" },
          { key: "31-50", label: "Lv 31–50 (Veteran)" },
          { key: "51-75", label: "Lv 51–75 (Master)" },
          { key: "76-100", label: "Lv 76–100 (Endgame)" },
        ].map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => onLevelFilterChange(f.key)}
            style={{
              background: levelFilter === f.key ? "#fff" : "#141414",
              color: levelFilter === f.key ? "#000" : "#bbb",
              border: "1px solid #333",
              borderRadius: "4px",
              padding: "4px 10px",
              fontSize: "0.8rem",
              cursor: "pointer",
              fontWeight: levelFilter === f.key ? 600 : 400,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Global Loot Rules Summary */}
      <Panel tight>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", fontSize: "0.82rem" }}>
          <div style={{ borderLeft: "2px solid #555", paddingLeft: "10px" }}>
            <strong style={{ color: "#fff" }}>Drop Tiers by Level</strong>
            <div style={{ color: "#999", marginTop: "4px" }}>
              • <strong>Lv 1–9:</strong> Iron Ore, Undead Bones, Mystery Eggs<br />
              • <strong>Lv 10–24:</strong> Silk Cloth unlocked<br />
              • <strong>Lv 25–39:</strong> Dragon Scales, Dragon Eggs unlocked<br />
              • <strong>Lv 40+:</strong> Mystic Gems, Void Eggs unlocked
            </div>
          </div>
          <div style={{ borderLeft: "2px solid #555", paddingLeft: "10px" }}>
            <strong style={{ color: "#fff" }}>Boss Encounters</strong>
            <div style={{ color: "#999", marginTop: "4px" }}>
              Defeat <strong>10 region monsters</strong> to summon the boss. Bosses guarantee Uncommon+ gear drops, bonus materials, a 12% pet egg drop rate, and 10% Skill Book chance.
            </div>
          </div>
          <div style={{ borderLeft: "2px solid #555", paddingLeft: "10px" }}>
            <strong style={{ color: "#fff" }}>Luck Bonus</strong>
            <div style={{ color: "#999", marginTop: "4px" }}>
              Every point of <strong>Luck</strong> increases gear, material, and rare egg drop rates by +1%.
            </div>
          </div>
        </div>
      </Panel>

      {/* Regions list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {filtered.map((region) => (
          <RegionCard key={region.id} region={region} />
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: "32px", textAlign: "center", color: "#666", border: "1px dashed #333", borderRadius: "8px" }}>
            No regions or monsters match your search filter.
          </div>
        )}
      </div>
    </div>
  );
}

function RegionCard({ region }: { region: Region }) {
  const lootPreview = useMemo(() => {
    const mats: string[] = ["Iron Ore", "Undead Bones"];
    if (region.minLevel >= 10 || region.maxLevel >= 10) mats.push("Silk Cloth");
    if (region.minLevel >= 25 || region.maxLevel >= 25) mats.push("Dragon Scales");
    if (region.minLevel >= 40 || region.maxLevel >= 40) mats.push("Mystic Gem");

    let egg = "Mystery Egg, Slime Egg";
    if (region.minLevel >= 15) egg = "Forest Egg, Mystery Egg";
    if (region.minLevel >= 30) egg = "Dragon Egg, Golden Egg";
    if (region.minLevel >= 60) egg = "Void Egg, Celestial Egg";

    return { mats: mats.join(", "), egg };
  }, [region]);

  return (
    <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "8px", overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid #222", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "1.8rem" }}>{region.icon}</span>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#fff" }}>{region.name}</h3>
              <span style={{ fontSize: "0.75rem", background: "#222", border: "1px solid #333", borderRadius: "4px", padding: "2px 6px", color: "#ccc" }}>
                Level {region.minLevel}–{region.maxLevel}
              </span>
            </div>
            <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "#888" }}>{region.description}</p>
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: "0.8rem", color: "#aaa" }}>
          <div><strong style={{ color: "#eee" }}>Materials:</strong> {lootPreview.mats}</div>
          <div style={{ color: "#888" }}><strong>Pet Eggs:</strong> {lootPreview.egg}</div>
        </div>
      </div>

      <div style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "14px" }}>
        {/* Regular Monsters */}
        <div>
          <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
            Common Inhabitants ({region.monsters.length})
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "8px" }}>
            {region.monsters.map((m) => {
              const trait = m.shape.hp > 1.1 ? "Tanky" : m.shape.atk > 1.1 ? "Hard Hitting" : m.shape.def > 1.1 ? "Armored" : "Balanced";
              return (
                <div key={m.id} style={{ background: "#161616", border: "1px solid #282828", borderRadius: "6px", padding: "8px 10px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "1.3rem" }}>{m.icon}</span>
                  <div style={{ overflow: "hidden" }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 500, color: "#eee", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }} title={m.name}>
                      {m.name}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "#777" }}>{trait}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Regional Boss */}
        <div>
          <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
            Regional Overlord (Boss)
          </div>
          <div style={{ background: "#181818", border: "1px solid #383838", borderRadius: "6px", padding: "12px 14px", display: "flex", alignItems: "center", gap: "14px" }}>
            <span style={{ fontSize: "2rem" }}>{region.boss.icon}</span>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <strong style={{ fontSize: "0.95rem", color: "#fff" }}>{region.boss.name}</strong>
                <Chip tone="gold">Boss</Chip>
              </div>
              <div style={{ fontSize: "0.78rem", color: "#999", marginTop: "4px" }}>
                Requires <strong>{region.bossUnlockKills} kills</strong> in {region.name} to summon.
              </div>
              <div style={{ fontSize: "0.74rem", color: "#777", marginTop: "2px" }}>
                Rewards: Guaranteed Gear + Material Stacks + 12% Egg + 10% Skill Book.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tab 2: Crafting & Fusion Guide ──────────────────────────────────────
function CraftingGuide({ search }: { search: string }) {
  const filteredRecipes = useMemo(() => {
    if (!search.trim()) return RECIPES;
    const q = search.toLowerCase();
    return RECIPES.filter((r) => {
      const gear = GEAR_BY_ID[r.gearId];
      if (gear && gear.name.toLowerCase().includes(q)) return true;
      if (r.rarity.toLowerCase().includes(q)) return true;
      return Object.keys(r.materials).some((m) => m.toLowerCase().includes(q));
    });
  }, [search]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Visual Forging / Fusion Explainer */}
      <Panel title={<h3><Sparkles size={18} /> Gear Fusion System (Forge 2-into-1)</h3>}>
        <div style={{ fontSize: "0.88rem", color: "#ccc", lineHeight: 1.5 }}>
          Combine <strong>two pieces of gear of the SAME slot and SAME rarity</strong> at the Blacksmith to forge an upgraded item of the <strong>next rarity tier</strong>!
        </div>
        <div style={{ marginTop: "14px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", background: "#141414", padding: "12px 16px", borderRadius: "6px", border: "1px solid #282828" }}>
          <div style={{ textAlign: "center" }}>
            <RarityChip rarity="uncommon" />
            <div style={{ fontSize: "0.75rem", color: "#777", marginTop: "2px" }}>2× Same Slot</div>
          </div>
          <ArrowRight size={18} style={{ color: "#666" }} />
          <div style={{ textAlign: "center" }}>
            <RarityChip rarity="rare" />
            <div style={{ fontSize: "0.75rem", color: "#777", marginTop: "2px" }}>Higher Base Stats</div>
          </div>
          <ArrowRight size={18} style={{ color: "#666" }} />
          <div style={{ textAlign: "center" }}>
            <RarityChip rarity="epic" />
            <div style={{ fontSize: "0.75rem", color: "#777", marginTop: "2px" }}>+3 Bonus Affixes</div>
          </div>
          <ArrowRight size={18} style={{ color: "#666" }} />
          <div style={{ textAlign: "center" }}>
            <RarityChip rarity="legendary" />
            <div style={{ fontSize: "0.75rem", color: "#777", marginTop: "2px" }}>+4 Bonus Affixes</div>
          </div>
          <ArrowRight size={18} style={{ color: "#666" }} />
          <div style={{ textAlign: "center" }}>
            <RarityChip rarity="mythic" />
            <div style={{ fontSize: "0.75rem", color: "#777", marginTop: "2px" }}>Peak Power (+5 Affixes)</div>
          </div>
        </div>
        <div style={{ marginTop: "10px", fontSize: "0.8rem", color: "#888" }}>
          • The forged item keeps the <strong>higher item level (ilvl)</strong> and retains the <strong>highest upgrade rank</strong> between the two sacrifices.<br />
          • Items must be unlocked and unequipped before forging.
        </div>
      </Panel>

      {/* Materials & Salvaging Chart */}
      <Panel title={<h3><Hammer size={18} /> Materials & Salvage Sources</h3>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
          {[
            { id: "iron_ore", name: "Iron Ore", icon: "🪨", source: "Levels 1–24 & salvaging common/uncommon gear", use: "Early weapon & armor forging" },
            { id: "undead_bones", name: "Undead Bones", icon: "🦴", source: "Levels 1–24 catacombs & skeleton monsters", use: "Reinforcing boots, chainmail, and blades" },
            { id: "silk_cloth", name: "Silk Cloth", icon: "🧵", source: "Levels 10–50 forest, marsh, and spider foes", use: "Light armor, robes, bows, and cloaks" },
            { id: "dragon_scales", name: "Dragon Scales", icon: "🐉", source: "Levels 25–70 volcanic beasts & bosses", use: "Epic and legendary tier arms & armors" },
            { id: "mystic_gem", name: "Mystic Gem", icon: "💎", source: "Levels 40+ bosses, spires, and high-floor tower", use: "High-tier relic forging & +7 to +10 upgrades" },
            { id: "star_essence", name: "Star Essence", icon: "🌟", source: "Salvaging Rare, Epic, Legendary, or Mythic gear", use: "Peak mythic crafts and ascension gear" },
          ].map((m) => (
            <div key={m.id} style={{ background: "#151515", border: "1px solid #2a2a2a", borderRadius: "6px", padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "1.4rem" }}>{m.icon}</span>
                <strong style={{ color: "#eee", fontSize: "0.9rem" }}>{m.name}</strong>
              </div>
              <div style={{ fontSize: "0.78rem", color: "#aaa", marginTop: "6px" }}>
                <strong>Source:</strong> {m.source}
              </div>
              <div style={{ fontSize: "0.74rem", color: "#777", marginTop: "3px" }}>
                <strong>Used For:</strong> {m.use}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Blacksmith Recipes Catalog */}
      <Panel title={<h3><Swords size={18} /> Blacksmith Crafting Recipes ({filteredRecipes.length})</h3>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "12px" }}>
          {filteredRecipes.map((r) => {
            const gear = GEAR_BY_ID[r.gearId];
            if (!gear) return null;
            return (
              <div key={r.id} style={{ background: "#141414", border: "1px solid #262626", borderRadius: "6px", padding: "12px 14px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "1.8rem" }}>{gear.icon}</span>
                      <div>
                        <div style={{ fontWeight: 600, color: "#fff", fontSize: "0.95rem" }}>{gear.name}</div>
                        <div style={{ fontSize: "0.75rem", color: "#888", textTransform: "capitalize" }}>
                          Slot: {gear.slot} {gear.weaponType ? `(${gear.weaponType})` : ""} · Lv Req: {gear.levelReq}
                        </div>
                      </div>
                    </div>
                    <RarityChip rarity={r.rarity} />
                  </div>
                  <p style={{ margin: "8px 0 10px", fontSize: "0.78rem", color: "#999" }}>{gear.desc}</p>
                </div>

                <div style={{ borderTop: "1px solid #222", paddingTop: "8px", marginTop: "8px" }}>
                  <div style={{ fontSize: "0.75rem", color: "#888", marginBottom: "4px" }}>Requirements:</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
                    {Object.entries(r.materials).map(([matId, qty]) => {
                      const mat = CONSUMABLE_BY_ID[matId];
                      return (
                        <span key={matId} style={{ background: "#1c1c1c", border: "1px solid #333", borderRadius: "4px", padding: "2px 6px", fontSize: "0.75rem", color: "#eee" }}>
                          {mat?.icon ?? "📦"} {qty}× {mat?.name ?? matId}
                        </span>
                      );
                    })}
                    <span style={{ color: "#ffd700", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "2px" }}>
                      <Coins size={12} /> {r.coins.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

// ── Tab 3: Pets & Breeding Guide ────────────────────────────────────────
function PetsGuide({ search }: { search: string }) {
  const filteredPets = useMemo(() => {
    if (!search.trim()) return PET_SPECIES;
    const q = search.toLowerCase();
    return PET_SPECIES.filter((p) => p.name.toLowerCase().includes(q) || p.rarity.toLowerCase().includes(q) || p.focus.toLowerCase().includes(q));
  }, [search]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Pet Fusion & Breeding Rules */}
      <Panel title={<h3><PawPrint size={18} /> Pet Fusion & Breeding Mechanics</h3>}>
        <div style={{ fontSize: "0.88rem", color: "#ccc", lineHeight: 1.5 }}>
          Combine duplicate companions to ascend them into higher rarity ranks:
        </div>
        <div style={{ marginTop: "12px", background: "#141414", border: "1px solid #282828", borderRadius: "6px", padding: "12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, color: "#fff" }}>3 Pets of the SAME Rarity</span>
            <ArrowRight size={16} style={{ color: "#666" }} />
            <span style={{ background: "#222", border: "1px solid #444", borderRadius: "4px", padding: "3px 8px", color: "#ffd700", fontWeight: 600 }}>
              1× Egg of the NEXT Higher Rarity Tier
            </span>
          </div>
          <div style={{ marginTop: "8px", fontSize: "0.8rem", color: "#888" }}>
            Example: Fusing 3 Uncommon pets awards 1 Dragon Egg (Guaranteed Rare). Fusing 3 Rare pets yields 1 Void Egg (Guaranteed Epic).
          </div>
        </div>

        <div style={{ marginTop: "14px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
          {(["common", "uncommon", "rare", "epic", "legendary", "mythic"] as Rarity[]).map((r) => (
            <div key={r} style={{ background: "#161616", border: "1px solid #282828", borderRadius: "6px", padding: "8px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <RarityChip rarity={r} />
                <span style={{ fontSize: "0.8rem", color: "#aaa" }}>Max Lv {PET_MAX_LEVEL[r]}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Egg Types & Hatch Rates */}
      <Panel title={<h3><Sparkles size={18} /> Egg Hatching Catalog</h3>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "12px" }}>
          {[
            { name: "Slime Egg", icon: "🟢", cost: "300 Coins", hatch: "Guaranteed Common (Slime, Bat, Goblin)", source: "Early monsters & general store" },
            { name: "Forest Egg", icon: "🌿", cost: "1,200 Coins", hatch: "Guaranteed Uncommon (Wolf Cub, Cat, Bunny)", source: "Mid monsters & expeditions" },
            { name: "Dragon Egg", icon: "🐉", cost: "5,000 Coins", hatch: "Guaranteed Rare (Dragon, Phoenix, Kitsune)", source: "Lv 25+ bosses & 3× Uncommon fusion" },
            { name: "Void Egg", icon: "🌑", cost: "20,000 Coins", hatch: "Guaranteed Epic (Griffin, Chimera Cub, Kraken)", source: "Lv 40+ bosses & 3× Rare fusion" },
            { name: "Phoenix Egg", icon: "🔥", cost: "80,000 Coins", hatch: "Guaranteed Legendary (Thunder Roc, Titan Golem, Elder Wyrm)", source: "3× Epic fusion & high tower chests" },
            { name: "Celestial Egg", icon: "⭐", cost: "300,000 Coins", hatch: "Guaranteed Mythic (Celestial, Void Drake, God Beast)", source: "3× Legendary fusion & celestial events" },
            { name: "Mystery Egg", icon: "🥚", cost: "600 Coins", hatch: "50% Common, 30% Uncommon, 13% Rare, 5% Epic, 1.7% Legendary, 0.3% Mythic", source: "Monster drops & daily quests" },
            { name: "Golden Egg", icon: "🪺", cost: "6,000 Coins", hatch: "70% Rare, 22% Epic, 7% Legendary, 1% Mythic", source: "Tower milestone rewards & shop" },
          ].map((egg) => (
            <div key={egg.name} style={{ background: "#151515", border: "1px solid #282828", borderRadius: "6px", padding: "10px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "1.5rem" }}>{egg.icon}</span>
                <div>
                  <strong style={{ color: "#fff", fontSize: "0.9rem" }}>{egg.name}</strong>
                  <div style={{ fontSize: "0.75rem", color: "#888" }}>Cost: {egg.cost}</div>
                </div>
              </div>
              <div style={{ fontSize: "0.78rem", color: "#ccc", marginTop: "6px" }}>
                <strong>Yield:</strong> {egg.hatch}
              </div>
              <div style={{ fontSize: "0.72rem", color: "#777", marginTop: "2px" }}>
                <strong>Source:</strong> {egg.source}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Pet Species Catalog */}
      <Panel title={<h3><PawPrint size={18} /> Pet Species & Combat Roles ({filteredPets.length})</h3>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "10px" }}>
          {filteredPets.map((pet) => {
            const roleColor = pet.ability === "strike" ? "#e05252" : pet.ability === "ward" ? "#4a9eff" : "#50c878";
            return (
              <div key={pet.id} style={{ background: "#141414", border: "1px solid #262626", borderRadius: "6px", padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "1.6rem" }}>{pet.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, color: "#fff", fontSize: "0.88rem" }}>{pet.name}</div>
                    <div style={{ fontSize: "0.74rem", color: "#888" }}>
                      Role: <span style={{ color: roleColor, textTransform: "capitalize", fontWeight: 500 }}>{pet.ability}</span> ({pet.focus})
                    </div>
                  </div>
                </div>
                <RarityChip rarity={pet.rarity} />
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

// ── Tab 4: Estate & Housing Guide ───────────────────────────────────────
function EstateGuide({ search }: { search: string }) {
  const q = search.trim().toLowerCase();
  const houses = ESTATE_HOUSES.filter((h) => !q || h.name.toLowerCase().includes(q) || h.desc.toLowerCase().includes(q));
  const objects = ESTATE_OBJECTS.filter((o) => !q || o.name.toLowerCase().includes(q) || o.desc.toLowerCase().includes(q));
  const petHouses = ESTATE_PET_HOUSES.filter((p) => !q || p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Overview */}
      <Panel title={<h3><Home size={18} /> Housing Economy Overview</h3>}>
        <div style={{ fontSize: "0.88rem", color: "#ccc", lineHeight: 1.5 }}>
          Estates provide end-game coin sinks that permanently augment your hero stats and produce daily dividends:
        </div>
        <div style={{ marginTop: "12px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
          <div style={{ background: "#151515", border: "1px solid #282828", borderRadius: "6px", padding: "10px 12px" }}>
            <strong style={{ color: "#fff", fontSize: "0.88rem" }}>Permanent Stat Multipliers</strong>
            <div style={{ fontSize: "0.78rem", color: "#999", marginTop: "4px" }}>
              Place luxury furnishings in your rooms for passive HP, ATK, DEF, Crit, and Luck multipliers.
            </div>
          </div>
          <div style={{ background: "#151515", border: "1px solid #282828", borderRadius: "6px", padding: "10px 12px" }}>
            <strong style={{ color: "#fff", fontSize: "0.88rem" }}>Daily Coin Dividends</strong>
            <div style={{ fontSize: "0.78rem", color: "#999", marginTop: "4px" }}>
              Collect a daily coin dividend equal to 1.5% of your total estate net worth + 500 base gold.
            </div>
          </div>
          <div style={{ background: "#151515", border: "1px solid #282828", borderRadius: "6px", padding: "10px 12px" }}>
            <strong style={{ color: "#fff", fontSize: "0.88rem" }}>Rested Estate Buff</strong>
            <div style={{ fontSize: "0.78rem", color: "#999", marginTop: "4px" }}>
              Resting at your residence grants a 4-hour buff with <strong>+10% XP</strong> and <strong>+5% Coins</strong>.
            </div>
          </div>
          <div style={{ background: "#151515", border: "1px solid #282828", borderRadius: "6px", padding: "10px 12px" }}>
            <strong style={{ color: "#fff", fontSize: "0.88rem" }}>70% Resale Guarantee</strong>
            <div style={{ fontSize: "0.78rem", color: "#999", marginTop: "4px" }}>
              Trade in your property or individual furnishings at any time for 70% of their original gold value.
            </div>
          </div>
        </div>
      </Panel>

      {/* Property Catalog */}
      <Panel title={<h3><Building2 size={18} /> Residential Properties ({houses.length})</h3>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
          {houses.map((h) => (
            <div key={h.id} style={{ background: "#141414", border: "1px solid #282828", borderRadius: "6px", padding: "12px 14px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "1.8rem" }}>{h.icon}</span>
                    <div>
                      <div style={{ fontWeight: 600, color: "#fff", fontSize: "0.95rem" }}>{h.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "#888" }}>Lv Req: {h.minLevel} · {h.rooms} Rooms</div>
                    </div>
                  </div>
                  <span style={{ color: "#ffd700", fontSize: "0.8rem", fontWeight: 600 }}>{h.price.toLocaleString()} g</span>
                </div>
                <p style={{ margin: "8px 0 10px", fontSize: "0.78rem", color: "#999" }}>{h.desc}</p>
              </div>
              <div style={{ borderTop: "1px solid #222", paddingTop: "8px", fontSize: "0.75rem", color: "#aaa" }}>
                <strong>Resale Value:</strong> {h.sellPrice.toLocaleString()} coins (70%)
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Furnishings Catalog */}
      <Panel title={<h3><Sparkles size={18} /> Luxury Furnishings ({objects.length})</h3>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
          {objects.map((obj) => (
            <div key={obj.id} style={{ background: "#141414", border: "1px solid #282828", borderRadius: "6px", padding: "10px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "1.4rem" }}>{obj.icon}</span>
                  <div>
                    <strong style={{ color: "#fff", fontSize: "0.88rem" }}>{obj.name}</strong>
                    <div style={{ fontSize: "0.72rem", color: "#888" }}>Cost: {obj.price.toLocaleString()} g</div>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: "0.76rem", color: "#4ade80", marginTop: "6px" }}>
                {obj.desc}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Pet Sanctuaries */}
      <Panel title={<h3><PawPrint size={18} /> Pet Housing & Sanctuaries ({petHouses.length})</h3>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
          {petHouses.map((ph) => (
            <div key={ph.id} style={{ background: "#141414", border: "1px solid #282828", borderRadius: "6px", padding: "10px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "1.5rem" }}>{ph.icon}</span>
                  <strong style={{ color: "#fff", fontSize: "0.9rem" }}>{ph.name}</strong>
                </div>
                <span style={{ color: "#ffd700", fontSize: "0.8rem", fontWeight: 600 }}>{ph.price.toLocaleString()} g</span>
              </div>
              <p style={{ margin: "6px 0 0", fontSize: "0.78rem", color: "#999" }}>{ph.desc}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

// ── Tab 5: Classes & Dual Classes ───────────────────────────────────────
function ClassesGuide({ search }: { search: string }) {
  const filtered = useMemo(() => {
    if (!search.trim()) return CLASSES;
    const q = search.toLowerCase();
    return CLASSES.filter((c) => c.name.toLowerCase().includes(q) || c.archetype.toLowerCase().includes(q) || c.weapon.toLowerCase().includes(q) || c.passive.name.toLowerCase().includes(q));
  }, [search]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Dual Class System Notice */}
      <Panel title={<h3><Swords size={18} /> Dual Class Specialization</h3>}>
        <div style={{ fontSize: "0.88rem", color: "#ccc", lineHeight: 1.5 }}>
          Upon reaching <strong>Level 25</strong>, adventurers unlock the <strong>Dual Class</strong> system in the Hero Sanctuary:
        </div>
        <div style={{ marginTop: "10px", fontSize: "0.82rem", color: "#aaa", lineHeight: 1.6 }}>
          • Choose any unlocked secondary class to level alongside your main class.<br />
          • Gain secondary class base stats and weapon affinity synergies.<br />
          • Swap or specialize freely to conquer higher floors of the Tower and Endless Abyss.
        </div>
      </Panel>

      {/* Classes Grid */}
      <Panel title={<h3><Shield size={18} /> Hero Classes ({filtered.length})</h3>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: "12px" }}>
          {filtered.map((c) => (
            <div key={c.id} style={{ background: "#141414", border: "1px solid #262626", borderRadius: "6px", padding: "12px 14px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "1.8rem" }}>{c.icon}</span>
                    <div>
                      <div style={{ fontWeight: 600, color: "#fff", fontSize: "0.95rem" }}>{c.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "#888", textTransform: "capitalize" }}>
                        {c.archetype} · Weapon: {c.weapon}
                      </div>
                    </div>
                  </div>
                  <RarityChip rarity={c.rarity} />
                </div>

                <div style={{ margin: "10px 0 8px", background: "#181818", padding: "8px 10px", borderRadius: "4px", border: "1px solid #242424" }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#ffd700" }}>Passive: {c.passive.name}</div>
                  <div style={{ fontSize: "0.74rem", color: "#bbb", marginTop: "2px" }}>{c.passive.desc}</div>
                </div>
              </div>

              <div style={{ borderTop: "1px solid #222", paddingTop: "6px", display: "flex", justifyContent: "space-between", fontSize: "0.74rem", color: "#777" }}>
                <span>HP: {c.base.hp}</span>
                <span>ATK: {c.base.atk}</span>
                <span>DEF: {c.base.def}</span>
                <span>SPD: {c.base.spd}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
