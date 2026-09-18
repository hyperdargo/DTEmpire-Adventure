import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import type { Notice } from "../lib/api.ts";
import { play } from "../lib/sound.ts";

export type ToastTone = "info" | "good" | "warn" | "bad";
export interface Toast { id: number; tone: ToastTone; title: string; body?: string; art?: string }
export type Celebration =
  | { id: number; kind: "levelUp"; level: number }
  | { id: number; kind: "achievement"; name: string; icon: string; coins: number; title?: string };

interface NotifyApi {
  toasts: Toast[];
  celebrations: Celebration[];
  toast(t: Omit<Toast, "id">): void;
  dismiss(id: number): void;
  notices(list: Notice[]): void;
  dismissCelebration(id: number): void;
}

const Ctx = createContext<NotifyApi | null>(null);

export function NotifyProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [celebrations, setCelebrations] = useState<Celebration[]>([]);
  const seq = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = seq.current++;
    setToasts((list) => [...list.slice(-4), { ...t, id }]);
    const ttl = t.tone === "bad" ? 6500 : 4200;
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), ttl);
  }, []);

  const notices = useCallback((list: Notice[]) => {
    const levels = list.filter((n) => n.kind === "levelUp");
    if (levels.length) {
      const top = levels[levels.length - 1] as Extract<Notice, { kind: "levelUp" }>;
      setCelebrations((c) => [...c, { id: seq.current++, kind: "levelUp", level: top.level }]);
      play("level");
    }
    for (const n of list) {
      switch (n.kind) {
        case "achievement":
          setCelebrations((c) => [...c, { id: seq.current++, kind: "achievement", name: n.name, icon: n.icon, coins: n.coins, title: n.title }]);
          break;
        case "mastery":
          toast({ tone: "good", title: `${n.rank} rank`, body: `Mastery against ${n.monster}. +${n.coins.toLocaleString()} coins`, art: "🏅" });
          break;
        case "egg":
          toast({ tone: "good", title: "Milestone egg", body: `A ${n.name} was added to your bag.`, art: "🥚" });
          break;
        case "toast":
          toast({ tone: n.tone, title: n.text, art: n.icon });
          break;
      }
    }
  }, [toast]);

  const dismissCelebration = useCallback((id: number) => setCelebrations((c) => c.filter((x) => x.id !== id)), []);

  const value = useMemo(() => ({ toasts, celebrations, toast, dismiss, notices, dismissCelebration }), [toasts, celebrations, toast, dismiss, notices, dismissCelebration]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotify() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useNotify outside NotifyProvider");
  return ctx;
}
