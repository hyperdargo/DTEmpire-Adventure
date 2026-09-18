import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { requireUser } from "../app.ts";
import {
  SESSION_COOKIE, SESSION_DAYS, changePassword, createGuest, createSession, deleteAccount, destroySession, discordAuthorizeUrl,
  discordIdentify, login, loginWithDiscord, register, requestPasswordReset, resetPassword, upgradeGuest, userFromSession,
} from "../auth.ts";
import { newToken } from "../lib/crypto.ts";
import { GameError } from "../lib/errors.ts";
import { verifyPassword } from "../lib/crypto.ts";

const credentials = z.object({ username: z.string().trim().min(1).max(40), password: z.string().min(1).max(200) });
const signup = z.object({ username: z.string().trim(), password: z.string().max(200), email: z.string().trim().max(200).optional().or(z.literal("")) });

const AUTH_LIMIT = { config: { rateLimit: { max: 20, timeWindow: "10 minutes" } } };

export async function registerAuthRoutes(app: FastifyInstance) {
  const g = app.game;

  const startSession = (req: FastifyRequest, reply: FastifyReply, userId: number) => {
    const token = createSession(g, userId, req.headers["user-agent"]);
    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true, sameSite: "lax", secure: g.config.secureCookies, path: "/", maxAge: SESSION_DAYS * 86_400,
    });
    return userFromSession(g, token);
  };

  app.get("/api/auth/providers", async () => ({ discord: !!g.config.discord, email: !!g.config.smtp }));

  app.post("/api/auth/register", AUTH_LIMIT, async (req, reply) => {
    const body = signup.parse(req.body);
    const id = await register(g, { username: body.username, password: body.password, email: body.email || undefined });
    return { user: startSession(req, reply, id) };
  });

  app.post("/api/auth/login", AUTH_LIMIT, async (req, reply) => {
    const body = credentials.parse(req.body);
    const user = await login(g, body, req.ip);
    return { user: startSession(req, reply, user.id) };
  });

  app.post("/api/auth/guest", { config: { rateLimit: { max: 5, timeWindow: "1 hour" } } }, async (req, reply) => {
    if (req.user) throw new GameError("You're already signed in.");
    const guest = createGuest(g);
    return { user: startSession(req, reply, guest.id) };
  });

  app.post("/api/auth/upgrade", AUTH_LIMIT, async (req) => {
    const user = requireUser(req);
    const body = signup.parse(req.body);
    await upgradeGuest(g, user.id, { username: body.username, password: body.password, email: body.email || undefined });
    return { ok: true };
  });

  app.post("/api/auth/logout", async (req, reply) => {
    destroySession(g, req.cookies[SESSION_COOKIE]);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.post("/api/auth/password", AUTH_LIMIT, async (req) => {
    const user = requireUser(req);
    const body = z.object({ current: z.string().max(200).optional(), next: z.string().max(200) }).parse(req.body);
    await changePassword(g, user.id, body.current, body.next);
    return { ok: true };
  });

  app.post("/api/auth/reset/request", { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } }, async (req) => {
    const body = z.object({ email: z.string().trim().email().max(200) }).parse(req.body);
    await requestPasswordReset(g, body.email);
    return { ok: true };
  });

  app.post("/api/auth/reset/confirm", AUTH_LIMIT, async (req) => {
    const body = z.object({ email: z.string().trim().email().max(200), code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"), password: z.string().max(200) }).parse(req.body);
    await resetPassword(g, body.email, body.code, body.password);
    return { ok: true };
  });

  app.post("/api/auth/delete", AUTH_LIMIT, async (req, reply) => {
    const user = requireUser(req);
    const body = z.object({ password: z.string().max(200).optional(), confirm: z.literal("DELETE") }).parse(req.body);
    if (user.hasPassword) {
      const row = g.db.get<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = ?", user.id);
      if (!(await verifyPassword(body.password ?? "", row?.password_hash))) throw new GameError("Your password is wrong.", { status: 401 });
    }
    deleteAccount(g, user.id);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  // ── Discord ──
  app.get("/api/auth/discord/start", async (req, reply) => {
    const state = newToken();
    reply.setCookie("dte_oauth", state, { httpOnly: true, sameSite: "lax", secure: g.config.secureCookies, path: "/api/auth/discord", maxAge: 600, signed: true });
    return reply.redirect(discordAuthorizeUrl(g, state));
  });

  app.get("/api/auth/discord/callback", async (req, reply) => {
    const q = z.object({ code: z.string().max(200).optional(), state: z.string().max(200).optional(), error: z.string().max(200).optional() }).parse(req.query);
    const cookie = req.cookies.dte_oauth ? req.unsignCookie(req.cookies.dte_oauth) : null;
    reply.clearCookie("dte_oauth", { path: "/api/auth/discord" });
    if (q.error || !q.code || !q.state || !cookie?.valid || cookie.value !== q.state) {
      return reply.redirect("/login?error=discord");
    }
    try {
      const identity = await discordIdentify(g, q.code);
      const { userId } = loginWithDiscord(g, identity, req.user?.id ?? null);
      if (!req.user) startSession(req, reply, userId);
      return reply.redirect(req.user ? "/settings?linked=discord" : "/");
    } catch (err) {
      req.log.warn({ err }, "discord login failed");
      const code = err instanceof GameError && err.status === 409 ? "discord_taken" : "discord";
      return reply.redirect(`/login?error=${code}`);
    }
  });
}
