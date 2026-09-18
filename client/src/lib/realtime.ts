export type ServerEvent = { type: string; [key: string]: unknown };
type Listener = (e: ServerEvent) => void;
export type ConnectionState = "connecting" | "open" | "closed";

/** One WebSocket for the whole app, reconnecting with backoff while the user is signed in. */
class Realtime {
  #ws: WebSocket | null = null;
  #listeners = new Set<Listener>();
  #stateListeners = new Set<(s: ConnectionState) => void>();
  #attempt = 0;
  #wanted = false;
  #timer: ReturnType<typeof setTimeout> | null = null;
  state: ConnectionState = "closed";

  start() {
    this.#wanted = true;
    if (!this.#ws) this.#connect();
  }

  stop() {
    this.#wanted = false;
    if (this.#timer) clearTimeout(this.#timer);
    this.#ws?.close();
    this.#ws = null;
    this.#setState("closed");
  }

  on(fn: Listener): () => void {
    this.#listeners.add(fn);
    return () => void this.#listeners.delete(fn);
  }

  onState(fn: (s: ConnectionState) => void): () => void {
    this.#stateListeners.add(fn);
    return () => void this.#stateListeners.delete(fn);
  }

  #setState(s: ConnectionState) {
    this.state = s;
    for (const fn of this.#stateListeners) fn(s);
  }

  #connect() {
    if (!this.#wanted || typeof WebSocket === "undefined") return;
    this.#setState("connecting");
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.#ws = ws;
    ws.onopen = () => {
      this.#attempt = 0;
      this.#setState("open");
    };
    ws.onmessage = (msg) => {
      try {
        const event = JSON.parse(String(msg.data)) as ServerEvent;
        for (const fn of this.#listeners) fn(event);
      } catch {
        // ignore malformed frames
      }
    };
    ws.onclose = (ev) => {
      this.#ws = null;
      this.#setState("closed");
      if (!this.#wanted || ev.code === 4401) return;
      const delay = Math.min(30_000, 1000 * 2 ** this.#attempt++) + Math.random() * 500;
      this.#timer = setTimeout(() => this.#connect(), delay);
    };
  }
}

export const realtime = new Realtime();
