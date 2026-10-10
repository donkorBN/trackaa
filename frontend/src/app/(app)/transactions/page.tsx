"use client";

import { Download, ListPlus, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import useSWRInfinite from "swr/infinite";
import { useQuickAdd } from "@/components/quick-add";
import { useToast } from "@/components/toast";
import { TxRow } from "@/components/TxRow";
import { Button, Card, Chip, cx, EmptyState, ErrorBox, Input, Label, Select, Sheet, Skeleton } from "@/components/ui";
import { apiDownload, fetcher, withQuery } from "@/lib/api";
import { dayLabel, deviceTimezone, shortDate, ymd } from "@/lib/dates";
import { useAccounts, useBusinesses, useCategories, useOnRefresh } from "@/lib/hooks";
import { formatGHS } from "@/lib/money";
import { periodRange } from "@/lib/periods";
import type { Period, Transaction, TransactionPage } from "@/lib/types";

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
const PERIOD_LABEL = { all: "All time", today: "Today", week: "This week", month: "This month", custom: "Custom" } as const;

export default function TransactionsPage() {
  const { openQuickAdd } = useQuickAdd();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [sheet, setSheet] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { categories } = useCategories(true);
  const { accounts } = useAccounts(true);
  const { businesses } = useBusinesses(true);

  // Deep links like /transactions?category_id=3&period=month from the dashboard.
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    if ([...p.keys()].length === 0) return;
    const next = { ...EMPTY };
    for (const k of Object.keys(EMPTY) as (keyof Filters)[]) {
      const v = p.get(k);
      if (v) (next as Record<string, string>)[k] = v;
    }
    setFilters(next);
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
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } = useSWRInfinite<TransactionPage>(
    (index, prev) =>
      prev && prev.meta.current_page >= prev.meta.last_page ? null : withQuery("/transactions", { ...query, per_page: 50, page: index + 1 }),
    fetcher,
    { revalidateAll: true },
  );
  const revalidate = useCallback(() => void mutate(), [mutate]);
  useOnRefresh(revalidate);

  const items = useMemo(() => data?.flatMap((p) => p.data) ?? [], [data]);
  const days: Record<string, { income: number; expense: number }> = Object.assign({}, ...(data?.map((p) => p.days) ?? []));
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

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));

  // Active filter pills (besides the type chips) that can be removed with one tap.
  const pills: { key: string; label: string; clear: () => void }[] = [];
  if (filters.period !== "all")
    pills.push({
      key: "period",
      label: filters.period === "custom" ? `${filters.from ? shortDate(filters.from) : "…"} – ${filters.to ? shortDate(filters.to) : "…"}` : PERIOD_LABEL[filters.period],
      clear: () => setFilters((f) => ({ ...f, period: "all", from: "", to: "" })),
    });
  if (filters.scope) pills.push({ key: "scope", label: filters.scope === "personal" ? "Personal" : "Business", clear: () => set("scope", "") });
  if (filters.business_id && filters.scope !== "personal")
    pills.push({ key: "biz", label: businesses.find((b) => String(b.id) === filters.business_id)?.name ?? "Business", clear: () => set("business_id", "") });
  if (filters.category_id)
    pills.push({ key: "cat", label: categories.find((c) => String(c.id) === filters.category_id)?.name ?? "Category", clear: () => set("category_id", "") });
  if (filters.account_id)
    pills.push({ key: "acc", label: accounts.find((a) => String(a.id) === filters.account_id)?.name ?? "Account", clear: () => set("account_id", "") });

  async function exportCsv() {
    setExporting(true);
    try {
      await apiDownload(withQuery("/transactions/export", query), "trackaa-transactions.csv");
    } catch (err) {
      toast({ message: (err as Error).message, tone: "error" });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between pt-1">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">Transactions</h1>
        <Button variant="ghost" size="sm" onClick={exportCsv} disabled={exporting || total === 0}>
          <Download size={16} /> {exporting ? "Exporting…" : "CSV"}
        </Button>
      </header>

      <div className="sticky top-0 z-20 -mx-4 space-y-3 bg-bg/90 px-4 pt-2 pb-3 backdrop-blur-xl md:top-0">
        <div className="flex gap-2">
          <label className="relative flex-1">
            <Search size={17} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-subtle" />
            <Input type="search" placeholder="Search notes, businesses, categories" value={q} onChange={(e) => setQ(e.target.value)} className="w-full pl-10" />
          </label>
          <button
            type="button"
            onClick={() => setSheet(true)}
            aria-label="Filters"
            className={cx(
              "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition",
              pills.length ? "border-accent bg-accent text-accent-fg" : "border-line bg-surface text-ink",
            )}
          >
            <SlidersHorizontal size={18} />
            {pills.length > 0 && <span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-expense px-1 text-[10px] font-bold text-white">{pills.length}</span>}
          </button>
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {([
            ["", "All"],
            ["expense", "Expenses"],
            ["income", "Income"],
            ["transfer", "Transfers"],
          ] as const).map(([v, label]) => (
            <Chip key={v} active={filters.type === v} onClick={() => set("type", v)} tone={v === "income" ? "income" : v === "expense" ? "expense" : v === "transfer" ? "transfer" : "neutral"}>
              {label}
            </Chip>
          ))}
          {pills.map((p) => (
            <Chip key={p.key} active onClick={p.clear} icon={<X size={13} />}>
              {p.label}
            </Chip>
          ))}
        </div>
      </div>

      {error && <ErrorBox error={error} onRetry={() => mutate()} />}

      {isLoading && !data ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : items.length === 0 && !error && !(pills.length > 0 || debouncedQ || filters.type) ? (
        <EmptyState
          icon={<ListPlus size={30} />}
          title="Nothing recorded yet"
          body="Everything you record shows up here, grouped by day, with daily totals."
          action={
            <Button onClick={openQuickAdd}>
              <Plus size={17} strokeWidth={2.5} /> Add a transaction
            </Button>
          }
        />
      ) : items.length === 0 && !error ? (
        <Card className="py-10 text-center">
          {pills.length > 0 || debouncedQ || filters.type ? (
            <>
              <p className="font-semibold">No matches</p>
              <p className="mt-1 text-sm text-muted">Try a different search or clear some filters.</p>
              <Button
                variant="secondary"
                className="mt-4"
                onClick={() => {
                  setFilters(EMPTY);
                  setQ("");
                }}
              >
                Clear all
              </Button>
            </>
          ) : (
            <></>
          )}
        </Card>
      ) : (
        <>
          <p className="px-1 text-xs text-muted">
            {total} transaction{total === 1 ? "" : "s"}
          </p>
          <div className="space-y-5">
            {groups.map((g) => {
              const sub = days[g.key];
              return (
                <section key={g.key}>
                  <div className="mb-2 flex items-baseline justify-between px-1">
                    <h2 className="text-[13px] font-semibold text-muted">{dayLabel(g.key)}</h2>
                    {sub && (sub.income > 0 || sub.expense > 0) && (
                      <div className="tabular text-xs font-medium">
                        {sub.income > 0 && <span className="text-income">+{formatGHS(sub.income)}</span>}
                        {sub.income > 0 && sub.expense > 0 && <span className="text-subtle"> · </span>}
                        {sub.expense > 0 && <span className="text-muted">−{formatGHS(sub.expense)}</span>}
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
            <div className="flex justify-center pt-2">
              <Button variant="secondary" onClick={() => setSize(size + 1)} disabled={isValidating}>
                {isValidating ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </>
      )}

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Filters">
        <div className="space-y-5">
          <div>
            <Label>Date</Label>
            <div className="flex flex-wrap gap-2">
              {(["all", "today", "week", "month", "custom"] as const).map((p) => (
                <Chip key={p} active={filters.period === p} onClick={() => set("period", p)}>
                  {PERIOD_LABEL[p]}
                </Chip>
              ))}
            </div>
            {filters.period === "custom" && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => set("from", e.target.value)} aria-label="From" />
                <Input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => set("to", e.target.value)} aria-label="To" />
              </div>
            )}
          </div>
          {businesses.length > 0 && (
          <div>
            <Label>Personal or business</Label>
            <div className="flex gap-2">
              {([
                ["", "Both"],
                ["personal", "Personal"],
                ["business", "Business"],
              ] as const).map(([v, l]) => (
                <Chip key={v} active={filters.scope === v} onClick={() => set("scope", v)}>
                  {l}
                </Chip>
              ))}
            </div>
          </div>
          )}
          {filters.scope !== "personal" && businesses.length > 0 && (
            <div>
              <Label htmlFor="f-biz">Business</Label>
              <Select id="f-biz" value={filters.business_id} onChange={(e) => set("business_id", e.target.value)}>
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
            <Label htmlFor="f-cat">Category</Label>
            <Select id="f-cat" value={filters.category_id} onChange={(e) => set("category_id", e.target.value)}>
              <option value="">Any category</option>
              {(["expense", "income"] as const).map((t) => (
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
            <Label htmlFor="f-acc">Account</Label>
            <Select id="f-acc" value={filters.account_id} onChange={(e) => set("account_id", e.target.value)}>
              <option value="">Any account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.archived ? " (archived)" : ""}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" size="lg" onClick={() => setFilters({ ...EMPTY, type: filters.type })}>
              Reset
            </Button>
            <Button className="flex-1" size="lg" onClick={() => setSheet(false)}>
              Show {isValidating ? "…" : total} result{total === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
