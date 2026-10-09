"use client";

import { timeLabel } from "@/lib/dates";
import { formatGHS } from "@/lib/money";
import type { Transaction } from "@/lib/types";
import { useQuickAdd } from "./quick-add";
import { cx } from "./ui";

export function TxRow({ tx, showDate }: { tx: Transaction; showDate?: boolean }) {
  const { openEdit } = useQuickAdd();
  const title =
    tx.type === "transfer" ? `${tx.account.name} → ${tx.to_account?.name ?? "?"}` : tx.description || tx.category?.name || "—";
  const meta = [
    tx.type === "transfer" ? "Transfer" : tx.description ? tx.category?.name : null,
    tx.scope === "business" ? tx.business?.name ?? "Business" : "Personal",
    tx.type !== "transfer" ? tx.account.name : null,
    showDate
      ? new Date(tx.occurred_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + " " + timeLabel(tx.occurred_at)
      : timeLabel(tx.occurred_at),
  ].filter(Boolean);

  return (
    <button
      type="button"
      onClick={() => openEdit(tx)}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
    >
      <span
        aria-hidden
        className={cx(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
          tx.type === "income" && "bg-income-soft text-income",
          tx.type === "expense" && "bg-expense-soft text-expense",
          tx.type === "transfer" && "bg-transfer-soft text-transfer",
        )}
      >
        {tx.type === "income" ? "↓" : tx.type === "expense" ? "↑" : "⇄"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{title}</span>
        <span className="block truncate text-xs text-muted">{meta.join(" · ")}</span>
      </span>
      <span
        className={cx(
          "tabular shrink-0 text-[15px] font-semibold",
          tx.type === "income" && "text-income",
          tx.type === "expense" && "text-ink",
          tx.type === "transfer" && "text-muted",
        )}
      >
        <span className="sr-only">{tx.type}</span>
        {tx.type === "income" ? "+" : tx.type === "expense" ? "−" : ""}
        {formatGHS(tx.amount).replace("GH₵ ", "GH₵ ")}
      </span>
    </button>
  );
}
