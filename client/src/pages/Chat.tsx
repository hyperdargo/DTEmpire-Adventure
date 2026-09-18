import { useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { CHAT_MAX_LENGTH } from "../../../shared/data/meta.ts";
import { Button, Empty, Loading, PageHead } from "../components/ui.tsx";
import { api, errorMessage } from "../lib/api.ts";
import { timeAgo } from "../lib/format.ts";
import { useData, useHero } from "../state/game.ts";
import { useNotify } from "../state/notify.tsx";

interface Message { id: number; userId: number; name: string; classIcon: string; level: number; body: string; at: number }
interface Thread { channel: string; userId: number; name: string; online: boolean; last: string; at: number }

export default function ChatPage() {
  const { hero, user } = useHero();
  const [params, setParams] = useSearchParams();
  const channel = params.get("c") ?? "world";
  const threads = useData<{ threads: Thread[] }>(["threads"], "/api/chat/threads");
  const channels = [
    { id: "world", label: "World" },
    ...(hero.guild ? [{ id: `guild:${hero.guild.id}`, label: `[${hero.guild.tag}] Guild` }] : []),
    ...(threads.data?.threads ?? []).map((t) => ({ id: t.channel, label: t.name, online: t.online })),
  ];
  const current = channels.find((c) => c.id === channel) ?? { id: channel, label: "Direct message" };

  return (
    <>
      <PageHead title="Chat">Be kind. Messages are public in World and your guild; direct messages are between you and one other hero.</PageHead>
      <div className="chat">
        <nav className="chat__channels" aria-label="Channels">
          {channels.map((c) => (
            <button key={c.id} type="button" className={`chat__channel${c.id === channel ? " is-active" : ""}`} onClick={() => setParams({ c: c.id })} aria-current={c.id === channel ? "page" : undefined}>
              {"online" in c && <span className={`online${c.online ? "" : " online--off"}`} aria-hidden />}
              {c.label}
            </button>
          ))}
          {!hero.guild && <Link className="faint" to="/guild">Join a guild for a guild channel →</Link>}
        </nav>
        <Room key={channel} channel={channel} title={current.label} guest={user!.isGuest} myId={user!.id} />
      </div>
    </>
  );
}

function Room({ channel, title, guest, myId }: { channel: string; title: string; guest: boolean; myId: number }) {
  const qc = useQueryClient();
  const notify = useNotify();
  const { data, isPending, isError } = useData<{ messages: Message[] }>(["chat", channel], `/api/chat?channel=${encodeURIComponent(channel)}`);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const list = useRef<HTMLOListElement>(null);
  const messages = data?.messages ?? [];

  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await api.post("/api/chat", { channel, body });
      setText("");
      void qc.invalidateQueries({ queryKey: ["chat", channel] });
      void qc.invalidateQueries({ queryKey: ["threads"] });
    } catch (err) {
      notify.toast({ tone: "warn", title: errorMessage(err) });
    } finally {
      setSending(false);
    }
  };

  const readOnly = guest && channel === "world";
  return (
    <section className="chat__room panel panel--tight" aria-label={title}>
      <h2 className="chat__title">{title}</h2>
      {isPending ? <Loading rows={3} /> : isError ? <Empty art="🔒" title="You can't read this channel" /> : (
        <ol className="chat__messages" ref={list} aria-live="polite">
          {messages.length === 0 && <li className="faint">No messages yet. Say hello.</li>}
          {messages.map((m) => (
            <li key={m.id} className={`msg${m.userId === myId ? " msg--mine" : ""}`}>
              <span className="art msg__icon" aria-hidden>{m.classIcon}</span>
              <div>
                <div className="msg__head"><Link to={`/players/${encodeURIComponent(m.name)}`}>{m.name}</Link> <span className="faint">Lv {m.level} · {timeAgo(m.at)}</span></div>
                <p className="msg__body">{m.body}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      <form className="chat__form" onSubmit={(e) => void send(e)}>
        <label className="sr-only" htmlFor="chat-input">Message</label>
        <input id="chat-input" className="input" value={text} onChange={(e) => setText(e.target.value)} maxLength={CHAT_MAX_LENGTH} autoComplete="off"
          placeholder={readOnly ? "Save your account in Settings to chat in World" : `Message ${title}`} disabled={readOnly} />
        <Button type="submit" variant="primary" disabled={!text.trim() || readOnly} loading={sending} aria-label="Send"><Send size={18} /></Button>
      </form>
    </section>
  );
}
