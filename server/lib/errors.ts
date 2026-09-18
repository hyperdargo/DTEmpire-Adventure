/** An expected, player-facing failure (not enough coins, on cooldown...). Safe to show verbatim. */
export class GameError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(message: string, opts: { status?: number; code?: string; details?: Record<string, unknown> } = {}) {
    super(message);
    this.status = opts.status ?? 400;
    this.code = opts.code ?? "bad_request";
    this.details = opts.details;
  }
}

export const notFound = (what: string) => new GameError(`${what} not found.`, { status: 404, code: "not_found" });
export const forbidden = (msg = "You can't do that.") => new GameError(msg, { status: 403, code: "forbidden" });
export const conflict = (msg: string) => new GameError(msg, { status: 409, code: "conflict" });
export const tooFast = (msg: string, retryAfterMs?: number) =>
  new GameError(msg, { status: 429, code: "rate_limited", details: retryAfterMs ? { retryAfterMs } : undefined });

export function assert(cond: unknown, message: string, opts?: ConstructorParameters<typeof GameError>[1]): asserts cond {
  if (!cond) throw new GameError(message, opts);
}
