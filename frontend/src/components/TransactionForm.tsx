"use client";

import { CalendarClock, Delete, PenLine, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { toLocalInput, dateTimeLabel } from "@/lib/dates";
import { useAccounts, useBusinesses, useCategories, useRefreshAll } from "@/lib/hooks";
import { formatGHS, parseAmount, toInputString } from "@/lib/money";
import { enqueue } from "@/lib/offline";
import { loadDefaults, saveDefaults } from "@/lib/prefs";
import type { Category, Ref, Scope, Transaction, TxInput, TxType } from "@/lib/types";
import { ACCOUNT_ICON, categoryVisual, IconBubble, TransferIcon } from "@/lib/visuals";
import { useToast } from "./toast";
import { Chip, cx, FormError, Input, Segmented, Spinner } from "./ui";

const TYPE_OPTIONS: { value: TxType; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfer" },
];

const TONE_TEXT = { income: "text-income", expense: "text-expense", transfer: "text-transfer" } as const;
const TONE_BG = { income: "bg-income", expense: "bg-expense", transfer: "bg-transfer" } as const;

function newRef() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (Number(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))).toString(16),
  );
}

/** Ensure a referenced-but-archived item still shows when editing an old transaction. */
function withRef<T extends { id: number; name: string }>(list: T[], ref: Ref | null | undefined): (T | Ref)[] {
  if (!ref || list.some((x) => x.id === ref.id)) return list;
  return [...list, ref];
}

/** "1250.5" -> "1,250.5" while typing. */
function displayAmount(s: string) {
  if (!s) return "0";
  const [w, f] = s.split(".");
  const whole = (w || "0").replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return f !== undefined ? `${whole}.${f}` : whole;
}

function pressKey(cur: string, key: string): string {
  if (key === "back") return cur.slice(0, -1);
  if (key === ".") return cur.includes(".") ? cur : (cur || "0") + ".";
  const [w, f] = cur.split(".");
  if (f !== undefined) return f.length >= 2 ? cur : cur + key;
  if ((w ?? "").length >= 10) return cur;
  return cur === "0" ? key : cur + key;
}

export function TransactionForm({ tx, onDone }: { tx?: Transaction; onDone: () => void }) {
  const editing = !!tx;
  const toast = useToast();
  const refreshAll = useRefreshAll();
  const { accounts, isLoading: la } = useAccounts();
  const { categories, isLoading: lc } = useCategories();
  const { businesses } = useBusinesses();
  const [touch] = useState(() => typeof window !== "undefined" && matchMedia("(pointer: coarse)").matches);

  const defaults = useMemo(() => (editing ? null : loadDefaults()), [editing]);

  // New entries always start as Expense (the common case); recording income is a deliberate tap.
  const [type, setType] = useState<TxType>(tx?.type ?? "expense");
  const [amount, setAmount] = useState(tx ? toInputString(tx.amount) : "");
  const [scope, setScope] = useState<Scope>(tx?.scope ?? defaults?.scope ?? "personal");
  const [businessId, setBusinessId] = useState<number | null>(tx ? (tx.business?.id ?? null) : (defaults?.business_id ?? null));
  const [categoryId, setCategoryId] = useState<number | null>(tx?.category?.id ?? null);
  const [accountId, setAccountId] = useState<number | null>(tx?.account.id ?? defaults?.account_id ?? null);
  const [toAccountId, setToAccountId] = useState<number | null>(tx?.to_account?.id ?? defaults?.to_account_id ?? null);
  const [description, setDescription] = useState(tx?.description ?? "");
  const [when, setWhen] = useState<string | null>(tx ? toLocalInput(new Date(tx.occurred_at)) : null);
  const [panel, setPanel] = useState<"none" | "note" | "date">(tx?.description ? "note" : "none");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const busy = useRef(false);
  const clientRef = useRef(newRef());
  const amountRef = useRef<HTMLInputElement>(null);

  // Most-used categories first so the usual one is always within reach.
  const typeCategories = useMemo(() => {
    const list = categories
      .filter((c) => c.transaction_type === type)
      .map((c, i) => ({ c, i }))
      .sort((a, b) => b.c.usage_count - a.c.usage_count || a.i - b.i)
      .map(({ c }) => c);
    return withRef<Category>(list, tx?.type === type ? tx.category : null);
  }, [categories, type, tx]);
  const accountList = withRef(withRef(accounts, tx?.account), tx?.to_account);
  const businessList = withRef(businesses, tx?.business);

  useEffect(() => {
    if (accounts.length && (accountId === null || !accountList.some((a) => a.id === accountId))) setAccountId(accounts[0].id);
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
    if (toAccountId === null || toAccountId === accountId) setToAccountId(accounts.find((a) => a.id !== accountId)?.id ?? null);
  }, [type, accountId, toAccountId, accounts]);

  const pesewas = parseAmount(amount);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy.current) return; // prevent double submits
    setError(null);

    if (!pesewas || pesewas <= 0) return setError("Enter an amount greater than zero.");
    if (type !== "transfer" && !categoryId) return setError("Pick a category.");
    if (!accountId) return setError("Pick an account.");
    if (type === "transfer" && (!toAccountId || toAccountId === accountId)) return setError("Pick two different accounts.");

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

    const rememberDefaults = () => {
      const prev = loadDefaults();
      saveDefaults({
        type,
        scope,
        account_id: accountId,
        to_account_id: toAccountId,
        business_id: scope === "business" ? businessId : prev.business_id,
        category: type === "transfer" ? prev.category : { ...prev.category, [type]: categoryId },
      });
    };

    busy.current = true;
    setSaving(true);
    try {
      if (editing) {
        await api(`/transactions/${tx!.id}`, { method: "PATCH", body });
        toast({ message: "Transaction updated" });
      } else {
        const saved = await api<Transaction>("/transactions", { method: "POST", body: { ...body, client_ref: clientRef.current } });
        rememberDefaults();
        clientRef.current = newRef();
        toast({
          message: `${formatGHS(saved.amount)} ${type} saved`,
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                await api(`/transactions/${saved.id}`, { method: "DELETE" });
                toast({ message: "Removed" });
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
      if (e.status === 0 && !editing) {
        // No connection: keep it on the device and sync later (client_ref makes the retry safe).
        enqueue({ ...body, client_ref: clientRef.current, occurred_at: body.occurred_at ?? new Date().toISOString() });
        rememberDefaults();
        clientRef.current = newRef();
        toast({ message: "You're offline. Saved on this phone and will sync automatically." });
        onDone();
      } else {
        setError(Object.values(e.fields ?? {})[0]?.[0] ?? e.message);
      }
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
  const whenLabel = when ? dateTimeLabel(new Date(when).toISOString()) : "Now";

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      {/* Fixed top: type + amount */}
      <div className="shrink-0 space-y-3 pb-3">
        <Segmented value={type} options={TYPE_OPTIONS} onChange={setType} />

        {/* Amount */}
        <div className="flex flex-col items-center">
          <label className={cx("flex items-baseline justify-center gap-1.5", TONE_TEXT[type])}>
            <span className="text-xl font-semibold opacity-80">GH₵</span>
            {touch ? (
              <span
                aria-live="polite"
                aria-label="Amount"
                className={cx("tabular text-[44px] leading-none font-bold tracking-tight", !amount && "opacity-30")}
              >
                {displayAmount(amount)}
              </span>
            ) : (
              <input
                ref={amountRef}
                autoFocus
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                aria-label="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                style={{ width: `${Math.max(amount.length, 1) + 0.6}ch` }}
                className="tabular min-w-[2ch] bg-transparent text-left text-[44px] leading-none font-bold tracking-tight outline-none placeholder:opacity-30 focus-visible:outline-none"
              />
            )}
          </label>
          <div className="mt-2.5 flex gap-2">
            <Chip active={panel === "date"} icon={<CalendarClock size={14} />} onClick={() => setPanel(panel === "date" ? "none" : "date")}>
              {whenLabel}
            </Chip>
            <Chip active={panel === "note"} icon={<PenLine size={14} />} onClick={() => setPanel(panel === "note" ? "none" : "note")}>
              {description.trim() ? <span className="max-w-[9rem] truncate">{description}</span> : "Note"}
            </Chip>
          </div>
        </div>
      </div>

      {/* Scrolling middle */}
      <div className="-mx-5 min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain border-t border-line px-5 py-4">
        {panel === "note" && (
          <Input
            autoFocus
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={255}
            placeholder="What was it for? e.g. Waakye at Osu"
            enterKeyHint="done"
          />
        )}
        {panel === "date" && (
          <div className="flex flex-wrap items-center gap-2">
            <Chip active={!when} onClick={() => setWhen(null)}>
              Now
            </Chip>
            <Chip
              active={!!when && new Date(when).toDateString() === new Date(Date.now() - 864e5).toDateString()}
              onClick={() => {
                const d = new Date(Date.now() - 864e5);
                d.setHours(12, 0, 0, 0);
                setWhen(toLocalInput(d));
              }}
            >
              Yesterday
            </Chip>
            <Input
              type="datetime-local"
              className="min-w-0 flex-1"
              value={when ?? toLocalInput(new Date())}
              onChange={(e) => setWhen(e.target.value || null)}
              aria-label="Date and time"
            />
          </div>
        )}

        {/* Category */}
        {type !== "transfer" && (
          <div className="-mx-5">
            {loading ? (
              <div className="h-[150px]" />
            ) : (
              <div className="no-scrollbar grid auto-cols-[76px] grid-flow-col grid-rows-2 md:grid-flow-row md:grid-cols-5 md:grid-rows-none gap-x-1 gap-y-3 overflow-x-auto px-4">
                {typeCategories.map((c) => {
                  const v = categoryVisual(c.name);
                  const active = categoryId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCategoryId(c.id);
                        amountRef.current?.focus(); // desktop: keep Enter = save
                      }}
                      aria-pressed={active}
                      className="flex flex-col items-center gap-1.5 rounded-2xl py-1 active:scale-95"
                    >
                      <IconBubble Icon={v.Icon} color={v.color} size={44} active={active} />
                      <span
                        className={cx(
                          "line-clamp-2 px-0.5 text-center text-[11px] leading-tight",
                          active ? "font-semibold text-ink" : "text-muted",
                        )}
                      >
                        {c.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Accounts */}
        <div className="space-y-2">
          <AccountRow
            label={type === "transfer" ? "From" : type === "income" ? "Into" : "From"}
            accounts={accountList}
            value={accountId}
            onChange={setAccountId}
          />
          {type === "transfer" && (
            <>
              <AccountRow
                label="To"
                accounts={accountList.filter((a) => a.id !== accountId)}
                value={toAccountId}
                onChange={setToAccountId}
              />
              <p className="flex items-center gap-1.5 px-1 text-xs text-muted">
                <TransferIcon size={13} /> Moving your own money. Not counted as income or spending.
              </p>
            </>
          )}
        </div>

        {/* Scope */}
        <div className="space-y-2">
          <Segmented
            size="sm"
            value={scope}
            onChange={setScope}
            options={[
              { value: "personal", label: "Personal" },
              { value: "business", label: "Business" },
            ]}
          />
          {scope === "business" && (
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
              {businessList.map((b) => (
                <Chip key={b.id} active={businessId === b.id} onClick={() => setBusinessId(businessId === b.id ? null : b.id)}>
                  {b.name}
                </Chip>
              ))}
            </div>
          )}
        </div>

        <FormError>{error}</FormError>
      </div>

      {/* Fixed bottom: keypad + actions */}
      <div className="-mx-5 shrink-0 space-y-2 border-t border-line bg-surface px-5 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {touch && (
          <div className="grid grid-cols-3 gap-1">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setAmount((a) => pressKey(a, k))}
                aria-label={k === "back" ? "Delete digit" : k}
                className="tabular flex h-11 items-center justify-center rounded-2xl text-[22px] font-medium text-ink select-none active:bg-surface-3 [@media(max-height:700px)]:h-9"
              >
                {k === "back" ? <Delete size={22} /> : k}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          {editing && (
            <button
              type="button"
              onClick={remove}
              disabled={saving}
              aria-label={confirmDelete ? "Confirm delete" : "Delete"}
              className={cx(
                "flex h-13 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition",
                confirmDelete ? "bg-expense text-white" : "bg-expense-soft text-expense",
              )}
            >
              <Trash2 size={18} />
              {confirmDelete && "Delete?"}
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className={cx(
              "flex h-13 flex-1 items-center justify-center gap-2 rounded-2xl text-[16px] font-semibold text-white transition active:scale-[0.99] disabled:opacity-60",
              TONE_BG[type],
            )}
          >
            {saving && <Spinner />}
            {editing ? "Save changes" : pesewas ? `Save ${formatGHS(pesewas)}` : `Save ${type}`}
          </button>
        </div>
      </div>
    </form>
  );
}

function AccountRow({
  label,
  accounts,
  value,
  onChange,
}: {
  label: string;
  accounts: { id: number; name: string; account_type?: keyof typeof ACCOUNT_ICON }[];
  value: number | null;
  onChange: (id: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 shrink-0 text-[13px] font-medium text-muted">{label}</span>
      <div className="no-scrollbar -mr-5 flex flex-1 gap-2 overflow-x-auto pr-5">
        {accounts.map((a) => {
          const Icon = ACCOUNT_ICON[a.account_type ?? "other"];
          return (
            <Chip key={a.id} active={value === a.id} onClick={() => onChange(a.id)} icon={<Icon size={14} />}>
              {a.name}
            </Chip>
          );
        })}
      </div>
    </div>
  );
}
