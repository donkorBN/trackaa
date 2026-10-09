"use client";

import { ArrowDownRight, ArrowUpRight, Lightbulb, Minus } from "lucide-react";
import { useState } from "react";
import { ChartCard, ColumnChart, FlowChart, LegendKey } from "@/components/charts";
import { ScopePicker, scopeQuery, type ScopeValue } from "@/components/ScopePicker";
import { Card, cx, ErrorBox, Eyebrow, SectionTitle, Segmented, Skeleton } from "@/components/ui";
import { shortDate } from "@/lib/dates";
import { useBudgets, useInsights } from "@/lib/hooks";
import { formatGHS } from "@/lib/money";
import type { Insights } from "@/lib/types";
import { categoryVisual, IconBubble } from "@/lib/visuals";

const monthLabel = (ym: string, opts: Intl.DateTimeFormatOptions = { month: "short" }) =>
  new Date(`${ym}-01T00:00:00`).toLocaleDateString("en-GB", opts);
const WEEKDAY_NAMES: Record<string, string> = {
  Mon: "Mondays",
  Tue: "Tuesdays",
  Wed: "Wednesdays",
  Thu: "Thursdays",
  Fri: "Fridays",
  Sat: "Saturdays",
  Sun: "Sundays",
};

export default function InsightsPage() {
  const [scope, setScope] = useState<ScopeValue>({ scope: "all", businessId: null });
  const [months, setMonths] = useState<"3" | "6" | "12">("6");
  const { data, error, mutate, isValidating } = useInsights({ ...scopeQuery(scope), months });
  const budgets = useBudgets();
  const overall = budgets.data?.data.find((b) => !b.category && (b.scope === "all" || b.scope === scope.scope));

  return (
    <div className="space-y-6">
      <header className="pt-1">
        <Eyebrow>Trends and patterns</Eyebrow>
        <h1 className="mt-0.5 text-[28px] leading-tight font-bold tracking-tight">Insights</h1>
      </header>

      {/* One filter row scopes everything below */}
      <div className="space-y-2.5">
        <ScopePicker value={scope} onChange={setScope} />
        <Segmented
          size="sm"
          value={months}
          onChange={setMonths}
          options={[
            { value: "3", label: "3 months" },
            { value: "6", label: "6 months" },
            { value: "12", label: "12 months" },
          ]}
        />
      </div>

      {error && <ErrorBox error={error} onRetry={() => mutate()} />}
      {!data ? (
        <div className="space-y-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-72" />
          <Skeleton className="h-60" />
        </div>
      ) : (
        <div className={cx("space-y-6 transition-opacity", isValidating && "opacity-60")}>
          <Stats data={data} />
          <Highlights data={data} dailyBudget={overall?.daily} />

          <ChartCard
            title="Money in and out"
            subtitle="By month. Bars above the line are money in, below are money out."
            legend={
              <>
                <LegendKey color="var(--income)" label="Money in" />
                <LegendKey color="var(--expense)" label="Money out" />
                <LegendKey color="var(--text)" label="Net" kind="dot" />
              </>
            }
            table={{
              headers: ["Month", "In", "Out", "Net"],
              rows: data.months.map((m) => [
                monthLabel(m.month, { month: "long", year: "numeric" }),
                formatGHS(m.income),
                formatGHS(m.expense),
                formatGHS(m.net, { sign: true }),
              ]),
            }}
          >
            <FlowChart
              data={data.months.map((m) => ({
                key: m.month,
                label: monthLabel(m.month),
                title: monthLabel(m.month, { month: "long", year: "numeric" }),
                income: m.income,
                expense: m.expense,
                net: m.net,
              }))}
            />
          </ChartCard>

          <ChartCard
            title={`Daily spending · ${monthLabel(data.daily[0]?.date.slice(0, 7) ?? "", { month: "long" })}`}
            subtitle={
              overall
                ? `The line is your daily budget of ${formatGHS(overall.daily)}.`
                : "Set a budget in Plan to see your daily limit here."
            }
            table={{
              headers: ["Day", "Spent"],
              rows: data.daily.filter((d) => d.expense > 0).map((d) => [shortDate(d.date), formatGHS(d.expense)]),
            }}
          >
            <ColumnChart
              data={data.daily.map((d) => ({
                key: d.date,
                label: String(Number(d.date.slice(8))),
                title: shortDate(d.date),
                value: d.expense,
              }))}
              reference={overall ? { value: overall.daily, label: "Daily budget" } : undefined}
              labelEvery={5}
            />
          </ChartCard>

          <WeekdayChart data={data} />
          <CategoryChanges data={data} />
          <TopExpenses data={data} />
        </div>
      )}
    </div>
  );
}

function Stats({ data }: { data: Insights }) {
  const s = data.stats;
  const tiles = [
    { label: "Average daily spend", value: formatGHS(s.average_daily_spend), note: `This month, ${s.day_of_month} days in` },
    { label: "On pace to spend", value: formatGHS(s.projected_month_spend), note: "By the end of the month" },
    {
      label: "Saved this month",
      value: s.savings_rate === null ? "—" : `${s.savings_rate}%`,
      note: s.savings_rate === null ? "No income recorded yet" : "Of money in, kept after spending",
    },
    {
      label: "Usual monthly spend",
      value: s.average_monthly_spend === null ? "—" : formatGHS(s.average_monthly_spend),
      note: "Average of earlier months",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-3xl border border-line bg-surface p-4 shadow-card">
          <div className="text-xs text-muted">{t.label}</div>
          <div className="mt-1.5 text-[17px] leading-tight font-bold tracking-tight break-words">{t.value}</div>
          <div className="mt-1 text-[11px] text-subtle">{t.note}</div>
        </div>
      ))}
    </div>
  );
}

/** Plain-language patterns pulled from the numbers. */
function Highlights({ data, dailyBudget }: { data: Insights; dailyBudget?: number }) {
  const s = data.stats;
  const notes: string[] = [];
  if (s.average_monthly_spend && s.projected_month_spend && s.day_of_month >= 5) {
    const diff = Math.round(((s.projected_month_spend - s.average_monthly_spend) / s.average_monthly_spend) * 100);
    if (Math.abs(diff) >= 10)
      notes.push(
        `You're on pace to spend ${formatGHS(s.projected_month_spend)} this month, ${Math.abs(diff)}% ${diff > 0 ? "more" : "less"} than usual.`,
      );
  }
  const top = [...data.weekdays].sort((a, b) => b.average - a.average)[0];
  if (top && top.average > 0)
    notes.push(`You spend the most on ${WEEKDAY_NAMES[top.label]}: about ${formatGHS(top.average)} on an average one.`);
  const up = [...data.categories].filter((c) => c.last_month_to_date > 0).sort((a, b) => b.change - a.change)[0];
  if (up && up.change > 0) notes.push(`${up.name} is up ${formatGHS(up.change)} compared with this point last month.`);
  const down = [...data.categories].sort((a, b) => a.change - b.change)[0];
  if (down && down.change < 0) notes.push(`${down.name} is down ${formatGHS(-down.change)} compared with this point last month.`);
  if (dailyBudget) {
    const over = data.daily.filter((d) => d.expense > dailyBudget).length;
    if (over > 0) notes.push(`You went over your daily budget on ${over} day${over === 1 ? "" : "s"} this month.`);
  }
  if (!notes.length) return null;
  return (
    <Card>
      <div className="flex items-center gap-2 text-[15px] font-semibold">
        <Lightbulb size={17} className="text-[#d97706]" /> What stands out
      </div>
      <ul className="mt-3 space-y-2 text-sm">
        {notes.slice(0, 4).map((n) => (
          <li key={n} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted" />
            {n}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function WeekdayChart({ data }: { data: Insights }) {
  const max = Math.max(...data.weekdays.map((w) => w.average));
  const top = data.weekdays.find((w) => w.average === max && max > 0);
  return (
    <ChartCard
      title="Spending by day of the week"
      subtitle={
        top ? `Average over the last 90 days. ${WEEKDAY_NAMES[top.label]} are your biggest days.` : "Average over the last 90 days."
      }
      table={{ headers: ["Day", "Average", "Total"], rows: data.weekdays.map((w) => [w.label, formatGHS(w.average), formatGHS(w.total)]) }}
    >
      <ColumnChart
        data={data.weekdays.map((w) => ({ key: w.label, label: w.label, title: `Average ${w.label}`, value: w.average }))}
        emphasis={top ? [top.label] : undefined}
        color="var(--transfer)"
        valueLabel="on average"
        height={160}
      />
    </ChartCard>
  );
}

function CategoryChanges({ data }: { data: Insights }) {
  if (!data.categories.length) return null;
  return (
    <section>
      <SectionTitle>Compared with last month</SectionTitle>
      <p className="-mt-2 mb-3 px-1 text-xs text-muted">This month so far vs the same number of days last month.</p>
      <Card flush className="divide-y divide-line overflow-hidden">
        {data.categories.slice(0, 8).map((c) => {
          const v = categoryVisual(c.name);
          const pct = c.last_month_to_date > 0 ? Math.round((c.change / c.last_month_to_date) * 100) : null;
          const Icon = c.change > 0 ? ArrowUpRight : c.change < 0 ? ArrowDownRight : Minus;
          return (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3">
              <IconBubble Icon={v.Icon} color={v.color} size={36} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-medium">{c.name}</div>
                <div className="tabular text-xs text-muted">Last month at this point: {formatGHS(c.last_month_to_date)}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="tabular text-[15px] font-semibold">{formatGHS(c.this_month)}</div>
                <div
                  className={cx(
                    "tabular inline-flex items-center gap-0.5 text-xs font-medium",
                    c.change > 0 ? "text-expense" : c.change < 0 ? "text-income" : "text-muted",
                  )}
                >
                  <Icon size={13} />
                  {pct === null ? (c.this_month > 0 ? "new" : "—") : `${Math.abs(pct)}% ${c.change >= 0 ? "more" : "less"}`}
                </div>
              </div>
            </div>
          );
        })}
      </Card>
    </section>
  );
}

function TopExpenses({ data }: { data: Insights }) {
  if (!data.top_expenses.length) return null;
  return (
    <section>
      <SectionTitle>Biggest expenses this month</SectionTitle>
      <Card flush className="divide-y divide-line overflow-hidden">
        {data.top_expenses.map((t) => {
          const v = categoryVisual(t.category);
          return (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3">
              <IconBubble Icon={v.Icon} color={v.color} size={36} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-medium">{t.description || t.category}</div>
                <div className="text-xs text-muted">
                  {t.description ? `${t.category} · ` : ""}
                  {new Date(t.occurred_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </div>
              </div>
              <div className="tabular shrink-0 text-[15px] font-semibold">−{formatGHS(t.amount)}</div>
            </div>
          );
        })}
      </Card>
    </section>
  );
}
