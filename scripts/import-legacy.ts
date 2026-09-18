// Usage: node scripts/import-legacy.ts <path/to/players.json> [--db data/adventure.db] [--dry-run] [--coin-rate 0.5]
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Db } from "../server/db/db.ts";
import { importLegacyPlayers } from "../server/legacy.ts";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

if (!file) {
  console.error("Usage: node scripts/import-legacy.ts <players.json> [--db data/adventure.db] [--dry-run] [--coin-rate 1]");
  process.exit(1);
}

const dbPath = resolve(flag("db") ?? process.env.DATABASE_PATH ?? "data/adventure.db");
const data = JSON.parse(readFileSync(file, "utf8")) as Record<string, Record<string, unknown>>;
const db = new Db(dbPath);
const report = importLegacyPlayers(db, data, { dryRun: args.includes("--dry-run"), coinRate: flag("coin-rate") ? Number(flag("coin-rate")) : undefined });
db.close();

console.log(`${args.includes("--dry-run") ? "[dry run] " : ""}Imported ${report.imported} of ${report.players} players into ${dbPath}`);
console.log(`  items: ${report.items}, pets: ${report.pets}`);
if (report.renamed.length) console.log(`  renamed: ${report.renamed.map((r) => `${r.from} → ${r.to}`).join(", ")}`);
if (report.skipped.length) console.log(`  skipped: ${report.skipped.map((s) => `${s.key} (${s.reason})`).join(", ")}`);
