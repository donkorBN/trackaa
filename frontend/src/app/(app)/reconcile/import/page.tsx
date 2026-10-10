"use client";

import { FileUp, Lock, Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Button, Callout, Card, Chip, cx, Field, FormError, Glyph, Input, Label, Num, PageHeader, Segmented, Select, Spinner, Stat, Toggle,
} from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { monthName } from "@/lib/dates";
import { useAccounts, useRefreshAll } from "@/lib/hooks";
import { formatGHS } from "@/lib/money";
import { autoMap, buildLines, dominantMonth, findHeaderRow, inMonth, type Grid, type Mapping } from "@/lib/statement-core";
import { PdfPasswordError, readStatementFile } from "@/lib/statement-file";
import type { StatementDetail } from "@/lib/types";
import { ACCOUNT_ICON } from "@/lib/visuals";

export default function ImportStatementPage() {
  const router = useRouter();
  const refreshAll = useRefreshAll();
  const { accounts } = useAccounts();
  const [accountId, setAccountId] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [grid, setGrid] = useState<Grid | null>(null);
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [feesAsLines, setFeesAsLines] = useState(true);
  const [onlyMonth, setOnlyMonth] = useState(true);
  const [period, setPeriod] = useState<string | null>(null);
  const [showColumns, setShowColumns] = useState(false);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const account = accountId ?? accounts.find((a) => a.account_type === "mobile_money")?.id ?? accounts[0]?.id ?? null;

  async function load(f: File, pw?: string) {
    setReading(true);
    setError(null);
    try {
      const g = await readStatementFile(f, pw);
      const h = Math.max(findHeaderRow(g), 0);
      const m = autoMap(g[h] ?? [], g.slice(h + 1, h + 30));
      setGrid(g);
      setHeaderRow(h);
      setMapping(m);
      setNeedsPassword(false);
      const parsed = buildLines(g, h, m, { feesAsLines: true });
      setPeriod(dominantMonth(parsed.lines));
      if (m.date === null || (m.amount === null && (m.debit === null || m.credit === null))) setShowColumns(true);
    } catch (e) {
      if (e instanceof PdfPasswordError) {
        setNeedsPassword(true);
        if (e.incorrect) setError(e.message);
      } else setError((e as Error).message);
      setGrid(null);
    } finally {
      setReading(false);
    }
  }

  const parsed = useMemo(
    () => (grid && mapping ? buildLines(grid, headerRow, mapping, { feesAsLines }) : null),
    [grid, headerRow, mapping, feesAsLines],
  );
  const months = useMemo(() => {
    const s = new Set<string>();
    parsed?.lines.forEach((l) => {
      const d = new Date(l.occurred_at);
      s.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    });
    return [...s].sort();
  }, [parsed]);
  const lines = parsed && period ? parsed.lines.filter((l) => !onlyMonth || inMonth(l.occurred_at, period)) : [];
  const totalIn = lines.filter((l) => l.amount > 0).reduce((s, l) => s + l.amount, 0);
  const totalOut = lines.filter((l) => l.amount < 0).reduce((s, l) => s - l.amount, 0);

  async function submit() {
    if (!account || !period || !lines.length) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api<StatementDetail>("/statements", {
        method: "POST",
        body: {
          account_id: account,
          period,
          source_name: file?.name ?? null,
          lines: lines.map(({ occurred_at, amount, description, reference, balance }) => ({
            occurred_at,
            amount,
            description,
            reference,
            balance,
          })),
        },
      });
      refreshAll();
      router.push(`/reconcile/view/?id=${res.id}`);
    } catch (e) {
      const err = e as ApiError;
      setError(Object.values(err.fields ?? {})[0]?.[0] ?? err.message);
      setSaving(false);
    }
  }

  const headers = grid?.[headerRow] ?? [];
  const colOptions = headers.map((h, i) => ({ i, label: h?.trim() || `Column ${i + 1}` }));
  const setCol = (k: keyof Mapping, v: string) => setMapping((m) => (m ? { ...m, [k]: v === "" ? null : Number(v) } : m));
  const toggleMulti = (k: "description" | "fees", i: number) =>
    setMapping((m) => (m ? { ...m, [k]: m[k].includes(i) ? m[k].filter((x) => x !== i) : [...m[k], i] } : m));

  return (
    <div className="space-y-6">
      <PageHeader back={{ href: "/reconcile", label: "Reconcile" }} title="Import statement" />

      <section className="space-y-2">
        <Label>Which account is this statement for?</Label>
        <div className="flex flex-wrap gap-2">
          {accounts.map((a) => {
            const Icon = ACCOUNT_ICON[a.account_type];
            return (
              <Chip key={a.id} active={account === a.id} onClick={() => setAccountId(a.id)} icon={<Icon size={14} />}>
                {a.name}
              </Chip>
            );
          })}
        </div>
      </section>

      <label className="block cursor-pointer">
        <Card tone="dashed" className="flex flex-col items-center justify-center gap-2 px-6 py-8 text-center transition-colors hover:border-ink/40">
          <Glyph size={48} active={!!file}>
            {reading ? <Spinner /> : <FileUp size={22} strokeWidth={2} />}
          </Glyph>
          <span className="mt-1 max-w-full truncate text-[15px] font-semibold text-ink">{file ? file.name : "Choose your statement"}</span>
          <span className="text-[12.5px] text-muted">CSV, Excel (.xlsx) or PDF · read on this device</span>
        </Card>
        <input
          type="file"
          accept=".csv,.xlsx,.pdf,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setFile(f);
            setPassword("");
            load(f);
          }}
        />
      </label>

      {needsPassword && file && (
        <Card className="space-y-3">
          <Callout tone="warn">
            <span className="flex items-center gap-1.5 font-semibold">
              <Lock size={14} /> This PDF is password-protected
            </span>
            <span className="mt-0.5 block">
              Enter the statement password (often sent with the statement by SMS or email). It isn&apos;t stored.
            </span>
          </Callout>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              load(file, password);
            }}
          >
            <Input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-w-0 flex-1"
              aria-label="PDF password"
            />
            <Button type="submit" variant="ink" className="h-12" disabled={!password || reading}>
              Open
            </Button>
          </form>
        </Card>
      )}

      <FormError>{error}</FormError>

      {parsed && mapping && (
        <>
          <Card className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[19px] leading-tight font-bold text-ink">
                  <Num>{parsed.lines.length}</Num> transaction{parsed.lines.length === 1 ? "" : "s"} found
                </h2>
                {parsed.skipped.length > 0 && (
                  <div className="mt-0.5 text-[12.5px] text-muted">
                    {parsed.skipped.length} rows skipped (no date or amount, e.g. headings and totals)
                  </div>
                )}
              </div>
              <Button variant="secondary" size="sm" aria-expanded={showColumns} onClick={() => setShowColumns((s) => !s)}>
                <Settings2 size={15} /> Columns
              </Button>
            </div>

            {showColumns && (
              <Card tone="sunken" flush className="space-y-3 p-4">
                <p className="text-[12.5px] text-muted">
                  We guessed these from the column headings. Fix any that look wrong; the preview updates as you go.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ColumnSelect label="Date" value={mapping.date} options={colOptions} onChange={(v) => setCol("date", v)} />
                  <ColumnSelect
                    label="Reference / ID"
                    value={mapping.reference}
                    options={colOptions}
                    onChange={(v) => setCol("reference", v)}
                    optional
                  />
                </div>
                <div>
                  <Label>How money in and out is shown</Label>
                  <Segmented
                    size="sm"
                    value={mapping.direction}
                    onChange={(direction) => setMapping({ ...mapping, direction })}
                    options={[
                      { value: "signed", label: "+/− amount" },
                      { value: "debit_credit", label: "Debit & credit" },
                      { value: "balance", label: "From balance" },
                    ]}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {mapping.direction === "debit_credit" ? (
                    <>
                      <ColumnSelect
                        label="Money out (debit)"
                        value={mapping.debit}
                        options={colOptions}
                        onChange={(v) => setCol("debit", v)}
                      />
                      <ColumnSelect
                        label="Money in (credit)"
                        value={mapping.credit}
                        options={colOptions}
                        onChange={(v) => setCol("credit", v)}
                      />
                    </>
                  ) : (
                    <ColumnSelect label="Amount" value={mapping.amount} options={colOptions} onChange={(v) => setCol("amount", v)} />
                  )}
                  <ColumnSelect
                    label="Balance (after)"
                    value={mapping.balance}
                    options={colOptions}
                    onChange={(v) => setCol("balance", v)}
                    optional
                  />
                  {mapping.direction === "balance" && (
                    <ColumnSelect
                      label="Balance before"
                      value={mapping.balanceBefore}
                      options={colOptions}
                      onChange={(v) => setCol("balanceBefore", v)}
                      optional
                    />
                  )}
                </div>
                <MultiColumns
                  label="Description columns"
                  options={colOptions}
                  selected={mapping.description}
                  onToggle={(i) => toggleMulti("description", i)}
                />
                <MultiColumns
                  label="Fee / e-levy columns"
                  options={colOptions}
                  selected={mapping.fees}
                  onToggle={(i) => toggleMulti("fees", i)}
                />
              </Card>
            )}

            {months.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Statement month" htmlFor="period">
                  <Select id="period" value={period ?? ""} onChange={(e) => setPeriod(e.target.value)}>
                    {months.map((m) => (
                      <option key={m} value={m}>
                        {monthName(m)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="space-y-2 pt-1 text-[14px] font-semibold text-ink sm:pt-7">
                  <label className="flex items-center justify-between gap-3">
                    <span>Only lines in this month</span>
                    <Toggle label="Only lines in this month" checked={onlyMonth} onChange={setOnlyMonth} />
                  </label>
                  {mapping.fees.length > 0 && (
                    <label className="flex items-center justify-between gap-3">
                      <span>Fees as separate lines</span>
                      <Toggle label="Fees as separate lines" checked={feesAsLines} onChange={setFeesAsLines} />
                    </label>
                  )}
                </div>
              </div>
            )}

            {lines.length > 0 && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Card tone="sunken" flush className="px-4 py-3">
                    <Stat label="Money in" value={formatGHS(totalIn)} tone="income" size="sm" />
                  </Card>
                  <Card tone="sunken" flush className="px-4 py-3">
                    <Stat label="Money out" value={formatGHS(totalOut)} tone="expense" size="sm" />
                  </Card>
                </div>
                <div className="-mx-5 max-h-80 overflow-auto border-y border-line">
                  <table className="w-full text-[13px]">
                    <thead className="eyebrow sticky top-0 border-b border-line bg-surface">
                      <tr>
                        <th className="px-5 py-2 text-left font-[650]">Date</th>
                        <th className="py-2 text-left font-[650]">Details</th>
                        <th className="px-5 py-2 text-right font-[650]">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {lines.slice(0, 50).map((l, i) => (
                        <tr key={i}>
                          <td className="px-5 py-2 whitespace-nowrap text-muted">
                            {new Date(l.occurred_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </td>
                          <td className="max-w-0 truncate py-2 text-ink">{l.description ?? "—"}</td>
                          <td className={cx("font-display tabular px-5 py-2 text-right font-bold whitespace-nowrap", l.amount > 0 ? "text-income" : "text-ink")}>
                            {formatGHS(l.amount, { sign: true })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {lines.length > 50 && <p className="px-5 py-2 text-[12.5px] text-muted">…and {lines.length - 50} more</p>}
                </div>
              </>
            )}
            {parsed.lines.length === 0 && (
              <Callout>No transactions found yet. Open “Columns” and point us at the date and amount columns.</Callout>
            )}
          </Card>

          <Button size="lg" className="w-full" disabled={!lines.length || !account || !period || saving} onClick={submit}>
            {saving && <Spinner />} Import {lines.length} line{lines.length === 1 ? "" : "s"} and match
          </Button>
        </>
      )}
    </div>
  );
}

function ColumnSelect({
  label,
  value,
  options,
  onChange,
  optional,
}: {
  label: string;
  value: number | null;
  options: { i: number; label: string }[];
  onChange: (v: string) => void;
  optional?: boolean;
}) {
  return (
    <Field label={label}>
      <Select value={value ?? ""} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        <option value="">{optional ? "None" : "Choose a column"}</option>
        {options.map((o) => (
          <option key={o.i} value={o.i}>
            {o.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function MultiColumns({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: { i: number; label: string }[];
  selected: number[];
  onToggle: (i: number) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <Chip key={o.i} active={selected.includes(o.i)} onClick={() => onToggle(o.i)}>
            {o.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}
