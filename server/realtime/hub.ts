import type { WebSocket } from "ws";
import type { Hub, ServerEvent } from "../game/context.ts";

/** In-process pub/sub over WebSockets. One server process owns all connections. */
export class WsHub implements Hub {
  #sockets = new Map<number, Set<WebSocket>>();

  add(userId: number, socket: WebSocket) {
    let set = this.#sockets.get(userId);
    if (!set) {
      set = new Set();
      this.#sockets.set(userId, set);
    }
    set.add(socket);
  }

  remove(userId: number, socket: WebSocket): boolean {
    const set = this.#sockets.get(userId);
    if (!set) return false;
    set.delete(socket);
    if (set.size === 0) {
      this.#sockets.delete(userId);
      return true;
    }
    return false;
  }

  toUser(userId: number, event: ServerEvent) {
    const set = this.#sockets.get(userId);
    if (!set) return;
    const data = JSON.stringify(event);
    for (const s of set) if (s.readyState === s.OPEN) s.send(data);
  }

  toChannel(channel: string, event: ServerEvent) {
    if (channel !== "world") return;
    const data = JSON.stringify(event);
    for (const set of this.#sockets.values()) for (const s of set) if (s.readyState === s.OPEN) s.send(data);
  }

  isOnline(userId: number) {
    return this.#sockets.has(userId);
  }

  onlineCount() {
    return this.#sockets.size;
  }

  onlineUserIds() {
    return [...this.#sockets.keys()];
  }

  closeAll() {
    for (const set of this.#sockets.values()) for (const s of set) s.close(1001, "Server restarting");
    this.#sockets.clear();
  }
}
