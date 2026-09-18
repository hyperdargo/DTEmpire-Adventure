import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

export interface Config {
  env: "development" | "production" | "test";
  port: number;
  host: string;
  publicUrl: string;
  dbPath: string;
  uploadDir: string;
  secureCookies: boolean;
  trustProxy: boolean;
  discord: { clientId: string; clientSecret: string; redirectUri: string } | null;
  smtp: { host: string; port: number; user: string; pass: string; from: string } | null;
  sessionSecret: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const mode = (env.NODE_ENV === "production" ? "production" : env.NODE_ENV === "test" ? "test" : "development") as Config["env"];
  const port = Number(env.PORT ?? 8081);
  const publicUrl = (env.PUBLIC_URL ?? `http://localhost:${mode === "development" ? 5173 : port}`).replace(/\/$/, "");
  const discord =
    env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET
      ? { clientId: env.DISCORD_CLIENT_ID, clientSecret: env.DISCORD_CLIENT_SECRET, redirectUri: env.DISCORD_REDIRECT_URI ?? `${publicUrl}/api/auth/discord/callback` }
      : null;
  const smtp =
    env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD
      ? { host: env.SMTP_HOST, port: Number(env.SMTP_PORT ?? 587), user: env.SMTP_USER, pass: env.SMTP_PASSWORD, from: env.SMTP_FROM ?? env.SMTP_USER }
      : null;
  if (mode === "production" && !env.SESSION_SECRET) {
    console.warn("[config] SESSION_SECRET is not set; generating an ephemeral one. Set it so signed state survives restarts.");
  }
  return {
    env: mode,
    port,
    host: env.HOST ?? "0.0.0.0",
    publicUrl,
    dbPath: resolve(env.DATABASE_PATH ?? "data/adventure.db"),
    uploadDir: resolve(env.UPLOAD_DIR ?? "data/uploads"),
    secureCookies: env.SECURE_COOKIES ? env.SECURE_COOKIES === "true" : publicUrl.startsWith("https://"),
    trustProxy: env.TRUST_PROXY === "true",
    discord,
    smtp,
    sessionSecret: env.SESSION_SECRET ?? randomBytes(32).toString("hex"),
  };
}
