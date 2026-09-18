import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { api, ApiError, type HeroSnap, type MeSnapshot, type Mutation } from "../lib/api.ts";
import { useNotify } from "./notify.tsx";

export const meKey = ["me"] as const;

export function useMe() {
  return useQuery({
    queryKey: meKey,
    queryFn: () => api.get<MeSnapshot | { user: null; hero: null }>("/api/me"),
    staleTime: 10_000,
    refetchInterval: 60_000,
  });
}

/** The signed-in hero, for screens that only render once a hero exists. */
export function useHero(): HeroSnap {
  const { data } = useMe();
  const snap = data as HeroSnap | undefined;
  if (!snap?.hero) throw new Error("useHero requires a hero");
  return snap;
}

export function useData<T>(key: QueryKey, path: string, opts: { enabled?: boolean; refetchInterval?: number; staleTime?: number } = {}) {
  return useQuery({ queryKey: key, queryFn: () => api.get<T>(path), staleTime: opts.staleTime ?? 5_000, enabled: opts.enabled, refetchInterval: opts.refetchInterval });
}

interface ActionOptions<T> {
  invalidate?: QueryKey[];
  success?: string | ((result: T) => string | null);
  onSuccess?: (result: T, full: Mutation<T>) => void;
  onError?: (err: ApiError) => boolean | void;
}

/**
 * Posts a game action. Applies fresh shell state, surfaces notices, invalidates dependent queries,
 * and reports failures in the player's language.
 */
export function useAction<TBody = unknown, T = unknown>(path: string | ((body: TBody) => string), opts: ActionOptions<T> = {}) {
  const qc = useQueryClient();
  const notify = useNotify();
  return useMutation({
    mutationFn: (body: TBody) => api.post<Mutation<T>>(typeof path === "function" ? path(body) : path, body),
    onSuccess: (data) => {
      if (data && typeof data === "object" && "me" in data && data.me) qc.setQueryData(meKey, data.me);
      if (data?.notices?.length) notify.notices(data.notices);
      for (const key of opts.invalidate ?? []) void qc.invalidateQueries({ queryKey: key });
      const msg = typeof opts.success === "function" ? opts.success(data.result) : opts.success;
      if (msg) notify.toast({ tone: "good", title: msg });
      opts.onSuccess?.(data.result, data);
    },
    onError: (err) => {
      const e = err instanceof ApiError ? err : new ApiError(0, "unknown", String(err));
      if (opts.onError?.(e)) return;
      if (e.status === 401) void qc.invalidateQueries({ queryKey: meKey });
      notify.toast({ tone: e.status === 429 ? "warn" : "bad", title: e.message });
    },
  });
}
