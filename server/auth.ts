import { GameError, conflict, notFound } from "./lib/errors.ts";
import { hashPassword, isLegacyHash, newToken, randomId, sha256, sixDigitCode, verifyPassword } from "./lib/crypto.ts";
import { DAY, MINUTE } from "./lib/time.ts";
import type { GameCtx } from "./game/context.ts";
import { sendMail } from "./game/player.ts";

export const SESSION_COOKIE = "dte_session";
export const SESSION_DAYS = 30;
export const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

export interface SessionUser {
  id: number;
  username: string;
  isGuest: boolean;
  email: string | null;
  emailVerified: boolean;
  discordLinked: boolean;
  hasPassword: boolean;
}

interface UserRow { id: number; username: string; password_hash: string | null; email: string | null; email_verified: number; discord_id: string | null; is_guest: number; banned: number }

const toSessionUser = (u: UserRow): SessionUser => ({
  id: u.id, username: u.username, isGuest: !!u.is_guest, email: u.email, emailVerified: !!u.email_verified,
  discordLinked: !!u.discord_id, hasPassword: !!u.password_hash,
});

export function validateUsername(username: string) {
  if (!USERNAME_RE.test(username)) throw new GameError("Usernames are 3-20 letters, numbers or underscores.", { code: "invalid_username" });
  if (/^guest_/i.test(username)) throw new GameError("That username is reserved.", { code: "invalid_username" });
}

export function validatePassword(password: string) {
  if (password.length < 8) throw new GameError("Passwords need at least 8 characters.", { code: "weak_password" });
  if (password.length > 200) throw new GameError("That password is too long.", { code: "weak_password" });
}

export function createSession(g: GameCtx, userId: number, userAgent: string | undefined): string {
  const token = newToken();
  const now = g.clock.now();
  g.db.run("INSERT INTO sessions (token_hash, user_id, created_at, expires_at, user_agent) VALUES (?, ?, ?, ?, ?)",
    sha256(token), userId, now, now + SESSION_DAYS * DAY, (userAgent ?? "").slice(0, 200));
  g.db.run("UPDATE users SET last_login_at = ? WHERE id = ?", now, userId);
  g.db.run("DELETE FROM sessions WHERE expires_at < ?", now);
  return token;
}

export function userFromSession(g: GameCtx, token: string | undefined): SessionUser | null {
  if (!token || token.length > 100) return null;
  const now = g.clock.now();
  const row = g.db.get<UserRow & { expires_at: number; token_hash: string }>(
    "SELECT u.*, s.expires_at, s.token_hash FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?", sha256(token));
  if (!row || row.expires_at < now || row.banned) return null;
  // Sliding expiry, refreshed at most daily.
  if (row.expires_at - now < (SESSION_DAYS - 1) * DAY) {
    g.db.run("UPDATE sessions SET expires_at = ? WHERE token_hash = ?", now + SESSION_DAYS * DAY, row.token_hash);
  }
  return toSessionUser(row);
}

export function destroySession(g: GameCtx, token: string | undefined) {
  if (token) g.db.run("DELETE FROM sessions WHERE token_hash = ?", sha256(token));
}

export async function register(g: GameCtx, input: { username: string; password: string; email?: string }) {
  validateUsername(input.username);
  validatePassword(input.password);
  const email = input.email?.trim().toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new GameError("Enter a valid email address.", { code: "invalid_email" });
  const hash = await hashPassword(input.password);
  return g.db.tx(() => {
    if (g.db.get("SELECT 1 FROM users WHERE username = ?", input.username)) throw conflict("That username is taken.");
    if (email && g.db.get("SELECT 1 FROM users WHERE email = ?", email)) throw conflict("That email is already in use.");
    return g.db.run("INSERT INTO users (username, password_hash, email, created_at) VALUES (?, ?, ?, ?)",
      input.username, hash, email, g.clock.now()).lastId;
  });
}

export function createGuest(g: GameCtx): { id: number; username: string } {
  return g.db.tx(() => {
    for (let i = 0; i < 10; i++) {
      const username = `Guest_${randomId(4).replace(/[^A-Za-z0-9]/g, "").slice(0, 6) || String(Date.now()).slice(-6)}`;
      if (g.db.get("SELECT 1 FROM users WHERE username = ?", username)) continue;
      const id = g.db.run("INSERT INTO users (username, is_guest, created_at) VALUES (?, 1, ?)", username, g.clock.now()).lastId;
      return { id, username };
    }
    throw new GameError("Couldn't create a guest right now. Try again.");
  });
}

/** Turns a guest into a full account, renaming the hero to the chosen username. */
export async function upgradeGuest(g: GameCtx, userId: number, input: { username: string; password: string; email?: string }) {
  validateUsername(input.username);
  validatePassword(input.password);
  const hash = await hashPassword(input.password);
  const email = input.email?.trim().toLowerCase() || null;
  g.db.tx(() => {
    const u = g.db.get<UserRow>("SELECT * FROM users WHERE id = ?", userId);
    if (!u?.is_guest) throw new GameError("This account is already saved.");
    if (g.db.get("SELECT 1 FROM users WHERE username = ? AND id != ?", input.username, userId)) throw conflict("That username is taken.");
    if (email && g.db.get("SELECT 1 FROM users WHERE email = ? AND id != ?", email, userId)) throw conflict("That email is already in use.");
    g.db.run("UPDATE users SET username = ?, password_hash = ?, email = ?, is_guest = 0 WHERE id = ?", input.username, hash, email, userId);
    g.db.run("UPDATE players SET name = ? WHERE user_id = ?", input.username, userId);
  });
}

const failedLogins = new Map<string, { count: number; until: number }>();

export async function login(g: GameCtx, input: { username: string; password: string }, ip: string) {
  const key = `${ip}|${input.username.toLowerCase()}`;
  const now = g.clock.now();
  const lock = failedLogins.get(key);
  if (lock && lock.until > now) {
    throw new GameError("Too many attempts. Wait a few minutes and try again.", { status: 429, code: "locked" });
  }
  const u = g.db.get<UserRow>("SELECT * FROM users WHERE username = ?", input.username.trim());
  const ok = await verifyPassword(input.password, u?.password_hash);
  if (!u || !ok) {
    const count = (lock?.count ?? 0) + 1;
    failedLogins.set(key, { count, until: count >= 8 ? now + 10 * MINUTE : 0 });
    throw new GameError("Wrong username or password.", { status: 401, code: "bad_credentials" });
  }
  failedLogins.delete(key);
  if (u.banned) throw new GameError("This account has been suspended.", { status: 403, code: "banned" });
  // Accounts imported from the original game carry Werkzeug hashes; upgrade them now that we know the password.
  if (isLegacyHash(u.password_hash)) g.db.run("UPDATE users SET password_hash = ? WHERE id = ?", await hashPassword(input.password), u.id);
  return toSessionUser(u);
}

export async function changePassword(g: GameCtx, userId: number, current: string | undefined, next: string) {
  validatePassword(next);
  const u = g.db.get<UserRow>("SELECT * FROM users WHERE id = ?", userId);
  if (!u) throw notFound("Account");
  if (u.password_hash && !(await verifyPassword(current ?? "", u.password_hash))) {
    throw new GameError("Your current password is wrong.", { status: 401, code: "bad_credentials" });
  }
  g.db.run("UPDATE users SET password_hash = ? WHERE id = ?", await hashPassword(next), userId);
}

// ── Email codes (only when SMTP is configured) ─────────────────────────

export async function sendEmail(g: GameCtx, to: string, subject: string, text: string) {
  if (!g.config.smtp) throw new GameError("Email isn't set up on this server.", { status: 501, code: "email_disabled" });
  const { createTransport } = await import("nodemailer");
  const t = createTransport({ host: g.config.smtp.host, port: g.config.smtp.port, secure: g.config.smtp.port === 465, auth: { user: g.config.smtp.user, pass: g.config.smtp.pass } });
  await t.sendMail({ from: g.config.smtp.from, to, subject, text });
}

export async function requestPasswordReset(g: GameCtx, email: string) {
  const u = g.db.get<UserRow>("SELECT * FROM users WHERE email = ?", email.trim().toLowerCase());
  // Always behave the same so the endpoint can't be used to probe which emails exist.
  if (!u) return;
  const code = sixDigitCode();
  g.db.run("DELETE FROM login_codes WHERE user_id = ? AND purpose = 'reset'", u.id);
  g.db.run("INSERT INTO login_codes (user_id, code_hash, purpose, expires_at) VALUES (?, ?, 'reset', ?)", u.id, sha256(code), g.clock.now() + 15 * MINUTE);
  await sendEmail(g, u.email!, "DTEmpire Adventure: your reset code", `Your password reset code is ${code}.\n\nIt expires in 15 minutes. If you didn't ask for this, you can ignore this email.`);
}

export async function resetPassword(g: GameCtx, email: string, code: string, password: string) {
  validatePassword(password);
  const u = g.db.get<UserRow>("SELECT * FROM users WHERE email = ?", email.trim().toLowerCase());
  const row = u ? g.db.get<{ id: number; code_hash: string; attempts: number; expires_at: number }>("SELECT * FROM login_codes WHERE user_id = ? AND purpose = 'reset'", u.id) : undefined;
  if (!u || !row || row.expires_at < g.clock.now() || row.attempts >= 5) throw new GameError("That code is invalid or expired.", { code: "bad_code" });
  if (row.code_hash !== sha256(code.trim())) {
    g.db.run("UPDATE login_codes SET attempts = attempts + 1 WHERE id = ?", row.id);
    throw new GameError("That code is invalid or expired.", { code: "bad_code" });
  }
  g.db.run("DELETE FROM login_codes WHERE id = ?", row.id);
  g.db.run("UPDATE users SET password_hash = ?, email_verified = 1 WHERE id = ?", await hashPassword(password), u.id);
  g.db.run("DELETE FROM sessions WHERE user_id = ?", u.id);
}

// ── Discord OAuth (only when configured) ───────────────────────────────

export function discordAuthorizeUrl(g: GameCtx, state: string) {
  const d = g.config.discord;
  if (!d) throw new GameError("Discord login isn't set up on this server.", { status: 501 });
  const params = new URLSearchParams({ client_id: d.clientId, redirect_uri: d.redirectUri, response_type: "code", scope: "identify", state, prompt: "consent" });
  return `https://discord.com/oauth2/authorize?${params}`;
}

export async function discordIdentify(g: GameCtx, code: string): Promise<{ id: string; username: string; globalName: string | null }> {
  const d = g.config.discord!;
  const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: d.clientId, client_secret: d.clientSecret, grant_type: "authorization_code", code, redirect_uri: d.redirectUri }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!tokenRes.ok) throw new GameError("Discord didn't accept that login. Try again.", { status: 502 });
  const token = (await tokenRes.json()) as { access_token: string };
  const meRes = await fetch("https://discord.com/api/v10/users/@me", { headers: { Authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(10_000) });
  if (!meRes.ok) throw new GameError("Couldn't read your Discord profile.", { status: 502 });
  const me = (await meRes.json()) as { id: string; username: string; global_name?: string | null };
  return { id: me.id, username: me.username, globalName: me.global_name ?? null };
}

/** Finds or creates the account for a Discord identity, or links it to the signed-in account. */
export function loginWithDiscord(g: GameCtx, identity: { id: string; username: string }, currentUserId: number | null): { userId: number; created: boolean } {
  return g.db.tx(() => {
    const linked = g.db.get<{ id: number }>("SELECT id FROM users WHERE discord_id = ?", identity.id);
    if (currentUserId) {
      if (linked && linked.id !== currentUserId) throw conflict("That Discord account is linked to another player.");
      g.db.run("UPDATE users SET discord_id = ? WHERE id = ?", identity.id, currentUserId);
      return { userId: currentUserId, created: false };
    }
    if (linked) return { userId: linked.id, created: false };
    let base = identity.username.replace(/[^A-Za-z0-9_]/g, "").slice(0, 16);
    if (base.length < 3) base = `hero${base}`;
    let username = base;
    for (let i = 2; g.db.get("SELECT 1 FROM users WHERE username = ?", username); i++) username = `${base.slice(0, 16)}${i}`;
    const id = g.db.run("INSERT INTO users (username, discord_id, created_at) VALUES (?, ?, ?)", username, identity.id, g.clock.now()).lastId;
    return { userId: id, created: true };
  });
}

export function deleteAccount(g: GameCtx, userId: number) {
  g.db.tx(() => {
    const guild = g.db.get<{ guild_id: number; role: string }>("SELECT guild_id, role FROM guild_members WHERE user_id = ?", userId);
    if (guild?.role === "leader") {
      const heir = g.db.get<{ user_id: number }>("SELECT user_id FROM guild_members WHERE guild_id = ? AND user_id != ? ORDER BY contribution DESC", guild.guild_id, userId);
      if (heir) {
        g.db.run("UPDATE guild_members SET role = 'leader' WHERE user_id = ?", heir.user_id);
        g.db.run("UPDATE guilds SET leader_id = ? WHERE id = ?", heir.user_id, guild.guild_id);
      } else {
        g.db.run("DELETE FROM guilds WHERE id = ?", guild.guild_id);
      }
    }
    // Release other players' escrow in open trades with this account before it disappears.
    for (const t of g.db.all<{ id: number; from_id: number; to_id: number; offer_coins: number }>(
      "SELECT id, from_id, to_id, offer_coins FROM trades WHERE status = 'pending' AND (from_id = ? OR to_id = ?)", userId, userId)) {
      g.db.run("UPDATE items SET escrow = NULL WHERE escrow = ?", `trade:${t.id}`);
      if (t.from_id !== userId && t.offer_coins) {
        sendMail(g, t.from_id, { sender: "Trade Post", subject: "🤝 Trade coins returned", body: "The player you offered a trade to has left the realm.", attachments: { coins: t.offer_coins } });
      }
      g.db.run("UPDATE trades SET status = 'cancelled' WHERE id = ?", t.id);
    }
    const listed = g.db.all<{ item_id: number }>("SELECT item_id FROM auctions WHERE seller_id = ?", userId);
    g.db.run("DELETE FROM auctions WHERE seller_id = ?", userId);
    for (const { item_id } of listed) g.db.run("DELETE FROM items WHERE id = ? AND escrow LIKE 'auction:%'", item_id);
    g.db.run("DELETE FROM users WHERE id = ?", userId);
  });
}
