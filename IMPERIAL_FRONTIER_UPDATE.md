# Imperial Frontier — level 400 expansion

- Actual shared realm cap raised from 200 (not 300) to 400. Existing XP/growth rules continue without resetting earned levels or XP.
- Eight append-only adventure regions cover 200–400, each with three shaped enemies and a ten-kill boss gate. Existing region IDs, gates, twenty Tower chapters and relic rewards are unchanged.
- Equipment rolls and affixes now use the shared cap rather than silently clamping item level to 100. Five frontier tiers provide all five weapon affinities and four armor/accessory slots (45 templates), with defense/vitality/initiative/offense tradeoffs. Existing item rows are not rewritten.
- Imperial Excavation opens at level 30: ten sequential sector charters, coin-funded contracts, eight finite supplies, explicit Survey/Brace/Extract/Return choices, increasing hull hazards, early retreat and collapse salvage. Research and XP are banked on return; a collapse saves only 25% research, no XP or charter.
- Drill, Hull and Survey each have ten permanent ranks with quadratic coin costs plus earned research. Research is bound state, never sold and never paid as coins.
- Seven one-time research commissions include three mythic items and four advanced class licenses: Bastion Marshal, Imperial Runesmith, Horizon Warden and Veil Reaver. Role adoption is reversible, saves the original class/tier and preserves HP percentage. Existing class IDs and unique ownership claims remain intact.
- New page, sidebar/mobile menu route, table shortcut, Guide entry and this signed update log. New UI is monochrome. Navigation uses icon-192.png.
- All mutations use the existing transactional result/me/notices wrapper and client useAction (CSRF). Work requests are single actions, strict schemas reject extra batch/count fields. Existing active battles and Dungeon runs block excavation mutations.

## Review / deploy

No deployment, commit, push, production database writes, migration or player reset was performed. Tests run against in-memory SQLite. Tests intentionally remain git-ignored per project policy.

After reviewing the entire dirty working tree (including pre-existing talent and quest changes), parent should rebuild and recreate Docker, verify `/health`, then verify `/excavation`, level-400 adventure routes and mobile layout in a signed-in browser. Retain the parent's pre-expansion SQLite online backup.

- By Hermes
