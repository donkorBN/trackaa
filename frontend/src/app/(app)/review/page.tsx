"use client";

import { Check, Plus } from "lucide-react";
import useSWR from "swr";
import { useState } from "react";
import { useQuickAdd } from "@/components/quick-add";
import { useToast } from "@/components/toast";
import { TxRow } from "@/components/TxRow";
import { Card, cx, ErrorBox, Eyebrow, SectionTitle, Skeleton, Spinner } from "@/components/ui";
import { api, fetcher, withQuery } from "@/lib/api";
import { deviceTimezone, ymd } from "@/lib/dates";
import { useMe, useOverview } from "@/lib/hooks";
import { formatGHS } from "@/lib/money";
import type { TransactionPage, User } from "@/lib/types";

const CHECKLIST = [
  "Transport: trotro, taxi, Uber, Bolt, fuel",
  "Food, drinks and snacks",
  "MoMo fees, airtime and data",
  "Sales or payments you received",
  "Stock, deliveries and other business costs",
];

export default function ReviewPage() {
  const { openQuickAdd } = useQuickAdd();
  const toast = useToast();
  const today = ymd(new Date());
  const { data: me, mutate: mutateMe } = useMe();
  const [saving, setSaving] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const overview = useOverview({ period: "today", tz: deviceTimezone() });
  const list = useSWR<TransactionPage>(withQuery("/transactions", { from: today, to: today, tz: deviceTimezone(), per_page: 200 }), fetcher);
  const done = me?.last_reviewed_on === today;
  const t = overview.data?.today;

  async function markDone() {
    setSaving(true);
    try {
      await mutateMe(api<User>("/review", { method: "POST", body: { date: today } }), { revalidate: false });
      toast({ message: "Nice. Today is fully recorded." });
    } catch (err) {
      toast({ message: (err as Error).message, tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="pt-1">
        <Eyebrow>{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</Eyebrow>
        <h1 className="mt-0.5 text-[28px] leading-tight font-bold tracking-tight">Today&apos;s review</h1>
        <p className="mt-1 text-sm text-muted">Thirty seconds now saves guessing later.</p>
      </header>

      {t ? (
        <Card flush className="grid grid-cols-3 divide-x divide-line">
          {[
            { l: "In", v: formatGHS(t.income), c: "text-income" },
            { l: "Out", v: formatGHS(t.expense), c: "" },
            { l: "Net", v: formatGHS(t.net, { sign: true }), c: t.net > 0 ? "text-income" : t.net < 0 ? "text-expense" : "" },
          ].map((s) => (
            <div key={s.l} className="px-4 py-3.5">
              <div className="text-xs text-muted">{s.l}</div>
              <div className={cx("tabular mt-1 truncate text-[15px] font-semibold", s.c)}>{s.v}</div>
            </div>
          ))}
        </Card>
      ) : (
        <Skeleton className="h-20" />
      )}

      <section>
        <SectionTitle>Did you forget any of these?</SectionTitle>
        <Card flush className="divide-y divide-line overflow-hidden">
          {CHECKLIST.map((c, i) => {
            const on = checked.has(i);
            return (
              <button
                key={c}
                type="button"
                onClick={() => setChecked((s) => (s.has(i) ? new Set([...s].filter((x) => x !== i)) : new Set(s).add(i)))}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] hover:bg-surface-2"
              >
                <span className={cx("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition", on ? "border-income bg-income text-white" : "border-line")}>
                  {on && <Check size={14} strokeWidth={3} />}
                </span>
                <span className={cx(on && "text-muted line-through")}>{c}</span>
              </button>
            );
          })}
        </Card>
        <button
          type="button"
          onClick={openQuickAdd}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-surface text-[15px] font-semibold hover:bg-surface-2"
        >
          <Plus size={18} /> Add something I forgot
        </button>
      </section>

      <section>
        <SectionTitle>Recorded today</SectionTitle>
        {list.error && <ErrorBox error={list.error} onRetry={() => list.mutate()} />}
        {!list.data && !list.error ? (
          <Skeleton className="h-32" />
        ) : list.data && list.data.data.length === 0 ? (
          <Card className="text-sm text-muted">Nothing recorded today yet.</Card>
        ) : (
          <Card flush className="divide-y divide-line overflow-hidden">
            {list.data?.data.map((tx) => (
              <TxRow key={tx.id} tx={tx} />
            ))}
          </Card>
        )}
      </section>

      <button
        type="button"
        disabled={done || saving || !me}
        onClick={markDone}
        className={cx(
          "flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[16px] font-semibold transition",
          done ? "bg-income-soft text-income" : "bg-accent text-accent-fg active:scale-[0.99]",
        )}
      >
        {saving ? <Spinner /> : done ? <Check size={20} strokeWidth={2.5} /> : null}
        {done ? "Today is reviewed" : "Everything is recorded"}
      </button>
    </div>
  );
}
