"use client";

import { ChevronRight, FileSpreadsheet, ShieldCheck, Upload } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";
import { Meter } from "@/components/charts";
import { Card, EmptyState, ErrorBox, Eyebrow, Skeleton } from "@/components/ui";
import { fetcher } from "@/lib/api";
import { monthName } from "@/lib/dates";
import type { StatementListItem } from "@/lib/types";

export default function ReconcilePage() {
  const { data, error, mutate } = useSWR<{ data: StatementListItem[] }>("/statements", fetcher);
  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 pt-1">
        <div>
          <Eyebrow>Plan</Eyebrow>
          <h1 className="mt-0.5 text-[28px] leading-tight font-bold tracking-tight">Reconcile</h1>
        </div>
        <Link
          href="/reconcile/import"
          className="pop inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-brand-ink"
        >
          <Upload size={16} /> Import
        </Link>
      </header>

      <Card className="text-sm">
        <p className="font-semibold">Check your records against your statement</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
          <li>Download your MoMo or bank statement for a month (CSV, Excel or PDF).</li>
          <li>Import it here and pick the account it belongs to.</li>
          <li>We match each line to what you recorded and show what&apos;s missing on either side.</li>
        </ol>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
          <ShieldCheck size={14} /> The file is read on your device. Only the transaction lines are saved.
        </p>
      </Card>

      {error && <ErrorBox error={error} onRetry={() => mutate()} />}
      {!data ? (
        <Skeleton className="h-40" />
      ) : data.data.length === 0 ? (
        <EmptyState
          icon={<FileSpreadsheet size={30} />}
          title="Check your MoMo statement"
          body="Import last month's statement and we'll show anything you forgot to record."
          action={
            <Link href="/reconcile/import" className="pop inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold text-brand-ink">
              <Upload size={16} /> Import a statement
            </Link>
          }
        />
      ) : (
        <Card flush className="divide-y divide-line overflow-hidden">
          {data.data.map((s) => (
            <Link key={s.id} href={`/reconcile/view/?id=${s.id}`} className="block px-4 py-3.5 hover:bg-surface-2">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium">
                    {s.account.name} · {monthName(s.period)}
                  </div>
                  <div className="text-xs text-muted">
                    {s.matched} of {s.line_count} matched{s.unmatched ? ` · ${s.unmatched} to review` : " · all done"}
                  </div>
                </div>
                <ChevronRight size={18} className="shrink-0 text-subtle" />
              </div>
              <div className="mt-2">
                <Meter value={s.matched} max={s.line_count} tone={s.unmatched ? "warn" : "good"} height={5} />
              </div>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
