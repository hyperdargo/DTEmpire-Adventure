# Design system — the card table

Recorded from the built interface (`client/src/styles`, `client/src/components`). The world is a dark felt
table under one lamp: everything you own or fight is a card, framed in a metal that encodes its rarity.
It exists to make a browser RPG feel like objects you handle, not rows in a database.

## Ground and light

The page is navy felt: a lamp pool at the top, a vignette at the edges, and an SVG-noise weave
(`body` background in `base.css`). Panels are translucent slabs on that felt, never white boxes. Dark is not
a style choice: people play this at night, on phones, one hand, lights off.

## Tokens (`styles/tokens.css`)

| Role | Token | Value |
| --- | --- | --- |
| Felt | `--felt-0 … --felt-4` | `#070a15` → `#212c4f` |
| Ink | `--ink`, `--ink-2`, `--ink-3` | `#efe6d2`, `#bdb4a0`, `#8f8877` (all ≥ 4.5:1 on felt) |
| Crest metal | `--gold`, `--gold-bright`, `--gold-deep` | `#d9a441`, `#f3c96d`, `#8f6419` |
| Fire / damage | `--ember`, `--blood` | `#ff7a3d`, `#e5484d` |
| Support | `--ward`, `--verdant` | `#5aa9ff`, `#4cc38a` |
| Hairlines | `--line`, `--line-strong`, `--line-soft` | gold at 16% / 42%, ivory at 8% |

Rarity metals are the only decorative colour the interface spends: pewter `#a3acb9`, verdigris `#46b98a`,
cobalt `#4d8ef0`, amethyst `#a66cf0`, gold `#f0b43c`, ember `#ff6b3d`, pearl `#f4e3b5`. A component reads the
current rarity through `--r`; the `.r-*` classes are doubled (`.r-rare.r-rare`) so they outrank per-component
defaults.

Spacing is a 4px scale (`--s-1 … --s-8`). Depth is three shadows, all with a downward offset and a real blur,
because the lamp is above: `--shadow-1/2/3`.

## Type

- **Display — Marcellus SC** (self-hosted): card names, headings, big numbers. Flared Roman capitals, the
  engraved plate on a card frame. Used at 1.1 line-height, balanced wrapping.
- **UI — Barlow Semi Condensed** (self-hosted, 500/600/700/800): everything else. Condensed enough for dense
  stat blocks, with tabular numerals on by default so numbers don't jitter as they animate.
- **Art — the platform emoji font** (`--font-art`), with Noto Color Emoji as a last resort. The original
  game's content is emoji; it is treated as card art (framed, drop-shadowed), never as an icon.
- **Icons — Lucide**, one stroke weight, for every piece of interface chrome.

## Components (`styles/components.css`)

- **`GameCard`** is the whole system: a metal frame (gradient lit from the top-left), an inset face, a name
  plate, an art window with a rarity-tinted radial glow, a type line, rules text, and stat gems that hang off
  the bottom corners. Rare and above carry a foil sheen that tracks the pointer. Sizes `sm|md|lg|xl` scale
  every inner dimension from `--w`, so one card works in a grid, a hand, or a hero slot.
- **`CardBack`** is the crest on a navy lattice — the face-down encounter, the unrevealed egg, the unknown floor.
- **`Flip`** turns a back into a face (700ms, ease-out) for class draws, hatching and loot.
- **Action cards** in battle are the same object in button form: art, name, rules text, keyboard hint, and a
  cooldown veil with the remaining turns.
- Bars (HP/XP/shield), chips, panels, sheets (native `<dialog>`), tabs, toasts and celebration overlays all
  take their colour from the tokens above. Browser surfaces are themed too: selection, caret, scrollbars and
  focus rings are gold.

## Layout

Desktop is a fixed 236px rail (grouped navigation with level locks and live badges), a sticky top bar
carrying the hero's portrait, health, XP and coins, and a 1320px content column. Below 1024px the rail
becomes a five-slot bottom tab bar plus a "More" sheet, the top bar compresses, and battle actions stick
above the tab bar within thumb reach. Everything respects `env(safe-area-inset-*)`.

## Motion

One authored moment: **the battle exchange**. A round plays back event by event — the attacker's card lunges,
the target recoils (harder on a critical), damage numbers rise and fade, the screen shakes on a crit, and an
ember wash warns when a boss winds up. Elsewhere motion is restrained: cards lift on hover, sheets rise,
counters roll to their new value, ready cards pulse. Easing is exponential ease-out (`--ease-out`,
`--ease-snap`); bars animate with `clip-path` rather than width so nothing triggers layout.

`prefers-reduced-motion` collapses durations to ~0, removes the lunge/shake/pulse, and plays battle rounds as
instant state changes with the same text log — no information is carried by motion alone.

## Accessibility

Semantic landmarks with a skip link; the battle log is an `aria-live` region so screen-reader players get the
same play-by-play the animation shows; cards used as buttons are real buttons with labels; keyboard shortcuts
(1 attack, 2–5 skills, G guard, P potion, F flee) are printed on the cards; dialogs are native and trap focus;
target sizes are ≥ 34px and touch targets ≥ 44px; contrast holds at AA for body text; sound is off by default.
