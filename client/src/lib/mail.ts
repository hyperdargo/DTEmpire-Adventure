interface Letter {
  sender: string;
  subject: string;
  body: string;
  claimed: boolean;
  attachments: { coins?: number; stacks?: Record<string, number>; itemIds?: number[] };
}

/** Search only changes visibility; reward totals always describe the whole inbox. */
export function triageMail<T extends Letter>(mail: T[], query: string, unclaimedOnly: boolean) {
  const needle = query.trim().toLocaleLowerCase();
  const pending = mail.filter(m => !m.claimed);
  return {
    letters: mail.filter(m => (!unclaimedOnly || !m.claimed) &&
      (!needle || [m.sender, m.subject, m.body].some(text => text.toLocaleLowerCase().includes(needle)))),
    pending: pending.length,
    coins: pending.reduce((sum, m) => sum + (m.attachments.coins ?? 0), 0),
    stacks: pending.reduce((sum, m) => sum + Object.values(m.attachments.stacks ?? {}).reduce((a, b) => a + b, 0), 0),
    items: pending.reduce((sum, m) => sum + (m.attachments.itemIds?.length ?? 0), 0),
  };
}
