import type { FastifyInstance } from "fastify";
import { z } from "zod";

const clientMessage = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ping") }),
]);

export async function registerRealtime(app: FastifyInstance) {
  const g = app.game;

  app.get("/ws", { websocket: true }, (socket, req) => {
    const user = req.user;
    if (!user) {
      socket.close(4401, "unauthenticated");
      return;
    }
    const firstConnection = !app.hub.isOnline(user.id);
    app.hub.add(user.id, socket);
    socket.send(JSON.stringify({ type: "hello", online: app.hub.onlineCount(), duel: app.duels.roomFor(user.id) }));
    if (firstConnection) g.db.run("UPDATE players SET last_seen_at = ? WHERE user_id = ?", g.clock.now(), user.id);

    let alive = true;
    const heartbeat = setInterval(() => {
      if (!alive) return socket.terminate();
      alive = false;
      socket.ping();
    }, 30_000);
    heartbeat.unref();
    socket.on("pong", () => (alive = true));

    socket.on("message", (raw: Buffer) => {
      alive = true;
      let msg: unknown;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      const parsed = clientMessage.safeParse(msg);
      if (!parsed.success) return;
      if (parsed.data.type === "ping") socket.send(JSON.stringify({ type: "pong", online: app.hub.onlineCount() }));
    });

    socket.on("close", () => {
      clearInterval(heartbeat);
      const wentOffline = app.hub.remove(user.id, socket);
      if (wentOffline) g.db.run("UPDATE players SET last_seen_at = ? WHERE user_id = ?", g.clock.now(), user.id);
    });
  });
}
