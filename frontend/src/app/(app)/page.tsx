"use client";

import { ArrowDownLeft, ArrowUpRight, ChevronRight, CircleCheckBig, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ReminderBanner } from "@/components/ReminderBanner";
import { ScopePicker, scopeQuery, type ScopeValue } from "@/components/ScopePicker";
import { TxRow } from "@/components/TxRow";
import { useQuickAdd } from "@/components/quick-add";
import { Meter, meterTone } from "@/components/charts";
import { Card, cx, ErrorBox, Eyebrow, SectionTitle, Skeleton } from "@/components/ui";
import { deviceTimezone, greeting, shortDate, ymd } from "@/lib/dates";
import { useAccounts, useBudgets, useMe, useOverview } from "@/lib/hooks";
import { formatGHS } from "@/lib/money";
import type { Overview, Period, Totals } from "@/lib/types";
import { ACCOUNT_ICON, categoryVisual, IconBubble, Initials } from "@/lib/visuals";

const PERIODS: { value: Period; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "custom", label: "Custom" },
];
const PERIOD_NAME: Record<Period, string> = { today: "Today", week: "This week", month: "This month", custom: "Custom range" };

export default function OverviewPage() {
  const { openQuickAdd } = useQuickAdd();
  const { data: me } = useMe();
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

  const rangeLabel = data
    ? data.period.from === data.period.to
      ? shortDate(data.period.from)
      : `${shortDate(data.period.from)} – ${shortDate(data.period.to)}`
    : "";

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 pt-1">
        <div>
          <Eyebrow>
            {greeting()}
            {me ? `, ${me.name.split(" ")[0]}` : ""}
          </Eyebrow>
          <h1 className="mt-0.5 text-[28px] leading-tight font-bold tracking-tight">Overview</h1>
        </div>
        <div className="flex gap-2 md:hidden">
          <Link
            href="/review"
            aria-label="Today's review"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-ink"
          >
            <CircleCheckBig size={19} />
          </Link>
          <Link
            href="/settings"
            aria-label="Settings"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-ink"
          >
            <Settings size={19} />
          </Link>
        </div>
        <div className="hidden pb-1 text-[13px] text-muted md:block">
          {new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
        </div>
      </header>

      <ReminderBanner />
      <ScopePicker value={scope} onChange={setScope} />

      {error && <ErrorBox error={error} onRetry={() => mutate()} />}

      {isLoading && !data ? (
        <div className="space-y-4">
          <Skeleton className="h-56" />
          <Skeleton className="h-24" />
          <Skeleton className="h-64" />
        </div>
      ) : data ? (
        <>
          {/* Hero */}
          <section className="rounded-[28px] bg-hero p-5 text-hero-fg shadow-float">
            <div className="flex rounded-2xl bg-white/[0.06] p-1" role="tablist">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  role="tab"
                  aria-selected={period === p.value}
                  onClick={() => setPeriod(p.value)}
                  className={cx(
                    "h-8 flex-1 rounded-xl text-xs font-semibold transition",
                    period === p.value ? "bg-white text-[#0c0e12]" : "text-hero-muted hover:text-hero-fg",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {period === "custom" && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(["from", "to"] as const).map((k) => (
                  <input
                    key={k}
                    type="date"
                    aria-label={k === "from" ? "From" : "To"}
                    value={range[k]}
                    max={k === "from" ? range.to : undefined}
                    min={k === "to" ? range.from : undefined}
                    onChange={(e) => setRange({ ...range, [k]: e.target.value })}
                    className="h-10 rounded-xl border border-hero-line bg-white/[0.06] px-3 text-sm text-hero-fg [color-scheme:dark] outline-none"
                  />
                ))}
              </div>
            )}

            <div className="mt-5 text-[13px] text-hero-muted">
              Net cash flow · {PERIOD_NAME[period]} <span className="opacity-70">({rangeLabel})</span>
            </div>
            <div
              className={cx(
                "tabular mt-1 text-[40px] leading-none font-bold tracking-tight",
                data.period.net > 0 && "text-[#4ade80]",
                data.period.net < 0 && "text-[#fb7185]",
              )}
            >
              {formatGHS(data.period.net, { sign: true })}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <HeroStat label="Money in" value={data.period.income} kind="in" />
              <HeroStat label="Money out" value={data.period.expense} kind="out" />
            </div>
          </section>

          {/* Secondary period strip: today, or this month when the hero already shows today */}
          <MiniTotals title={period === "today" ? "This month" : "Today"} totals={period === "today" ? data.month : data.today} />

          <BudgetCard />

          {!data.has_transactions && (
            <Card className="text-center">
              <div className="py-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2">
                  <Plus size={22} />
                </div>
                <div className="mt-3 font-semibold">Record your first transaction</div>
                <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
                  Tap + whenever money comes in or goes out. It takes about five seconds.
                </p>
                <button
                  type="button"
                  onClick={openQuickAdd}
                  className="mt-4 h-10 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-fg"
                >
                  Add a transaction
                </button>
              </div>
            </Card>
          )}

          <Spending data={data} period={period} range={range} />

          {scope.scope !== "personal" && data.businesses.length > 0 && (
            <section>
              <SectionTitle>Businesses</SectionTitle>
              <Card flush className="divide-y divide-line overflow-hidden">
                {data.businesses.map((b) => (
                  <div key={b.id ?? "none"} className="flex items-center gap-3 px-4 py-3.5">
                    <Initials name={b.name} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-medium">{b.name}</div>
                      <div className="tabular mt-0.5 text-xs text-muted">
                        <span className={b.income > 0 ? "text-income" : ""}>{formatGHS(b.income, { compact: true })}</span> in ·{" "}
                        {formatGHS(b.expense, { compact: true })} out
                      </div>
                    </div>
                    <div
                      className={cx("tabular shrink-0 text-[15px] font-semibold", b.net > 0 && "text-income", b.net < 0 && "text-expense")}
                    >
                      {formatGHS(b.net, { sign: true })}
                    </div>
                  </div>
                ))}
              </Card>
            </section>
          )}

          <Accounts />

          <section>
            <SectionTitle
              action={
                <Link href="/transactions" className="flex items-center text-[13px] font-medium text-muted hover:text-ink">
                  See all <ChevronRight size={16} />
                </Link>
              }
            >
              Recent
            </SectionTitle>
            {data.recent.length === 0 ? (
              <Card className="text-sm text-muted">Nothing recorded yet{scope.scope !== "all" ? " for this selection" : ""}.</Card>
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

function HeroStat({ label, value, kind }: { label: string; value: number; kind: "in" | "out" }) {
  const Icon = kind === "in" ? ArrowDownLeft : ArrowUpRight;
  return (
    <div className="rounded-2xl bg-white/[0.06] p-3">
      <div className="flex items-center gap-1.5 text-xs text-hero-muted">
        <span
          className={cx(
            "flex h-5 w-5 items-center justify-center rounded-full",
            kind === "in" ? "bg-[#4ade80]/15 text-[#4ade80]" : "bg-[#fb7185]/15 text-[#fb7185]",
          )}
        >
          <Icon size={13} strokeWidth={2.5} />
        </span>
        {label}
      </div>
      <div className="tabular mt-1.5 text-[17px] font-semibold tracking-tight">{formatGHS(value)}</div>
    </div>
  );
}

function MiniTotals({ title, totals }: { title: string; totals: Totals }) {
  return (
    <Card flush className="grid grid-cols-3 divide-x divide-line">
      {[
        { label: `${title} in`, value: formatGHS(totals.income), cls: "text-income" },
        { label: `${title} out`, value: formatGHS(totals.expense), cls: "text-ink" },
        {
          label: "Net",
          value: formatGHS(totals.net, { sign: true }),
          cls: totals.net > 0 ? "text-income" : totals.net < 0 ? "text-expense" : "",
        },
      ].map((s) => (
        <div key={s.label} className="px-4 py-3.5">
          <div className="truncate text-xs text-muted">{s.label}</div>
          <div className={cx("tabular mt-1 truncate text-[15px] font-semibold tracking-tight", s.cls)}>{s.value}</div>
        </div>
      ))}
    </Card>
  );
}

function Spending({ data, period, range }: { data: Overview; period: Period; range: { from: string; to: string } }) {
  const total = data.categories.reduce((s, c) => s + c.total, 0);
  const qs = `period=${period}${period === "custom" ? `&from=${range.from}&to=${range.to}` : ""}`;
  return (
    <section>
      <SectionTitle action={total > 0 && <span className="tabular text-[13px] text-muted">{formatGHS(total)}</span>}>
        Where your money went
      </SectionTitle>
      {data.categories.length === 0 ? (
        <Card className="text-sm text-muted">No spending recorded for {PERIOD_NAME[period].toLowerCase()}.</Card>
      ) : (
        <Card flush className="overflow-hidden">
          {/* Proportion bar */}
          <div className="px-4 pt-4">
            <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
              {data.categories.slice(0, 8).map((c) => (
                <div
                  key={c.id}
                  className="h-2 first:rounded-l-full last:rounded-r-full"
                  style={{ width: `${(c.total / total) * 100}%`, background: categoryVisual(c.name).color, minWidth: 4 }}
                />
              ))}
            </div>
          </div>
          <ul className="mt-2 divide-y divide-line">
            {data.categories.map((c) => {
              const v = categoryVisual(c.name);
              const share = (c.total / total) * 100;
              const pct = share < 1 ? "<1" : Math.round(share);
              return (
                <li key={c.id}>
                  <Link href={`/transactions?category_id=${c.id}&${qs}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                    <IconBubble Icon={v.Icon} color={v.color} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{c.name}</span>
                      <span className="block text-xs text-muted">{pct}% of spending</span>
                    </span>
                    <span className="tabular shrink-0 text-[15px] font-semibold">{formatGHS(c.total)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </section>
  );
}

function Accounts() {
  const { data, accounts } = useAccounts();
  if (!data || accounts.length === 0) return null;
  return (
    <section>
      <SectionTitle
        action={
          <Link href="/settings#accounts" className="flex items-center text-[13px] font-medium text-muted hover:text-ink">
            Manage <ChevronRight size={16} />
          </Link>
        }
      >
        Accounts
      </SectionTitle>
      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] md:px-0">
        <div className="w-40 shrink-0 snap-start rounded-3xl bg-surface-2 p-4 md:w-auto">
          <div className="text-xs text-muted">Total recorded</div>
          <div className="tabular mt-6 text-[17px] font-bold tracking-tight">{formatGHS(data.total_balance)}</div>
        </div>
        {accounts.map((a) => {
          const Icon = ACCOUNT_ICON[a.account_type];
          return (
            <div key={a.id} className="w-40 shrink-0 snap-start rounded-3xl border border-line bg-surface p-4 shadow-card md:w-auto">
              <div className="flex items-center gap-2 text-xs text-muted">
                <Icon size={15} /> <span className="truncate">{a.name}</span>
              </div>
              <div className={cx("tabular mt-6 text-[17px] font-semibold tracking-tight", a.balance < 0 && "text-expense")}>
                {formatGHS(a.balance)}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 px-1 text-xs text-subtle">Opening balance + what you&apos;ve recorded. Not linked to your real MoMo or bank.</p>
    </section>
  );
}

function BudgetCard() {
  const { data } = useBudgets();
  if (!data) return null;
  const b = data.data.find((x) => !x.category && x.scope === "all") ?? data.data.find((x) => !x.category);
  if (!b) {
    return (
      <Link
        href="/plan"
        className="flex items-center justify-between gap-3 rounded-3xl border border-dashed border-line px-5 py-4 text-sm hover:bg-surface"
      >
        <span>
          <span className="font-semibold">Set a monthly budget</span>
          <span className="block text-muted">See what you can spend each day and week</span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-subtle" />
      </Link>
    );
  }
  const tone = meterTone(b.spent, b.amount, b.expected_by_now);
  return (
    <Link href="/plan" className="block rounded-3xl border border-line bg-surface p-5 shadow-card hover:bg-surface-2/40">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-muted">Budget left this month</span>
        <span className="text-[13px] text-muted">of {formatGHS(b.amount, { compact: true })}</span>
      </div>
      <div className={cx("mt-1 text-[22px] font-bold tracking-tight", b.remaining < 0 && "text-expense")}>
        {b.remaining < 0 ? `${formatGHS(-b.remaining)} over` : formatGHS(b.remaining)}
      </div>
      <div className="mt-3">
        <Meter value={b.spent} max={b.amount} tone={tone} pace={b.expected_by_now} height={8} />
      </div>
      {b.daily_allowance !== null && b.remaining > 0 && (
        <div className="mt-3 text-[13px] text-muted">
          About <span className="font-semibold text-ink">{formatGHS(b.daily_allowance)}</span> a day for the next {data.days_left} days ·
          today {formatGHS(b.spent_today ?? 0, { compact: true })} of {formatGHS(b.daily, { compact: true })}
        </div>
      )}
    </Link>
  );
}
