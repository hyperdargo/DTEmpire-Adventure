const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("en-US");

export const fmt = (n: number) => full.format(Math.round(n));
export const fmtCompact = (n: number) => (Math.abs(n) < 10_000 ? full.format(Math.round(n)) : compact.format(n));

export function duration(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s >= 172_800) return `${Math.floor(s / 86_400)}d ${Math.floor((s % 86_400) / 3600)}h`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

export function timeAgo(at: number, now = Date.now()): string {
  const s = Math.round((now - at) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86_400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86_400)}d ago`;
}

export const titleCase = (s: string) => s.replace(/(^|[\s_-])(\w)/g, (_, sep: string, c: string) => `${sep === "_" ? " " : sep}${c.toUpperCase()}`);

export const pct = (a: number, b: number) => (b <= 0 ? 0 : Math.max(0, Math.min(100, (a / b) * 100)));

export const STAT_LABEL: Record<string, string> = {
  hp: "HP", atk: "Attack", def: "Defense", spd: "Speed", crit: "Crit chance", critDmg: "Crit damage",
  dodge: "Dodge", lifesteal: "Lifesteal", luck: "Luck", xpBonus: "XP bonus",
};
export const PERCENT_STATS = new Set(["crit", "critDmg", "dodge", "lifesteal", "luck", "xpBonus"]);
export const statValue = (key: string, v: number) => (PERCENT_STATS.has(key) ? `${v}%` : fmt(v));
