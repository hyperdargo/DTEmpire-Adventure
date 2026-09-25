import { randomBytes } from "node:crypto";
import { CLASS_BY_ID } from "../../shared/data/classes.ts";
import { GEAR_BY_ID } from "../../shared/data/items.ts";
import {
  ACHIEVEMENTS, AUCTION_FEE_PCT, AUCTION_HOURS, CHAT_MAX_LENGTH, type Counter, GUILD_CREATE_COST, GUILD_CREATE_LEVEL,
  GUILD_MAX_MEMBERS, GUILD_TASK_POOL, TRADE_EXPIRY_HOURS, guildXpToNext,
} from "../../shared/data/meta.ts";
import type { ItemRecord } from "../../shared/rules/items.ts";
import { createRng } from "../../shared/rules/rng.ts";
import { toItemView, toPetView } from "../../shared/rules/views.ts";
import { json } from "../db/db.ts";
import { GameError, conflict, forbidden, notFound, tooFast } from "../lib/errors.ts";
import { HOUR, dayKey } from "../lib/time.ts";
import { throttle } from "../lib/throttle.ts";
import type { GameCtx } from "./context.ts";
import { getOwnedItem } from "./inventory.ts";
import { type Player, addStack, bump, findPlayer, heroStats, itemFromRow, loadPlayer, playerTitle, savePlayer, sendMail, spendCoins } from "./player.ts";

/** Strips control and invisible formatting characters (incl. bidi overrides), keeping newlines and the emoji joiner. */
const cleanText = (s: string, max: number) =>
  s.replace(/[\p{Cc}\p{Cf}]/gu, (c) => (c === "\n" || c === "\u200d" ? c : "")).replace(/\n{3,}/g, "\n\n").trim().slice(0, max);

const nameOf = (g: GameCtx, userId: number) => g.db.get<{ name: string }>("SELECT name FROM players WHERE user_id = ?", userId)?.name ?? "Unknown";

// ═════════════════════════════════ Chat ═════════════════════════════════


export function isBlocked(g: GameCtx, a: number, b: number) {
  return !!g.db.get("SELECT 1 FROM blocks WHERE (user_id = ? AND blocked_id = ?) OR (user_id = ? AND blocked_id = ?)", a, b, b, a);
}

export const dmChannel = (a: number, b: number) => `dm:${Math.min(a, b)}:${Math.max(a, b)}`;

function assertChannelAccess(g: GameCtx, p: Player, channel: string): { kind: "world" | "guild" | "dm"; members?: number[] } {
  if (channel === "world") return { kind: "world" };
  if (channel.startsWith("guild:")) {
    const id = Number(channel.slice(6));
    if (!p.guildId || p.guildId !== id) throw forbidden("You aren't in that guild.");
    return { kind: "guild", members: g.db.all<{ user_id: number }>("SELECT user_id FROM guild_members WHERE guild_id = ?", id).map((r) => r.user_id) };
  }
  const m = /^dm:(\d+):(\d+)$/.exec(channel);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (p.userId !== a && p.userId !== b) throw forbidden();
    return { kind: "dm", members: [a, b] };
  }
  throw notFound("Channel");
}

export function chatHistory(g: GameCtx, p: Player, channel: string, beforeId?: number) {
  assertChannelAccess(g, p, channel);
  const rows = g.db.all<{ id: number; user_id: number; body: string; created_at: number; name: string; class_id: string; level: number; title: string | null }>(
    `SELECT c.id, c.user_id, c.body, c.created_at, pl.name, pl.class_id, pl.level, pl.title FROM chat_messages c
     JOIN players pl ON pl.user_id = c.user_id WHERE c.channel = ? AND c.id < ? ORDER BY c.id DESC LIMIT 60`,
    channel, beforeId ?? Number.MAX_SAFE_INTEGER);
  const blocked = new Set(g.db.all<{ blocked_id: number }>("SELECT blocked_id FROM blocks WHERE user_id = ?", p.userId).map((r) => r.blocked_id));
  return rows.filter((r) => !blocked.has(r.user_id)).reverse().map(chatView);
}

const chatView = (r: { id: number; user_id: number; body: string; created_at: number; name: string; class_id: string; level: number }) => ({
  id: r.id, userId: r.user_id, name: r.name, classIcon: CLASS_BY_ID[r.class_id]?.icon ?? "⚔️", level: r.level, body: r.body, at: r.created_at,
});

export function sendChat(g: GameCtx, p: Player, channel: string, body: string) {
  const now = g.clock.now();
  const text = cleanText(body, CHAT_MAX_LENGTH);
  if (!text) throw new GameError("Say something first.");
  const access = assertChannelAccess(g, p, channel);
  if (access.kind === "dm") {
    const other = access.members!.find((id) => id !== p.userId) ?? p.userId;
    if (isBlocked(g, p.userId, other)) throw forbidden("You can't message this player.");
  }
  if (throttle(g, `chat:${p.userId}`, 1200)) throw tooFast("Slow down a little.");
  const id = g.db.run("INSERT INTO chat_messages (channel, user_id, body, created_at) VALUES (?, ?, ?, ?)", channel, p.userId, text, now).lastId;
  const msg = chatView({ id, user_id: p.userId, body: text, created_at: now, name: p.name, class_id: p.classId, level: p.level });
  const event = { type: "chat", channel, message: msg };
  if (access.kind === "world") g.hub.toChannel("world", event);
  else for (const uid of access.members!) g.hub.toUser(uid, event);
  return msg;
}

export function dmThreads(g: GameCtx, userId: number) {
  const rows = g.db.all<{ channel: string; last_id: number }>(
    "SELECT channel, MAX(id) AS last_id FROM chat_messages WHERE channel LIKE 'dm:%' AND (channel LIKE ? OR channel LIKE ?) GROUP BY channel ORDER BY last_id DESC LIMIT 30",
    `dm:${userId}:%`, `dm:%:${userId}`);
  return rows.map((r) => {
    const [, a, b] = r.channel.split(":");
    const other = Number(a) === userId ? Number(b) : Number(a);
    const last = g.db.get<{ body: string; created_at: number }>("SELECT body, created_at FROM chat_messages WHERE id = ?", r.last_id);
    return { channel: r.channel, userId: other, name: nameOf(g, other), online: g.hub.isOnline(other), last: last?.body ?? "", at: last?.created_at ?? 0 };
  });
}

export function setBlocked(g: GameCtx, userId: number, targetId: number, blocked: boolean) {
  if (userId === targetId) throw new GameError("You can't block yourself.");
  if (blocked) {
    g.db.run("INSERT OR IGNORE INTO blocks (user_id, blocked_id) VALUES (?, ?)", userId, targetId);
    g.db.run("DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)", userId, targetId, targetId, userId);
  } else {
    g.db.run("DELETE FROM blocks WHERE user_id = ? AND blocked_id = ?", userId, targetId);
  }
}

// ═════════════════════════════════ Friends ═════════════════════════════════

export function listFriends(g: GameCtx, userId: number) {
  const rows = g.db.all<{ user_id: number; friend_id: number; status: string; created_at: number }>(
    "SELECT * FROM friends WHERE user_id = ? OR friend_id = ?", userId, userId);
  return rows.map((r) => {
    const other = r.user_id === userId ? r.friend_id : r.user_id;
    const pl = g.db.get<{ name: string; level: number; class_id: string; last_seen_at: number }>("SELECT name, level, class_id, last_seen_at FROM players WHERE user_id = ?", other);
    return {
      userId: other, name: pl?.name ?? "Unknown", level: pl?.level ?? 1, classIcon: CLASS_BY_ID[pl?.class_id ?? ""]?.icon ?? "⚔️",
      status: r.status === "accepted" ? "friend" : r.user_id === userId ? "outgoing" : "incoming",
      online: g.hub.isOnline(other), lastSeenAt: pl?.last_seen_at ?? 0,
    };
  });
}

export function requestFriend(g: GameCtx, p: Player, targetId: number) {
  if (targetId === p.userId) throw new GameError("You can't befriend yourself, though we admire the confidence.");
  if (!findPlayer(g, targetId)) throw notFound("Player");
  if (isBlocked(g, p.userId, targetId)) throw forbidden("You can't add this player.");
  const existing = g.db.get<{ user_id: number; status: string }>("SELECT user_id, status FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)", p.userId, targetId, targetId, p.userId);
  if (existing?.status === "accepted") throw conflict("You're already friends.");
  if (existing && existing.user_id === targetId) return respondFriend(g, p, targetId, true);
  if (existing) throw conflict("Request already sent.");
  g.db.run("INSERT INTO friends (user_id, friend_id, status, created_at) VALUES (?, ?, 'pending', ?)", p.userId, targetId, g.clock.now());
  g.hub.toUser(targetId, { type: "friend_request", from: p.name, userId: p.userId });
  return "requested";
}

export function respondFriend(g: GameCtx, p: Player, fromId: number, accept: boolean) {
  const row = g.db.get("SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ? AND status = 'pending'", fromId, p.userId);
  if (!row) throw notFound("Friend request");
  if (accept) {
    g.db.run("UPDATE friends SET status = 'accepted' WHERE user_id = ? AND friend_id = ?", fromId, p.userId);
    g.hub.toUser(fromId, { type: "friend_accepted", by: p.name, userId: p.userId });
    return "accepted";
  }
  g.db.run("DELETE FROM friends WHERE user_id = ? AND friend_id = ?", fromId, p.userId);
  return "declined";
}

export function removeFriend(g: GameCtx, userId: number, otherId: number) {
  g.db.run("DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)", userId, otherId, otherId, userId);
}

// ═════════════════════════════════ Guilds ═════════════════════════════════

interface GuildRow { id: number; name: string; tag: string; emblem: string; description: string; leader_id: number; level: number; xp: number; open: number; state: string; created_at: number }
export interface GuildVaultRequest {
  id: string;
  userId: number;
  userName: string;
  userLevel: number;
  amount: number;
  reason: string;
  status: "pending" | "approved" | "denied";
  createdAt: number;
  resolvedAt?: number;
  resolvedBy?: string;
}

export interface GuildVaultLog {
  id: string;
  type: "donate" | "payout" | "request" | "denied";
  userId: number;
  userName: string;
  amount: number;
  timestamp: number;
  note?: string;
}

export interface GuildVaultState {
  balance: number;
  requests: GuildVaultRequest[];
  log: GuildVaultLog[];
}

type GuildState = {
  tasks?: { day: string; ids: string[]; baseline: Record<string, Partial<Record<Counter, number>>>; claimed: string[] };
  bank?: number;
  vault?: GuildVaultState;
};
type Role = "leader" | "officer" | "member";

function memberRole(g: GameCtx, userId: number, guildId: number): Role | null {
  return (g.db.get<{ role: Role }>("SELECT role FROM guild_members WHERE user_id = ? AND guild_id = ?", userId, guildId)?.role) ?? null;
}

export function createGuild(g: GameCtx, p: Player, input: { name: string; tag: string; emblem: string; description: string }) {
  if (p.guildId) throw new GameError("Leave your current guild first.");
  if (p.level < GUILD_CREATE_LEVEL) throw new GameError(`Founding a guild requires level ${GUILD_CREATE_LEVEL}.`);
  const name = cleanText(input.name, 24);
  const tag = input.tag.trim().toUpperCase();
  if (!/^[\p{L}\p{N} '’-]{3,24}$/u.test(name)) throw new GameError("Guild names are 3-24 letters, numbers, spaces or dashes.");
  if (!/^[A-Z0-9]{2,5}$/.test(tag)) throw new GameError("Tags are 2-5 letters or numbers.");
  if (g.db.get("SELECT 1 FROM guilds WHERE name = ? OR tag = ?", name, tag)) throw conflict("That guild name or tag is taken.");
  spendCoins(p, GUILD_CREATE_COST, "founding a guild");
  const now = g.clock.now();
  const id = g.db.run("INSERT INTO guilds (name, tag, emblem, description, leader_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    name, tag, [...input.emblem.trim()].slice(0, 2).join("") || "🛡️", cleanText(input.description, 280), p.userId, now).lastId;
  joinAs(g, p, id, "leader");
  return id;
}

function joinAs(g: GameCtx, p: Player, guildId: number, role: Role) {
  g.db.run("INSERT INTO guild_members (user_id, guild_id, role, joined_at) VALUES (?, ?, ?, ?)", p.userId, guildId, role, g.clock.now());
  g.db.run("DELETE FROM guild_requests WHERE user_id = ?", p.userId);
  p.guildId = guildId;
  const guild = g.db.get<GuildRow>("SELECT * FROM guilds WHERE id = ?", guildId)!;
  const state = json<GuildState>(guild.state, {});
  if (state.tasks?.day === dayKey(g.clock.now())) {
    state.tasks.baseline[p.userId] = { ...p.counters };
    g.db.run("UPDATE guilds SET state = ? WHERE id = ?", JSON.stringify(state), guildId);
  }
}

export function listGuilds(g: GameCtx, search = "") {
  const q = `%${search.trim().replace(/[%_]/g, "")}%`;
  return g.db.all<GuildRow & { members: number }>(
    `SELECT gd.*, (SELECT COUNT(*) FROM guild_members m WHERE m.guild_id = gd.id) AS members FROM guilds gd
     WHERE gd.name LIKE ? OR gd.tag LIKE ? ORDER BY gd.level DESC, gd.xp DESC LIMIT 50`, q, q)
    .map((r) => ({ id: r.id, name: r.name, tag: r.tag, emblem: r.emblem, description: r.description, level: r.level, members: r.members, maxMembers: GUILD_MAX_MEMBERS(r.level), open: !!r.open }));
}

export function guildDetail(g: GameCtx, viewer: Player, guildId: number) {
  const r = g.db.get<GuildRow>("SELECT * FROM guilds WHERE id = ?", guildId);
  if (!r) throw notFound("Guild");
  const members = g.db.all<{ user_id: number; role: Role; contribution: number; joined_at: number; name: string; level: number; class_id: string; power: number; last_seen_at: number }>(
    `SELECT m.user_id, m.role, m.contribution, m.joined_at, pl.name, pl.level, pl.class_id, pl.power, pl.last_seen_at FROM guild_members m
     JOIN players pl ON pl.user_id = m.user_id WHERE m.guild_id = ? ORDER BY CASE m.role WHEN 'leader' THEN 0 WHEN 'officer' THEN 1 ELSE 2 END, m.contribution DESC`, guildId);
  const myRole = memberRole(g, viewer.userId, guildId);
  const requests = myRole === "leader" || myRole === "officer"
    ? g.db.all<{ user_id: number; name: string; level: number }>("SELECT r.user_id, pl.name, pl.level FROM guild_requests r JOIN players pl ON pl.user_id = r.user_id WHERE r.guild_id = ?", guildId)
    : [];
  const state = json<GuildState>(r.state, {});
  const vault = myRole ? {
    balance: state.vault?.balance ?? 0,
    requests: (state.vault?.requests ?? []).slice(-20).reverse(),
    log: (state.vault?.log ?? []).slice(-30).reverse(),
  } : null;
  return {
    id: r.id, name: r.name, tag: r.tag, emblem: r.emblem, description: r.description, level: r.level, xp: r.xp, xpToNext: guildXpToNext(r.level),
    open: !!r.open, perkPct: Math.min(10, r.level), maxMembers: GUILD_MAX_MEMBERS(r.level), myRole,
    members: members.map((m) => ({ userId: m.user_id, name: m.name, role: m.role, level: m.level, classIcon: CLASS_BY_ID[m.class_id]?.icon ?? "⚔️", power: m.power, contribution: m.contribution, online: g.hub.isOnline(m.user_id), lastSeenAt: m.last_seen_at })),
    requests: requests.map((x) => ({ userId: x.user_id, name: x.name, level: x.level })),
    tasks: myRole ? guildTasks(g, guildId) : null,
    vault,
  };
}

export function joinGuild(g: GameCtx, p: Player, guildId: number) {
  if (p.guildId) throw new GameError("Leave your current guild first.");
  const r = g.db.get<GuildRow>("SELECT * FROM guilds WHERE id = ?", guildId);
  if (!r) throw notFound("Guild");
  const count = g.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM guild_members WHERE guild_id = ?", guildId)!.n;
  if (count >= GUILD_MAX_MEMBERS(r.level)) throw new GameError("That guild is full.");
  if (!r.open) {
    g.db.run("INSERT OR IGNORE INTO guild_requests (guild_id, user_id, created_at) VALUES (?, ?, ?)", guildId, p.userId, g.clock.now());
    for (const o of g.db.all<{ user_id: number }>("SELECT user_id FROM guild_members WHERE guild_id = ? AND role IN ('leader','officer')", guildId)) {
      g.hub.toUser(o.user_id, { type: "guild_request", from: p.name });
    }
    return "requested";
  }
  joinAs(g, p, guildId, "member");
  guildBroadcast(g, guildId, `${p.name} joined the guild.`);
  return "joined";
}

function guildBroadcast(g: GameCtx, guildId: number, text: string) {
  for (const m of g.db.all<{ user_id: number }>("SELECT user_id FROM guild_members WHERE guild_id = ?", guildId)) {
    g.hub.toUser(m.user_id, { type: "guild_event", text, at: g.clock.now() });
  }
}

export function reviewRequest(g: GameCtx, p: Player, userId: number, approve: boolean) {
  if (!p.guildId) throw forbidden();
  const role = memberRole(g, p.userId, p.guildId);
  if (role !== "leader" && role !== "officer") throw forbidden("Only leaders and officers can review requests.");
  if (!g.db.get("SELECT 1 FROM guild_requests WHERE guild_id = ? AND user_id = ?", p.guildId, userId)) throw notFound("Request");
  g.db.run("DELETE FROM guild_requests WHERE guild_id = ? AND user_id = ?", p.guildId, userId);
  if (!approve) return "denied";
  const applicant = loadPlayer(g, userId);
  if (applicant.guildId) return "already_in_guild";
  joinAs(g, applicant, p.guildId, "member");
  savePlayer(g, applicant);
  sendMail(g, userId, { sender: "Guild Hall", subject: "🛡️ Welcome to the guild", body: "Your request to join was approved." });
  return "approved";
}

export function leaveGuild(g: GameCtx, p: Player) {
  if (!p.guildId) throw new GameError("You aren't in a guild.");
  const guildId = p.guildId;
  const role = memberRole(g, p.userId, guildId);
  const others = g.db.all<{ user_id: number; role: Role }>("SELECT user_id, role FROM guild_members WHERE guild_id = ? AND user_id != ? ORDER BY CASE role WHEN 'officer' THEN 0 ELSE 1 END, contribution DESC", guildId, p.userId);
  if (role === "leader" && others.length) {
    const heir = others[0]!;
    g.db.run("UPDATE guild_members SET role = 'leader' WHERE user_id = ?", heir.user_id);
    g.db.run("UPDATE guilds SET leader_id = ? WHERE id = ?", heir.user_id, guildId);
  }
  g.db.run("DELETE FROM guild_members WHERE user_id = ?", p.userId);
  p.guildId = null;
  if (!others.length) {
    g.db.run("UPDATE players SET guild_id = NULL WHERE guild_id = ?", guildId);
    g.db.run("DELETE FROM guilds WHERE id = ?", guildId);
  } else guildBroadcast(g, guildId, `${p.name} left the guild.`);
}

export function manageMember(g: GameCtx, p: Player, targetId: number, action: "kick" | "promote" | "demote" | "transfer") {
  if (!p.guildId) throw forbidden();
  const myRole = memberRole(g, p.userId, p.guildId);
  const theirRole = memberRole(g, targetId, p.guildId);
  if (!theirRole) throw notFound("Member");
  if (targetId === p.userId) throw new GameError("Choose another member.");
  const rank = { leader: 0, officer: 1, member: 2 } as const;
  if (!myRole || rank[myRole] >= rank[theirRole]) throw forbidden("You don't outrank that member.");
  if (action === "kick") {
    g.db.run("DELETE FROM guild_members WHERE user_id = ?", targetId);
    g.db.run("UPDATE players SET guild_id = NULL WHERE user_id = ?", targetId);
    sendMail(g, targetId, { sender: "Guild Hall", subject: "You were removed from your guild", body: `${p.name} removed you from the guild.` });
  } else if (myRole !== "leader") {
    throw forbidden("Only the leader can change ranks.");
  } else if (action === "promote") {
    g.db.run("UPDATE guild_members SET role = 'officer' WHERE user_id = ?", targetId);
  } else if (action === "demote") {
    g.db.run("UPDATE guild_members SET role = 'member' WHERE user_id = ?", targetId);
  } else {
    g.db.run("UPDATE guild_members SET role = 'leader' WHERE user_id = ?", targetId);
    g.db.run("UPDATE guild_members SET role = 'officer' WHERE user_id = ?", p.userId);
    g.db.run("UPDATE guilds SET leader_id = ? WHERE id = ?", targetId, p.guildId);
  }
}

export function updateGuild(g: GameCtx, p: Player, input: { description?: string; open?: boolean; emblem?: string }) {
  if (!p.guildId || memberRole(g, p.userId, p.guildId) !== "leader") throw forbidden("Only the leader can edit the guild.");
  if (input.description != null) g.db.run("UPDATE guilds SET description = ? WHERE id = ?", cleanText(input.description, 280), p.guildId);
  if (input.open != null) g.db.run("UPDATE guilds SET open = ? WHERE id = ?", input.open ? 1 : 0, p.guildId);
  if (input.emblem) g.db.run("UPDATE guilds SET emblem = ? WHERE id = ?", [...input.emblem.trim()].slice(0, 2).join(""), p.guildId);
}

function addGuildXp(g: GameCtx, guildId: number, amount: number) {
  const r = g.db.get<GuildRow>("SELECT * FROM guilds WHERE id = ?", guildId)!;
  let level = r.level;
  let xp = r.xp + amount;
  while (xp >= guildXpToNext(level)) {
    xp -= guildXpToNext(level);
    level++;
    guildBroadcast(g, guildId, `The guild reached level ${level}! Members gain +${Math.min(10, level)}% XP.`);
  }
  g.db.run("UPDATE guilds SET level = ?, xp = ? WHERE id = ?", level, xp, guildId);
}

export function donateToGuild(g: GameCtx, p: Player, coins: number) {
  if (!p.guildId) throw new GameError("You aren't in a guild.");
  const amount = Math.floor(coins);
  if (amount < 100) throw new GameError("Donate at least 100 coins.");
  spendCoins(p, amount, "the donation");
  const xp = Math.floor(amount / 10);
  addGuildXp(g, p.guildId, xp);
  g.db.run("UPDATE guild_members SET contribution = contribution + ? WHERE user_id = ?", xp, p.userId);
  return { guildXp: xp };
}

export function donateToGuildVault(g: GameCtx, p: Player, coins: number) {
  if (!p.guildId) throw new GameError("You aren't in a guild.");
  const amount = Math.floor(coins);
  if (amount < 100) throw new GameError("Donate at least 100 coins to the vault.");
  spendCoins(p, amount, "guild vault donation");

  const r = g.db.get<GuildRow>("SELECT * FROM guilds WHERE id = ?", p.guildId)!;
  const state = json<GuildState>(r.state, {});
  state.vault = state.vault ?? { balance: 0, requests: [], log: [] };
  state.vault.balance += amount;
  state.vault.log = state.vault.log ?? [];
  state.vault.log.push({
    id: randomBytes(6).toString("hex"),
    type: "donate",
    userId: p.userId,
    userName: p.name,
    amount,
    timestamp: g.clock.now(),
    note: `Donated ${amount.toLocaleString()} coins`,
  });
  if (state.vault.log.length > 50) state.vault.log = state.vault.log.slice(-50);
  g.db.run("UPDATE guilds SET state = ? WHERE id = ?", JSON.stringify(state), p.guildId);

  const xp = Math.floor(amount / 10);
  g.db.run("UPDATE guild_members SET contribution = contribution + ? WHERE user_id = ?", xp, p.userId);
  guildBroadcast(g, p.guildId, `${p.name} donated ${amount.toLocaleString()} coins to the Guild Vault!`);
  return { balance: state.vault.balance, contribution: xp };
}

export function requestGuildVaultWithdrawal(g: GameCtx, p: Player, coins: number, reason: string) {
  if (!p.guildId) throw new GameError("You aren't in a guild.");
  const amount = Math.floor(coins);
  if (amount < 100) throw new GameError("Minimum withdrawal request is 100 coins.");

  const r = g.db.get<GuildRow>("SELECT * FROM guilds WHERE id = ?", p.guildId)!;
  const state = json<GuildState>(r.state, {});
  state.vault = state.vault ?? { balance: 0, requests: [], log: [] };

  if (amount > state.vault.balance) {
    throw new GameError(`The vault only holds ${state.vault.balance.toLocaleString()} coins.`);
  }

  state.vault.requests = state.vault.requests ?? [];
  if (state.vault.requests.some((rq) => rq.userId === p.userId && rq.status === "pending")) {
    throw new GameError("You already have an open withdrawal request waiting for review.");
  }

  const cleanReason = cleanText(reason, 120) || "Guild funds request";
  const reqId = randomBytes(6).toString("hex");
  const request: GuildVaultRequest = {
    id: reqId,
    userId: p.userId,
    userName: p.name,
    userLevel: p.level,
    amount,
    reason: cleanReason,
    status: "pending",
    createdAt: g.clock.now(),
  };

  state.vault.requests.push(request);
  if (state.vault.requests.length > 50) state.vault.requests = state.vault.requests.slice(-50);

  state.vault.log = state.vault.log ?? [];
  state.vault.log.push({
    id: randomBytes(6).toString("hex"),
    type: "request",
    userId: p.userId,
    userName: p.name,
    amount,
    timestamp: g.clock.now(),
    note: `Requested ${amount.toLocaleString()} coins: "${cleanReason}"`,
  });
  if (state.vault.log.length > 50) state.vault.log = state.vault.log.slice(-50);
  g.db.run("UPDATE guilds SET state = ? WHERE id = ?", JSON.stringify(state), p.guildId);

  for (const o of g.db.all<{ user_id: number }>("SELECT user_id FROM guild_members WHERE guild_id = ? AND role IN ('leader','officer')", p.guildId)) {
    g.hub.toUser(o.user_id, { type: "guild_event", text: `${p.name} requested ${amount.toLocaleString()} coins from the Guild Vault.`, at: g.clock.now() });
  }

  return { requestId: reqId };
}

export function reviewGuildVaultRequest(g: GameCtx, p: Player, requestId: string, approve: boolean) {
  if (!p.guildId) throw forbidden();
  const role = memberRole(g, p.userId, p.guildId);
  if (role !== "leader" && role !== "officer") throw forbidden("Only leaders and officers can review vault requests.");

  const r = g.db.get<GuildRow>("SELECT * FROM guilds WHERE id = ?", p.guildId)!;
  const state = json<GuildState>(r.state, {});
  state.vault = state.vault ?? { balance: 0, requests: [], log: [] };
  state.vault.requests = state.vault.requests ?? [];

  const req = state.vault.requests.find((x) => x.id === requestId);
  if (!req || req.status !== "pending") throw notFound("Pending vault request");

  const now = g.clock.now();
  if (approve) {
    if (state.vault.balance < req.amount) {
      throw new GameError(`Not enough coins in the vault (has ${state.vault.balance.toLocaleString()} coins).`);
    }
    state.vault.balance -= req.amount;
    req.status = "approved";
    req.resolvedAt = now;
    req.resolvedBy = p.name;

    g.db.run("UPDATE players SET coins = coins + ? WHERE user_id = ?", req.amount, req.userId);
    sendMail(g, req.userId, {
      sender: "Guild Vault",
      subject: "💰 Vault Request Approved",
      body: `Your request for ${req.amount.toLocaleString()} coins was approved by ${p.name}. The coins have been transferred into your purse.`,
    });

    state.vault.log = state.vault.log ?? [];
    state.vault.log.push({
      id: randomBytes(6).toString("hex"),
      type: "payout",
      userId: req.userId,
      userName: req.userName,
      amount: req.amount,
      timestamp: now,
      note: `Approved by ${p.name} (${req.reason})`,
    });
    guildBroadcast(g, p.guildId, `${p.name} approved ${req.userName}'s withdrawal of ${req.amount.toLocaleString()} coins from the Guild Vault.`);
  } else {
    req.status = "denied";
    req.resolvedAt = now;
    req.resolvedBy = p.name;

    sendMail(g, req.userId, {
      sender: "Guild Vault",
      subject: "❌ Vault Request Denied",
      body: `Your request for ${req.amount.toLocaleString()} coins was denied by ${p.name}.`,
    });

    state.vault.log = state.vault.log ?? [];
    state.vault.log.push({
      id: randomBytes(6).toString("hex"),
      type: "denied",
      userId: req.userId,
      userName: req.userName,
      amount: req.amount,
      timestamp: now,
      note: `Denied by ${p.name}`,
    });
  }

  if (state.vault.log.length > 50) state.vault.log = state.vault.log.slice(-50);
  g.db.run("UPDATE guilds SET state = ? WHERE id = ?", JSON.stringify(state), p.guildId);
  return { status: req.status };
}

function ensureGuildTasks(g: GameCtx, guildId: number) {
  const r = g.db.get<GuildRow>("SELECT * FROM guilds WHERE id = ?", guildId)!;
  const state = json<GuildState>(r.state, {});
  const day = dayKey(g.clock.now());
  if (state.tasks?.day !== day) {
    const rng = createRng(`guildtasks:${guildId}:${day}`);
    const pool = [...GUILD_TASK_POOL];
    const ids: string[] = [];
    while (ids.length < 3 && pool.length) ids.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]!.id);
    const baseline: Record<string, Partial<Record<Counter, number>>> = {};
    for (const m of g.db.all<{ user_id: number; counters: string }>("SELECT m.user_id, pl.counters FROM guild_members m JOIN players pl ON pl.user_id = m.user_id WHERE m.guild_id = ?", guildId)) {
      baseline[m.user_id] = json(m.counters, {});
    }
    state.tasks = { day, ids, baseline, claimed: [] };
    g.db.run("UPDATE guilds SET state = ? WHERE id = ?", JSON.stringify(state), guildId);
  }
  return state.tasks!;
}

export function guildTasks(g: GameCtx, guildId: number) {
  const t = ensureGuildTasks(g, guildId);
  const members = g.db.all<{ user_id: number; counters: string }>("SELECT m.user_id, pl.counters FROM guild_members m JOIN players pl ON pl.user_id = m.user_id WHERE m.guild_id = ?", guildId);
  return t.ids.map((id) => {
    const def = GUILD_TASK_POOL.find((x) => x.id === id)!;
    let progress = 0;
    for (const m of members) {
      const now = json<Partial<Record<Counter, number>>>(m.counters, {});
      const base = t.baseline[m.user_id] ?? now;
      progress += Math.max(0, (now[def.counter] ?? 0) - (base[def.counter] ?? 0));
    }
    return { ...def, progress: Math.min(def.goal, progress), claimed: t.claimed.includes(id) };
  });
}

export function claimGuildTask(g: GameCtx, p: Player, taskId: string) {
  if (!p.guildId) throw forbidden();
  const role = memberRole(g, p.userId, p.guildId);
  if (role !== "leader" && role !== "officer") throw forbidden("Leaders and officers claim guild tasks.");
  const task = guildTasks(g, p.guildId).find((t) => t.id === taskId);
  if (!task) throw notFound("Guild task");
  if (task.claimed) throw new GameError("Already claimed.");
  if (task.progress < task.goal) throw new GameError("That task isn't complete yet.");
  const r = g.db.get<GuildRow>("SELECT * FROM guilds WHERE id = ?", p.guildId)!;
  const state = json<GuildState>(r.state, {});
  state.tasks!.claimed.push(taskId);
  g.db.run("UPDATE guilds SET state = ? WHERE id = ?", JSON.stringify(state), p.guildId);
  addGuildXp(g, p.guildId, task.guildXp);
  for (const m of g.db.all<{ user_id: number }>("SELECT user_id FROM guild_members WHERE guild_id = ?", p.guildId)) {
    sendMail(g, m.user_id, { sender: "Guild Hall", subject: `${task.icon} Guild task complete: ${task.name}`, body: "The whole guild shares the reward.", attachments: { coins: task.coins }, expiresInDays: 14 });
  }
}

// ═════════════════════════════════ Trades ═════════════════════════════════

interface TradeRow { id: number; from_id: number; to_id: number; offer_coins: number; request_coins: number; offer_items: string; request_items: string; message: string; status: string; created_at: number; expires_at: number }

function assertTradable(item: ItemRecord) {
  if (item.equipped) throw new GameError("Unequip items before trading them.");
  if (item.locked) throw new GameError("Unlock items before trading them.");
}

export function createTrade(g: GameCtx, p: Player, input: { toId: number; offerItemIds: number[]; offerCoins: number; requestItemIds: number[]; requestCoins: number; message: string }) {
  if (p.level < 5) throw new GameError("Trading unlocks at level 5.");
  if (input.toId === p.userId) throw new GameError("You can't trade with yourself.");
  const target = findPlayer(g, input.toId);
  if (!target) throw notFound("Player");
  if (isBlocked(g, p.userId, input.toId)) throw forbidden("You can't trade with this player.");
  const offerItems = [...new Set(input.offerItemIds)].slice(0, 12);
  const requestItems = [...new Set(input.requestItemIds)].slice(0, 12);
  const offerCoins = Math.max(0, Math.floor(input.offerCoins));
  const requestCoins = Math.max(0, Math.floor(input.requestCoins));
  if (!offerItems.length && !offerCoins && !requestItems.length && !requestCoins) throw new GameError("Add something to the trade.");
  const open = g.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM trades WHERE from_id = ? AND status = 'pending'", p.userId)!.n;
  if (open >= 10) throw new GameError("You have too many open trade offers.");
  for (const id of offerItems) assertTradable(getOwnedItem(g, p.userId, id));
  for (const id of requestItems) getOwnedItem(g, input.toId, id);
  spendCoins(p, offerCoins, "the trade offer");
  const now = g.clock.now();
  const id = g.db.run(
    "INSERT INTO trades (from_id, to_id, offer_coins, request_coins, offer_items, request_items, message, status, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)",
    p.userId, input.toId, offerCoins, requestCoins, JSON.stringify(offerItems), JSON.stringify(requestItems), cleanText(input.message, 200), now, now + TRADE_EXPIRY_HOURS * HOUR,
  ).lastId;
  for (const itemId of offerItems) g.db.run("UPDATE items SET escrow = ? WHERE id = ?", `trade:${id}`, itemId);
  g.hub.toUser(input.toId, { type: "trade_offer", from: p.name, tradeId: id });
  return id;
}

/**
 * Releases escrowed items back to the sender. Escrowed coins are refunded by mail, never by a direct
 * UPDATE: the sender may be the player loaded in this very request, whose save would overwrite it.
 */
function returnTradeEscrow(g: GameCtx, t: TradeRow, reason: string) {
  g.db.run("UPDATE items SET escrow = NULL WHERE escrow = ?", `trade:${t.id}`);
  if (t.offer_coins) {
    sendMail(g, t.from_id, { sender: "Trade Post", subject: "🤝 Trade coins returned", body: `Your offer to ${nameOf(g, t.to_id)} was ${reason}. Your coins are attached.`, attachments: { coins: t.offer_coins } });
  }
}

export function expireTrades(g: GameCtx) {
  for (const t of g.db.all<TradeRow>("SELECT * FROM trades WHERE status = 'pending' AND expires_at < ?", g.clock.now())) {
    returnTradeEscrow(g, t, "not answered in time");
    g.db.run("UPDATE trades SET status = 'expired', resolved_at = ? WHERE id = ?", g.clock.now(), t.id);
  }
}

export function respondTrade(g: GameCtx, p: Player, tradeId: number, action: "accept" | "decline" | "cancel") {
  expireTrades(g);
  const t = g.db.get<TradeRow>("SELECT * FROM trades WHERE id = ?", tradeId);
  if (!t || t.status !== "pending") throw notFound("Open trade");
  const now = g.clock.now();
  if (action === "cancel") {
    if (t.from_id !== p.userId) throw forbidden();
    g.db.run("UPDATE items SET escrow = NULL WHERE escrow = ?", `trade:${t.id}`);
    p.coins += t.offer_coins;
    g.db.run("UPDATE trades SET status = 'cancelled', resolved_at = ? WHERE id = ?", now, t.id);
    return "cancelled";
  }
  if (t.to_id !== p.userId) throw forbidden();
  if (action === "decline") {
    returnTradeEscrow(g, t, "declined");
    g.db.run("UPDATE trades SET status = 'declined', resolved_at = ? WHERE id = ?", now, t.id);
    g.hub.toUser(t.from_id, { type: "trade_update", tradeId: t.id, status: "declined" });
    return "declined";
  }
  const requestItems = JSON.parse(t.request_items) as number[];
  for (const id of requestItems) assertTradable(getOwnedItem(g, p.userId, id));
  spendCoins(p, t.request_coins, "this trade");
  // Receiver gets escrowed items + coins; sender gets requested items + coins.
  for (const id of JSON.parse(t.offer_items) as number[]) moveItem(g, id, p.userId);
  for (const id of requestItems) moveItem(g, id, t.from_id);
  p.coins += t.offer_coins;
  g.db.run("UPDATE players SET coins = coins + ? WHERE user_id = ?", t.request_coins, t.from_id);
  g.db.run("UPDATE trades SET status = 'accepted', resolved_at = ? WHERE id = ?", now, t.id);
  bump(g, p, "tradesCompleted");
  g.db.run("UPDATE players SET counters = json_set(counters, '$.tradesCompleted', COALESCE(json_extract(counters, '$.tradesCompleted'), 0) + 1) WHERE user_id = ?", t.from_id);
  g.hub.toUser(t.from_id, { type: "trade_update", tradeId: t.id, status: "accepted" });
  return "accepted";
}

/** Moves an item to a new owner, merging stackables into the owner's existing stack. */
function moveItem(g: GameCtx, itemId: number, newOwner: number) {
  const row = g.db.get<{ id: number; template_id: string; qty: number; base: string }>("SELECT id, template_id, qty, base FROM items WHERE id = ?", itemId);
  if (!row) return;
  if (row.base === "{}") {
    g.db.run("DELETE FROM items WHERE id = ?", row.id);
    addStack(g, newOwner, row.template_id, row.qty);
  } else {
    g.db.run("UPDATE items SET owner_id = ?, escrow = NULL, equipped = 0, locked = 0 WHERE id = ?", newOwner, row.id);
  }
}

export function listTrades(g: GameCtx, userId: number) {
  expireTrades(g);
  const rows = g.db.all<TradeRow>("SELECT * FROM trades WHERE (from_id = ? OR to_id = ?) ORDER BY created_at DESC LIMIT 50", userId, userId);
  const itemsFor = (ids: number[]) => ids.map((id) => {
    const r = g.db.get("SELECT * FROM items WHERE id = ?", id);
    return r ? toItemView(itemFromRow(r as never)) : null;
  }).filter(Boolean);
  return rows.map((t) => ({
    id: t.id, direction: t.from_id === userId ? "outgoing" : "incoming", fromName: nameOf(g, t.from_id), toName: nameOf(g, t.to_id),
    fromId: t.from_id, toId: t.to_id, offerCoins: t.offer_coins, requestCoins: t.request_coins,
    offerItems: itemsFor(JSON.parse(t.offer_items)), requestItems: itemsFor(JSON.parse(t.request_items)),
    message: t.message, status: t.status, createdAt: t.created_at, expiresAt: t.expires_at,
  }));
}

// ═════════════════════════════════ Auction house ═════════════════════════════════

export function listAuction(g: GameCtx, p: Player, input: { itemId: number; qty: number; price: number; hours: number }) {
  if (p.level < 15) throw new GameError("The auction house opens at level 15.", { code: "level_locked" });
  if (!(AUCTION_HOURS as readonly number[]).includes(input.hours)) throw new GameError("Choose a listing duration.");
  const price = Math.floor(input.price);
  if (price < 10 || price > 1_000_000_000) throw new GameError("Set a price between 10 and 1,000,000,000 coins.");
  const item = getOwnedItem(g, p.userId, input.itemId);
  assertTradable(item);
  const mine = g.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM auctions WHERE seller_id = ? AND status = 'active'", p.userId)!.n;
  if (mine >= 20) throw new GameError("You can list up to 20 items at once.");
  const deposit = Math.max(5, Math.round(price * 0.01));
  spendCoins(p, deposit, "the listing deposit");
  const now = g.clock.now();
  let itemId = item.id;
  const qty = Math.max(1, Math.min(item.qty, Math.floor(input.qty)));
  if (item.base && Object.keys(item.base).length === 0 && qty < item.qty) {
    g.db.run("UPDATE items SET qty = qty - ? WHERE id = ?", qty, item.id);
    itemId = g.db.run("INSERT INTO items (owner_id, template_id, rarity, ilvl, qty, escrow, created_at) VALUES (NULL, ?, ?, ?, ?, 'auction', ?)",
      item.templateId, item.rarity, item.ilvl, qty, now).lastId;
  }
  const id = g.db.run("INSERT INTO auctions (seller_id, item_id, qty, price, status, created_at, expires_at) VALUES (?, ?, ?, ?, 'active', ?, ?)",
    p.userId, itemId, qty, price, now, now + input.hours * HOUR).lastId;
  g.db.run("UPDATE items SET escrow = ? WHERE id = ?", `auction:${id}`, itemId);
  return id;
}

export function expireAuctions(g: GameCtx) {
  for (const a of g.db.all<{ id: number; seller_id: number; item_id: number }>("SELECT id, seller_id, item_id FROM auctions WHERE status = 'active' AND expires_at < ?", g.clock.now())) {
    g.db.run("UPDATE auctions SET status = 'expired' WHERE id = ?", a.id);
    const mailId = sendMail(g, a.seller_id, { sender: "Auction House", subject: "📦 Your listing expired", body: "Nobody bought your item. It's attached so you can claim it back." });
    g.db.run("UPDATE items SET owner_id = NULL, escrow = ? WHERE id = ?", `mail:${mailId}`, a.item_id);
    g.db.run("UPDATE mail SET attachments = ? WHERE id = ?", JSON.stringify({ itemIds: [a.item_id] }), mailId);
  }
}

export function browseAuctions(g: GameCtx, userId: number, filter: { kind?: string; rarity?: string; q?: string; sort?: "new" | "cheap" | "pricey"; mine?: boolean }) {
  expireAuctions(g);
  const rows = g.db.all<{ id: number; seller_id: number; item_id: number; qty: number; price: number; created_at: number; expires_at: number; seller: string }>(
    `SELECT a.*, pl.name AS seller FROM auctions a JOIN players pl ON pl.user_id = a.seller_id WHERE a.status = 'active' ${filter.mine ? "AND a.seller_id = ?" : "AND ? = ?"}
     ORDER BY ${filter.sort === "cheap" ? "a.price ASC" : filter.sort === "pricey" ? "a.price DESC" : "a.created_at DESC"} LIMIT 300`,
    ...(filter.mine ? [userId] : [1, 1]));
  const q = filter.q?.trim().toLowerCase() ?? "";
  return rows
    .map((a) => {
      const r = g.db.get("SELECT * FROM items WHERE id = ?", a.item_id);
      if (!r) return null;
      const view = toItemView({ ...itemFromRow(r as never), qty: a.qty });
      return { id: a.id, sellerId: a.seller_id, seller: a.seller, price: a.price, qty: a.qty, expiresAt: a.expires_at, createdAt: a.created_at, item: view, mine: a.seller_id === userId };
    })
    .filter((a): a is NonNullable<typeof a> => !!a)
    .filter((a) => (!filter.kind || a.item.kind === filter.kind) && (!filter.rarity || a.item.rarity === filter.rarity) && (!q || a.item.name.toLowerCase().includes(q)))
    .slice(0, 100);
}

export function buyAuction(g: GameCtx, p: Player, auctionId: number) {
  expireAuctions(g);
  const a = g.db.get<{ id: number; seller_id: number; item_id: number; qty: number; price: number; status: string }>("SELECT * FROM auctions WHERE id = ?", auctionId);
  if (!a || a.status !== "active") throw notFound("Listing");
  if (a.seller_id === p.userId) throw new GameError("That's your own listing.");
  spendCoins(p, a.price, "this listing");
  const fee = Math.round((a.price * AUCTION_FEE_PCT) / 100);
  g.db.run("UPDATE auctions SET status = 'sold', buyer_id = ?, sold_at = ? WHERE id = ?", p.userId, g.clock.now(), a.id);
  moveItem(g, a.item_id, p.userId);
  const item = g.db.get("SELECT * FROM items WHERE owner_id = ? ORDER BY id DESC LIMIT 1", p.userId);
  sendMail(g, a.seller_id, {
    sender: "Auction House", subject: "💰 Your item sold",
    body: `${p.name} bought your listing for ${a.price.toLocaleString("en-US")} coins. After the ${AUCTION_FEE_PCT}% fee, your earnings are attached.`,
    attachments: { coins: a.price - fee },
  });
  g.db.run("UPDATE players SET counters = json_set(counters, '$.auctionsSold', COALESCE(json_extract(counters, '$.auctionsSold'), 0) + 1) WHERE user_id = ?", a.seller_id);
  void item;
  return { price: a.price };
}

export function cancelAuction(g: GameCtx, p: Player, auctionId: number) {
  const a = g.db.get<{ id: number; seller_id: number; item_id: number; status: string }>("SELECT * FROM auctions WHERE id = ?", auctionId);
  if (!a || a.status !== "active") throw notFound("Listing");
  if (a.seller_id !== p.userId) throw forbidden();
  g.db.run("UPDATE auctions SET status = 'cancelled' WHERE id = ?", a.id);
  moveItem(g, a.item_id, p.userId);
}

// ═════════════════════════════════ Leaderboards & profiles ═════════════════════════════════

export type Board = "level" | "power" | "tower" | "dungeon" | "arena" | "wealth";
const BOARD_SQL: Record<Board, { order: string; value: string }> = {
  level: { order: "level DESC, total_xp DESC", value: "level" },
  power: { order: "power DESC", value: "power" },
  tower: { order: "tower_floor DESC, level DESC", value: "tower_floor" },
  dungeon: { order: "dungeon_best DESC, level DESC", value: "dungeon_best" },
  arena: { order: "arena_rating DESC", value: "arena_rating" },
  wealth: { order: "coins DESC", value: "coins" },
};

export function leaderboard(g: GameCtx, board: Board, userId: number) {
  const b = BOARD_SQL[board];
  const rows = g.db.all<{ user_id: number; name: string; level: number; class_id: string; value: number; guild_id: number | null; tag: string | null }>(
    `SELECT pl.user_id, pl.name, pl.level, pl.class_id, pl.${b.value} AS value, pl.guild_id, gd.tag FROM players pl
     LEFT JOIN guilds gd ON gd.id = pl.guild_id ORDER BY ${b.order.split(", ").map((s) => `pl.${s}`).join(", ")} LIMIT 100`);
  const me = g.db.get<{ value: number }>(`SELECT ${b.value} AS value FROM players WHERE user_id = ?`, userId);
  const myRank = me ? (g.db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM players WHERE ${b.value} > ?`, me.value)?.n ?? 0) + 1 : null;
  return {
    board,
    rows: rows.map((r, i) => ({ rank: i + 1, userId: r.user_id, name: r.name, level: r.level, classIcon: CLASS_BY_ID[r.class_id]?.icon ?? "⚔️", className: CLASS_BY_ID[r.class_id]?.name ?? "", value: r.value, guildId: r.guild_id, guildTag: r.tag, online: g.hub.isOnline(r.user_id) })),
    me: me ? { rank: myRank, value: me.value } : null,
  };
}

export function publicProfile(g: GameCtx, viewerId: number, name: string) {
  const row = g.db.get<{ user_id: number }>("SELECT user_id FROM players WHERE name = ? COLLATE NOCASE", name);
  if (!row) throw notFound("Player");
  const p = loadPlayer(g, row.user_id);
  const stats = heroStats(g, p);
  const cls = CLASS_BY_ID[p.classId]!;
  const equipped = g.db.all("SELECT * FROM items WHERE owner_id = ? AND equipped = 1", p.userId).map((r) => toItemView(itemFromRow(r as never)));
  const petRow = g.db.get<{ id: number; species_id: string; rarity: string; level: number; xp: number; name: string | null }>("SELECT * FROM pets WHERE owner_id = ? AND active = 1", p.userId);
  const guild = p.guildId ? g.db.get<{ id: number; name: string; tag: string; emblem: string }>("SELECT id, name, tag, emblem FROM guilds WHERE id = ?", p.guildId) : null;
  const friendship = g.db.get<{ user_id: number; status: string }>("SELECT user_id, status FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)", viewerId, p.userId, p.userId, viewerId);
  return {
    userId: p.userId, name: p.name, title: playerTitle(p), bio: p.bio, avatar: p.avatar, level: p.level,
    class: { id: cls.id, name: cls.name, icon: cls.icon, rarity: p.classRarity, passive: cls.passive },
    dual: p.state.dual ? { ...p.state.dual, name: CLASS_BY_ID[p.state.dual.classId]?.name, icon: CLASS_BY_ID[p.state.dual.classId]?.icon } : null,
    stats, power: stats.power, towerFloor: p.towerFloor, dungeonBest: p.dungeonBest, arenaRating: p.arenaRating,
    counters: p.counters, achievements: (p.state.achievements ?? []).length, achievementsTotal: ACHIEVEMENTS.length,
    equipped, pet: petRow ? toPetView({ id: petRow.id, speciesId: petRow.species_id, rarity: petRow.rarity as never, level: petRow.level, xp: petRow.xp, active: true, name: petRow.name }) : null,
    guild, online: g.hub.isOnline(p.userId), lastSeenAt: p.lastSeenAt, createdAt: p.createdAt,
    relation: viewerId === p.userId ? "self" : friendship?.status === "accepted" ? "friend" : friendship ? (friendship.user_id === viewerId ? "outgoing" : "incoming") : "none",
    blocked: isBlocked(g, viewerId, p.userId),
  };
}

export function searchPlayers(g: GameCtx, q: string) {
  const term = `${q.trim().replace(/[%_]/g, "")}%`;
  if (term.length < 2) return [];
  return g.db.all<{ user_id: number; name: string; level: number; class_id: string }>("SELECT user_id, name, level, class_id FROM players WHERE name LIKE ? ORDER BY level DESC LIMIT 12", term)
    .map((r) => ({ userId: r.user_id, name: r.name, level: r.level, classIcon: CLASS_BY_ID[r.class_id]?.icon ?? "⚔️", online: g.hub.isOnline(r.user_id) }));
}

export { GEAR_BY_ID };
