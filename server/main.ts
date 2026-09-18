import { buildApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { expireAuctions, expireTrades } from "./game/social.ts";

const config = loadConfig();
const app = await buildApp({ config });

// Background sweeps: expired trades and auctions are returned to their owners by mail.
const sweep = setInterval(() => {
  try {
    app.game.db.tx(() => {
      expireTrades(app.game);
      expireAuctions(app.game);
    });
  } catch (err) {
    app.log.error({ err }, "sweep failed");
  }
}, 60_000);
sweep.unref();

const shutdown = async (signal: string) => {
  app.log.info(`${signal} received, shutting down`);
  clearInterval(sweep);
  await app.close();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ port: config.port, host: config.host });
console.log(`DTEmpire Adventure server listening on http://localhost:${config.port}`);
