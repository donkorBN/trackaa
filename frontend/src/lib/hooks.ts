"use client";

import useSWR, { useSWRConfig } from "swr";
import { useCallback, useEffect } from "react";
import { fetcher, withQuery } from "./api";
import { deviceTimezone } from "./dates";
import type { Account, BudgetsResponse, Business, Category, Goal, Insights, Meta, Overview, Progress, User } from "./types";

type List<T> = { data: T[] };

/** Public server settings for the sign-in screens. */
export function useMeta() {
  return useSWR<Meta>("/meta", fetcher, { revalidateOnFocus: false });
}

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

export function useBudgets(month?: string) {
  return useSWR<BudgetsResponse>(withQuery("/budgets", { month, tz: deviceTimezone() }), fetcher);
}

export function useGoals() {
  const r = useSWR<{ data: Goal[] }>(withQuery("/goals", { tz: deviceTimezone() }), fetcher);
  return { ...r, goals: r.data?.data ?? [] };
}

export function useInsights(query: Record<string, string | number | undefined>) {
  return useSWR<Insights>(withQuery("/insights", { ...query, tz: deviceTimezone() }), fetcher, { keepPreviousData: true });
}

export function useProgress() {
  return useSWR<Progress>("/progress", fetcher);
}
