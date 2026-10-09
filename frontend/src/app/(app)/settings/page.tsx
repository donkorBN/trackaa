"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import { Button, Card, Input, Label, Segmented, Select, Sheet, Spinner, cx } from "@/components/ui";
import { api, ApiError, setToken } from "@/lib/api";
import { useAccounts, useBusinesses, useCategories, useMe, useRefreshAll } from "@/lib/hooks";
import { formatGHS, parseAmount, toInputString } from "@/lib/money";
import { disablePush, enablePush, pushActive, pushSupported } from "@/lib/push";
import type { Account } from "@/lib/types";

const ACCOUNT_TYPES: { value: Account["account_type"]; label: string }[] = [
  { value: "mobile_money", label: "Mobile Money" },
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank account" },
  { value: "other", label: "Other" },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <Reminders />
      <Accounts />
      <Businesses />
      <Categories />
      <Profile />
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function errorText(err: unknown) {
  const e = err as ApiError;
  return Object.values(e.fields ?? {})[0]?.[0] ?? e.message;
}

/* ---------------- Reminders ---------------- */

function Reminders() {
  const { data: me, mutate } = useMe();
  const toast = useToast();
  const [push, setPush] = useState<"on" | "off" | "unsupported" | "loading">("loading");

  useEffect(() => {
    if (!pushSupported()) return setPush("unsupported");
    pushActive().then((on) => setPush(on ? "on" : "off"));
  }, []);

  async function save(patch: Partial<{ reminder_enabled: boolean; reminder_time: string }>) {
    try {
      await mutate(api("/me", { method: "PATCH", body: patch }), { revalidate: false });
    } catch (err) {
      toast({ message: errorText(err), tone: "error" });
    }
  }

  async function togglePush() {
    setPush("loading");
    try {
      if (push === "on") {
        await disablePush();
        setPush("off");
      } else {
        const r = await enablePush();
        setPush(r === "enabled" ? "on" : "off");
        if (r === "denied") toast({ message: "Notifications are blocked in your browser settings.", tone: "error" });
        if (r === "unavailable") toast({ message: "Push isn't set up on the server yet. You'll still see the in-app reminder.", tone: "error" });
      }
    } catch (err) {
      toast({ message: errorText(err), tone: "error" });
      setPush("off");
    }
  }

  if (!me) return null;
  return (
    <Section title="Daily reminder">
      <Card className="space-y-4">
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm">
            Remind me to record today&apos;s transactions
            <span className="block text-xs text-muted">“Have you recorded everything you earned and spent today?”</span>
          </span>
          <input
            type="checkbox"
            className="h-5 w-5 accent-[var(--accent)]"
            checked={me.reminder_enabled}
            onChange={(e) => save({ reminder_enabled: e.target.checked })}
          />
        </label>
        {me.reminder_enabled && (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">Time</span>
              <Input
                type="time"
                className="w-40"
                defaultValue={me.reminder_time}
                onBlur={(e) => e.target.value && e.target.value !== me.reminder_time && save({ reminder_time: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
              <span className="text-sm">
                Phone notification
                <span className="block text-xs text-muted">
                  {push === "unsupported"
                    ? "Not supported here. On iPhone, add Trackaa to your Home Screen first."
                    : "Otherwise you'll see a reminder banner when you open the app."}
                </span>
              </span>
              {push !== "unsupported" && (
                <Button variant={push === "on" ? "secondary" : "primary"} onClick={togglePush} disabled={push === "loading"}>
                  {push === "loading" ? <Spinner /> : push === "on" ? "Turn off" : "Turn on"}
                </Button>
              )}
            </div>
          </>
        )}
      </Card>
    </Section>
  );
}

/* ---------------- Generic row + editor ---------------- */

function Row({ title, subtitle, right, archived, onClick }: { title: string; subtitle?: string; right?: React.ReactNode; archived?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-2">
      <span className={cx("min-w-0", archived && "opacity-50")}>
        <span className="block truncate text-sm font-medium">
          {title}
          {archived && <span className="ml-2 text-xs font-normal text-muted">archived</span>}
        </span>
        {subtitle && <span className="block text-xs text-muted">{subtitle}</span>}
      </span>
      {right}
    </button>
  );
}

function useSaver(onDone: () => void) {
  const refreshAll = useRefreshAll();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(fn: () => Promise<unknown>, message: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
      refreshAll();
      toast({ message });
      onDone();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run };
}

/* ---------------- Accounts ---------------- */

function Accounts() {
  const { accounts, data } = useAccounts(true);
  const [editing, setEditing] = useState<Account | "new" | null>(null);
  return (
    <Section title="Accounts" action={<Button variant="ghost" onClick={() => setEditing("new")}>+ Add</Button>}>
      <Card flush className="divide-y divide-line overflow-hidden">
        {accounts.map((a) => (
          <Row
            key={a.id}
            title={a.name}
            subtitle={ACCOUNT_TYPES.find((t) => t.value === a.account_type)?.label}
            archived={a.archived}
            onClick={() => setEditing(a)}
            right={<span className="tabular text-sm font-medium">{formatGHS(a.balance)}</span>}
          />
        ))}
        {data && (
          <div className="flex justify-between bg-surface-2 px-4 py-3 text-sm">
            <span className="font-medium">Total recorded balance</span>
            <span className="tabular font-semibold">{formatGHS(data.total_balance)}</span>
          </div>
        )}
      </Card>
      <p className="mt-2 px-1 text-xs text-muted">
        Balances are your opening balance plus recorded transactions, not live MoMo or bank data. Set the opening balance to
        what the account held when you started tracking.
      </p>
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New account" : "Edit account"}>
        {editing !== null && <AccountEditor account={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </Section>
  );
}

function AccountEditor({ account, onDone }: { account: Account | null; onDone: () => void }) {
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState<Account["account_type"]>(account?.account_type ?? "mobile_money");
  const [opening, setOpening] = useState(account ? toInputString(Math.abs(account.opening_balance)) : "0");
  const [negative, setNegative] = useState((account?.opening_balance ?? 0) < 0);
  const { busy, error, run } = useSaver(onDone);
  const [localError, setLocalError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = opening.trim() === "" ? 0 : parseAmount(opening);
    if (p === null) return setLocalError("Enter a valid opening balance.");
    const body = { name: name.trim(), account_type: type, opening_balance: negative ? -p : p };
    run(
      () => (account ? api(`/accounts/${account.id}`, { method: "PATCH", body }) : api("/accounts", { method: "POST", body })),
      account ? "Account updated" : "Account added",
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label>Name</Label>
        <Input required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. MTN MoMo" maxLength={80} />
      </div>
      <div>
        <Label>Type</Label>
        <Select value={type} onChange={(e) => setType(e.target.value as Account["account_type"])}>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Opening balance (GH₵)</Label>
        <div className="flex gap-2">
          <Input inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value)} />
          <label className="flex shrink-0 items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={negative} onChange={(e) => setNegative(e.target.checked)} /> Overdrawn
          </label>
        </div>
      </div>
      {(localError || error) && <p className="rounded-xl bg-expense-soft px-3 py-2 text-sm text-expense">{localError || error}</p>}
      <div className="flex gap-2">
        {account && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => run(() => api(`/accounts/${account.id}`, { method: "PATCH", body: { archived: !account.archived } }), account.archived ? "Account restored" : "Account archived")}
          >
            {account.archived ? "Restore" : "Archive"}
          </Button>
        )}
        <Button type="submit" className="flex-1" disabled={busy}>
          {busy && <Spinner />} Save
        </Button>
      </div>
    </form>
  );
}

/* ---------------- Businesses & categories ---------------- */

interface NamedItem {
  id: number;
  name: string;
  archived: boolean;
}

function NameEditor({
  item,
  endpoint,
  extra,
  noun,
  onDone,
}: {
  item: NamedItem | null;
  endpoint: string;
  extra?: Record<string, string>;
  noun: string;
  onDone: () => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const { busy, error, run } = useSaver(onDone);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const body = { name: name.trim(), ...extra };
        run(
          () => (item ? api(`${endpoint}/${item.id}`, { method: "PATCH", body: { name: body.name } }) : api(endpoint, { method: "POST", body })),
          item ? `${noun} updated` : `${noun} added`,
        );
      }}
      className="space-y-4"
    >
      <div>
        <Label>Name</Label>
        <Input required autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </div>
      {item && <p className="text-xs text-muted">Archiving hides it from Quick Add. Past transactions keep it.</p>}
      {error && <p className="rounded-xl bg-expense-soft px-3 py-2 text-sm text-expense">{error}</p>}
      <div className="flex gap-2">
        {item && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => run(() => api(`${endpoint}/${item.id}`, { method: "PATCH", body: { archived: !item.archived } }), item.archived ? `${noun} restored` : `${noun} archived`)}
          >
            {item.archived ? "Restore" : "Archive"}
          </Button>
        )}
        <Button type="submit" className="flex-1" disabled={busy}>
          {busy && <Spinner />} Save
        </Button>
      </div>
    </form>
  );
}

function Businesses() {
  const { businesses } = useBusinesses(true);
  const [editing, setEditing] = useState<NamedItem | "new" | null>(null);
  return (
    <Section title="Businesses" action={<Button variant="ghost" onClick={() => setEditing("new")}>+ Add</Button>}>
      <Card flush className="divide-y divide-line overflow-hidden">
        {businesses.length === 0 && <p className="px-4 py-3 text-sm text-muted">No businesses yet.</p>}
        {businesses.map((b) => (
          <Row key={b.id} title={b.name} archived={b.archived} onClick={() => setEditing(b)} />
        ))}
      </Card>
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New business" : "Edit business"}>
        {editing !== null && (
          <NameEditor item={editing === "new" ? null : editing} endpoint="/businesses" noun="Business" onDone={() => setEditing(null)} />
        )}
      </Sheet>
    </Section>
  );
}

function Categories() {
  const { categories } = useCategories(true);
  const [type, setType] = useState<"expense" | "income">("expense");
  const [editing, setEditing] = useState<NamedItem | "new" | null>(null);
  return (
    <Section title="Categories" action={<Button variant="ghost" onClick={() => setEditing("new")}>+ Add</Button>}>
      <div className="mb-2">
        <Segmented
          value={type}
          onChange={setType}
          options={[
            { value: "expense", label: "Expense" },
            { value: "income", label: "Income" },
          ]}
        />
      </div>
      <Card flush className="divide-y divide-line overflow-hidden">
        {categories
          .filter((c) => c.transaction_type === type)
          .map((c) => (
            <Row key={c.id} title={c.name} archived={c.archived} onClick={() => setEditing(c)} />
          ))}
      </Card>
      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? `New ${type} category` : "Edit category"}
      >
        {editing !== null && (
          <NameEditor
            item={editing === "new" ? null : editing}
            endpoint="/categories"
            extra={{ transaction_type: type }}
            noun="Category"
            onDone={() => setEditing(null)}
          />
        )}
      </Sheet>
    </Section>
  );
}

/* ---------------- Profile ---------------- */

function Profile() {
  const { data: me } = useMe();
  const router = useRouter();
  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    setToken(null);
    router.replace("/login");
  }
  return (
    <Section title="Account">
      <Card className="flex items-center justify-between gap-3">
        <div className="min-w-0 text-sm">
          <div className="truncate font-medium">{me?.name}</div>
          <div className="truncate text-muted">{me?.email}</div>
        </div>
        <Button variant="danger" onClick={logout}>
          Log out
        </Button>
      </Card>
      <p className="mt-6 text-center text-xs text-muted">All amounts in Ghana cedis (GH₵).</p>
    </Section>
  );
}
