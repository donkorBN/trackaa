"use client";

import { Check, Flame, Plus } from "lucide-react";
import useSWR from "swr";
import { useState } from "react";
import { useQuickAdd } from "@/components/quick-add";
import { useToast } from "@/components/toast";
import { TxRow } from "@/components/TxRow";
import { Button, Card, cx, ErrorBox, ListCard, PageHeader, SectionTitle, Skeleton, Spinner, Stat } from "@/components/ui";
import { api, fetcher, withQuery } from "@/lib/api";
import { deviceTimezone, ymd } from "@/lib/dates";
import { useMe, useOverview, useRefreshAll } from "@/lib/hooks";
import { confetti, haptic } from "@/lib/feedback";
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
  const refreshAll = useRefreshAll();
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
      refreshAll(); // streak + badges
      haptic.success();
      confetti("small");
      toast({ message: "Nice. Today is fully recorded and counts towards your streak" });
    } catch (err) {
      toast({ message: (err as Error).message, tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <PageHeader
          eyebrow={new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          title={"Today's review"}
        />
        <p className="mt-2 text-[14.5px] text-muted">Thirty seconds now saves guessing later.</p>
      </div>

      {t ? (
        <Card className="grid grid-cols-3 gap-3">
          <Stat label="In" value={formatGHS(t.income)} tone="income" size="sm" />
          <Stat label="Out" value={formatGHS(t.expense)} size="sm" />
          <Stat label="Net" value={formatGHS(t.net, { sign: true })} tone={t.net > 0 ? "income" : t.net < 0 ? "expense" : "neutral"} size="sm" />
        </Card>
      ) : (
        <Skeleton className="h-20" />
      )}

      <section>
        <SectionTitle>Did you forget any of these?</SectionTitle>
        <ListCard>
          {CHECKLIST.map((c, i) => {
            const on = checked.has(i);
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() => setChecked((s) => (s.has(i) ? new Set([...s].filter((x) => x !== i)) : new Set(s).add(i)))}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] font-semibold text-ink transition-colors hover:bg-surface-2"
              >
                <span
                  className={cx(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    on ? "border-brand-ink bg-brand text-brand-ink" : "border-line bg-surface",
                  )}
                >
                  {on && <Check size={14} strokeWidth={3} />}
                </span>
                <span className={cx(on && "font-medium text-muted line-through")}>{c}</span>
              </button>
            );
          })}
        </ListCard>
        <Button variant="secondary" size="lg" className="mt-3 w-full" onClick={openQuickAdd}>
          <Plus size={18} /> Add something I forgot
        </Button>
      </section>

      <section>
        <SectionTitle>Recorded today</SectionTitle>
        {list.error && <ErrorBox error={list.error} onRetry={() => list.mutate()} />}
        {!list.data && !list.error ? (
          <Skeleton className="h-32" />
        ) : list.data && list.data.data.length === 0 ? (
          <Card tone="dashed" className="text-center text-[14px] text-muted">
            Nothing recorded today yet.
          </Card>
        ) : (
          <ListCard>
            {list.data?.data.map((tx) => (
              <TxRow key={tx.id} tx={tx} />
            ))}
          </ListCard>
        )}
      </section>

      {done ? (
        <button
          type="button"
          disabled
          className="flex h-14 w-full items-center justify-center gap-2 rounded-control bg-hero text-[15px] font-bold text-brand"
        >
          <Check size={20} strokeWidth={2.5} /> Today is checked in
          <Flame size={18} fill="currentColor" aria-hidden />
        </button>
      ) : (
        <Button size="lg" className="h-14 w-full text-[16px]" disabled={saving || !me} onClick={markDone}>
          {saving && <Spinner />}
          That’s everything for today
        </Button>
      )}
    </div>
  );
}
