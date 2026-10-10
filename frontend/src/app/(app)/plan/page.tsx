"use client";

import { AlertTriangle, ArrowRight, CheckCircle2, CircleAlert, FileSpreadsheet, Flag, Plus, Target, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { ChartCard, LineChart, Meter, meterTone, toneLabel, type MeterTone } from "@/components/charts";
import { MoneyField } from "@/components/MoneyField";
import { useToast } from "@/components/toast";
import {
  Button,
  Card,
  Chip,
  cx,
  EmptyState,
  ErrorBox,
  Eyebrow,
  FormError,
  Input,
  Label,
  SectionTitle,
  Segmented,
  Sheet,
  Skeleton,
  Spinner,
} from "@/components/ui";
import { api, ApiError, fetcher, withQuery } from "@/lib/api";
import { deviceTimezone, shortDate, ymd } from "@/lib/dates";
import { useBudgets, useCategories, useGoals, useRefreshAll } from "@/lib/hooks";
import { formatGHS, parseAmount, toInputString } from "@/lib/money";
import type { Budget, BudgetsResponse, Goal, GoalDetail } from "@/lib/types";
import { categoryVisual, IconBubble } from "@/lib/visuals";

// Goal identity colours in a fixed categorical order (validated reference palette).
const GOAL_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];

function errorText(err: unknown) {
  const e = err as ApiError;
  return Object.values(e.fields ?? {})[0]?.[0] ?? e.message;
}

export default function PlanPage() {
  const budgets = useBudgets();
  const month = budgets.data
    ? new Date(budgets.data.month + "-01T00:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    : "";
  return (
    <div className="space-y-8">
      <header className="pt-1">
        <Eyebrow>{month}</Eyebrow>
        <h1 className="mt-0.5 text-[28px] leading-tight font-bold tracking-tight">Plan</h1>
      </header>
      <Budgets res={budgets.data} error={budgets.error} retry={() => budgets.mutate()} />
      <Goals />
      <Link
        href="/reconcile"
        className="flex items-center gap-3 rounded-3xl border border-line bg-surface p-4 shadow-card hover:bg-surface-2"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-transfer-soft text-transfer">
          <FileSpreadsheet size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">Reconcile statements</span>
          <span className="block text-[13px] text-muted">Check your MoMo or bank statement against what you recorded</span>
        </span>
        <ArrowRight size={18} className="shrink-0 text-subtle" />
      </Link>
    </div>
  );
}

/* ================= Budgets ================= */

function ToneBadge({ tone }: { tone: MeterTone }) {
  const Icon = tone === "good" ? CheckCircle2 : tone === "warn" ? AlertTriangle : CircleAlert;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        tone === "good" && "bg-income-soft text-income",
        tone === "warn" && "bg-[color-mix(in_oklab,#d97706_14%,transparent)] text-[#b45309] dark:text-[#fbbf24]",
        tone === "over" && "bg-expense-soft text-expense",
      )}
    >
      <Icon size={12} strokeWidth={2.5} /> {toneLabel(tone)}
    </span>
  );
}

function Budgets({ res, error, retry }: { res?: BudgetsResponse; error: unknown; retry: () => void }) {
  const [editing, setEditing] = useState<Budget | "new" | null>(null);
  if (error) return <ErrorBox error={error} onRetry={retry} />;
  if (!res) return <Skeleton className="h-72" />;

  const overall = res.data.find((b) => !b.category && b.scope === "all") ?? res.data.find((b) => !b.category);
  const byCategory = res.data.filter((b) => b.category);
  const others = res.data.filter((b) => !b.category && b !== overall);

  return (
    <section className="space-y-4">
      <SectionTitle
        action={
          <button type="button" onClick={() => setEditing("new")} className="text-[13px] font-semibold text-transfer">
            + Add budget
          </button>
        }
      >
        Budget
      </SectionTitle>

      {overall ? (
        <OverallBudget b={overall} res={res} onEdit={() => setEditing(overall)} />
      ) : (
        <EmptyState
          icon={<Target size={30} />}
          title="Set a monthly budget"
          body="We'll split it into a daily and weekly amount and show how much you can still spend."
          action={<Button onClick={() => setEditing("new")}>Set budget</Button>}
        />
      )}

      {[...others, ...byCategory].length > 0 && (
        <Card flush className="divide-y divide-line overflow-hidden">
          {[...others, ...byCategory].map((b) => (
            <BudgetRow key={b.id} b={b} onClick={() => setEditing(b)} />
          ))}
        </Card>
      )}

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New budget" : "Edit budget"}>
        {editing !== null && <BudgetForm budget={editing === "new" ? null : editing} res={res} onDone={() => setEditing(null)} />}
      </Sheet>
    </section>
  );
}

function scopeName(s: Budget["scope"]) {
  return s === "all" ? "Everything" : s === "personal" ? "Personal" : "Business";
}

function OverallBudget({ b, res, onEdit }: { b: Budget; res: BudgetsResponse; onEdit: () => void }) {
  const tone = meterTone(b.spent, b.amount, b.expected_by_now);
  const over = b.remaining < 0;
  return (
    <button type="button" onClick={onEdit} className="block w-full rounded-[28px] border border-line bg-surface p-5 text-left shadow-card">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] text-muted">Monthly budget{b.scope !== "all" ? ` · ${scopeName(b.scope)}` : ""}</span>
        <ToneBadge tone={tone} />
      </div>
      <div className={cx("mt-2 text-[34px] leading-none font-bold tracking-tight", over && "text-expense")}>
        {formatGHS(Math.abs(b.remaining))}
      </div>
      <div className="mt-1.5 text-sm text-muted">
        {over ? "over budget" : "left"} · {formatGHS(b.spent)} of {formatGHS(b.amount)} spent
      </div>
      <div className="mt-4">
        <Meter value={b.spent} max={b.amount} tone={tone} pace={b.expected_by_now} height={12} />
        <div className="mt-1.5 flex justify-between text-[11px] text-subtle">
          <span>
            Day {res.days_elapsed} of {res.days_in_month}
          </span>
          <span>| marks even pace</span>
        </div>
      </div>
      {b.daily_allowance !== null && res.days_left > 0 && (
        <p className="mt-4 rounded-2xl bg-surface-2 px-4 py-3 text-sm">
          {over ? (
            <>You&apos;ve gone over this month&apos;s budget. Every cedi from here adds to the overspend.</>
          ) : (
            <>
              You can spend <span className="font-semibold">{formatGHS(b.daily_allowance)} a day</span> for the next {res.days_left} day
              {res.days_left === 1 ? "" : "s"}.
            </>
          )}
        </p>
      )}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Period label="Today" spent={b.spent_today ?? 0} limit={b.daily} />
        <Period label="This week" spent={b.spent_this_week ?? 0} limit={b.weekly} />
        <Period label="This month" spent={b.spent} limit={b.amount} />
      </div>
    </button>
  );
}

function Period({ label, spent, limit }: { label: string; spent: number; limit: number }) {
  const tone = meterTone(spent, limit);
  return (
    <div className="rounded-2xl bg-surface-2 p-3">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="mt-1 text-[13px] leading-tight font-semibold break-words">{formatGHS(spent, { compact: true })}</div>
      <div className="mb-2 text-[11px] leading-tight text-muted break-words">of {formatGHS(limit, { compact: true })}</div>
      <Meter value={spent} max={limit} tone={tone} height={6} />
    </div>
  );
}

function BudgetRow({ b, onClick }: { b: Budget; onClick: () => void }) {
  const tone = meterTone(b.spent, b.amount, b.expected_by_now);
  const v = b.category ? categoryVisual(b.category.name) : null;
  return (
    <button type="button" onClick={onClick} className="block w-full px-4 py-3.5 text-left hover:bg-surface-2">
      <div className="flex items-center gap-3">
        {v ? (
          <IconBubble Icon={v.Icon} color={v.color} size={36} />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2">
            <Target size={17} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-medium">{b.category?.name ?? `${scopeName(b.scope)} budget`}</span>
            {tone !== "good" && <ToneBadge tone={tone} />}
          </div>
          <div className="tabular text-xs text-muted">
            {formatGHS(b.spent)} of {formatGHS(b.amount)}
          </div>
        </div>
        <div className={cx("tabular shrink-0 text-right text-[13px] font-semibold", b.remaining < 0 && "text-expense")}>
          {formatGHS(Math.abs(b.remaining), { compact: true })}
          <div className="text-[11px] font-normal text-muted">{b.remaining < 0 ? "over" : "left"}</div>
        </div>
      </div>
      <div className="mt-2.5 pl-12">
        <Meter value={b.spent} max={b.amount} tone={tone} pace={b.expected_by_now} height={6} />
      </div>
    </button>
  );
}

function BudgetForm({ budget, res, onDone }: { budget: Budget | null; res: BudgetsResponse; onDone: () => void }) {
  const toast = useToast();
  const refreshAll = useRefreshAll();
  const { categories } = useCategories();
  const [kind, setKind] = useState<"overall" | "category">(
    budget ? (budget.category ? "category" : "overall") : res.data.some((b) => !b.category) ? "category" : "overall",
  );
  const [scope, setScope] = useState<Budget["scope"]>(budget?.scope ?? "all");
  const [categoryId, setCategoryId] = useState<number | null>(budget?.category?.id ?? null);
  const [amount, setAmount] = useState(budget ? toInputString(budget.amount) : "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const p = parseAmount(amount);
  const days = res.days_in_month;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!p) return setError("Enter a budget greater than zero.");
    if (kind === "category" && !categoryId) return setError("Pick a category.");
    setBusy(true);
    setError(null);
    try {
      if (budget) await api(`/budgets/${budget.id}`, { method: "PATCH", body: { amount: p } });
      else
        await api("/budgets", {
          method: "POST",
          body: { amount: p, scope: kind === "overall" ? scope : "all", category_id: kind === "category" ? categoryId : null },
        });
      refreshAll();
      toast({ message: "Budget saved" });
      onDone();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  async function remove() {
    if (!budget) return;
    setBusy(true);
    try {
      await api(`/budgets/${budget.id}`, { method: "DELETE" });
      refreshAll();
      toast({ message: "Budget removed" });
      onDone();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-5">
      {!budget && (
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: "overall", label: "Whole month" },
            { value: "category", label: "One category" },
          ]}
        />
      )}
      {kind === "overall" && !budget && (
        <div>
          <Label>Counts spending from</Label>
          <div className="flex gap-2">
            {(["all", "personal", "business"] as const).map((s) => (
              <Chip key={s} active={scope === s} onClick={() => setScope(s)}>
                {scopeName(s)}
              </Chip>
            ))}
          </div>
        </div>
      )}
      {kind === "category" && !budget && (
        <div>
          <Label>Category</Label>
          <div className="flex flex-wrap gap-2">
            {categories
              .filter((c) => c.transaction_type === "expense")
              .map((c) => {
                const v = categoryVisual(c.name);
                return (
                  <Chip key={c.id} active={categoryId === c.id} onClick={() => setCategoryId(c.id)} icon={<v.Icon size={14} />}>
                    {c.name}
                  </Chip>
                );
              })}
          </div>
        </div>
      )}
      {budget && <div className="text-[15px] font-medium">{budget.category?.name ?? `Monthly budget · ${scopeName(budget.scope)}`}</div>}
      <div>
        <Label htmlFor="budget-amount">Monthly amount</Label>
        <MoneyField id="budget-amount" value={amount} onChange={setAmount} autoFocus={!!budget} />
        {p ? (
          <p className="tabular mt-2 text-[13px] text-muted">
            That&apos;s about <span className="font-semibold text-ink">{formatGHS(Math.floor(p / days))}</span> a day or{" "}
            <span className="font-semibold text-ink">{formatGHS(Math.floor((p * 7) / days))}</span> a week this month.
          </p>
        ) : null}
      </div>
      <FormError>{error}</FormError>
      <div className="flex gap-2">
        {budget && (
          <Button variant="danger" size="lg" onClick={remove} disabled={busy} aria-label="Delete budget">
            <Trash2 size={18} />
          </Button>
        )}
        <Button type="submit" size="lg" className="flex-1" disabled={busy}>
          {busy && <Spinner />} Save budget
        </Button>
      </div>
    </form>
  );
}

/* ================= Goals ================= */

function Goals() {
  const { goals, error, mutate, isLoading } = useGoals();
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<Goal | null>(null);
  const [adding, setAdding] = useState<Goal | null>(null);

  return (
    <section className="space-y-4">
      <SectionTitle
        action={
          <button type="button" onClick={() => setCreating(true)} className="text-[13px] font-semibold text-transfer">
            + New goal
          </button>
        }
      >
        Goals
      </SectionTitle>
      {error && <ErrorBox error={error} onRetry={() => mutate()} />}
      {isLoading && <Skeleton className="h-36" />}
      {!isLoading && goals.length === 0 && (
        <EmptyState
          icon={<Flag size={30} />}
          title="Save towards something"
          body="An emergency fund, rent, stock for the business, a new laptop. We'll show what to put aside each week."
          action={<Button onClick={() => setCreating(true)}>Create a goal</Button>}
        />
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {goals.map((g, i) => (
          <GoalCard
            key={g.id}
            goal={g}
            color={g.color ?? GOAL_COLORS[i % GOAL_COLORS.length]}
            onOpen={() => setOpen(g)}
            onAdd={() => setAdding(g)}
          />
        ))}
      </div>

      <Sheet open={creating} onClose={() => setCreating(false)} title="New goal">
        {creating && <GoalForm onDone={() => setCreating(false)} nextColor={GOAL_COLORS[goals.length % GOAL_COLORS.length]} />}
      </Sheet>
      <Sheet open={!!adding} onClose={() => setAdding(null)} title={adding ? `Add to ${adding.name}` : ""}>
        {adding && <ContributionForm goal={adding} onDone={() => setAdding(null)} />}
      </Sheet>
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.name} wide>
        {open && (
          <GoalDetailView
            goal={open}
            color={open.color ?? GOAL_COLORS[goals.findIndex((g) => g.id === open.id) % GOAL_COLORS.length]}
            onClose={() => setOpen(null)}
          />
        )}
      </Sheet>
    </section>
  );
}

function goalPlanText(g: Goal) {
  if (g.remaining <= 0) return "Goal reached. Nice work.";
  if (g.weekly_needed && g.target_date) return `Put aside ${formatGHS(g.weekly_needed)} a week to reach it by ${shortDate(g.target_date)}.`;
  if (g.projected_date) return `At your recent pace you'll get there around ${shortDate(g.projected_date)}.`;
  return "Add your first contribution to start tracking progress.";
}

function GoalCard({ goal: g, color, onOpen, onAdd }: { goal: Goal; color: string; onOpen: () => void; onAdd: () => void }) {
  return (
    <div className="rounded-3xl border border-line bg-surface p-5 shadow-card">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
              <span className="truncate text-[15px] font-semibold">{g.name}</span>
            </div>
            <div className="mt-1 text-xs text-muted">{g.target_date ? `By ${shortDate(g.target_date)}` : "No deadline"}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[22px] leading-none font-bold tracking-tight">{g.percent}%</div>
          </div>
        </div>
        <div className="mt-4 h-2.5 w-full rounded-full" style={{ background: `color-mix(in oklab, ${color} 16%, transparent)` }}>
          <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${g.percent}%`, background: color }} />
        </div>
        <div className="tabular mt-2 flex justify-between text-xs text-muted">
          <span>
            <span className="font-semibold text-ink">{formatGHS(g.saved)}</span> saved
          </span>
          <span>of {formatGHS(g.target_amount)}</span>
        </div>
        <p className="mt-3 text-[13px]">{goalPlanText(g)}</p>
        {g.on_track !== null && g.remaining > 0 && (
          <div className="mt-2">
            <span
              className={cx(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                g.on_track ? "bg-income-soft text-income" : "bg-expense-soft text-expense",
              )}
            >
              {g.on_track ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
              {g.on_track ? "On pace" : `Behind: at this pace, ${g.projected_date ? shortDate(g.projected_date) : "later"}`}
            </span>
          </div>
        )}
      </button>
      {g.remaining > 0 && (
        <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={onAdd}>
          <Plus size={15} /> Add money
        </Button>
      )}
    </div>
  );
}

function GoalForm({ goal, onDone, nextColor }: { goal?: Goal; onDone: () => void; nextColor?: string }) {
  const toast = useToast();
  const refreshAll = useRefreshAll();
  const [name, setName] = useState(goal?.name ?? "");
  const [target, setTarget] = useState(goal ? toInputString(goal.target_amount) : "");
  const [date, setDate] = useState(goal?.target_date ?? "");
  const [color, setColor] = useState(goal?.color ?? nextColor ?? GOAL_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const p = parseAmount(target);
    if (!name.trim()) return setError("Give the goal a name.");
    if (!p) return setError("Enter a target amount.");
    setBusy(true);
    try {
      const body = { name: name.trim(), target_amount: p, target_date: date || null, color };
      if (goal) await api(`/goals/${goal.id}`, { method: "PATCH", body });
      else await api("/goals", { method: "POST", body });
      refreshAll();
      toast({ message: goal ? "Goal updated" : "Goal created" });
      onDone();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <Label htmlFor="goal-name">Name</Label>
        <Input
          id="goal-name"
          autoFocus={!goal}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder="e.g. Emergency fund"
        />
      </div>
      <div>
        <Label htmlFor="goal-target">Target</Label>
        <MoneyField id="goal-target" value={target} onChange={setTarget} />
      </div>
      <div>
        <Label htmlFor="goal-date">Target date (optional)</Label>
        <Input id="goal-date" type="date" min={ymd(new Date())} value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div>
        <Label>Colour</Label>
        <div className="flex flex-wrap gap-2">
          {GOAL_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Colour ${c}`}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
              className={cx("h-8 w-8 rounded-full ring-offset-2 ring-offset-surface transition", color === c && "ring-2 ring-ink")}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
      <FormError>{error}</FormError>
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy && <Spinner />} {goal ? "Save goal" : "Create goal"}
      </Button>
    </form>
  );
}

function ContributionForm({ goal, onDone }: { goal: Goal; onDone: () => void }) {
  const toast = useToast();
  const refreshAll = useRefreshAll();
  const [amount, setAmount] = useState(goal.weekly_needed ? toInputString(goal.weekly_needed) : "");
  const [withdraw, setWithdraw] = useState(false);
  const [note, setNote] = useState("");
  const [date, setDate] = useState(ymd(new Date()));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const p = parseAmount(amount);
    if (!p) return setError("Enter an amount.");
    setBusy(true);
    try {
      const res = await api<GoalDetail>(`/goals/${goal.id}/contributions`, {
        method: "POST",
        body: { amount: withdraw ? -p : p, note: note.trim() || null, occurred_on: date },
      });
      refreshAll();
      toast({
        message: res.remaining <= 0 ? `🎉 ${goal.name} reached!` : `${formatGHS(p)} ${withdraw ? "taken out of" : "added to"} ${goal.name}`,
      });
      onDone();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Segmented
        value={withdraw ? "out" : "in"}
        onChange={(v) => setWithdraw(v === "out")}
        options={[
          { value: "in", label: "Add money" },
          { value: "out", label: "Take out" },
        ]}
      />
      <div>
        <Label htmlFor="contrib-amount">Amount</Label>
        <MoneyField id="contrib-amount" value={amount} onChange={setAmount} autoFocus />
        {goal.weekly_needed && !withdraw ? (
          <p className="mt-1.5 text-xs text-muted">Suggested: {formatGHS(goal.weekly_needed)} a week</p>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="contrib-date">Date</Label>
          <Input id="contrib-date" type="date" max={ymd(new Date())} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="contrib-note">Note</Label>
          <Input id="contrib-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} placeholder="Optional" />
        </div>
      </div>
      <p className="text-xs text-muted">
        This tracks progress towards the goal. To record the money actually moving, add a transfer to your savings account too.
      </p>
      <FormError>{error}</FormError>
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy && <Spinner />} Save
      </Button>
    </form>
  );
}

function GoalDetailView({ goal, color, onClose }: { goal: Goal; color: string; onClose: () => void }) {
  const toast = useToast();
  const refreshAll = useRefreshAll();
  const { data, mutate } = useSWR<GoalDetail>(withQuery(`/goals/${goal.id}`, { tz: deviceTimezone() }), fetcher);
  const [mode, setMode] = useState<"view" | "edit" | "add">("view");
  const [confirm, setConfirm] = useState(false);
  const g = data ?? { ...goal, contributions: [] };
  const history = [...(data?.contributions ?? [])].reverse(); // oldest first

  async function removeContribution(id: number) {
    await mutate(api<GoalDetail>(`/goals/${goal.id}/contributions/${id}`, { method: "DELETE" }), { revalidate: false });
    refreshAll();
  }
  async function del() {
    if (!confirm) return setConfirm(true);
    await api(`/goals/${goal.id}`, { method: "DELETE" });
    refreshAll();
    toast({ message: "Goal deleted" });
    onClose();
  }

  if (mode === "edit") return <GoalForm goal={g} onDone={onClose} />;
  if (mode === "add") return <ContributionForm goal={g} onDone={onClose} />;

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[34px] leading-none font-bold tracking-tight">{formatGHS(g.saved)}</div>
        <div className="mt-1.5 text-sm text-muted">
          saved of {formatGHS(g.target_amount)} · {g.percent}%{g.target_date ? ` · by ${shortDate(g.target_date)}` : ""}
        </div>
        <p className="mt-3 text-sm">{goalPlanText(g)}</p>
        {g.monthly_needed ? <p className="mt-1 text-[13px] text-muted">That&apos;s about {formatGHS(g.monthly_needed)} a month.</p> : null}
      </div>

      {history.length > 0 && (
        <ChartCard
          title="Progress"
          subtitle="Total saved over time"
          table={{
            headers: ["Date", "Change", "Total"],
            rows: history.map((c) => [shortDate(c.occurred_on), formatGHS(c.amount, { sign: true }), formatGHS(c.running_total)]),
          }}
        >
          <LineChart
            points={[
              { key: "start", label: "Start", value: 0 },
              ...history.map((c) => ({ key: String(c.id), label: shortDate(c.occurred_on), value: c.running_total })),
            ]}
            target={g.target_amount}
            color={color}
            startLabel={shortDate(history[0].occurred_on)}
            endLabel={shortDate(history[history.length - 1].occurred_on)}
          />
        </ChartCard>
      )}

      <div className="flex gap-2">
        {g.remaining > 0 && (
          <Button className="flex-1" onClick={() => setMode("add")}>
            <Plus size={16} /> Add money
          </Button>
        )}
        <Button variant="secondary" className="flex-1" onClick={() => setMode("edit")}>
          Edit goal
        </Button>
      </div>

      {data && data.contributions.length > 0 && (
        <div>
          <div className="mb-2 text-[13px] font-medium text-muted">History</div>
          <Card flush className="divide-y divide-line overflow-hidden">
            {data.contributions.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className={cx("tabular text-[15px] font-semibold", c.amount < 0 && "text-expense")}>
                    {formatGHS(c.amount, { sign: true })}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {shortDate(c.occurred_on)}
                    {c.note ? ` · ${c.note}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeContribution(c.id)}
                  aria-label="Remove contribution"
                  className="rounded-lg p-2 text-subtle hover:bg-surface-2 hover:text-expense"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </Card>
        </div>
      )}

      <Button variant="danger" className="w-full" onClick={del}>
        <Trash2 size={16} /> {confirm ? "Tap again to delete this goal" : "Delete goal"}
      </Button>
    </div>
  );
}
