export function filterLogbook<T extends { kind: string; text: string }>(entries: T[], search: string, kind: string): T[] {
  const query = search.trim().toLocaleLowerCase();
  return entries.filter(entry =>
    (kind === "all" || entry.kind === kind) &&
    (!query || `${entry.text} ${entry.kind.replace(/_/g, " ")}`.toLocaleLowerCase().includes(query)),
  );
}
