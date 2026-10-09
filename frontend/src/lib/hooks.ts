"use client";

import useSWR, { useSWRConfig } from "swr";
import { useCallback, useEffect } from "react";
import { fetcher, withQuery } from "./api";
import type { Account, Business, Category, Overview, User } from "./types";

type List<T> = { data: T[] };

export function useMe() {
  return useSWR<User>("/me", fetcher);
}

export function useAccounts(includeArchived = false) {
  const r = useSWR<List<Account> & { total_balance: number }>(withQuery("/accounts", { include_archived: includeArchived }), fetcher);
  return { ...r, accounts: r.data?.data ?? [] };
}

export function useBusinesses(includeArchived = false) {
  const r = useSWR<List<Business>>(withQuery("/businesses", { include_archived: includeArchived }), fetcher);
  return { ...r, businesses: r.data?.data ?? [] };
}

export function useCategories(includeArchived = false) {
  const r = useSWR<List<Category>>(withQuery("/categories", { include_archived: includeArchived }), fetcher);
  return { ...r, categories: r.data?.data ?? [] };
}

export function useOverview(query: Record<string, string | number | undefined>) {
  return useSWR<Overview>(withQuery("/overview", query), fetcher, { keepPreviousData: true });
}

const REFRESH_EVENT = "trackaa:refresh";

/** Revalidate every cached API response — after any write, all totals stay correct. */
export function useRefreshAll() {
  const { mutate } = useSWRConfig();
  return useCallback(() => {
    mutate(() => true);
    // Global key-matching mutate skips useSWRInfinite caches, so they listen for this instead.
    window.dispatchEvent(new Event(REFRESH_EVENT));
  }, [mutate]);
}

export function useOnRefresh(fn: () => void) {
  useEffect(() => {
    window.addEventListener(REFRESH_EVENT, fn);
    return () => window.removeEventListener(REFRESH_EVENT, fn);
  }, [fn]);
}
