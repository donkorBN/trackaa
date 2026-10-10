"use client";

import { timeLabel } from "@/lib/dates";
import { formatGHS } from "@/lib/money";
import type { Transaction } from "@/lib/types";
import { categoryIcon, TransferIcon } from "@/lib/visuals";
import { useQuickAdd } from "./quick-add";
import { cx, Glyph } from "./ui";

export function TxRow({ tx, showDate }: { tx: Transaction; showDate?: boolean }) {
  const { openEdit } = useQuickAdd();
  const isTransfer = tx.type === "transfer";
  const Icon = isTransfer ? TransferIcon : categoryIcon(tx.category?.name);
  const title = isTransfer ? `${tx.account.name} → ${tx.to_account?.name ?? "?"}` : tx.description || tx.category?.name || "—";
  const when = showDate
    ? new Date(tx.occurred_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + ", " + timeLabel(tx.occurred_at)
    : timeLabel(tx.occurred_at);
  const meta = [
    isTransfer ? "Transfer" : tx.description ? tx.category?.name : null,
    tx.scope === "business" ? tx.business?.name ?? "Business" : null,
    isTransfer ? null : tx.account.name,
    when,
  ].filter(Boolean);

  return (
    <button
      type="button"
      onClick={() => openEdit(tx)}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2 active:bg-surface-2"
    >
      <Glyph icon={Icon} size={42} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{title}</span>
        <span className="mt-0.5 block truncate text-[12.5px] text-muted">{meta.join(" · ")}</span>
      </span>
      <span
        className={cx(
          "font-display tabular shrink-0 text-[15.5px] font-bold",
          tx.type === "income" && "text-income",
          tx.type === "transfer" && "text-muted",
        )}
      >
        <span className="sr-only">{tx.type} </span>
        {tx.type === "income" ? "+" : tx.type === "expense" ? "−" : ""}
        {formatGHS(tx.amount).replace("GH₵ ", "GH₵ ")}
      </span>
    </button>
  );
}
