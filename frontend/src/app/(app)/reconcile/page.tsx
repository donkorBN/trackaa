"use client";

import { CheckCircle2, ChevronRight, CircleDashed, FileSpreadsheet, ShieldCheck, Upload } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";
import { buttonClass, Card, EmptyState, ErrorBox, Glyph, ListCard, PageHeader, ProgressBar, SectionTitle, Skeleton, Tag } from "@/components/ui";
import { fetcher } from "@/lib/api";
import { monthName } from "@/lib/dates";
import type { StatementListItem } from "@/lib/types";

export default function ReconcilePage() {
  const { data, error, mutate } = useSWR<{ data: StatementListItem[] }>("/statements", fetcher);
  const empty = data?.data.length === 0;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Plan"
        title="Reconcile"
        actions={
          // The empty state carries the neon action; keep one primary per view.
          <Link href="/reconcile/import" className={buttonClass(empty ? "secondary" : "primary", "sm")}>
            <Upload size={16} /> Import
          </Link>
        }
      />

      <Card>
        <h2 className="text-[17px] leading-tight font-bold text-ink">Check your records against your statement</h2>
        <ol className="mt-3 space-y-2.5 text-[14px] text-muted">
          {[
            "Download your MoMo or bank statement for a month (CSV, Excel or PDF).",
            "Import it here and pick the account it belongs to.",
            "We match each line to what you recorded and show what's missing on either side.",
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="font-display tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[12px] font-bold text-ink">
                {i + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 flex items-center gap-1.5 border-t border-line pt-3 text-[12.5px] text-muted">
          <ShieldCheck size={14} className="shrink-0" /> The file is read on your device. Only the transaction lines are saved.
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
            <Link href="/reconcile/import" className={buttonClass("primary", "md")}>
              <Upload size={16} /> Import a statement
            </Link>
          }
        />
      ) : (
        <section>
          <SectionTitle>Statements</SectionTitle>
          <ListCard>
            {data.data.map((s) => (
              <Link key={s.id} href={`/reconcile/view/?id=${s.id}`} className="group block px-4 py-3.5 transition-colors hover:bg-surface-2">
                <div className="flex items-center gap-3">
                  <Glyph icon={FileSpreadsheet} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold text-ink">
                      {s.account.name} · {monthName(s.period)}
                    </div>
                    <div className="mt-0.5 truncate text-[12.5px] text-muted">
                      {s.matched} of {s.line_count} lines matched
                    </div>
                  </div>
                  {s.unmatched ? (
                    <Tag tone="warn" icon={CircleDashed}>
                      {s.unmatched} to review
                    </Tag>
                  ) : (
                    <Tag tone="good" icon={CheckCircle2}>
                      All done
                    </Tag>
                  )}
                  <ChevronRight size={18} className="shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" />
                </div>
                <div className="mt-3 pl-[52px]">
                  <ProgressBar
                    value={s.matched}
                    max={s.line_count}
                    tone={s.unmatched ? "warn" : "brand"}
                    size="sm"
                    label={`${s.account.name} ${monthName(s.period)} matched`}
                  />
                </div>
              </Link>
            ))}
          </ListCard>
        </section>
      )}
    </div>
  );
}
