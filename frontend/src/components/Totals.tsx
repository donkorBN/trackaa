import { formatGHS } from "@/lib/money";
import type { Totals } from "@/lib/types";
import { cx } from "./ui";

export function NetFigure({ value, size = "lg" }: { value: number; size?: "lg" | "md" }) {
  return (
    <div
      className={cx(
        "tabular font-bold tracking-tight",
        size === "lg" ? "text-3xl" : "text-2xl",
        value > 0 ? "text-income" : value < 0 ? "text-expense" : "text-ink",
      )}
    >
      {formatGHS(value, { sign: true })}
    </div>
  );
}

export function InOut({ totals }: { totals: Totals }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
      <div className="rounded-xl bg-income-soft px-3 py-2">
        <div className="text-xs text-muted">Money in</div>
        <div className="tabular font-semibold text-income">{formatGHS(totals.income)}</div>
      </div>
      <div className="rounded-xl bg-expense-soft px-3 py-2">
        <div className="text-xs text-muted">Money out</div>
        <div className="tabular font-semibold text-expense">{formatGHS(totals.expense)}</div>
      </div>
    </div>
  );
}

export function TotalsCard({ title, totals }: { title: string; totals: Totals }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{title} · net cash flow</div>
      <div className="mt-1">
        <NetFigure value={totals.net} />
      </div>
      <InOut totals={totals} />
    </div>
  );
}
