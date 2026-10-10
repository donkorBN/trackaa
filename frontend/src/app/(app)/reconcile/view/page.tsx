"use client";

import { ArrowLeft, CheckCircle2, EyeOff, Link2, Link2Off, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { Meter } from "@/components/charts";
import { useToast } from "@/components/toast";
import { TxRow } from "@/components/TxRow";
import { Button, Card, Chip, cx, ErrorBox, FormError, Input, Label, Segmented, Sheet, Skeleton, Spinner } from "@/components/ui";
import { api, ApiError, fetcher, withQuery } from "@/lib/api";
import { deviceTimezone, monthName, timeLabel } from "@/lib/dates";
import { useBusinesses, useCategories, useRefreshAll } from "@/lib/hooks";
import { formatGHS } from "@/lib/money";
import type { StatementDetail, StatementLineT, Transaction } from "@/lib/types";
import { categoryVisual } from "@/lib/visuals";

type Tab = "missing" | "app" | "matched" | "ignored";

export default function StatementPage() {
  // Static export: the statement id travels in the query string (/reconcile/view/?id=12).
  const [id, setId] = useState<string | null>(null);
  useEffect(() => setId(new URLSearchParams(location.search).get("id")), []);
  const router = useRouter();
  const toast = useToast();
  const refreshAll = useRefreshAll();
  const key = id ? withQuery(`/statements/${id}`, { tz: deviceTimezone() }) : null;
  const { data, error, mutate } = useSWR<StatementDetail>(key, fetcher);
  const [tab, setTab] = useState<Tab>("missing");
  const [recording, setRecording] = useState<StatementLineT | null>(null);
  const [matching, setMatching] = useState<StatementLineT | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function act(path: string, body?: unknown, method = "POST") {
    setBusy(true);
    try {
      await mutate(api<StatementDetail>(path, { method, body }), { revalidate: false });
      refreshAll();
    } catch (e) {
      toast({ message: (e as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }
  const lineAction = (line: StatementLineT, action: string, extra: object = {}) =>
    act(`/statements/${id}/lines/${line.id}`, { action, ...extra }, "PATCH");

  if (error) return <ErrorBox error={error} onRetry={() => mutate()} />;
  if (!data || !id) return <Skeleton className="h-96" />;

  const s = data.summary;
  const missing = data.lines.filter((l) => l.status === "unmatched");
  const matched = data.lines.filter((l) => l.status === "matched");
  const ignored = data.lines.filter((l) => l.status === "ignored");
  const done = s.counts.unmatched === 0 && data.app_only.length === 0;

  return (
    <div className="space-y-6">
      <header className="pt-1">
        <Link href="/reconcile" className="inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink">
          <ArrowLeft size={15} /> Reconcile
        </Link>
        <h1 className="mt-1 text-[28px] leading-tight font-bold tracking-tight">{data.account.name}</h1>
        <p className="text-sm text-muted">
          {monthName(data.period)}
          {data.source_name ? ` · ${data.source_name}` : ""}
        </p>
      </header>

      <Card className="space-y-4">
        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-[15px] font-semibold">
              {s.counts.matched} of {s.counts.total - s.counts.ignored} lines matched
            </span>
            {done && (
              <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-income">
                <CheckCircle2 size={15} /> Reconciled
              </span>
            )}
          </div>
          <div className="mt-2">
            <Meter value={s.counts.matched} max={Math.max(s.counts.total - s.counts.ignored, 1)} tone={done ? "good" : "warn"} height={8} />
          </div>
        </div>
        <table className="tabular w-full text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="pb-2 text-left font-medium" />
              <th className="pb-2 text-right font-medium">Statement</th>
              <th className="pb-2 text-right font-medium">Trackaa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            <tr>
              <td className="py-2 text-muted">Money in</td>
              <td className="py-2 text-right">{formatGHS(s.statement_in)}</td>
              <td className={cx("py-2 text-right", s.statement_in !== s.app_in && "font-semibold")}>{formatGHS(s.app_in)}</td>
            </tr>
            <tr>
              <td className="py-2 text-muted">Money out</td>
              <td className="py-2 text-right">{formatGHS(s.statement_out)}</td>
              <td className={cx("py-2 text-right", s.statement_out !== s.app_out && "font-semibold")}>{formatGHS(s.app_out)}</td>
            </tr>
            <tr>
              <td className="py-2 text-muted">Closing balance</td>
              <td className="py-2 text-right">{s.statement_closing === null ? "—" : formatGHS(s.statement_closing)}</td>
              <td className="py-2 text-right">{formatGHS(s.recorded_closing)}</td>
            </tr>
          </tbody>
        </table>
        {s.difference !== null && s.difference !== 0 && (
          <p className="rounded-2xl bg-surface-2 px-4 py-3 text-[13px]">
            Your recorded balance is <span className="font-semibold">{formatGHS(Math.abs(s.difference))}</span>{" "}
            {s.difference > 0 ? "lower" : "higher"} than the statement. Add the missing lines below, or adjust this account&apos;s opening
            balance in Settings if you started tracking mid-way.
          </p>
        )}
        {s.difference === 0 && <p className="text-[13px] text-income">Closing balances agree.</p>}
      </Card>

      <Segmented
        size="sm"
        value={tab}
        onChange={setTab}
        options={[
          { value: "missing", label: `Missing (${missing.length})` },
          { value: "app", label: `Only here (${data.app_only.length})` },
          { value: "matched", label: `Matched (${matched.length})` },
          { value: "ignored", label: `Ignored (${ignored.length})` },
        ]}
      />

      {tab === "missing" && (
        <Section
          empty="Every statement line is in Trackaa."
          hint="On the statement but not recorded in Trackaa. Add them, link them to something you recorded, or ignore them."
        >
          {missing.map((l) => (
            <LineRow key={l.id} line={l}>
              <Button size="sm" onClick={() => setRecording(l)} disabled={busy}>
                <Plus size={14} /> Add
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setMatching(l)} disabled={busy}>
                <Link2 size={14} /> Link
              </Button>
              <Button size="sm" variant="ghost" onClick={() => lineAction(l, "ignore")} disabled={busy}>
                <EyeOff size={14} /> Ignore
              </Button>
            </LineRow>
          ))}
        </Section>
      )}

      {tab === "app" && (
        <Section
          empty="Everything you recorded on this account appears on the statement."
          hint="Recorded on this account in Trackaa but not on the statement. It may be on the wrong account, a wrong amount, or a duplicate. Tap to fix."
        >
          {data.app_only.map((t) => (
            <TxRow key={t.id} tx={t} showDate />
          ))}
        </Section>
      )}

      {tab === "matched" && (
        <Section empty="Nothing matched yet.">
          {matched.map((l) => (
            <LineRow key={l.id} line={l} matchedTo={l.transaction}>
              <Button size="sm" variant="ghost" onClick={() => lineAction(l, "unmatch")} disabled={busy}>
                <Link2Off size={14} /> Unlink
              </Button>
            </LineRow>
          ))}
        </Section>
      )}

      {tab === "ignored" && (
        <Section empty="No ignored lines.">
          {ignored.map((l) => (
            <LineRow key={l.id} line={l}>
              <Button size="sm" variant="ghost" onClick={() => lineAction(l, "unignore")} disabled={busy}>
                <RotateCcw size={14} /> Restore
              </Button>
            </LineRow>
          ))}
        </Section>
      )}

      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => act(`/statements/${id}/rematch`)} disabled={busy}>
          {busy ? <Spinner /> : <RefreshCw size={15} />} Match again
        </Button>
        <Button
          variant="danger"
          className="flex-1"
          onClick={async () => {
            if (!confirmDelete) return setConfirmDelete(true);
            await api(`/statements/${id}`, { method: "DELETE" });
            router.replace("/reconcile");
          }}
        >
          <Trash2 size={15} /> {confirmDelete ? "Tap again to delete" : "Delete statement"}
        </Button>
      </div>
      <p className="text-center text-xs text-subtle">Deleting a statement never deletes your transactions.</p>

      <Sheet open={!!recording} onClose={() => setRecording(null)} title="Add to Trackaa">
        {recording && (
          <RecordForm
            line={recording}
            onSaved={(d) => {
              mutate(d, { revalidate: false });
              refreshAll();
              setRecording(null);
              toast({ message: "Added and matched" });
            }}
            statementId={id}
          />
        )}
      </Sheet>
      <Sheet open={!!matching} onClose={() => setMatching(null)} title="Link to a recorded transaction">
        {matching && (
          <LinkPicker
            line={matching}
            candidates={data.app_only}
            onPick={async (t) => {
              setMatching(null);
              await lineAction(matching, "match", { transaction_id: t.id });
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

function Section({ children, empty, hint }: { children: React.ReactNode[]; empty: string; hint?: string }) {
  return (
    <section className="space-y-3">
      {hint && children.length > 0 && <p className="px-1 text-xs text-muted">{hint}</p>}
      {children.length === 0 ? (
        <Card className="flex items-center gap-2 text-sm text-muted">
          <CheckCircle2 size={16} className="text-income" /> {empty}
        </Card>
      ) : (
        <Card flush className="divide-y divide-line overflow-hidden">
          {children}
        </Card>
      )}
    </section>
  );
}

function LineRow({ line, children, matchedTo }: { line: StatementLineT; children: React.ReactNode; matchedTo?: Transaction | null }) {
  const d = new Date(line.occurred_at);
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-medium">{line.description || (line.amount > 0 ? "Money in" : "Money out")}</div>
          <div className="text-xs text-muted">
            {d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, {timeLabel(line.occurred_at)}
            {line.reference ? ` · Ref ${line.reference}` : ""}
          </div>
          {matchedTo && (
            <div className="mt-1 inline-flex items-center gap-1 text-xs text-income">
              <Link2 size={12} /> {matchedTo.description || matchedTo.category?.name || "Transfer"} ·{" "}
              {new Date(matchedTo.occurred_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </div>
          )}
        </div>
        <div className={cx("tabular shrink-0 text-[15px] font-semibold", line.amount > 0 && "text-income")}>
          {formatGHS(line.amount, { sign: true })}
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function RecordForm({ line, statementId, onSaved }: { line: StatementLineT; statementId: string; onSaved: (d: StatementDetail) => void }) {
  const type = line.amount > 0 ? "income" : "expense";
  const { categories } = useCategories();
  const { businesses } = useBusinesses();
  const guessFee = type === "expense" && /fee|charge|levy/i.test(line.description ?? "");
  const options = categories.filter((c) => c.transaction_type === type).sort((a, b) => b.usage_count - a.usage_count);
  const [categoryId, setCategoryId] = useState<number | null>(guessFee ? (categories.find((c) => /fees/i.test(c.name))?.id ?? null) : null);
  const [scope, setScope] = useState<"personal" | "business">("personal");
  const [businessId, setBusinessId] = useState<number | null>(null);
  const [note, setNote] = useState(line.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId) return setError("Pick a category.");
    setBusy(true);
    try {
      const d = await api<StatementDetail>(`/statements/${statementId}/lines/${line.id}/record`, {
        method: "POST",
        body: { category_id: categoryId, scope, business_id: scope === "business" ? businessId : null, description: note.trim() || null },
      });
      onSaved(d);
    } catch (err) {
      const e = err as ApiError;
      setError(Object.values(e.fields ?? {})[0]?.[0] ?? e.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="rounded-2xl bg-surface-2 px-4 py-3">
        <div className={cx("tabular text-[22px] font-bold", type === "income" ? "text-income" : "text-expense")}>
          {formatGHS(line.amount, { sign: true })}
        </div>
        <div className="text-xs text-muted">
          {type === "income" ? "Income" : "Expense"} ·{" "}
          {new Date(line.occurred_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
      <div>
        <Label>Category</Label>
        <div className="flex flex-wrap gap-1.5">
          {options.map((c) => {
            const v = categoryVisual(c.name);
            return (
              <Chip key={c.id} active={categoryId === c.id} onClick={() => setCategoryId(c.id)} icon={<v.Icon size={14} />} tone={type}>
                {c.name}
              </Chip>
            );
          })}
        </div>
      </div>
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
        <div className="flex flex-wrap gap-2">
          {businesses.map((b) => (
            <Chip key={b.id} active={businessId === b.id} onClick={() => setBusinessId(b.id)}>
              {b.name}
            </Chip>
          ))}
        </div>
      )}
      <div>
        <Label htmlFor="rec-note">Note</Label>
        <Input id="rec-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} />
      </div>
      <FormError>{error}</FormError>
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy && <Spinner />} Add {type}
      </Button>
    </form>
  );
}

function LinkPicker({ line, candidates, onPick }: { line: StatementLineT; candidates: Transaction[]; onPick: (t: Transaction) => void }) {
  const signed = (t: Transaction) => (t.type === "income" || (t.type === "transfer" && t.to_account) ? 1 : -1);
  const sameDirection = candidates
    .filter((t) => Math.sign(line.amount) === signed(t) || t.type === "transfer")
    .sort((a, b) => Math.abs(a.amount - Math.abs(line.amount)) - Math.abs(b.amount - Math.abs(line.amount)));
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Statement line: <span className="font-semibold text-ink">{formatGHS(line.amount, { sign: true })}</span> on{" "}
        {new Date(line.occurred_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}. Pick the transaction you recorded for
        it, even if the amount or date differ slightly.
      </p>
      {sameDirection.length === 0 ? (
        <Card className="text-sm text-muted">No unmatched transactions on this account this month. Use “Add” instead.</Card>
      ) : (
        <Card flush className="divide-y divide-line overflow-hidden">
          {sameDirection.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onPick(t)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-medium">{t.description || t.category?.name || "Transfer"}</div>
                <div className="text-xs text-muted">
                  {new Date(t.occurred_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </div>
              </div>
              <div className="tabular text-[15px] font-semibold">{formatGHS(t.amount)}</div>
            </button>
          ))}
        </Card>
      )}
    </div>
  );
}
