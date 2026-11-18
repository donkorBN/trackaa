"use client";

import {
  ChevronRight, Download, KeyRound, Trash2, LogOut, UserX, Monitor, Moon, Plus, Smartphone, Sun,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useToast } from "@/components/toast";
import {
  Button, Callout, Field, FormError, Glyph, Input, ListCard, ListRow, Monogram, Num, PageHeader, SectionTitle, Segmented, Select, Sheet,
  Spinner, Tag, Toggle,
} from "@/components/ui";
import { api, apiDownload, ApiError, setToken, withQuery } from "@/lib/api";
import { deviceTimezone } from "@/lib/dates";
import { useAccounts, useBusinesses, useCategories, useMe, useRefreshAll } from "@/lib/hooks";
import { useInstall } from "@/lib/install";
import { formatGHS, parseAmount, toInputString } from "@/lib/money";
import { getThemePref, setThemePref, type ThemePref } from "@/lib/theme";
import type { Account } from "@/lib/types";
import { ACCOUNT_ICON, categoryIcon } from "@/lib/visuals";

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
    <div className="space-y-8">
      <PageHeader eyebrow="Your account" title="Settings" />
      <Profile />
      <Accounts />
      <Businesses />
      <Categories />
      <Preferences />
      <Security />
    </div>
  );
}

/* ---------------- shared bits ---------------- */

/** Row title with an "Archived" tag after it. */
function ItemTitle({ children, archived }: { children: ReactNode; archived?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="truncate">{children}</span>
      {archived && <Tag>Archived</Tag>}
    </span>
  );
}

const Chevron = <ChevronRight size={18} className="text-subtle" />;

function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="secondary" size="sm" onClick={onClick}>
      <Plus size={15} strokeWidth={2.5} /> Add
    </Button>
  );
}

/** Fine print under a list card. */
function Note({ children }: { children: ReactNode }) {
  return <p className="mt-2.5 px-1 text-[12.5px] leading-relaxed text-muted">{children}</p>;
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
      <ListCard>
        <ListRow leading={<Monogram name={me.name} size={48} />} title={me.name} meta={me.email} trailing={Chevron} onClick={() => setEditing(true)} />
      </ListCard>
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
      <Input required autoFocus aria-label="Your name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
      <FormError>{error}</FormError>
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy && <Spinner />} Save
      </Button>
    </form>
  );
}

/** Deletes an item that was never used; if it has history, explains that archiving is the way. */
function DeleteButton({ path, noun, onDone }: { path: string; noun: string; onDone: () => void }) {
  const refreshAll = useRefreshAll();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="danger"
      size="lg"
      aria-label={`Delete ${noun.toLowerCase()}`}
      disabled={busy}
      onClick={async () => {
        if (!confirm) return setConfirm(true);
        setBusy(true);
        try {
          await api(path, { method: "DELETE" });
          refreshAll();
          toast({ message: `${noun} deleted` });
          onDone();
        } catch (err) {
          const e = err as ApiError;
          toast({ message: e.status === 422 ? `This ${noun.toLowerCase()} has transactions, so it can only be archived.` : e.message, tone: "error" });
          setBusy(false);
          setConfirm(false);
        }
      }}
    >
      {busy ? <Spinner /> : <Trash2 size={17} />}
      {confirm && "Sure?"}
    </Button>
  );
}

/* ---------------- Accounts ---------------- */

function Accounts() {
  const { accounts, data } = useAccounts(true);
  const [editing, setEditing] = useState<Account | "new" | null>(null);
  return (
    <section id="accounts" className="scroll-mt-6">
      <SectionTitle action={<AddButton onClick={() => setEditing("new")} />}>Accounts</SectionTitle>
      <ListCard>
        {accounts.map((a) => (
          <ListRow
            key={a.id}
            leading={<Glyph icon={ACCOUNT_ICON[a.account_type]} />}
            title={<ItemTitle archived={a.archived}>{a.name}</ItemTitle>}
            meta={`${ACCOUNT_TYPES.find((t) => t.value === a.account_type)?.label} · opening ${formatGHS(a.opening_balance)}`}
            muted={a.archived}
            onClick={() => setEditing(a)}
            trailing={
              <Num tone={a.balance < 0 ? "expense" : "neutral"} className="text-[15.5px]">
                {formatGHS(a.balance)}
              </Num>
            }
          />
        ))}
        {data && (
          <div className="flex items-center justify-between gap-3 bg-surface-2 px-4 py-3.5">
            <span className="eyebrow">Total recorded balance</span>
            <Num className="text-[17px]">{formatGHS(data.total_balance)}</Num>
          </div>
        )}
      </ListCard>
      <Note>
        Set each opening balance to what the account actually held when you started tracking. Balances are calculated from
        what you record, not pulled from MoMo or your bank.
      </Note>
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
      <Field label="Name" htmlFor="acc-name">
        <Input id="acc-name" required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. MTN MoMo, Ecobank" maxLength={80} />
      </Field>
      <Field label="Type" htmlFor="acc-type">
        <Select id="acc-type" value={type} onChange={(e) => setType(e.target.value as Account["account_type"])}>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Opening balance (GH₵)" htmlFor="acc-open">
        <Input id="acc-open" inputMode="decimal" placeholder="0.00" className="tabular w-full" value={opening} onChange={(e) => setOpening(e.target.value)} />
      </Field>
      <div className="flex items-center justify-between gap-3 rounded-control bg-surface-2 px-3.5 py-3">
        <span className="text-[14px] font-semibold text-ink">This account was overdrawn / owed</span>
        <Toggle checked={negative} onChange={setNegative} label="This account was overdrawn / owed" />
      </div>
      <FormError>{error}</FormError>
      <div className="flex gap-2">
        {account && <DeleteButton path={`/accounts/${account.id}`} noun="Account" onDone={onDone} />}
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
      <Field label="Name" htmlFor="name-edit">
        <Input id="name-edit" required autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </Field>
      {item && <Callout>Archiving hides it from Quick Add. Past transactions keep it.</Callout>}
      <FormError>{error}</FormError>
      <div className="flex gap-2">
        {item && <DeleteButton path={`${endpoint}/${item.id}`} noun={noun} onDone={onDone} />}
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
      <ListCard>
        {businesses.length === 0 && (
          <p className="px-4 py-4 text-[13.5px] leading-relaxed text-muted">
            Run a business or side hustle? Add it to track its money separately from yours. If you don&apos;t, you&apos;ll never see business options.
          </p>
        )}
        {businesses.map((b) => (
          <ListRow
            key={b.id}
            leading={<Monogram name={b.name} />}
            title={<ItemTitle archived={b.archived}>{b.name}</ItemTitle>}
            muted={b.archived}
            trailing={Chevron}
            onClick={() => setEditing(b)}
          />
        ))}
      </ListCard>
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
      <ListCard>
        {categories
          .filter((c) => c.transaction_type === type)
          .map((c) => (
            <ListRow
              key={c.id}
              leading={<Glyph icon={categoryIcon(c.name)} />}
              title={<ItemTitle archived={c.archived}>{c.name}</ItemTitle>}
              meta={c.usage_count ? `${c.usage_count} in the last 90 days` : undefined}
              muted={c.archived}
              trailing={Chevron}
              onClick={() => setEditing(c)}
            />
          ))}
      </ListCard>
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
      <ListCard>
        <div className="px-4 py-3.5">
          <div className="mb-2.5 text-[15px] font-semibold text-ink">Appearance</div>
          <Segmented
            label="Appearance"
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
          <ListRow
            leading={<Glyph icon={Smartphone} />}
            title="Install on your phone"
            meta={install.canPrompt ? "Opens like a normal app, straight to Quick Add" : "Tap Share, then “Add to Home Screen”"}
            onClick={install.canPrompt ? install.prompt : undefined}
            trailing={install.canPrompt ? Chevron : undefined}
          />
        )}
        <ListRow
          leading={<Glyph icon={Download} />}
          title="Export all transactions"
          meta="CSV file for Excel or Google Sheets"
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
          trailing={exporting ? <Spinner className="text-muted" /> : Chevron}
        />
      </ListCard>
    </section>
  );
}

/* ---------------- Security ---------------- */

function Security() {
  const router = useRouter();
  const [changing, setChanging] = useState(false);
  const [deleting, setDeleting] = useState(false);
  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    setToken(null);
    router.replace("/login");
  }
  return (
    <section>
      <SectionTitle>Security</SectionTitle>
      <ListCard>
        <ListRow leading={<Glyph icon={KeyRound} />} title="Change password" trailing={Chevron} onClick={() => setChanging(true)} />
        <ListRow leading={<Glyph icon={LogOut} tone="expense" />} title={<span className="text-expense">Log out</span>} onClick={logout} />
        <ListRow
          leading={<Glyph icon={UserX} tone="expense" />}
          title={<span className="text-expense">Delete account</span>}
          meta="Permanently removes your account and all its data"
          trailing={Chevron}
          onClick={() => setDeleting(true)}
        />
      </ListCard>
      <p className="mt-8 text-center text-[12px] text-subtle">Trackaa · all amounts in Ghana cedis (GH₵)</p>
      <Sheet open={changing} onClose={() => setChanging(false)} title="Change password">
        {changing && <PasswordForm onDone={() => setChanging(false)} />}
      </Sheet>
      <Sheet open={deleting} onClose={() => setDeleting(false)} title="Delete account">
        {deleting && <DeleteAccountForm />}
      </Sheet>
    </section>
  );
}

function DeleteAccountForm() {
  const router = useRouter();
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  async function exportFirst() {
    setExporting(true);
    try {
      await apiDownload("/transactions/export", "trackaa-transactions.csv");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setExporting(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/me", { method: "DELETE", body: { password } });
      try {
        Object.keys(localStorage).filter((k) => k.startsWith("trackaa.")).forEach((k) => localStorage.removeItem(k));
      } catch {
        /* storage unavailable */
      }
      setToken(null);
      toast({ message: "Your account and data were deleted." });
      router.replace("/login");
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <Callout tone="bad">
        This deletes your account and every transaction, account, budget, goal and statement in it. It can&apos;t be undone.
      </Callout>
      <Button variant="secondary" className="w-full" onClick={exportFirst} disabled={exporting}>
        {exporting ? <Spinner /> : <Download size={16} />} Download my transactions first (CSV)
      </Button>
      <Field label="Type your password to confirm" htmlFor="delete-pw">
        <Input id="delete-pw" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <FormError>{error}</FormError>
      <Button type="submit" variant="danger" size="lg" className="w-full" disabled={busy || !password}>
        {busy ? <Spinner /> : <Trash2 size={17} />} Delete my account forever
      </Button>
    </form>
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
      <Field label="Current password" htmlFor="pw-cur">
        <Input id="pw-cur" type="password" required autoComplete="current-password" value={f.current_password} onChange={(e) => setF({ ...f, current_password: e.target.value })} />
      </Field>
      <Field label="New password" htmlFor="pw-new" hint="At least 8 characters.">
        <Input id="pw-new" type="password" required minLength={8} autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
      </Field>
      <FormError>{error}</FormError>
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy && <Spinner />} Update password
      </Button>
    </form>
  );
}
