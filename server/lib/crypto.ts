import { createHash, pbkdf2, randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;

const PARAMS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEYLEN = 32;

/** Format: scrypt$N$r$p$saltB64$hashB64 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize("NFKC"), salt, KEYLEN, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

/** True when a stored hash came from the original Flask app and should be upgraded after a successful login. */
export const isLegacyHash = (stored: string | null | undefined) => !!stored && /^(scrypt|pbkdf2):/.test(stored);

/** Verifies Werkzeug hashes ("scrypt:n:r:p$salt$hex" or "pbkdf2:sha256:iters$salt$hex") imported from the original game. */
async function verifyWerkzeug(password: string, stored: string): Promise<boolean> {
  const [method, salt, hex] = stored.split("$") as [string, string, string];
  if (!method || salt === undefined || !hex) return false;
  const expected = Buffer.from(hex, "hex");
  const parts = method.split(":");
  let actual: Buffer;
  if (parts[0] === "scrypt") {
    const n = Number(parts[1] ?? 32768);
    const r = Number(parts[2] ?? 8);
    const p = Number(parts[3] ?? 1);
    actual = await scrypt(password, Buffer.from(salt, "utf8"), expected.length, { N: n, r, p, maxmem: 132 * n * r * p + 1024 * 1024 });
  } else if (parts[0] === "pbkdf2") {
    const digest = parts[1] ?? "sha256";
    const iterations = Number(parts[2] ?? 600000);
    actual = await promisify(pbkdf2)(password, salt, iterations, expected.length, digest);
  } else return false;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) {
    // Spend comparable time so missing accounts aren't distinguishable by timing.
    await scrypt(password, randomBytes(16), KEYLEN, PARAMS);
    return false;
  }
  if (isLegacyHash(stored)) return verifyWerkzeug(password, stored);
  const parts = stored.split("$");
  if (parts[0] !== "scrypt" || parts.length !== 6) return false;
  const [, n, r, p, saltB64, hashB64] = parts as [string, string, string, string, string, string];
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password.normalize("NFKC"), Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: PARAMS.maxmem,
  });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const newToken = () => randomBytes(32).toString("base64url");
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const sixDigitCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
export const randomId = (bytes = 9) => randomBytes(bytes).toString("base64url");
