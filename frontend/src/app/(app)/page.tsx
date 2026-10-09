"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ReminderBanner } from "@/components/ReminderBanner";
import { ScopePicker, scopeQuery, type ScopeValue } from "@/components/ScopePicker";
import { InOut, NetFigure, TotalsCard } from "@/components/Totals";
import { TxRow } from "@/components/TxRow";
import { useQuickAdd } from "@/components/quick-add";
import { Card, ErrorBox, Input, Segmented, Skeleton, cx } from "@/components/ui";
import { deviceTimezone, shortDate, ymd } from "@/lib/dates";
import { useAccounts, useOverview } from "@/lib/hooks";
import { formatGHS } from "@/lib/money";
import type { Period } from "@/lib/types";

const PERIOD_LABEL: Record<Period, string> = { today: "Today", week: "This week", month: "This month", custom: "Custom range" };

export default function OverviewPage() {
  const { openQuickAdd } = useQuickAdd();
  const [scope, setScope] = useState<ScopeValue>({ scope: "all", businessId: null });
  const [period, setPeriod] = useState<Period>("month");
  const [range, setRange] = useState(() => {
    const d = new Date();
    return { from: ymd(new Date(d.getFullYear(), d.getMonth(), 1)), to: ymd(d) };
  });

  const customReady = period !== "custom" || (range.from && range.to && range.from <= range.to);
  const { data, error, isLoading, mutate } = useOverview({
    ...scopeQuery(scope),
    period: customReady ? period : "month",
    from: period === "custom" ? range.from : undefined,
    to: period === "custom" ? range.to : undefined,
    tz: deviceTimezone(),
  });

  // PWA shortcut: /?add=1 opens Quick Add straight away.
  useEffect(() => {
    if (new URLSearchParams(location.search).get("add")) {
      history.replaceState(null, "", "/");
      openQuickAdd();
    }
  }, [openQuickAdd]);

  const maxCat = Math.max(1, ...(data?.categories.map((c) => c.total) ?? [1]));

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
      <ReminderBanner />
      <ScopePicker value={scope} onChange={setScope} />

      {error && <ErrorBox error={error} onRetry={() => mutate()} />}

      {isLoading && !data ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      ) : data ? (
        <>
          {!data.has_transactions && (
            <Card className="text-center">
              <div className="py-4">
                <div className="text-base font-semibold">Record your first transaction</div>
                <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
                  Tap + whenever money comes in or goes out. It takes a few seconds.
                </p>
                <button
                  type="button"
                  onClick={openQuickAdd}
                  className="mt-4 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-fg"
                >
                  Add a transaction
                </button>
              </div>
            </Card>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <TotalsCard title="Today" totals={data.today} />
            <TotalsCard title="This month" totals={data.month} />
          </div>

          {/* Breakdown for a chosen period */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Where the money went</h2>
            </div>
            <Segmented
              size="sm"
              value={period}
              onChange={setPeriod}
              options={[
                { value: "today", label: "Today" },
                { value: "week", label: "Week" },
                { value: "month", label: "Month" },
                { value: "custom", label: "Custom" },
              ]}
            />
            {period === "custom" && (
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={range.from} max={range.to} onChange={(e) => setRange({ ...range, from: e.target.value })} aria-label="From" />
                <Input type="date" value={range.to} min={range.from} onChange={(e) => setRange({ ...range, to: e.target.value })} aria-label="To" />
              </div>
            )}

            <Card>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                {PERIOD_LABEL[period]} · {data.period.from === data.period.to ? shortDate(data.period.from) : `${shortDate(data.period.from)} – ${shortDate(data.period.to)}`}
              </div>
              <div className="mt-1">
                <NetFigure value={data.period.net} size="md" />
              </div>
              <InOut totals={data.period} />

              <div className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">Spending by category</div>
              {data.categories.length === 0 ? (
                <p className="mt-2 text-sm text-muted">No spending recorded in this period.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {data.categories.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/transactions?category_id=${c.id}&period=${period}${period === "custom" ? `&from=${range.from}&to=${range.to}` : ""}`}
                        className="block"
                      >
                        <div className="flex justify-between text-sm">
                          <span>{c.name}</span>
                          <span className="tabular font-medium">{formatGHS(c.total)}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                          <div className="h-full rounded-full bg-expense/70" style={{ width: `${(c.total / maxCat) * 100}%` }} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {scope.scope !== "personal" && data.businesses.length > 0 && (
              <Card flush>
                <div className="px-4 pt-4 text-xs font-semibold uppercase tracking-wide text-muted">Businesses · {PERIOD_LABEL[period].toLowerCase()}</div>
                <ul className="mt-2 divide-y divide-line">
                  {data.businesses.map((b) => (
                    <li key={b.id ?? "none"} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{b.name}</div>
                        <div className="tabular text-xs text-muted">
                          <span className="text-income">{formatGHS(b.income)}</span> in · <span className="text-expense">{formatGHS(b.expense)}</span> out
                        </div>
                      </div>
                      <div className={cx("tabular shrink-0 text-sm font-semibold", b.net > 0 ? "text-income" : b.net < 0 ? "text-expense" : "")}>
                        {formatGHS(b.net, { sign: true })}
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </section>

          <AccountsCard />

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-semibold">Recent</h2>
              <Link href="/transactions" className="text-sm font-medium text-muted hover:text-ink">
                See all →
              </Link>
            </div>
            {data.recent.length === 0 ? (
              <p className="text-sm text-muted">Nothing recorded yet{scope.scope !== "all" ? " for this selection" : ""}.</p>
            ) : (
              <Card flush className="divide-y divide-line overflow-hidden">
                {data.recent.map((tx) => (
                  <TxRow key={tx.id} tx={tx} showDate />
                ))}
              </Card>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function AccountsCard() {
  const { data, accounts } = useAccounts();
  if (!data || accounts.length === 0) return null;
  const total = data.total_balance;
  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">Recorded balance</div>
        <div className="tabular text-lg font-bold">{formatGHS(total)}</div>
      </div>
      <ul className="mt-3 space-y-1.5 text-sm">
        {accounts.map((a) => (
          <li key={a.id} className="flex justify-between">
            <span className="text-muted">{a.name}</span>
            <span className={cx("tabular font-medium", a.balance < 0 && "text-expense")}>{formatGHS(a.balance)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">
        Opening balances plus what you&apos;ve recorded here. Not synced with your real MoMo or bank balance. Set opening balances in Settings.
      </p>
    </Card>
  );
}
