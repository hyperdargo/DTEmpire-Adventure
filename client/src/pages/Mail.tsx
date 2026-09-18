import { useState } from "react";
import { CONSUMABLE_BY_ID } from "../../../shared/data/items.ts";
import { Button, Coins, Empty, Loading, PageHead } from "../components/ui.tsx";
import { fmt, timeAgo } from "../lib/format.ts";
import { useAction, useData } from "../state/game.ts";

interface Mail { id: number; sender: string; subject: string; body: string; attachments: { coins?: number; stacks?: Record<string, number>; itemIds?: number[] }; createdAt: number; read: boolean; claimed: boolean; expiresAt: number | null }

const hasGifts = (m: Mail) => !!(m.attachments.coins || Object.keys(m.attachments.stacks ?? {}).length || m.attachments.itemIds?.length);

export default function MailPage() {
  const { data, isPending } = useData<{ mail: Mail[] }>(["mail"], "/api/mail");
  const [open, setOpen] = useState<number | null>(null);
  const inv = [["mail"], ["inventory"]];
  const claim = useAction<{ mailId: number }>("/api/mail/claim", { invalidate: inv });
  const claimAll = useAction("/api/mail/claim-all", {
    invalidate: inv,
    success: (r) => { const x = r as { count: number; coins: number }; return x.count ? `Opened ${x.count} letter${x.count > 1 ? "s" : ""}${x.coins ? `: ${fmt(x.coins)} coins` : ""}.` : "Nothing left to claim."; },
  });
  const clean = useAction("/api/mail/clean", { invalidate: [["mail"]], success: "Old letters cleared." });

  if (isPending) return <Loading rows={4} />;
  const mail = data?.mail ?? [];
  const pending = mail.filter((m) => !m.claimed).length;

  return (
    <>
      <PageHead title="Mail" actions={<><Button variant="primary" disabled={!pending} loading={claimAll.isPending} onClick={() => claimAll.mutate(undefined)}>Claim all</Button><Button variant="ghost" onClick={() => clean.mutate(undefined)}>Clear opened</Button></>}>
        Rewards from the Tower, the Bestiary, guild tasks, auctions and the war council arrive here.
      </PageHead>
      {mail.length === 0 ? <Empty art="✉️" title="No letters">Your satchel is empty.</Empty> : (
        <ul className="mail">
          {mail.map((m) => {
            const expanded = open === m.id;
            return (
              <li key={m.id} className={`letter${m.claimed ? " letter--read" : ""}`}>
                <button type="button" className="letter__head" aria-expanded={expanded} onClick={() => { setOpen(expanded ? null : m.id); if (!m.claimed && !hasGifts(m)) claim.mutate({ mailId: m.id }); }}>
                  {!m.claimed && <span className="badge badge--dot" aria-label="Unread" />}
                  <b>{m.subject}</b>
                  <span className="faint">{m.sender} · {timeAgo(m.createdAt)}</span>
                </button>
                {expanded && (
                  <div className="letter__body">
                    {m.body.split("\n").map((l, i) => <p key={i}>{l}</p>)}
                    {hasGifts(m) && (
                      <div className="row row--wrap">
                        {!!m.attachments.coins && <Coins value={m.attachments.coins} compact />}
                        {Object.entries(m.attachments.stacks ?? {}).map(([t, q]) => <span key={t} className="chip"><span className="art">{CONSUMABLE_BY_ID[t]?.icon}</span>{CONSUMABLE_BY_ID[t]?.name ?? t} ×{q}</span>)}
                        {!!m.attachments.itemIds?.length && <span className="chip">{m.attachments.itemIds.length} item{m.attachments.itemIds.length > 1 ? "s" : ""}</span>}
                        {!m.claimed ? <Button size="sm" variant="primary" onClick={() => claim.mutate({ mailId: m.id })}>Claim</Button> : <span className="chip chip--good">Claimed</span>}
                      </div>
                    )}
                    {m.expiresAt && !m.claimed && <p className="faint">Expires {new Date(m.expiresAt).toLocaleDateString()}.</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
