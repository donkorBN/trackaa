"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { toLocalInput } from "@/lib/dates";
import { useAccounts, useBusinesses, useCategories, useRefreshAll } from "@/lib/hooks";
import { formatGHS, parseAmount, toInputString } from "@/lib/money";
import { loadDefaults, saveDefaults } from "@/lib/prefs";
import type { Ref, Scope, Transaction, TxInput, TxType } from "@/lib/types";
import { useToast } from "./toast";
import { Chip, cx, Input, Label, Segmented, Spinner } from "./ui";

const TYPE_OPTIONS: { value: TxType; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfer" },
];

function newRef() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16),
      );
}

/** Ensure a referenced-but-archived item still shows when editing an old transaction. */
function withRef<T extends { id: number; name: string }>(list: T[], ref: Ref | null | undefined): (T | Ref)[] {
  if (!ref || list.some((x) => x.id === ref.id)) return list;
  return [...list, ref];
}

export function TransactionForm({ tx, onDone }: { tx?: Transaction; onDone: () => void }) {
  const editing = !!tx;
  const toast = useToast();
  const refreshAll = useRefreshAll();
  const { accounts, isLoading: la } = useAccounts();
  const { categories, isLoading: lc } = useCategories();
  const { businesses } = useBusinesses();

  const defaults = useMemo(() => (editing ? null : loadDefaults()), [editing]);

  const [type, setType] = useState<TxType>(tx?.type ?? defaults?.type ?? "expense");
  const [amount, setAmount] = useState(tx ? toInputString(tx.amount) : "");
  const [scope, setScope] = useState<Scope>(tx?.scope ?? defaults?.scope ?? "personal");
  const [businessId, setBusinessId] = useState<number | null>(tx ? tx.business?.id ?? null : defaults?.business_id ?? null);
  const [categoryId, setCategoryId] = useState<number | null>(tx?.category?.id ?? null);
  const [accountId, setAccountId] = useState<number | null>(tx?.account.id ?? defaults?.account_id ?? null);
  const [toAccountId, setToAccountId] = useState<number | null>(tx?.to_account?.id ?? defaults?.to_account_id ?? null);
  const [description, setDescription] = useState(tx?.description ?? "");
  const [when, setWhen] = useState<string | null>(tx ? toLocalInput(new Date(tx.occurred_at)) : null);
  const [showMore, setShowMore] = useState(editing);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const busy = useRef(false);
  const clientRef = useRef(newRef());

  const typeCategories = useMemo(
    () => withRef(categories.filter((c) => c.transaction_type === type), tx?.type === type ? tx.category : null),
    [categories, type, tx],
  );
  const accountList = withRef(withRef(accounts, tx?.account), tx?.to_account);
  const businessList = withRef(businesses, tx?.business);

  // Fill sensible defaults once reference data arrives.
  useEffect(() => {
    if (accounts.length && (accountId === null || !accountList.some((a) => a.id === accountId))) {
      setAccountId(accounts[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts]);

  useEffect(() => {
    if (type === "transfer") return;
    if (categoryId !== null && typeCategories.some((c) => c.id === categoryId)) return;
    const remembered = defaults?.category[type];
    setCategoryId(remembered && typeCategories.some((c) => c.id === remembered) ? remembered : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, typeCategories]);

  useEffect(() => {
    if (type !== "transfer") return;
    if (toAccountId === null || toAccountId === accountId) {
      setToAccountId(accounts.find((a) => a.id !== accountId)?.id ?? null);
    }
  }, [type, accountId, toAccountId, accounts]);

  const pesewas = parseAmount(amount);
  const tone = type === "income" ? "income" : type === "expense" ? "expense" : "transfer";

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy.current) return; // prevent double submits
    setError(null);

    if (!pesewas || pesewas <= 0) return setError("Enter an amount greater than zero.");
    if (type !== "transfer" && !categoryId) return setError("Pick a category.");
    if (!accountId) return setError("Pick an account.");
    if (type === "transfer" && (!toAccountId || toAccountId === accountId))
      return setError("Pick two different accounts for a transfer.");

    const body: TxInput = {
      type,
      amount: pesewas,
      scope,
      category_id: type === "transfer" ? null : categoryId,
      account_id: accountId,
      to_account_id: type === "transfer" ? toAccountId : null,
      business_id: scope === "business" ? businessId : null,
      description: description.trim() || null,
      occurred_at: when ? new Date(when).toISOString() : editing ? tx!.occurred_at : null,
    };

    busy.current = true;
    setSaving(true);
    try {
      if (editing) {
        await api(`/transactions/${tx!.id}`, { method: "PATCH", body });
        toast({ message: "Transaction updated" });
      } else {
        const saved = await api<Transaction>("/transactions", { method: "POST", body: { ...body, client_ref: clientRef.current } });
        const prev = loadDefaults();
        saveDefaults({
          type,
          scope,
          account_id: accountId,
          to_account_id: toAccountId,
          business_id: scope === "business" ? businessId : prev.business_id,
          category: type === "transfer" ? prev.category : { ...prev.category, [type]: categoryId },
        });
        clientRef.current = newRef();
        setAmount("");
        setDescription("");
        toast({
          message: `Saved ${formatGHS(saved.amount)} ${type}`,
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                await api(`/transactions/${saved.id}`, { method: "DELETE" });
                toast({ message: "Transaction removed" });
              } catch (err) {
                toast({ message: (err as Error).message, tone: "error" });
              }
              refreshAll();
            },
          },
        });
      }
      refreshAll();
      onDone();
    } catch (err) {
      const e = err as ApiError;
      setError(Object.values(e.fields ?? {})[0]?.[0] ?? e.message);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirmDelete) return setConfirmDelete(true);
    setSaving(true);
    try {
      await api(`/transactions/${tx!.id}`, { method: "DELETE" });
      toast({ message: "Transaction deleted" });
      refreshAll();
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  const loading = la || lc;

  return (
    <form onSubmit={submit} className="space-y-4">
      <Segmented value={type} options={TYPE_OPTIONS} onChange={setType} />

      {/* Amount */}
      <label
        className={cx(
          "flex items-baseline gap-2 rounded-2xl px-4 py-4",
          tone === "income" ? "bg-income-soft text-income" : tone === "expense" ? "bg-expense-soft text-expense" : "bg-transfer-soft text-transfer",
        )}
      >
        <span className="text-xl font-semibold">GH₵</span>
        <input
          autoFocus={!editing}
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          placeholder="0.00"
          aria-label="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
          className="tabular w-full min-w-0 bg-transparent text-4xl font-bold tracking-tight outline-none placeholder:opacity-40"
        />
      </label>

      <div>
        <Label>{type === "transfer" ? "From account" : type === "income" ? "Received into" : "Paid from"}</Label>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          {accountList.map((a) => (
            <Chip key={a.id} active={accountId === a.id} onClick={() => setAccountId(a.id)}>
              {a.name}
            </Chip>
          ))}
        </div>
      </div>

      {type === "transfer" && (
        <div>
          <Label>To account</Label>
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
            {accountList
              .filter((a) => a.id !== accountId)
              .map((a) => (
                <Chip key={a.id} active={toAccountId === a.id} onClick={() => setToAccountId(a.id)}>
                  {a.name}
                </Chip>
              ))}
          </div>
          <p className="mt-2 text-xs text-muted">Transfers move money between your accounts. They don&apos;t count as income or spending.</p>
        </div>
      )}

      {/* Scope + business */}
      <div>
        <Segmented
          value={scope}
          onChange={setScope}
          options={[
            { value: "personal", label: "Personal" },
            { value: "business", label: "Business" },
          ]}
        />
        {scope === "business" && (
          <div className="no-scrollbar -mx-5 mt-2 flex gap-2 overflow-x-auto px-5">
            {businessList.map((b) => (
              <Chip key={b.id} active={businessId === b.id} onClick={() => setBusinessId(businessId === b.id ? null : b.id)}>
                {b.name}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {type !== "transfer" && (
        <div>
          <Label>Category</Label>
          {loading ? (
            <div className="h-10" />
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {typeCategories.map((c) => (
                <Chip key={c.id} size="sm" active={categoryId === c.id} tone={tone} onClick={() => setCategoryId(c.id)}>
                  {c.name}
                </Chip>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Optional */}
      {showMore ? (
        <div className="space-y-4">
          <div>
            <Label>Note</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={255}
              placeholder="e.g. Lunch at Osu"
              enterKeyHint="done"
            />
          </div>
          <div>
            <Label>Date &amp; time</Label>
            <div className="flex gap-2">
              <Input
                type="datetime-local"
                value={when ?? toLocalInput(new Date())}
                onChange={(e) => setWhen(e.target.value || null)}
              />
              {when && !editing && (
                <button type="button" className="shrink-0 px-2 text-sm font-medium text-muted" onClick={() => setWhen(null)}>
                  Now
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setShowMore(true)} className="text-sm font-medium text-muted hover:text-ink">
          + Add note or change date (now)
        </button>
      )}

      {error && <p className="rounded-xl bg-expense-soft px-3 py-2 text-sm text-expense">{error}</p>}

      <div className="sticky bottom-0 -mx-5 mb-[calc(-1*max(1.25rem,env(safe-area-inset-bottom)))] flex gap-2 border-t border-line bg-surface px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {editing && (
          <button
            type="button"
            onClick={remove}
            disabled={saving}
            className="rounded-2xl border border-line px-4 text-sm font-semibold text-expense hover:bg-expense-soft"
          >
            {confirmDelete ? "Confirm delete" : "Delete"}
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className={cx(
            "flex flex-1 items-center justify-center gap-2 rounded-2xl py-4 text-base font-semibold text-white transition disabled:opacity-60",
            tone === "income" ? "bg-income" : tone === "expense" ? "bg-expense" : "bg-transfer",
          )}
        >
          {saving && <Spinner />}
          {editing ? "Save changes" : `Save ${type}`}
        </button>
      </div>
    </form>
  );
}
