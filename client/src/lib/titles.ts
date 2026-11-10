interface SearchableTitle {
  title: string;
  source: string;
  desc: string;
  category?: string;
  earned: boolean;
}

export function filterTitles<T extends SearchableTitle>(titles: readonly T[], query: string, status: "all" | "earned" | "locked", category: string): T[] {
  const needle = query.trim().toLowerCase();
  return titles.filter((title) =>
    (status === "all" || title.earned === (status === "earned")) &&
    (category === "all" || title.category === category) &&
    (!needle || `${title.title} ${title.source} ${title.desc}`.toLowerCase().includes(needle)),
  );
}
