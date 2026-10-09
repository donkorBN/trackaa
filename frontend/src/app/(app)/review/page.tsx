"use client";

import useSWR from "swr";
import { useState } from "react";
import { useQuickAdd } from "@/components/quick-add";
import { TotalsCard } from "@/components/Totals";
import { TxRow } from "@/components/TxRow";
import { Card, ErrorBox, Skeleton } from "@/components/ui";
import { fetcher, withQuery } from "@/lib/api";
import { deviceTimezone, ymd } from "@/lib/dates";
import { useOverview } from "@/lib/hooks";
import { markReviewed, reviewedOn } from "@/lib/prefs";
import type { TransactionPage } from "@/lib/types";

const CHECKLIST = [
  "Transport, trotro, Uber, fuel",
  "Food, drinks, snacks",
  "MoMo fees and airtime/data",
  "Sales or payments you received",
  "Business purchases, stock, deliveries",
];

export default function ReviewPage() {
  const { openQuickAdd } = useQuickAdd();
  const today = ymd(new Date());
  const [done, setDone] = useState(() => (typeof window !== "undefined" ? reviewedOn() === today : false));
  const overview = useOverview({ period: "today", tz: deviceTimezone() });
  const list = useSWR<TransactionPage>(withQuery("/transactions", { from: today, to: today, tz: deviceTimezone(), per_page: 200 }), fetcher);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Today&apos;s review</h1>
        <p className="mt-1 text-sm text-muted">Take 30 seconds: is anything missing from today?</p>
      </div>

      {overview.data ? <TotalsCard title="Today" totals={overview.data.today} /> : <Skeleton className="h-36" />}

      <Card>
        <div className="text-sm font-semibold">Did you forget any of these?</div>
        <ul className="mt-2 space-y-1 text-sm text-muted">
          {CHECKLIST.map((c) => (
            <li key={c}>• {c}</li>
          ))}
        </ul>
        <button type="button" onClick={openQuickAdd} className="mt-4 w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-fg">
          + Add something I forgot
        </button>
      </Card>

      <section>
        <h2 className="mb-2 text-base font-semibold">Recorded today</h2>
        {list.error && <ErrorBox error={list.error} onRetry={() => list.mutate()} />}
        {!list.data && !list.error ? (
          <Skeleton className="h-24" />
        ) : list.data && list.data.data.length === 0 ? (
          <p className="text-sm text-muted">Nothing recorded today yet.</p>
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
        disabled={done}
        onClick={() => {
          markReviewed(today);
          setDone(true);
        }}
        className="w-full rounded-xl border border-line bg-surface py-3 text-sm font-semibold disabled:text-income"
      >
        {done ? "✓ Today is reviewed" : "Everything is recorded"}
      </button>
    </div>
  );
}
