import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { ClassDef } from "../../../shared/data/types.ts";
import { CardBack, Flip, GameCard } from "../components/GameCard.tsx";
import { Button } from "../components/ui.tsx";
import { api, errorMessage, type MeSnapshot } from "../lib/api.ts";
import { play } from "../lib/sound.ts";
import { meKey } from "../state/game.ts";
import { useNotify } from "../state/notify.tsx";

/** First run: the crest deals you a class card. */
export function Onboarding() {
  const qc = useQueryClient();
  const notify = useNotify();
  const [cls, setCls] = useState<ClassDef | null>(null);
  const [me, setMe] = useState<MeSnapshot | null>(null);
  const [busy, setBusy] = useState(false);

  const draw = async () => {
    setBusy(true);
    try {
      const r = await api.post<{ class: ClassDef; me: MeSnapshot }>("/api/hero");
      setMe(r.me);
      setTimeout(() => {
        setCls(r.class);
        play(["rare", "epic", "legendary"].includes(r.class.rarity) ? "rare" : "flip");
      }, 250);
    } catch (err) {
      notify.toast({ tone: "bad", title: errorMessage(err) });
      setBusy(false);
    }
  };

  return (
    <div className="onboard">
      <div className="onboard__copy">
        <h1>{cls ? `You are a ${cls.name}.` : "The crest will choose your class."}</h1>
        <p>
          {cls
            ? `${cls.rarity[0]!.toUpperCase()}${cls.rarity.slice(1)} class, wielder of the ${cls.weapon}. ${cls.passive.name}: ${cls.passive.desc}.`
            : "Every hero is dealt one of eighteen classes, from common Warriors to legendary Dragon Knights. Rarer classes start stronger, and any class can be ascended later at the Temple."}
        </p>
      </div>
      <Flip
        revealed={!!cls}
        back={<CardBack size="xl" label="Your face-down class card" onClick={busy ? undefined : () => void draw()} />}
      >
        {cls ? (
          <GameCard size="xl" rarity={cls.rarity} art={cls.icon} name={cls.name} type={<><b>{cls.rarity}</b> class · {cls.weapon}</>}
            text={`${cls.passive.name}: ${cls.passive.desc}.`} atk={cls.base.atk} hp={cls.base.hp} />
        ) : <CardBack size="xl" />}
      </Flip>
      {cls && me ? (
        <Button variant="primary" size="lg" onClick={() => qc.setQueryData(meKey, me)}>Take your seat at the table</Button>
      ) : (
        <Button variant="primary" size="lg" loading={busy} onClick={() => void draw()}>Draw your class</Button>
      )}
    </div>
  );
}
