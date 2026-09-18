import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { SESSION_COOKIE, type SessionUser, userFromSession } from "./auth.ts";
import type { Config } from "./config.ts";
import { Db } from "./db/db.ts";
import type { GameCtx } from "./game/context.ts";
import { GameError } from "./lib/errors.ts";
import { type Clock, systemClock } from "./lib/time.ts";
import { WsHub } from "./realtime/hub.ts";
import { LiveDuels } from "./realtime/liveDuels.ts";
import { registerAuthRoutes } from "./routes/auth.ts";
import { registerGameRoutes } from "./routes/game.ts";
import { registerSocialRoutes } from "./routes/social.ts";
import { registerRealtime } from "./routes/realtime.ts";
// Battle finalizers register themselves on import.
import "./game/pve.ts";
import "./game/modes.ts";
import "./game/events.ts";

declare module "fastify" {
  interface FastifyRequest {
    user: SessionUser | null;
  }
  interface FastifyInstance {
    game: GameCtx;
    hub: WsHub;
    duels: LiveDuels;
  }
}

export interface AppOptions {
  config: Config;
  db?: Db;
  clock?: Clock;
  logger?: boolean;
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function buildApp(opts: AppOptions): Promise<FastifyInstance> {
  const { config } = opts;
  const app = Fastify({
    logger: (opts.logger ?? config.env !== "test")
      ? { level: config.env === "production" ? "info" : "warn", redact: ["req.headers.cookie", "req.headers.authorization"] }
      : false,
    trustProxy: config.trustProxy,
    bodyLimit: 256 * 1024,
  });

  const db = opts.db ?? new Db(config.dbPath);
  const hub = new WsHub();
  const game: GameCtx = { db, clock: opts.clock ?? systemClock, hub, config, log: app.log };
  app.decorate("game", game);
  app.decorate("hub", hub);
  app.decorate("duels", new LiveDuels(game));
  app.decorateRequest("user", null);

  await app.register(cookie, { secret: config.sessionSecret });
  await app.register(rateLimit, { global: true, max: 600, timeWindow: "1 minute", allowList: config.env === "test" ? () => true : undefined });
  await app.register(multipart, { limits: { fileSize: 1024 * 1024, files: 1, fields: 5 } });
  await app.register(websocket, { options: { maxPayload: 16 * 1024 } });

  app.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    req.user = userFromSession(game, req.cookies[SESSION_COOKIE]);
    if (req.url.startsWith("/api/") && MUTATING.has(req.method)) {
      // CSRF: a custom header can't be sent cross-site without a CORS preflight, which we never grant.
      if (req.headers["x-dte-request"] !== "1") {
        return reply.code(403).send({ error: { code: "csrf", message: "Request blocked." } });
      }
      const origin = req.headers.origin;
      if (origin && !sameOrigin(origin, req, config)) {
        return reply.code(403).send({ error: { code: "csrf", message: "Request blocked." } });
      }
    }
  });

  app.addHook("onSend", async (req, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    reply.header("Cross-Origin-Opener-Policy", "same-origin");
    if (config.secureCookies) reply.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    const type = String(reply.getHeader("content-type") ?? "");
    if (type.includes("text/html")) {
      reply.header("Content-Security-Policy", [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' data: https://fonts.gstatic.com",
        "img-src 'self' data: blob:",
        "connect-src 'self' ws: wss:",
        "worker-src 'self'",
        "manifest-src 'self'",
        "base-uri 'self'",
        "form-action 'self' https://discord.com",
        "frame-ancestors 'none'",
        "object-src 'none'",
      ].join("; "));
    }
    if (req.url.startsWith("/api/")) reply.header("Cache-Control", "no-store");
    return payload;
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof GameError) {
      return reply.code(err.status).send({ error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } });
    }
    if (err instanceof ZodError) {
      const issue = err.issues[0];
      const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
      return reply.code(400).send({ error: { code: "invalid_input", message: `${where}${issue?.message ?? "Invalid input"}` } });
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status < 500) {
      return reply.code(status).send({ error: { code: (err as { code?: string }).code ?? "bad_request", message: status === 429 ? "Too many requests. Slow down a little." : (err as Error).message } });
    }
    req.log.error({ err }, "unhandled error");
    return reply.code(500).send({ error: { code: "server_error", message: "Something went wrong on our side. Try again in a moment." } });
  });

  app.get("/health", async () => {
    db.get("SELECT 1");
    return { ok: true, uptime: Math.round(process.uptime()), online: hub.onlineCount() };
  });

  await registerAuthRoutes(app);
  await registerGameRoutes(app);
  await registerSocialRoutes(app);
  await registerRealtime(app);

  // Uploaded avatars: served inert.
  await mkdir(config.uploadDir, { recursive: true });
  await app.register(fastifyStatic, {
    root: config.uploadDir,
    prefix: "/uploads/",
    decorateReply: false,
    setHeaders: (res) => {
      res.header("Content-Security-Policy", "default-src 'none'; sandbox");
      res.header("Cache-Control", "public, max-age=604800, immutable");
    },
  });

  // Built client (production). In development Vite serves the client and proxies /api.
  const dist = resolve("dist");
  if (existsSync(join(dist, "index.html"))) {
    await app.register(fastifyStatic, {
      root: dist,
      prefix: "/",
      // Resolve files per request (not a startup snapshot) so a rebuilt client is served without a restart.
      wildcard: true,
      setHeaders: (res, path) => {
        if (path.includes(`${join("dist", "assets")}`)) res.header("Cache-Control", "public, max-age=31536000, immutable");
        else if (path.endsWith("sw.js") || path.endsWith(".html") || path.endsWith("manifest.webmanifest")) res.header("Cache-Control", "no-cache");
      },
    });
    app.setNotFoundHandler((req, reply) => {
      if (req.method === "GET" && !req.url.startsWith("/api/") && !req.url.startsWith("/uploads/") && req.headers.accept?.includes("text/html")) {
        return reply.header("Cache-Control", "no-cache").sendFile("index.html", dist);
      }
      return reply.code(404).send({ error: { code: "not_found", message: "Not found." } });
    });
  } else {
    app.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: { code: "not_found", message: "Not found." } }));
  }

  app.addHook("onClose", async () => {
    app.duels.shutdown();
    hub.closeAll();
    if (!opts.db) db.close();
  });

  return app;
}

function sameOrigin(origin: string, req: FastifyRequest, config: Config): boolean {
  try {
    const o = new URL(origin);
    if (o.origin === new URL(config.publicUrl).origin) return true;
    return o.host === req.headers.host;
  } catch {
    return false;
  }
}

export function requireUser(req: FastifyRequest): SessionUser {
  if (!req.user) throw new GameError("Please sign in.", { status: 401, code: "unauthenticated" });
  return req.user;
}
