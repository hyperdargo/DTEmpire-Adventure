export type AchievementFilter = "all" | "pending" | "earned";

export function filterAchievements<T extends { name: string; desc: string; title?: string; done: boolean; progress: number; goal: number }>(entries: T[], search: string, status: AchievementFilter): T[] {
  const query = search.trim().toLocaleLowerCase();
  return entries.filter(entry =>
    (status === "all" || (status === "earned" ? entry.done : !entry.done)) &&
    (!query || `${entry.name} ${entry.desc} ${entry.title ?? ""}`.toLocaleLowerCase().includes(query)),
  );
}
