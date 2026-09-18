import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { requireUser } from "../app.ts";
import { GameError, notFound } from "../lib/errors.ts";
import { itemFromRow, loadPlayer } from "../game/player.ts";
import * as social from "../game/social.ts";
import { toItemView } from "../../shared/rules/views.ts";
import { mutate } from "./game.ts";

const id = z.coerce.number().int().positive();
const parse = <T extends z.ZodTypeAny>(schema: T, req: FastifyRequest): z.infer<T> => schema.parse(req.body ?? {});
const channelSchema = z.string().regex(/^(world|guild:\d+|dm:\d+:\d+)$/);

export async function registerSocialRoutes(app: FastifyInstance) {
  const g = app.game;
  const u = requireUser;

  // ── Chat ──
  app.get("/api/chat", async (req) => {
    const q = z.object({ channel: channelSchema, before: id.optional() }).parse(req.query);
    return { messages: social.chatHistory(g, loadPlayer(g, u(req).id), q.channel, q.before) };
  });
  app.post("/api/chat", { config: { rateLimit: { max: 40, timeWindow: "1 minute" } } }, async (req) => {
    const { channel, body } = parse(z.object({ channel: channelSchema, body: z.string().max(2000) }), req);
    const user = u(req);
    if (user.isGuest && channel === "world") throw new GameError("Save your account to chat in World.", { code: "guest_chat" });
    return { message: social.sendChat(g, loadPlayer(g, user.id), channel, body) };
  });
  app.get("/api/chat/threads", async (req) => ({ threads: social.dmThreads(g, u(req).id) }));
  app.post("/api/chat/dm", async (req) => {
    const { userId } = parse(z.object({ userId: id }), req);
    return { channel: social.dmChannel(u(req).id, userId) };
  });
  app.post("/api/block", async (req) => {
    const { userId, blocked } = parse(z.object({ userId: id, blocked: z.boolean() }), req);
    social.setBlocked(g, u(req).id, userId, blocked);
    return { ok: true };
  });

  // ── Friends ──
  app.get("/api/friends", async (req) => ({ friends: social.listFriends(g, u(req).id) }));
  app.post("/api/friends/request", async (req) => {
    const { userId } = parse(z.object({ userId: id }), req);
    return mutate(g, u(req), (p) => social.requestFriend(g, p, userId));
  });
  app.post("/api/friends/respond", async (req) => {
    const { userId, accept } = parse(z.object({ userId: id, accept: z.boolean() }), req);
    return mutate(g, u(req), (p) => social.respondFriend(g, p, userId, accept));
  });
  app.post("/api/friends/remove", async (req) => {
    const { userId } = parse(z.object({ userId: id }), req);
    social.removeFriend(g, u(req).id, userId);
    return { ok: true };
  });

  // ── Guilds ──
  app.get("/api/guilds", async (req) => {
    const q = z.object({ q: z.string().max(40).optional() }).parse(req.query);
    u(req);
    return { guilds: social.listGuilds(g, q.q) };
  });
  app.get("/api/guilds/:guildId", async (req) => {
    const { guildId } = z.object({ guildId: id }).parse(req.params);
    return g.db.tx(() => social.guildDetail(g, loadPlayer(g, u(req).id), guildId));
  });
  app.post("/api/guilds", async (req) => {
    const body = parse(z.object({ name: z.string().max(40), tag: z.string().max(8), emblem: z.string().max(16), description: z.string().max(400).default("") }), req);
    return mutate(g, u(req), (p) => social.createGuild(g, p, body));
  });
  app.post("/api/guilds/:guildId/join", async (req) => {
    const { guildId } = z.object({ guildId: id }).parse(req.params);
    return mutate(g, u(req), (p) => social.joinGuild(g, p, guildId));
  });
  app.post("/api/guild/leave", async (req) => mutate(g, u(req), (p) => social.leaveGuild(g, p)));
  app.post("/api/guild/member", async (req) => {
    const { userId, action } = parse(z.object({ userId: id, action: z.enum(["kick", "promote", "demote", "transfer"]) }), req);
    return mutate(g, u(req), (p) => social.manageMember(g, p, userId, action));
  });
  app.post("/api/guild/request", async (req) => {
    const { userId, approve } = parse(z.object({ userId: id, approve: z.boolean() }), req);
    return mutate(g, u(req), (p) => social.reviewRequest(g, p, userId, approve));
  });
  app.post("/api/guild/update", async (req) => {
    const body = parse(z.object({ description: z.string().max(400).optional(), open: z.boolean().optional(), emblem: z.string().max(16).optional() }), req);
    return mutate(g, u(req), (p) => social.updateGuild(g, p, body));
  });
  app.post("/api/guild/donate", async (req) => {
    const { coins } = parse(z.object({ coins: z.number().int().min(1).max(1_000_000_000) }), req);
    return mutate(g, u(req), (p) => social.donateToGuild(g, p, coins));
  });
  app.post("/api/guild/task", async (req) => {
    const { taskId } = parse(z.object({ taskId: z.string().max(40) }), req);
    return mutate(g, u(req), (p) => social.claimGuildTask(g, p, taskId));
  });

  // ── Trades ──
  app.get("/api/trades", async (req) => ({ trades: g.db.tx(() => social.listTrades(g, u(req).id)) }));
  app.post("/api/trades", { config: { rateLimit: { max: 30, timeWindow: "10 minutes" } } }, async (req) => {
    const body = parse(z.object({
      toId: id, offerItemIds: z.array(id).max(12).default([]), offerCoins: z.number().int().min(0).max(1_000_000_000).default(0),
      requestItemIds: z.array(id).max(12).default([]), requestCoins: z.number().int().min(0).max(1_000_000_000).default(0), message: z.string().max(400).default(""),
    }), req);
    const user = u(req);
    if (user.isGuest) throw new GameError("Save your account to trade.", { code: "guest_trade" });
    return mutate(g, user, (p) => social.createTrade(g, p, body));
  });
  app.post("/api/trades/:tradeId/:action", async (req) => {
    const { tradeId, action } = z.object({ tradeId: id, action: z.enum(["accept", "decline", "cancel"]) }).parse(req.params);
    return mutate(g, u(req), (p) => social.respondTrade(g, p, tradeId, action));
  });

  // ── Auctions ──
  app.get("/api/auctions", async (req) => {
    const q = z.object({
      kind: z.string().max(20).optional(), rarity: z.string().max(20).optional(), q: z.string().max(40).optional(),
      sort: z.enum(["new", "cheap", "pricey"]).optional(), mine: z.coerce.boolean().optional(),
    }).parse(req.query);
    const user = u(req);
    return { listings: g.db.tx(() => social.browseAuctions(g, user.id, q)) };
  });
  app.post("/api/auctions", async (req) => {
    const body = parse(z.object({ itemId: id, qty: z.number().int().min(1).max(9999).default(1), price: z.number().int().min(1), hours: z.number().int() }), req);
    const user = u(req);
    if (user.isGuest) throw new GameError("Save your account to use the auction house.", { code: "guest_trade" });
    return mutate(g, user, (p) => social.listAuction(g, p, body));
  });
  app.post("/api/auctions/:auctionId/buy", async (req) => {
    const { auctionId } = z.object({ auctionId: id }).parse(req.params);
    return mutate(g, u(req), (p) => social.buyAuction(g, p, auctionId));
  });
  app.post("/api/auctions/:auctionId/cancel", async (req) => {
    const { auctionId } = z.object({ auctionId: id }).parse(req.params);
    return mutate(g, u(req), (p) => social.cancelAuction(g, p, auctionId));
  });

  // ── Players ──
  app.get("/api/leaderboard/:board", async (req) => {
    const { board } = z.object({ board: z.enum(["level", "power", "tower", "dungeon", "arena", "wealth"]) }).parse(req.params);
    return social.leaderboard(g, board, u(req).id);
  });
  app.get("/api/players", async (req) => {
    const { q } = z.object({ q: z.string().max(30).default("") }).parse(req.query);
    u(req);
    return { players: social.searchPlayers(g, q) };
  });
  app.get("/api/players/:name", async (req) => {
    const { name } = z.object({ name: z.string().max(30) }).parse(req.params);
    return g.db.tx(() => social.publicProfile(g, u(req).id, name));
  });
  /** Items a player could be asked for in a trade: unequipped, unlocked, not in escrow. */
  app.get("/api/players/:userId/tradable", async (req) => {
    const { userId } = z.object({ userId: id }).parse(req.params);
    u(req);
    if (!g.db.get("SELECT 1 FROM players WHERE user_id = ?", userId)) throw notFound("Player");
    const items = g.db.all("SELECT * FROM items WHERE owner_id = ? AND equipped = 0 AND locked = 0 AND escrow IS NULL ORDER BY id DESC LIMIT 200", userId);
    return { items: items.map((r) => toItemView(itemFromRow(r as never))) };
  });
}
