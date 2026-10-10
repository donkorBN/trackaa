"use client";

import {
  Bell, ChevronRight, Download, KeyRound, LogOut, Monitor, Moon, Smartphone, Sun, type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useToast } from "@/components/toast";
import { Button, Card, cx, FormError, Input, Label, SectionTitle, Segmented, Select, Sheet, Spinner, Toggle } from "@/components/ui";
import { api, apiDownload, ApiError, setToken, withQuery } from "@/lib/api";
import { deviceTimezone } from "@/lib/dates";
import { useAccounts, useBusinesses, useCategories, useMe, useRefreshAll } from "@/lib/hooks";
import { useInstall } from "@/lib/install";
import { formatGHS, parseAmount, toInputString } from "@/lib/money";
import { disablePush, enablePush, pushActive, pushSupported } from "@/lib/push";
import { getThemePref, setThemePref, type ThemePref } from "@/lib/theme";
import type { Account } from "@/lib/types";
import { ACCOUNT_ICON, categoryVisual, IconBubble, Initials } from "@/lib/visuals";

const ACCOUNT_TYPES: { value: Account["account_type"]; label: string }[] = [
  { value: "mobile_money", label: "Mobile Money" },
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank account" },
  { value: "other", label: "Other" },
];

function errorText(err: unknown) {
  const e = err as ApiError;
  return Object.values(e.fields ?? {})[0]?.[0] ?? e.message;
}

export default function SettingsPage() {
  return (
    <div className="space-y-7">
      <h1 className="pt-1 text-[28px] leading-tight font-bold tracking-tight">Settings</h1>
      <Profile />
      <Reminders />
      <Accounts />
      <Businesses />
      <Categories />
      <Preferences />
      <Security />
    </div>
  );
}

/* ---------------- shared bits ---------------- */

function Row({
  title,
  subtitle,
  right,
  leading,
  archived,
  onClick,
  danger,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  leading?: ReactNode;
  archived?: boolean;
  onClick?: () => void;
  danger?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cx("flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left", onClick && "hover:bg-surface-2 active:bg-surface-2")}
    >
      {leading && <span className={cx(archived && "opacity-40")}>{leading}</span>}
      <span className={cx("min-w-0 flex-1", archived && "opacity-50")}>
        <span className={cx("block truncate text-[15px] font-medium", danger && "text-expense")}>
          {title}
          {archived && <span className="ml-2 rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-muted">Archived</span>}
        </span>
        {subtitle && <span className="mt-0.5 block text-xs text-muted">{subtitle}</span>}
      </span>
      {right}
      {onClick && !right && <ChevronRight size={18} className="shrink-0 text-subtle" />}
    </Tag>
  );
}

function RowIcon({ Icon, tone = "neutral" }: { Icon: LucideIcon; tone?: "neutral" | "danger" }) {
  return (
    <span className={cx("flex h-9 w-9 items-center justify-center rounded-xl", tone === "danger" ? "bg-expense-soft text-expense" : "bg-surface-2 text-ink")}>
      <Icon size={18} />
    </span>
  );
}

function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-[13px] font-semibold text-transfer hover:opacity-80">
      + Add
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
  return { busy, error, setError, run };
}

/* ---------------- Profile ---------------- */

function Profile() {
  const { data: me } = useMe();
  const [editing, setEditing] = useState(false);
  if (!me) return <div className="h-20" />;
  return (
    <>
      <Card flush>
        <Row
          leading={<Initials name={me.name} size={48} />}
          title={<span className="text-[17px] font-semibold">{me.name}</span>}
          subtitle={me.email}
          onClick={() => setEditing(true)}
        />
      </Card>
      <Sheet open={editing} onClose={() => setEditing(false)} title="Your name">
        {editing && <NameForm initial={me.name} onDone={() => setEditing(false)} />}
      </Sheet>
    </>
  );
}

function NameForm({ initial, onDone }: { initial: string; onDone: () => void }) {
  const [name, setName] = useState(initial);
  const { busy, error, run } = useSaver(onDone);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => api("/me", { method: "PATCH", body: { name: name.trim() } }), "Name updated");
      }}
    >
      <Input required autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
      <FormError>{error}</FormError>
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy && <Spinner />} Save
      </Button>
    </form>
  );
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
      await mutate(api("/me", { method: "PATCH", body: { ...patch, timezone: deviceTimezone() } }), { revalidate: false });
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
        if (r === "enabled") toast({ message: "Notifications are on for this device" });
        if (r === "denied") toast({ message: "Notifications are blocked. Allow them in your browser settings.", tone: "error" });
        if (r === "unavailable") toast({ message: "Push isn't available on the server right now.", tone: "error" });
      }
    } catch (err) {
      toast({ message: errorText(err), tone: "error" });
      setPush("off");
    }
  }

  if (!me) return null;
  return (
    <section>
      <SectionTitle>Daily reminder</SectionTitle>
      <Card flush className="divide-y divide-line">
        <Row
          leading={<RowIcon Icon={Bell} />}
          title="Remind me every day"
          subtitle="“Have you recorded everything you earned and spent today?”"
          right={<Toggle label="Daily reminder" checked={me.reminder_enabled} onChange={(v) => save({ reminder_enabled: v })} />}
        />
        {me.reminder_enabled && (
          <>
            <Row
              title="Time"
              right={
                <input
                  type="time"
                  aria-label="Reminder time"
                  defaultValue={me.reminder_time}
                  onBlur={(e) => e.target.value && e.target.value !== me.reminder_time && save({ reminder_time: e.target.value })}
                  className="tabular h-9 rounded-xl bg-surface-2 px-3 text-base font-medium outline-none"
                />
              }
            />
            <Row
              title="Phone notifications"
              subtitle={
                push === "unsupported"
                  ? "Not supported in this browser. On iPhone, add Trackaa to your Home Screen first."
                  : push === "on"
                    ? "On for this device"
                    : "Otherwise you'll see a reminder when you open the app"
              }
              right={
                push === "unsupported" ? undefined : push === "loading" ? (
                  <Spinner className="text-muted" />
                ) : (
                  <Toggle label="Phone notifications" checked={push === "on"} onChange={togglePush} />
                )
              }
            />
          </>
        )}
      </Card>
    </section>
  );
}

/* ---------------- Accounts ---------------- */

function Accounts() {
  const { accounts, data } = useAccounts(true);
  const [editing, setEditing] = useState<Account | "new" | null>(null);
  return (
    <section id="accounts" className="scroll-mt-6">
      <SectionTitle action={<AddButton onClick={() => setEditing("new")} />}>Accounts</SectionTitle>
      <Card flush className="divide-y divide-line overflow-hidden">
        {accounts.map((a) => {
          const Icon = ACCOUNT_ICON[a.account_type];
          return (
            <Row
              key={a.id}
              leading={<RowIcon Icon={Icon} />}
              title={a.name}
              subtitle={`${ACCOUNT_TYPES.find((t) => t.value === a.account_type)?.label} · opening ${formatGHS(a.opening_balance)}`}
              archived={a.archived}
              onClick={() => setEditing(a)}
              right={<span className={cx("tabular text-[15px] font-semibold", a.balance < 0 && "text-expense")}>{formatGHS(a.balance)}</span>}
            />
          );
        })}
        {data && (
          <div className="flex items-center justify-between bg-surface-2/60 px-4 py-3.5 text-[15px]">
            <span className="font-medium">Total recorded balance</span>
            <span className="tabular font-bold">{formatGHS(data.total_balance)}</span>
          </div>
        )}
      </Card>
      <p className="mt-2 px-1 text-xs text-subtle">
        Set each opening balance to what the account actually held when you started tracking. Balances are calculated from
        what you record, not pulled from MoMo or your bank.
      </p>
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New account" : "Edit account"}>
        {editing !== null && <AccountEditor account={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </section>
  );
}

function AccountEditor({ account, onDone }: { account: Account | null; onDone: () => void }) {
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState<Account["account_type"]>(account?.account_type ?? "mobile_money");
  const [opening, setOpening] = useState(account ? toInputString(Math.abs(account.opening_balance)) : "");
  const [negative, setNegative] = useState((account?.opening_balance ?? 0) < 0);
  const { busy, error, setError, run } = useSaver(onDone);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = opening.trim() === "" ? 0 : parseAmount(opening);
    if (p === null) return setError("Enter a valid opening balance.");
    const body = { name: name.trim(), account_type: type, opening_balance: negative ? -p : p };
    run(
      () => (account ? api(`/accounts/${account.id}`, { method: "PATCH", body }) : api("/accounts", { method: "POST", body })),
      account ? "Account updated" : "Account added",
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="acc-name">Name</Label>
        <Input id="acc-name" required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. MTN MoMo, Ecobank" maxLength={80} />
      </div>
      <div>
        <Label htmlFor="acc-type">Type</Label>
        <Select id="acc-type" value={type} onChange={(e) => setType(e.target.value as Account["account_type"])}>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="acc-open">Opening balance (GH₵)</Label>
        <Input id="acc-open" inputMode="decimal" placeholder="0.00" value={opening} onChange={(e) => setOpening(e.target.value)} />
        <label className="mt-2 flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={negative} onChange={(e) => setNegative(e.target.checked)} className="h-4 w-4" /> This account was overdrawn / owed
        </label>
      </div>
      <FormError>{error}</FormError>
      <div className="flex gap-2">
        {account && (
          <Button
            variant={account.archived ? "secondary" : "danger"}
            size="lg"
            disabled={busy}
            onClick={() => run(() => api(`/accounts/${account.id}`, { method: "PATCH", body: { archived: !account.archived } }), account.archived ? "Account restored" : "Account archived")}
          >
            {account.archived ? "Restore" : "Archive"}
          </Button>
        )}
        <Button type="submit" size="lg" className="flex-1" disabled={busy}>
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

function NameEditor({ item, endpoint, extra, noun, onDone }: { item: NamedItem | null; endpoint: string; extra?: Record<string, string>; noun: string; onDone: () => void }) {
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
        <Label htmlFor="name-edit">Name</Label>
        <Input id="name-edit" required autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </div>
      {item && <p className="text-xs text-muted">Archiving hides it from Quick Add. Past transactions keep it.</p>}
      <FormError>{error}</FormError>
      <div className="flex gap-2">
        {item && (
          <Button
            variant={item.archived ? "secondary" : "danger"}
            size="lg"
            disabled={busy}
            onClick={() => run(() => api(`${endpoint}/${item.id}`, { method: "PATCH", body: { archived: !item.archived } }), item.archived ? `${noun} restored` : `${noun} archived`)}
          >
            {item.archived ? "Restore" : "Archive"}
          </Button>
        )}
        <Button type="submit" size="lg" className="flex-1" disabled={busy}>
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
    <section>
      <SectionTitle action={<AddButton onClick={() => setEditing("new")} />}>Businesses</SectionTitle>
      <Card flush className="divide-y divide-line overflow-hidden">
        {businesses.length === 0 && <p className="px-4 py-4 text-sm text-muted">No businesses yet.</p>}
        {businesses.map((b) => (
          <Row key={b.id} leading={<Initials name={b.name} />} title={b.name} archived={b.archived} onClick={() => setEditing(b)} />
        ))}
      </Card>
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New business" : "Edit business"}>
        {editing !== null && <NameEditor item={editing === "new" ? null : editing} endpoint="/businesses" noun="Business" onDone={() => setEditing(null)} />}
      </Sheet>
    </section>
  );
}

function Categories() {
  const { categories } = useCategories(true);
  const [type, setType] = useState<"expense" | "income">("expense");
  const [editing, setEditing] = useState<NamedItem | "new" | null>(null);
  return (
    <section>
      <SectionTitle action={<AddButton onClick={() => setEditing("new")} />}>Categories</SectionTitle>
      <Segmented
        className="mb-3"
        value={type}
        onChange={setType}
        options={[
          { value: "expense", label: "Expense" },
          { value: "income", label: "Income" },
        ]}
      />
      <Card flush className="divide-y divide-line overflow-hidden">
        {categories
          .filter((c) => c.transaction_type === type)
          .map((c) => {
            const v = categoryVisual(c.name);
            return (
              <Row
                key={c.id}
                leading={<IconBubble Icon={v.Icon} color={v.color} size={36} />}
                title={c.name}
                subtitle={c.usage_count ? `${c.usage_count} in the last 90 days` : undefined}
                archived={c.archived}
                onClick={() => setEditing(c)}
              />
            );
          })}
      </Card>
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? `New ${type} category` : "Edit category"}>
        {editing !== null && (
          <NameEditor item={editing === "new" ? null : editing} endpoint="/categories" extra={{ transaction_type: type }} noun="Category" onDone={() => setEditing(null)} />
        )}
      </Sheet>
    </section>
  );
}

/* ---------------- Preferences ---------------- */

function Preferences() {
  const [theme, setTheme] = useState<ThemePref>("system");
  const [exporting, setExporting] = useState(false);
  const toast = useToast();
  const install = useInstall();
  useEffect(() => setTheme(getThemePref()), []);

  return (
    <section>
      <SectionTitle>App</SectionTitle>
      <Card flush className="divide-y divide-line overflow-hidden">
        <div className="px-4 py-3.5">
          <div className="mb-2.5 text-[15px] font-medium">Appearance</div>
          <Segmented
            value={theme}
            onChange={(v) => {
              setTheme(v);
              setThemePref(v);
            }}
            options={[
              { value: "system", label: <span className="inline-flex items-center gap-1.5"><Monitor size={14} /> Auto</span> },
              { value: "light", label: <span className="inline-flex items-center gap-1.5"><Sun size={14} /> Light</span> },
              { value: "dark", label: <span className="inline-flex items-center gap-1.5"><Moon size={14} /> Dark</span> },
            ]}
          />
        </div>
        {!install.installed && (install.canPrompt || install.ios) && (
          <Row
            leading={<RowIcon Icon={Smartphone} />}
            title="Install on your phone"
            subtitle={install.canPrompt ? "Opens like a normal app, straight to Quick Add" : "Tap Share, then “Add to Home Screen”"}
            onClick={install.canPrompt ? install.prompt : undefined}
          />
        )}
        <Row
          leading={<RowIcon Icon={Download} />}
          title="Export all transactions"
          subtitle="CSV file for Excel or Google Sheets"
          onClick={async () => {
            if (exporting) return;
            setExporting(true);
            try {
              await apiDownload(withQuery("/transactions/export", { tz: deviceTimezone() }), "trackaa-transactions.csv");
            } catch (err) {
              toast({ message: errorText(err), tone: "error" });
            } finally {
              setExporting(false);
            }
          }}
          right={exporting ? <Spinner className="text-muted" /> : undefined}
        />
      </Card>
    </section>
  );
}

/* ---------------- Security ---------------- */

function Security() {
  const router = useRouter();
  const [changing, setChanging] = useState(false);
  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    setToken(null);
    router.replace("/login");
  }
  return (
    <section>
      <SectionTitle>Security</SectionTitle>
      <Card flush className="divide-y divide-line overflow-hidden">
        <Row leading={<RowIcon Icon={KeyRound} />} title="Change password" onClick={() => setChanging(true)} />
        <Row leading={<RowIcon Icon={LogOut} tone="danger" />} title="Log out" danger onClick={logout} />
      </Card>
      <p className="mt-6 text-center text-xs text-subtle">Trackaa · all amounts in Ghana cedis (GH₵)</p>
      <Sheet open={changing} onClose={() => setChanging(false)} title="Change password">
        {changing && <PasswordForm onDone={() => setChanging(false)} />}
      </Sheet>
    </section>
  );
}

function PasswordForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ current_password: "", password: "" });
  const { busy, error, run } = useSaver(onDone);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => api("/me/password", { method: "PUT", body: { ...f, password_confirmation: f.password } }), "Password changed. Other devices were signed out.");
      }}
    >
      <div>
        <Label htmlFor="pw-cur">Current password</Label>
        <Input id="pw-cur" type="password" required autoComplete="current-password" value={f.current_password} onChange={(e) => setF({ ...f, current_password: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="pw-new">New password</Label>
        <Input id="pw-new" type="password" required minLength={8} autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <p className="mt-1.5 text-xs text-muted">At least 8 characters.</p>
      </div>
      <FormError>{error}</FormError>
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy && <Spinner />} Update password
      </Button>
    </form>
  );
}
