import { useState } from "react";
import { GEM_BY_ID, type GemDef } from "../../../shared/data/gems.ts";
import { GEAR_BY_ID } from "../../../shared/data/items.ts";
import type { ItemRecord } from "../../../shared/rules/items.ts";
import { Button, Coins, Loading, Panel } from "../components/ui.tsx";
import { useAction, useData } from "../state/game.ts";

interface JewelerState { gems: (GemDef & { qty: number })[]; gear: ItemRecord[]; punches: number; unsocketCoins: number; punchCost: { coins: number; materials: Record<string, number> } }
export default function Jeweler() {
  const data = useData<JewelerState>(["gems"], "/api/gems");
  const [gemId, setGemId] = useState("gem_ruby_1");
  const invalidate = [["gems"], ["inventory"], ["smithy"]];
  const punch = useAction("/api/gems/punch", { invalidate, success: "Jeweler's Punch crafted." });
  const unlock = useAction<{ itemId: number }>("/api/gems/unlock", { invalidate, success: "Socket unlocked." });
  const socket = useAction<{ itemId: number; index: number; gemId: string }>("/api/gems/socket", { invalidate, success: "Gem socketed." });
  const remove = useAction<{ itemId: number; index: number }>("/api/gems/unsocket", { invalidate, success: "Gem returned to your bag." });
  const craft = useAction<{ gemId: string }>("/api/gems/craft", { invalidate, success: "Gems combined." });
  if (!data.data) return <Loading rows={3} />;
  const state = data.data;
  const busy = punch.isPending || unlock.isPending || socket.isPending || remove.isPending || craft.isPending;
  return <div className="stack">
    <Panel title="Jeweler · Gem Socketing">
      <p>Unlock up to two sockets per gear piece. Socketing is free; removing a gem returns it intact for <Coins value={state.unsocketCoins} />. Locked gear cannot be modified. Finish combat before changing sockets.</p>
      <p>Chipped gems drop from monsters. Every 10th tower floor awards two. The Transmute tab can shape mystic gems into any Chipped gem. Three matching gems combine into the next tier. Gem bonuses are flat and do not scale with gear upgrades.</p>
      <p>Punches owned: {state.punches}. Recipe: 10 Iron Ore + 1 Mystic Gem + <Coins value={state.punchCost.coins} />.</p>
      <Button loading={punch.isPending} disabled={busy} onClick={() => punch.mutate({})}>Craft Jeweler's Punch</Button>
      <label>Gem to insert <select value={gemId} onChange={(e) => setGemId(e.target.value)}>{state.gems.map((gem) => <option key={gem.id} value={gem.id}>{gem.name} (+{gem.value} {gem.stat}) · {gem.qty} owned</option>)}</select></label>
    </Panel>
    <Panel title="Your gear">
      {!state.gear.length && <p>No gear in your bag.</p>}
      {state.gear.map((item) => <div key={item.id} className="panel stack">
        <b>{GEAR_BY_ID[item.templateId]?.name} #{item.id}{item.equipped ? " · Equipped" : ""}{item.locked ? " · Locked" : ""}</b>
        {(item.sockets ?? []).map((gem, index) => <div className="row row--wrap" key={index}>
          <span>Socket {index + 1}: {gem ? GEM_BY_ID[gem]?.name : "Empty"}</span>
          {gem ? <Button disabled={busy || item.locked} onClick={() => remove.mutate({ itemId: item.id, index })}>Remove · {state.unsocketCoins} coins</Button>
            : <Button disabled={busy || item.locked || !(state.gems.find((g) => g.id === gemId)?.qty)} onClick={() => socket.mutate({ itemId: item.id, index, gemId })}>Insert selected gem</Button>}
        </div>)}
        {(item.sockets?.length ?? 0) < 2 && <Button disabled={busy || item.locked || !state.punches} onClick={() => unlock.mutate({ itemId: item.id })}>Unlock socket · 1 Punch</Button>}
      </div>)}
    </Panel>
    <Panel title="Combine gems">
      <div className="grid-cards">{state.gems.filter((gem) => gem.tier < 4).map((gem) => <div key={gem.id} className="panel stack"><b>{gem.name} · {gem.qty} owned</b><span>3 → 1 {GEM_BY_ID[`gem_${gem.family}_${gem.tier + 1}`]?.name}</span><Button disabled={busy || gem.qty < 3} onClick={() => craft.mutate({ gemId: gem.id })}>Combine · {gem.craftCoins} coins</Button></div>)}</div>
    </Panel>
  </div>;
}
