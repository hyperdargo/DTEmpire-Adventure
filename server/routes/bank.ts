import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { requireUser } from "../app.ts";
import { loadPlayer } from "../game/player.ts";
import * as bank from "../game/bank.ts";
import { mutate } from "./game.ts";

const parse = <T extends z.ZodTypeAny>(schema: T, req: FastifyRequest): z.infer<T> => schema.parse(req.body ?? {});

export async function registerBankRoutes(app: FastifyInstance) {
  const g = app.game;
  const u = requireUser;

  app.get("/api/bank", async (req) => {
    const user = u(req);
    const p = loadPlayer(g, user.id);
    return bank.getBankView(g, p);
  });

  app.post("/api/bank/deposit", async (req) => {
    const { amount } = parse(z.object({ amount: z.coerce.number().int().positive() }), req);
    return mutate(g, u(req), (p) => bank.depositSavings(g, p, amount));
  });

  app.post("/api/bank/withdraw", async (req) => {
    const { amount } = parse(z.object({ amount: z.coerce.number().int().positive() }), req);
    return mutate(g, u(req), (p) => bank.withdrawSavings(g, p, amount));
  });

  app.post("/api/bank/fd/create", async (req) => {
    const schema = z.object({
      amount: z.coerce.number().int().positive(),
      durationHours: z.coerce.number().int().positive(),
    });
    const { amount, durationHours } = parse(schema, req);
    return mutate(g, u(req), (p) => bank.createFixedDeposit(g, p, amount, durationHours));
  });

  app.post("/api/bank/fd/claim", async (req) => {
    const { fdId } = parse(z.object({ fdId: z.string().min(1) }), req);
    return mutate(g, u(req), (p) => bank.claimFixedDeposit(g, p, fdId));
  });

  app.post("/api/bank/loan/take", async (req) => {
    const { amount } = parse(z.object({ amount: z.coerce.number().int().positive() }), req);
    return mutate(g, u(req), (p) => bank.takeLoan(g, p, amount));
  });

  app.post("/api/bank/loan/repay", async (req) => {
    const { amount } = parse(z.object({ amount: z.coerce.number().int().positive() }), req);
    return mutate(g, u(req), (p) => bank.repayLoan(g, p, amount));
  });
}
