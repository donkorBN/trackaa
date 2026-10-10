"use client";

import { ArrowDownLeft, ArrowUpRight, Plus, Settings, Target } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatedMoney } from "@/components/AnimatedMoney";
import { StreakChip, TodayCard } from "@/components/progress";
import { ScopePicker, scopeQuery, type ScopeValue } from "@/components/ScopePicker";
import { TxRow } from "@/components/TxRow";
import { useQuickAdd } from "@/components/quick-add";
import { Meter, meterTone, ToneTag } from "@/components/charts";
import {
  Button,
  Card,
  cx,
  EmptyState,
  ErrorBox,
  Glyph,
  IconButton,
  LinkCard,
  ListCard,
  ListRow,
  Monogram,
  Num,
  PageHeader,
  SectionLink,
  SectionTitle,
  Segmented,
  Skeleton,
  Stat,
} from "@/components/ui";
import { deviceTimezone, greeting, shortDate, ymd } from "@/lib/dates";
import { useAccounts, useBudgets, useMe, useOverview } from "@/lib/hooks";
import { formatGHS } from "@/lib/money";
import type { Overview, Period, Totals } from "@/lib/types";
import { ACCOUNT_ICON, categoryIcon, SHARE_RAMP } from "@/lib/visuals";

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
      <PageHeader
        eyebrow={`${greeting()}${me ? `, ${me.name.split(" ")[0]}` : ""}`}
        title="Overview"
        actions={
          <>
            <StreakChip />
            <IconButton href="/settings" label="Settings" className="md:hidden">
              <Settings size={19} />
            </IconButton>
          </>
        }
      />

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
          <section className="rounded-sheet bg-hero p-5 text-hero-fg">
            <Segmented onDark size="sm" label="Period" value={period} onChange={setPeriod} options={PERIODS} />
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
                    className="h-11 rounded-control border-[1.5px] border-hero-line bg-white/[0.06] px-3 text-base text-hero-fg [color-scheme:dark] outline-none focus:border-brand"
                  />
                ))}
              </div>
            )}

            <div className="mt-6 flex items-baseline justify-between gap-2">
              <span className="eyebrow" style={{ color: "var(--hero-muted)" }}>
                Net cash flow · {PERIOD_NAME[period]}
              </span>
              <span className="truncate text-xs text-hero-muted">{rangeLabel}</span>
            </div>
            <div
              className={cx(
                "font-display tabular mt-2 text-[44px] leading-none font-extrabold",
                data.period.net > 0 && "text-brand",
                data.period.net < 0 && "text-hero-negative",
              )}
            >
              <AnimatedMoney value={data.period.net} sign />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <HeroStat label="Money in" value={data.period.income} kind="in" />
              <HeroStat label="Money out" value={data.period.expense} kind="out" />
            </div>
          </section>

          {/* Secondary period strip: today, or this month when the hero already shows today */}
          <MiniTotals title={period === "today" ? "Month" : "Today"} totals={period === "today" ? data.month : data.today} />

          <TodayCard />

          <BudgetCard />

          {!data.has_transactions && (
            <EmptyState
              icon={<Plus size={30} strokeWidth={2.5} />}
              title="Record your first spend"
              body="Tap + whenever money comes in or goes out. It takes about five seconds, and it starts your streak."
              action={
                <Button onClick={openQuickAdd}>
                  <Plus size={17} strokeWidth={2.5} /> Add a transaction
                </Button>
              }
            />
          )}

          <Spending data={data} period={period} range={range} />

          {scope.scope !== "personal" && data.businesses.length > 0 && (
            <section>
              <SectionTitle>Businesses</SectionTitle>
              <ListCard>
                {data.businesses.map((b) => (
                  <ListRow
                    key={b.id ?? "none"}
                    leading={<Monogram name={b.name} />}
                    title={b.name}
                    meta={
                      <span className="tabular">
                        {formatGHS(b.income, { compact: true })} in · {formatGHS(b.expense, { compact: true })} out
                      </span>
                    }
                    trailing={
                      <Num tone={b.net > 0 ? "income" : b.net < 0 ? "expense" : "neutral"} className="text-[15.5px]">
                        {formatGHS(b.net, { sign: true })}
                      </Num>
                    }
                  />
                ))}
              </ListCard>
            </section>
          )}

          <Accounts />

          <section>
            <SectionTitle action={<SectionLink href="/transactions">See all</SectionLink>}>Recent</SectionTitle>
            {data.recent.length === 0 ? (
              <Card tone="sunken" className="text-sm text-muted">
                Nothing recorded yet{scope.scope !== "all" ? " for this selection" : ""}.
              </Card>
            ) : (
              <ListCard>
                {data.recent.map((tx) => (
                  <TxRow key={tx.id} tx={tx} showDate />
                ))}
              </ListCard>
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
    <div className="rounded-control bg-white/[0.06] p-3.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-hero-muted">
        <Icon size={15} strokeWidth={2.5} className={kind === "in" ? "text-brand" : "text-hero-negative"} />
        {label}
      </div>
      <div className="font-display tabular mt-1.5 text-[19px] font-bold">
        <AnimatedMoney value={value} />
      </div>
    </div>
  );
}

function MiniTotals({ title, totals }: { title: string; totals: Totals }) {
  return (
    <Card flush className="grid grid-cols-3 divide-x divide-line">
      <div className="px-4 py-3.5">
        <Stat size="sm" label={`${title} in`} value={formatGHS(totals.income)} tone={totals.income > 0 ? "income" : "neutral"} />
      </div>
      <div className="px-4 py-3.5">
        <Stat size="sm" label={`${title} out`} value={formatGHS(totals.expense)} />
      </div>
      <div className="px-4 py-3.5">
        <Stat
          size="sm"
          label="Net"
          value={formatGHS(totals.net, { sign: true })}
          tone={totals.net > 0 ? "income" : totals.net < 0 ? "expense" : "neutral"}
        />
      </div>
    </Card>
  );
}

function Spending({ data, period, range }: { data: Overview; period: Period; range: { from: string; to: string } }) {
  const total = data.categories.reduce((s, c) => s + c.total, 0);
  const qs = `period=${period}${period === "custom" ? `&from=${range.from}&to=${range.to}` : ""}`;
  const top = data.categories.slice(0, SHARE_RAMP.length);
  return (
    <section>
      <SectionTitle action={total > 0 && <Num className="text-[15px]">{formatGHS(total)}</Num>}>Where your money went</SectionTitle>
      {data.categories.length === 0 ? (
        <Card tone="sunken" className="text-sm text-muted">
          No spending recorded for {PERIOD_NAME[period].toLowerCase()}.
        </Card>
      ) : (
        <ListCard>
          {/* Share of spending: biggest slice darkest */}
          <div className="px-4 pt-4 pb-3">
            <div className="flex h-3 gap-[3px] overflow-hidden rounded-full">
              {top.map((c, i) => (
                <div key={c.id} style={{ width: `${(c.total / total) * 100}%`, background: SHARE_RAMP[i], minWidth: 6 }} />
              ))}
            </div>
          </div>
          {data.categories.map((c, i) => {
            const share = (c.total / total) * 100;
            const pct = share < 1 ? "<1" : Math.round(share);
            return (
              <ListRow
                key={c.id}
                href={`/transactions?category_id=${c.id}&${qs}`}
                leading={
                  <span className="relative">
                    <Glyph icon={categoryIcon(c.name)} size={40} />
                    {i < top.length && (
                      <span
                        className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-surface"
                        style={{ background: SHARE_RAMP[i] }}
                      />
                    )}
                  </span>
                }
                title={c.name}
                meta={`${pct}% of spending`}
                trailing={<Num className="text-[15.5px]">{formatGHS(c.total)}</Num>}
              />
            );
          })}
        </ListCard>
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
        hint="Opening balance + what you've recorded. Not linked to your real MoMo or bank."
        action={<SectionLink href="/settings#accounts">Manage</SectionLink>}
      >
        Accounts
      </SectionTitle>
      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] md:px-0">
        <Card tone="ink" className="w-40 shrink-0 snap-start md:w-auto">
          <div className="eyebrow" style={{ color: "var(--hero-muted)" }}>
            Total
          </div>
          <div className="font-display tabular mt-7 text-[19px] font-bold">{formatGHS(data.total_balance)}</div>
        </Card>
        {accounts.map((a) => (
          <Card key={a.id} className="w-40 shrink-0 snap-start md:w-auto">
            <div className="flex items-center gap-2">
              <Glyph icon={ACCOUNT_ICON[a.account_type]} size={28} />
              <span className="truncate text-[13px] font-semibold">{a.name}</span>
            </div>
            <Num tone={a.balance < 0 ? "expense" : "neutral"} className="mt-4 block text-[19px]">
              {formatGHS(a.balance)}
            </Num>
          </Card>
        ))}
      </div>
    </section>
  );
}

function BudgetCard() {
  const { data } = useBudgets();
  if (!data) return null;
  const b = data.data.find((x) => !x.category && x.scope === "all") ?? data.data.find((x) => !x.category);
  if (!b) {
    return (
      <LinkCard href="/plan" tone="dashed">
        <div className="flex items-center gap-3">
          <Glyph icon={Target} size={40} />
          <span>
            <span className="block text-[15px] font-bold">Set a monthly budget</span>
            <span className="block text-[13px] text-muted">See what you can spend each day and week</span>
          </span>
        </div>
      </LinkCard>
    );
  }
  const tone = meterTone(b.spent, b.amount, b.expected_by_now);
  return (
    <Link href="/plan" className="block rounded-card border border-line bg-surface p-5 transition-colors hover:border-ink/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="eyebrow">Budget left this month</div>
          <Num tone={b.remaining < 0 ? "expense" : "neutral"} className="mt-1 block text-[28px] leading-tight font-extrabold">
            {b.remaining < 0 ? `${formatGHS(-b.remaining)} over` : formatGHS(b.remaining)}
          </Num>
        </div>
        <ToneTag tone={tone} />
      </div>
      <div className="mt-4">
        <Meter value={b.spent} max={b.amount} tone={tone} pace={b.expected_by_now} height={12} />
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted">
        <span className="tabular">{formatGHS(b.spent, { compact: true })} spent</span>
        <span className="tabular">of {formatGHS(b.amount, { compact: true })}</span>
      </div>
      {b.daily_allowance !== null && b.remaining > 0 && (
        <div className="mt-4 rounded-control bg-surface-2 px-3.5 py-2.5 text-[13px] text-muted">
          About <span className="font-bold text-ink">{formatGHS(b.daily_allowance)}</span> a day for the next {data.days_left} days · today{" "}
          {formatGHS(b.spent_today ?? 0, { compact: true })} of {formatGHS(b.daily, { compact: true })}
        </div>
      )}
    </Link>
  );
}
