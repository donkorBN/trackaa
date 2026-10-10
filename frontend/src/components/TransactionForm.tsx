"use client";

import { ArrowRight, Briefcase, CalendarClock, Check, ChevronDown, Delete, Flame, PenLine, Plus, Trash2, Undo2, User } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, ApiError } from "@/lib/api";
import { dateTimeLabel, toLocalInput } from "@/lib/dates";
import { confetti, haptic } from "@/lib/feedback";
import { useAccounts, useBusinesses, useCategories, useProgress, useRefreshAll } from "@/lib/hooks";
import { formatGHS, parseAmount, toInputString } from "@/lib/money";
import { enqueue } from "@/lib/offline";
import { loadDefaults, saveDefaults } from "@/lib/prefs";
import type { Account, Business, Category, Ref, Scope, Transaction, TxInput, TxType } from "@/lib/types";
import { ACCOUNT_ICON, categoryVisual, IconBubble, TransferIcon } from "@/lib/visuals";
import { useToast } from "./toast";
import { cx, FormError, Input, Segmented, Spinner } from "./ui";

const TYPE_OPTIONS: { value: TxType; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfer" },
];

const TONE_TEXT = { income: "text-income", expense: "text-expense", transfer: "text-transfer" } as const;
const TONE_BG = { income: "bg-income", expense: "bg-expense", transfer: "bg-transfer" } as const;
const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 365];

type Panel = "none" | "account" | "to" | "scope" | "date" | "note";

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

interface Saved {
  tx: Transaction;
  streak: number;
  extended: boolean;
}

export function TransactionForm({ tx, onDone }: { tx?: Transaction; onDone: () => void }) {
  const editing = !!tx;
  const toast = useToast();
  const refreshAll = useRefreshAll();
  const { accounts, isLoading: la } = useAccounts();
  const { categories, isLoading: lc } = useCategories();
  const { businesses, mutate: mutateBusinesses } = useBusinesses();
  const { data: progress } = useProgress();
  const [touch] = useState(() => typeof window !== "undefined" && matchMedia("(pointer: coarse)").matches);

  const defaults = useMemo(() => (editing ? null : loadDefaults()), [editing]);
  const hasBusinesses = businesses.length > 0 || !!tx?.business;

  // New entries always start as Expense (the common case); recording income is a deliberate tap.
  const [type, setType] = useState<TxType>(tx?.type ?? "expense");
  const [amount, setAmount] = useState(tx ? toInputString(tx.amount) : "");
  const [bump, setBump] = useState(0);
  const [scope, setScope] = useState<Scope>(tx?.scope ?? defaults?.scope ?? "personal");
  const [businessId, setBusinessId] = useState<number | null>(tx ? (tx.business?.id ?? null) : (defaults?.business_id ?? null));
  const [categoryId, setCategoryId] = useState<number | null>(tx?.category?.id ?? null);
  const [accountId, setAccountId] = useState<number | null>(tx?.account.id ?? defaults?.account_id ?? null);
  const [toAccountId, setToAccountId] = useState<number | null>(tx?.to_account?.id ?? defaults?.to_account_id ?? null);
  const [description, setDescription] = useState(tx?.description ?? "");
  const [when, setWhen] = useState<string | null>(tx ? toLocalInput(new Date(tx.occurred_at)) : null);
  const [panel, setPanel] = useState<Panel>("none");
  // Phones: amount first on its own roomy screen, then details. Editing starts on details.
  const [stage, setStage] = useState<"amount" | "details">(touch && !editing ? "amount" : "details");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saved, setSaved] = useState<Saved | null>(null);
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
  const accountList = withRef(withRef(accounts, tx?.account), tx?.to_account) as (Account | Ref)[];
  const businessList = withRef(businesses, tx?.business) as (Business | Ref)[];

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

  // No businesses: everything is personal, and the switch is hidden.
  useEffect(() => {
    if (!hasBusinesses && scope !== "personal") setScope("personal");
  }, [hasBusinesses, scope]);

  // The success screen closes itself unless the person wants to add another.
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [saved, onDone]);

  const pesewas = parseAmount(amount);
  const account = accountList.find((a) => a.id === accountId);
  const toAccount = accountList.find((a) => a.id === toAccountId);
  const business = businessList.find((b) => b.id === businessId);

  function key(k: string) {
    haptic.tap();
    setAmount((a) => pressKey(a, k));
    setBump((n) => n + 1);
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy.current) return; // prevent double submits
    setError(null);

    const fail = (m: string) => {
      haptic.warn();
      setError(m);
    };
    if (!pesewas || pesewas <= 0) {
      if (touch) setStage("amount");
      return fail("Enter an amount greater than zero.");
    }
    if (type !== "transfer" && !categoryId) return fail("Pick a category.");
    if (!accountId) return fail("Pick an account.");
    if (type === "transfer" && (!toAccountId || toAccountId === accountId)) return fail("Pick two different accounts.");

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
        haptic.success();
        toast({ message: "Transaction updated" });
        refreshAll();
        onDone();
      } else {
        const res = await api<Transaction>("/transactions", { method: "POST", body: { ...body, client_ref: clientRef.current } });
        rememberDefaults();
        clientRef.current = newRef();
        const extended = !!progress && !progress.today_done;
        const streak = progress ? (extended ? progress.streak + 1 : progress.streak) : 1;
        haptic.success();
        if (extended && STREAK_MILESTONES.includes(streak)) confetti("big");
        else confetti("small");
        refreshAll();
        setSaved({ tx: res, streak, extended });
      }
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
        haptic.warn();
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
      haptic.success();
      toast({ message: "Transaction deleted" });
      refreshAll();
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  function addAnother() {
    setSaved(null);
    setAmount("");
    setDescription("");
    setWhen(null);
    setPanel("none");
    setStage(touch ? "amount" : "details");
  }

  if (saved) {
    return (
      <SavedView
        saved={saved}
        onUndo={async () => {
          try {
            await api(`/transactions/${saved.tx.id}`, { method: "DELETE" });
            toast({ message: "Removed" });
          } catch (e) {
            toast({ message: (e as Error).message, tone: "error" });
          }
          refreshAll();
          onDone();
        }}
        onAnother={addAnother}
        onDone={onDone}
      />
    );
  }

  const loading = la || lc;
  const whenLabel = when ? dateTimeLabel(new Date(when).toISOString()) : "Now";
  const AccIcon = ACCOUNT_ICON[(account as Account | undefined)?.account_type ?? "other"];
  const ToIcon = ACCOUNT_ICON[(toAccount as Account | undefined)?.account_type ?? "other"];
  const togglePanel = (p: Panel) => {
    haptic.tap();
    setPanel((cur) => (cur === p ? "none" : p));
  };

  if (touch && stage === "amount") {
    const ready = !!pesewas && pesewas > 0;
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Segmented value={type} options={TYPE_OPTIONS} onChange={setType} />
        <div className="flex min-h-[9rem] flex-1 flex-col items-center justify-center">
          <div className={cx("flex items-baseline justify-center gap-2", TONE_TEXT[type])}>
            <span className="text-[28px] font-semibold opacity-70">GH₵</span>
            <span key={bump} aria-live="polite" aria-label="Amount" className={cx("font-display animate-bump text-[68px] leading-none font-extrabold", !amount && "opacity-25")}>
              {displayAmount(amount)}
            </span>
          </div>
          <div className="mt-3 h-5 text-[13px] text-muted">{error ?? (type === "income" ? "How much came in?" : type === "transfer" ? "How much are you moving?" : "How much did you spend?")}</div>
        </div>
        <div className="-mx-5 shrink-0 space-y-3 px-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="grid grid-cols-3 gap-2.5">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => key(k)}
                aria-label={k === "back" ? "Delete digit" : k}
                className="flex h-16 items-center justify-center rounded-2xl bg-surface-2/70 text-[26px] font-medium text-ink transition select-none active:scale-95 active:bg-surface-3 [@media(max-height:700px)]:h-12"
              >
                {k === "back" ? <Delete size={24} /> : k}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!ready}
            onClick={() => {
              haptic.tap();
              setError(null);
              setStage("details");
            }}
            className={cx(
              "pop flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[17px] font-bold text-white disabled:opacity-40",
              TONE_BG[type],
            )}
          >
            Next <ArrowRight size={19} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      {/* Fixed top: type, amount, detail pills */}
      <div className="shrink-0 pb-3">
        <Segmented value={type} options={TYPE_OPTIONS} onChange={setType} />

        {touch ? (
          <button
            type="button"
            onClick={() => {
              haptic.tap();
              setStage("amount");
            }}
            className="mx-auto mt-5 mb-4 flex items-center gap-2 rounded-2xl px-3 py-1 active:scale-95"
            aria-label="Change amount"
          >
            <span className={cx("font-display text-[42px] leading-none font-extrabold", TONE_TEXT[type])}>{formatGHS(pesewas ?? 0)}</span>
            <PenLine size={16} className="text-subtle" />
          </button>
        ) : (
          <div className="flex flex-col items-center pt-6 pb-5">
            <label className={cx("flex items-baseline justify-center gap-2", TONE_TEXT[type])}>
              <span className="text-2xl font-semibold opacity-70">GH₵</span>
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
                className="min-w-[2ch] bg-transparent text-left text-[52px] leading-none font-bold tracking-tight outline-none placeholder:opacity-25"
              />
            </label>
          </div>
        )}

        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          <Pill active={panel === "account"} onClick={() => togglePanel("account")} icon={<AccIcon size={15} />}>
            {type === "transfer" ? "From " : ""}
            {account?.name ?? "Account"}
          </Pill>
          {type === "transfer" && (
            <Pill active={panel === "to"} onClick={() => togglePanel("to")} icon={<ArrowRight size={15} />}>
              <ToIcon size={15} /> {toAccount?.name ?? "To"}
            </Pill>
          )}
          {hasBusinesses && (
            <Pill active={panel === "scope"} onClick={() => togglePanel("scope")} icon={scope === "business" ? <Briefcase size={15} /> : <User size={15} />}>
              {scope === "business" ? (business?.name ?? "Business") : "Personal"}
            </Pill>
          )}
          <Pill active={panel === "date"} onClick={() => togglePanel("date")} icon={<CalendarClock size={15} />}>
            {whenLabel}
          </Pill>
          <Pill active={panel === "note"} onClick={() => togglePanel("note")} icon={<PenLine size={15} />}>
            {description.trim() ? <span className="max-w-[8rem] truncate">{description}</span> : "Note"}
          </Pill>
        </div>
      </div>

      {/* Scrolling middle: the open picker, or the category grid */}
      <div className="-mx-5 min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-line px-5 py-4">
        {panel === "account" || panel === "to" ? (
          <PickerList
            title={panel === "to" ? "Money goes to" : type === "income" ? "Money comes into" : type === "transfer" ? "Money leaves" : "Paid from"}
            items={accountList
              .filter((a) => panel !== "to" || a.id !== accountId)
              .map((a) => {
                const Icon = ACCOUNT_ICON[(a as Account).account_type ?? "other"];
                return {
                  id: a.id,
                  label: a.name,
                  sub: "balance" in a ? `Recorded balance ${formatGHS(a.balance)}` : undefined,
                  icon: <Icon size={18} />,
                };
              })}
            selected={panel === "to" ? toAccountId : accountId}
            onPick={(id) => {
              haptic.tap();
              if (panel === "to") setToAccountId(id);
              else setAccountId(id);
              setPanel("none");
            }}
          />
        ) : panel === "scope" ? (
          <ScopePanel
            scope={scope}
            businessId={businessId}
            businesses={businessList}
            onPick={(s, b) => {
              haptic.tap();
              setScope(s);
              setBusinessId(b);
              setPanel("none");
            }}
            onCreate={async (name) => {
              const b = await api<Business>("/businesses", { method: "POST", body: { name } });
              await mutateBusinesses();
              refreshAll();
              setScope("business");
              setBusinessId(b.id);
              setPanel("none");
              toast({ message: `${b.name} added` });
            }}
          />
        ) : panel === "date" ? (
          <div className="space-y-3">
            <div className="text-[13px] font-medium text-muted">When did it happen?</div>
            <div className="flex flex-wrap gap-2">
              <Pill active={!when} onClick={() => setWhen(null)}>
                Now
              </Pill>
              <Pill
                active={!!when && new Date(when).toDateString() === new Date(Date.now() - 864e5).toDateString()}
                onClick={() => {
                  const d = new Date(Date.now() - 864e5);
                  d.setHours(12, 0, 0, 0);
                  setWhen(toLocalInput(d));
                }}
              >
                Yesterday
              </Pill>
            </div>
            <Input type="datetime-local" value={when ?? toLocalInput(new Date())} onChange={(e) => setWhen(e.target.value || null)} aria-label="Date and time" />
            <DoneButton onClick={() => setPanel("none")} />
          </div>
        ) : panel === "note" ? (
          <div className="space-y-3">
            <div className="text-[13px] font-medium text-muted">Add a note</div>
            <Input
              autoFocus
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={255}
              placeholder="What was it for? e.g. Waakye at Osu"
              enterKeyHint="done"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  setPanel("none");
                }
              }}
            />
            <DoneButton onClick={() => setPanel("none")} />
          </div>
        ) : type === "transfer" ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-transfer-soft text-transfer">
              <TransferIcon size={24} />
            </span>
            <p className="max-w-xs text-sm text-muted">Moving money between your own accounts. It won&apos;t count as income or spending.</p>
          </div>
        ) : loading ? (
          <div className="h-40" />
        ) : (
          <div className="grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-5">
            {typeCategories.map((c) => {
              const v = categoryVisual(c.name);
              const active = categoryId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    haptic.tap();
                    setCategoryId(c.id);
                    amountRef.current?.focus(); // desktop: keep Enter = save
                  }}
                  aria-pressed={active}
                  className="flex flex-col items-center gap-1.5 rounded-2xl py-1 transition active:scale-90"
                >
                  <span className={cx("rounded-full transition-transform duration-200", active && "scale-110")}>
                    <IconBubble Icon={v.Icon} color={v.color} size={52} active={active} />
                  </span>
                  <span className={cx("line-clamp-2 px-0.5 text-center text-[11.5px] leading-tight", active ? "font-semibold text-ink" : "text-muted")}>
                    {c.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {error && (
          <div className="mt-4">
            <FormError>{error}</FormError>
          </div>
        )}
      </div>

      {/* Fixed bottom: keypad + actions */}
      <div className="-mx-5 shrink-0 space-y-3 border-t border-line bg-surface px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex gap-2">
          {editing && (
            <button
              type="button"
              onClick={remove}
              disabled={saving}
              aria-label={confirmDelete ? "Confirm delete" : "Delete"}
              className={cx(
                "flex h-14 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition",
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
              "pop flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl text-[17px] font-bold text-white disabled:opacity-60",
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

function Pill({ active, onClick, icon, children }: { active?: boolean; onClick: () => void; icon?: ReactNode; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13.5px] font-medium transition active:scale-95",
        active ? "border-accent bg-accent text-accent-fg" : "border-line bg-surface-2/60 text-ink",
      )}
    >
      {icon}
      {children}
      <ChevronDown size={14} className={cx("opacity-50 transition-transform", active && "rotate-180")} />
    </button>
  );
}

function DoneButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="h-11 w-full rounded-xl bg-surface-2 text-sm font-semibold">
      Done
    </button>
  );
}

function PickerList({
  title,
  items,
  selected,
  onPick,
}: {
  title: string;
  items: { id: number; label: string; sub?: string; icon: ReactNode }[];
  selected: number | null;
  onPick: (id: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 text-[13px] font-medium text-muted">{title}</div>
      <div className="overflow-hidden rounded-2xl border border-line">
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            onClick={() => onPick(it.id)}
            className={cx("flex w-full items-center gap-3 border-b border-line px-4 py-3.5 text-left last:border-b-0", selected === it.id ? "bg-surface-2" : "hover:bg-surface-2")}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-ink">{it.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium">{it.label}</span>
              {it.sub && <span className="block text-xs text-muted">{it.sub}</span>}
            </span>
            {selected === it.id && <Check size={18} className="text-income" strokeWidth={3} />}
          </button>
        ))}
      </div>
    </div>
  );
}

function ScopePanel({
  scope,
  businessId,
  businesses,
  onPick,
  onCreate,
}: {
  scope: Scope;
  businessId: number | null;
  businesses: (Business | Ref)[];
  onPick: (s: Scope, b: number | null) => void;
  onCreate: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  async function create() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await onCreate(name.trim());
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      <PickerList
        title="Who is this for?"
        items={[
          { id: 0, label: "Personal", sub: "My own money", icon: <User size={18} /> },
          ...businesses.map((b) => ({ id: b.id, label: b.name, sub: "Business", icon: <Briefcase size={18} /> })),
        ]}
        selected={scope === "personal" ? 0 : businessId}
        onPick={(id) => (id === 0 ? onPick("personal", null) : onPick("business", id))}
      />
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault(); // don't submit the transaction
              create();
            }
          }}
          placeholder="New business name"
          maxLength={80}
          className="min-w-0 flex-1"
        />
        <button type="button" onClick={create} disabled={!name.trim() || busy} className="flex h-11 items-center gap-1 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-40">
          {busy ? <Spinner /> : <Plus size={16} />} Add
        </button>
      </div>
    </div>
  );
}

function SavedView({ saved, onUndo, onAnother, onDone }: { saved: Saved; onUndo: () => void; onAnother: () => void; onDone: () => void }) {
  const t = saved.tx;
  const tone = t.type === "income" ? "bg-income" : t.type === "expense" ? "bg-expense" : "bg-transfer";
  const what = t.type === "transfer" ? `${t.account.name} → ${t.to_account?.name}` : (t.category?.name ?? "");
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
      <div className={cx("pop flex h-24 w-24 animate-pop items-center justify-center rounded-[28px] text-white", tone)}>
        <Check size={48} strokeWidth={3} className="draw-check" />
      </div>
      <div className="font-display mt-6 text-[38px] leading-none font-extrabold">{formatGHS(t.amount)}</div>
      <div className="mt-2 text-[15px] text-muted">
        {what}
        {t.description ? ` · ${t.description}` : ""}
      </div>

      <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#fff1e6] px-4 py-2 text-[14px] font-semibold text-[#c2410c] dark:bg-[#3a1d0b] dark:text-[#fdba74]">
        <Flame size={17} fill="#f97316" color="#f97316" />
        {saved.extended
          ? saved.streak === 1
            ? "Streak started!"
            : `${saved.streak}-day streak!`
          : `Day ${Math.max(saved.streak, 1)} streak: already counted`}
      </div>

      <div className="mt-8 flex w-full max-w-sm gap-2">
        <button type="button" onClick={onUndo} className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-surface-2 text-sm font-semibold">
          <Undo2 size={16} /> Undo
        </button>
        <button type="button" onClick={onAnother} className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-surface-2 text-sm font-semibold">
          <Plus size={16} /> Add another
        </button>
      </div>
      <button type="button" onClick={onDone} className="pop mt-3 h-12 w-full max-w-sm rounded-2xl bg-brand text-[15px] font-bold text-brand-ink">
        Done
      </button>
    </div>
  );
}
