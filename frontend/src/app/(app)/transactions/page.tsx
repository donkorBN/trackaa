"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWRInfinite from "swr/infinite";
import { FilterIcon, SearchIcon } from "@/components/icons";
import { useQuickAdd } from "@/components/quick-add";
import { TxRow } from "@/components/TxRow";
import { Button, Card, Chip, ErrorBox, Input, Label, Select, Skeleton } from "@/components/ui";
import { fetcher, withQuery } from "@/lib/api";
import { dayLabel, deviceTimezone, ymd } from "@/lib/dates";
import { useAccounts, useBusinesses, useCategories, useOnRefresh } from "@/lib/hooks";
import { formatGHS } from "@/lib/money";
import { periodRange } from "@/lib/periods";
import type { Period, TransactionPage, Transaction } from "@/lib/types";

interface Filters {
  period: "all" | Period;
  from: string;
  to: string;
  type: "" | "income" | "expense" | "transfer";
  scope: "" | "personal" | "business";
  business_id: string;
  category_id: string;
  account_id: string;
}

const EMPTY: Filters = { period: "all", from: "", to: "", type: "", scope: "", business_id: "", category_id: "", account_id: "" };

export default function TransactionsPage() {
  const { openQuickAdd } = useQuickAdd();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [showFilters, setShowFilters] = useState(false);
  const { categories } = useCategories(true);
  const { accounts } = useAccounts(true);
  const { businesses } = useBusinesses(true);

  // Allow deep links like /transactions?category_id=3&period=month from the dashboard.
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    if ([...p.keys()].length === 0) return;
    const next = { ...EMPTY };
    for (const k of Object.keys(EMPTY) as (keyof Filters)[]) {
      const v = p.get(k);
      if (v) (next as Record<string, string>)[k] = v;
    }
    setFilters(next);
    setShowFilters(true);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const range = useMemo(() => {
    if (filters.period === "all") return { from: undefined, to: undefined };
    if (filters.period === "custom") return { from: filters.from || undefined, to: filters.to || undefined };
    return periodRange(filters.period);
  }, [filters]);

  const query = {
    q: debouncedQ,
    type: filters.type,
    scope: filters.scope,
    business_id: filters.scope === "personal" ? "" : filters.business_id,
    category_id: filters.category_id,
    account_id: filters.account_id,
    from: range.from,
    to: range.to,
    tz: deviceTimezone(),
    per_page: 50,
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } = useSWRInfinite<TransactionPage>(
    (index, prev) => (prev && prev.meta.current_page >= prev.meta.last_page ? null : withQuery("/transactions", { ...query, page: index + 1 })),
    fetcher,
    { revalidateAll: true },
  );

  const revalidate = useCallback(() => void mutate(), [mutate]);
  useOnRefresh(revalidate);

  const items = useMemo(() => data?.flatMap((p) => p.data) ?? [], [data]);
  const days = Object.assign({}, ...(data?.map((p) => p.days) ?? []));
  const total = data?.[0]?.meta.total ?? 0;
  const hasMore = data ? data[data.length - 1].meta.current_page < data[data.length - 1].meta.last_page : false;

  const groups = useMemo(() => {
    const g: { key: string; items: Transaction[] }[] = [];
    for (const tx of items) {
      const key = ymd(new Date(tx.occurred_at));
      if (g.at(-1)?.key !== key) g.push({ key, items: [] });
      g.at(-1)!.items.push(tx);
    }
    return g;
  }, [items]);

  const activeCount = (Object.keys(EMPTY) as (keyof Filters)[]).filter(
    (k) => k !== "from" && k !== "to" && filters[k] !== EMPTY[k],
  ).length;
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>

      <div className="flex gap-2">
        <label className="relative flex-1">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">
            <SearchIcon />
          </span>
          <Input type="search" placeholder="Search notes, business, category" value={q} onChange={(e) => setQ(e.target.value)} className="w-full pl-9" />
        </label>
        <Button variant="secondary" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
          <FilterIcon />
          <span className="hidden sm:inline">Filters</span>
          {activeCount > 0 && <span className="rounded-full bg-accent px-1.5 text-xs text-accent-fg">{activeCount}</span>}
        </Button>
      </div>

      {showFilters && (
        <Card className="space-y-4">
          <div>
            <Label>Date</Label>
            <div className="flex flex-wrap gap-2">
              {(["all", "today", "week", "month", "custom"] as const).map((p) => (
                <Chip key={p} active={filters.period === p} onClick={() => set("period", p)}>
                  {{ all: "All time", today: "Today", week: "This week", month: "This month", custom: "Custom" }[p]}
                </Chip>
              ))}
            </div>
            {filters.period === "custom" && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Input type="date" value={filters.from} onChange={(e) => set("from", e.target.value)} aria-label="From" />
                <Input type="date" value={filters.to} onChange={(e) => set("to", e.target.value)} aria-label="To" />
              </div>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Type</Label>
              <Select value={filters.type} onChange={(e) => set("type", e.target.value as Filters["type"])}>
                <option value="">Income &amp; expenses</option>
                <option value="income">Income</option>
                <option value="expense">Expenses</option>
                <option value="transfer">Transfers</option>
              </Select>
            </div>
            <div>
              <Label>Personal / Business</Label>
              <Select value={filters.scope} onChange={(e) => set("scope", e.target.value as Filters["scope"])}>
                <option value="">Both</option>
                <option value="personal">Personal</option>
                <option value="business">Business</option>
              </Select>
            </div>
            {filters.scope !== "personal" && (
              <div>
                <Label>Business</Label>
                <Select value={filters.business_id} onChange={(e) => set("business_id", e.target.value)}>
                  <option value="">Any business</option>
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                      {b.archived ? " (archived)" : ""}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div>
              <Label>Category</Label>
              <Select value={filters.category_id} onChange={(e) => set("category_id", e.target.value)}>
                <option value="">Any category</option>
                {(["income", "expense"] as const).map((t) => (
                  <optgroup key={t} label={t === "income" ? "Income" : "Expense"}>
                    {categories
                      .filter((c) => c.transaction_type === t)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.archived ? " (archived)" : ""}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </Select>
            </div>
            <div>
              <Label>Account</Label>
              <Select value={filters.account_id} onChange={(e) => set("account_id", e.target.value)}>
                <option value="">Any account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.archived ? " (archived)" : ""}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {activeCount > 0 && (
            <button type="button" className="text-sm font-medium text-muted hover:text-ink" onClick={() => setFilters(EMPTY)}>
              Clear filters
            </button>
          )}
        </Card>
      )}

      {error && <ErrorBox error={error} onRetry={() => mutate()} />}

      {isLoading && !data ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : items.length === 0 && !error ? (
        <Card className="py-10 text-center">
          {activeCount > 0 || debouncedQ ? (
            <p className="text-sm text-muted">No transactions match these filters.</p>
          ) : (
            <>
              <p className="font-semibold">No transactions yet</p>
              <p className="mt-1 text-sm text-muted">Everything you record shows up here, grouped by day.</p>
              <button type="button" onClick={openQuickAdd} className="mt-4 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-fg">
                Add a transaction
              </button>
            </>
          )}
        </Card>
      ) : (
        <>
          <p className="text-xs text-muted">
            {total} transaction{total === 1 ? "" : "s"}
          </p>
          <div className="space-y-4">
            {groups.map((g) => {
              const sub = days[g.key] as { income: number; expense: number } | undefined;
              return (
                <section key={g.key}>
                  <div className="mb-1.5 flex items-baseline justify-between px-1">
                    <h2 className="text-sm font-semibold">{dayLabel(g.key)}</h2>
                    {sub && (sub.income > 0 || sub.expense > 0) && (
                      <div className="tabular text-xs text-muted">
                        {sub.income > 0 && <span className="text-income">+{formatGHS(sub.income)}</span>}
                        {sub.income > 0 && sub.expense > 0 && " · "}
                        {sub.expense > 0 && <span className="text-expense">−{formatGHS(sub.expense)}</span>}
                      </div>
                    )}
                  </div>
                  <Card flush className="divide-y divide-line overflow-hidden">
                    {g.items.map((tx) => (
                      <TxRow key={tx.id} tx={tx} />
                    ))}
                  </Card>
                </section>
              );
            })}
          </div>
          {hasMore && (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={() => setSize(size + 1)} disabled={isValidating}>
                {isValidating ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
