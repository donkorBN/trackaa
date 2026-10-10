"use client";

import { CircleAlert, CircleCheck, FileSpreadsheet, Flag, Plus, Target, Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { ChartCard, LineChart, Meter, meterTone, ToneTag } from "@/components/charts";
import { MoneyField } from "@/components/MoneyField";
import { useToast } from "@/components/toast";
import {
  Button,
  Callout,
  Card,
  Chip,
  EmptyState,
  ErrorBox,
  Eyebrow,
  Field,
  FormError,
  Glyph,
  Input,
  LinkCard,
  ListCard,
  ListRow,
  Num,
  PageHeader,
  ProgressBar,
  SectionTitle,
  Segmented,
  Sheet,
  Skeleton,
  Spinner,
  Tag,
} from "@/components/ui";
import { api, ApiError, fetcher, withQuery } from "@/lib/api";
import { deviceTimezone, shortDate, ymd } from "@/lib/dates";
import { useBudgets, useCategories, useGoals, useRefreshAll } from "@/lib/hooks";
import { formatGHS, parseAmount, toInputString } from "@/lib/money";
import type { Budget, BudgetsResponse, Goal, GoalDetail } from "@/lib/types";
import { categoryIcon } from "@/lib/visuals";

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
      <PageHeader eyebrow={month || undefined} title="Plan" />
      <Budgets res={budgets.data} error={budgets.error} retry={() => budgets.mutate()} />
      <Goals />
      <LinkCard href="/reconcile">
        <div className="flex items-center gap-3">
          <Glyph icon={FileSpreadsheet} />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-ink">Reconcile statements</span>
            <span className="mt-0.5 block text-[12.5px] text-muted">Check your MoMo or bank statement against what you recorded</span>
          </span>
        </div>
      </LinkCard>
    </div>
  );
}

/* ================= Budgets ================= */

function Budgets({ res, error, retry }: { res?: BudgetsResponse; error: unknown; retry: () => void }) {
  const [editing, setEditing] = useState<Budget | "new" | null>(null);
  if (error) return <ErrorBox error={error} onRetry={retry} />;
  if (!res) return <Skeleton className="h-72" />;

  const overall = res.data.find((b) => !b.category && b.scope === "all") ?? res.data.find((b) => !b.category);
  const byCategory = res.data.filter((b) => b.category);
  const others = res.data.filter((b) => !b.category && b !== overall);

  return (
    <section>
      <SectionTitle
        action={
          <Button variant="secondary" size="sm" onClick={() => setEditing("new")}>
            + Add budget
          </Button>
        }
      >
        Budget
      </SectionTitle>

      <div className="space-y-3">
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
          <ListCard>
            {[...others, ...byCategory].map((b) => (
              <BudgetRow key={b.id} b={b} onClick={() => setEditing(b)} />
            ))}
          </ListCard>
        )}
      </div>

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
    <button
      type="button"
      onClick={onEdit}
      className="block w-full rounded-card border border-line bg-surface p-5 text-left transition-colors hover:border-ink/30"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-muted">Monthly budget{b.scope !== "all" ? ` · ${scopeName(b.scope)}` : ""}</span>
        <ToneTag tone={tone} />
      </div>
      <Num tone={over ? "expense" : "neutral"} className="mt-2 block text-[40px] leading-none font-extrabold">
        {formatGHS(Math.abs(b.remaining))}
      </Num>
      <div className="mt-2 text-[13px] text-muted">
        {over ? "over budget" : "left"} · <span className="tabular">{formatGHS(b.spent)}</span> of{" "}
        <span className="tabular">{formatGHS(b.amount)}</span> spent
      </div>
      <div className="mt-5">
        <Meter value={b.spent} max={b.amount} tone={tone} pace={b.expected_by_now} height={12} />
        <div className="mt-2 flex justify-between text-[11.5px] text-subtle">
          <span>
            Day {res.days_elapsed} of {res.days_in_month}
          </span>
          <span>| marks even pace</span>
        </div>
      </div>
      {b.daily_allowance !== null && res.days_left > 0 && (
        <Callout tone={over ? "bad" : "info"} className="mt-4">
          {over ? (
            <>You&apos;ve gone over this month&apos;s budget. Every cedi from here adds to the overspend.</>
          ) : (
            <>
              You can spend <Num>{formatGHS(b.daily_allowance)} a day</Num> for the next {res.days_left} day
              {res.days_left === 1 ? "" : "s"}.
            </>
          )}
        </Callout>
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
    <div className="rounded-tile bg-surface-2 p-3">
      <Eyebrow className="truncate">{label}</Eyebrow>
      <Num className="mt-1 block text-[15px] leading-tight break-words">{formatGHS(spent, { compact: true })}</Num>
      <div className="tabular mb-2 text-[11.5px] leading-tight break-words text-muted">of {formatGHS(limit, { compact: true })}</div>
      <Meter value={spent} max={limit} tone={tone} height={6} />
    </div>
  );
}

function BudgetRow({ b, onClick }: { b: Budget; onClick: () => void }) {
  const tone = meterTone(b.spent, b.amount, b.expected_by_now);
  const over = b.remaining < 0;
  return (
    <button type="button" onClick={onClick} className="block w-full px-4 py-3.5 text-left transition-colors hover:bg-surface-2">
      <div className="flex items-center gap-3">
        <Glyph icon={b.category ? categoryIcon(b.category.name) : Target} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold text-ink">{b.category?.name ?? `${scopeName(b.scope)} budget`}</span>
            {tone !== "good" && <ToneTag tone={tone} />}
          </div>
          <div className="tabular mt-0.5 text-[12.5px] text-muted">
            {formatGHS(b.spent)} of {formatGHS(b.amount)}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <Num tone={over ? "expense" : "neutral"} className="block text-[15px]">
            {formatGHS(Math.abs(b.remaining), { compact: true })}
          </Num>
          <div className="text-[11.5px] text-muted">{over ? "over" : "left"}</div>
        </div>
      </div>
      <div className="mt-2.5 pl-[52px]">
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
          label="Budget type"
          options={[
            { value: "overall", label: "Whole month" },
            { value: "category", label: "One category" },
          ]}
        />
      )}
      {kind === "overall" && !budget && (
        <Field label="Counts spending from">
          <div className="flex flex-wrap gap-2">
            {(["all", "personal", "business"] as const).map((s) => (
              <Chip key={s} active={scope === s} onClick={() => setScope(s)}>
                {scopeName(s)}
              </Chip>
            ))}
          </div>
        </Field>
      )}
      {kind === "category" && !budget && (
        <Field label="Category">
          <div className="flex flex-wrap gap-2">
            {categories
              .filter((c) => c.transaction_type === "expense")
              .map((c) => (
                <Chip key={c.id} active={categoryId === c.id} onClick={() => setCategoryId(c.id)} icon={<CategoryIcon name={c.name} />}>
                  {c.name}
                </Chip>
              ))}
          </div>
        </Field>
      )}
      {budget && (
        <div className="flex items-center gap-3">
          <Glyph icon={budget.category ? categoryIcon(budget.category.name) : Target} />
          <span className="text-[15px] font-semibold text-ink">{budget.category?.name ?? `Monthly budget · ${scopeName(budget.scope)}`}</span>
        </div>
      )}
      <Field
        label="Monthly amount"
        htmlFor="budget-amount"
        hint={
          p ? (
            <span className="tabular">
              That&apos;s about <Num>{formatGHS(Math.floor(p / days))}</Num> a day or{" "}
              <Num>{formatGHS(Math.floor((p * 7) / days))}</Num> a week this month.
            </span>
          ) : null
        }
      >
        <MoneyField id="budget-amount" value={amount} onChange={setAmount} autoFocus={!!budget} />
      </Field>
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

/** Small category icon for chips (on-system: inherits the chip's ink/surface colour). */
function CategoryIcon({ name }: { name: string }) {
  const Icon = categoryIcon(name);
  return <Icon size={14} />;
}

/* ================= Goals ================= */

function Goals() {
  const { goals, error, mutate, isLoading } = useGoals();
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<Goal | null>(null);
  const [adding, setAdding] = useState<Goal | null>(null);

  return (
    <section>
      <SectionTitle
        action={
          <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
            + New goal
          </Button>
        }
      >
        Goals
      </SectionTitle>
      <div className="space-y-3">
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
        {goals.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2">
            {goals.map((g) => (
              <GoalCard key={g.id} goal={g} onOpen={() => setOpen(g)} onAdd={() => setAdding(g)} />
            ))}
          </div>
        )}
      </div>

      <Sheet open={creating} onClose={() => setCreating(false)} title="New goal">
        {creating && <GoalForm onDone={() => setCreating(false)} />}
      </Sheet>
      <Sheet open={!!adding} onClose={() => setAdding(null)} title={adding ? `Add to ${adding.name}` : ""}>
        {adding && <ContributionForm goal={adding} onDone={() => setAdding(null)} />}
      </Sheet>
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.name} wide>
        {open && <GoalDetailView goal={open} onClose={() => setOpen(null)} />}
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

/** Goal pace as words + icon, never colour alone. */
function GoalPaceTag({ g }: { g: Goal }) {
  if (g.on_track === null) return null;
  return g.on_track ? (
    <Tag tone="good" icon={CircleCheck}>
      On pace
    </Tag>
  ) : (
    <Tag tone="warn" icon={TriangleAlert}>
      {`Behind: at this pace, ${g.projected_date ? shortDate(g.projected_date) : "later"}`}
    </Tag>
  );
}

function GoalCard({ goal: g, onOpen, onAdd }: { goal: Goal; onOpen: () => void; onAdd: () => void }) {
  const reached = g.remaining <= 0;
  return (
    <Card>
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="flex items-start gap-3">
          <Glyph icon={Flag} active={reached} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold text-ink">{g.name}</div>
            <div className="mt-0.5 text-[12.5px] text-muted">{g.target_date ? `By ${shortDate(g.target_date)}` : "No deadline"}</div>
          </div>
          <Num className="shrink-0 text-[24px] leading-none font-extrabold">{g.percent}%</Num>
        </div>
        <div className="mt-4">
          <ProgressBar value={g.saved} max={g.target_amount} tone="brand" label={`${g.name} progress`} />
        </div>
        <div className="mt-2 flex justify-between gap-2 text-[12.5px] text-muted">
          <span>
            <Num className="text-[13px]">{formatGHS(g.saved)}</Num> saved
          </span>
          <span className="tabular">of {formatGHS(g.target_amount)}</span>
        </div>
        <p className="mt-3 text-[13px] text-ink">{goalPlanText(g)}</p>
        {g.on_track !== null && g.remaining > 0 && (
          <div className="mt-2.5">
            <GoalPaceTag g={g} />
          </div>
        )}
      </button>
      {g.remaining > 0 && (
        <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={onAdd}>
          <Plus size={15} /> Add money
        </Button>
      )}
    </Card>
  );
}

function GoalForm({ goal, onDone }: { goal?: Goal; onDone: () => void }) {
  const toast = useToast();
  const refreshAll = useRefreshAll();
  const [name, setName] = useState(goal?.name ?? "");
  const [target, setTarget] = useState(goal ? toInputString(goal.target_amount) : "");
  const [date, setDate] = useState(goal?.target_date ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const p = parseAmount(target);
    if (!name.trim()) return setError("Give the goal a name.");
    if (!p) return setError("Enter a target amount.");
    setBusy(true);
    try {
      // Goals render on-system (no per-goal colour). Keep any stored value; new goals send null (allowed by the API).
      const body = { name: name.trim(), target_amount: p, target_date: date || null, color: goal?.color ?? null };
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
      <Field label="Name" htmlFor="goal-name">
        <Input
          id="goal-name"
          autoFocus={!goal}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder="e.g. Emergency fund"
        />
      </Field>
      <Field label="Target" htmlFor="goal-target">
        <MoneyField id="goal-target" value={target} onChange={setTarget} />
      </Field>
      <Field label="Target date (optional)" htmlFor="goal-date">
        <Input id="goal-date" type="date" min={ymd(new Date())} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
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
        label="Add or take out"
        options={[
          { value: "in", label: "Add money" },
          { value: "out", label: "Take out" },
        ]}
      />
      <Field
        label="Amount"
        htmlFor="contrib-amount"
        hint={
          goal.weekly_needed && !withdraw ? (
            <>
              Suggested: <Num>{formatGHS(goal.weekly_needed)}</Num> a week
            </>
          ) : null
        }
      >
        <MoneyField id="contrib-amount" value={amount} onChange={setAmount} autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Date" htmlFor="contrib-date">
          <Input id="contrib-date" type="date" max={ymd(new Date())} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Note" htmlFor="contrib-note">
          <Input id="contrib-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} placeholder="Optional" />
        </Field>
      </div>
      <Callout>This tracks progress towards the goal. To record the money actually moving, add a transfer to your savings account too.</Callout>
      <FormError>{error}</FormError>
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy && <Spinner />} Save
      </Button>
    </form>
  );
}

function GoalDetailView({ goal, onClose }: { goal: Goal; onClose: () => void }) {
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
        <Eyebrow>Saved</Eyebrow>
        <Num className="mt-1 block text-[40px] leading-none font-extrabold">{formatGHS(g.saved)}</Num>
        <div className="mt-2 text-[13px] text-muted">
          saved of <span className="tabular">{formatGHS(g.target_amount)}</span> · {g.percent}%
          {g.target_date ? ` · by ${shortDate(g.target_date)}` : ""}
        </div>
        <div className="mt-4">
          <ProgressBar value={g.saved} max={g.target_amount} tone="brand" size="lg" label={`${g.name} progress`} />
        </div>
        <p className="mt-4 text-sm text-ink">{goalPlanText(g)}</p>
        {g.monthly_needed ? (
          <p className="mt-1 text-[13px] text-muted">
            That&apos;s about <Num>{formatGHS(g.monthly_needed)}</Num> a month.
          </p>
        ) : null}
        {g.on_track !== null && g.remaining > 0 && (
          <div className="mt-3">
            <GoalPaceTag g={g} />
          </div>
        )}
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
            color="var(--text)"
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
          <Eyebrow className="mb-2 px-0.5">History</Eyebrow>
          <ListCard>
            {data.contributions.map((c) => (
              <ListRow
                key={c.id}
                title={
                  <Num tone={c.amount < 0 ? "expense" : "neutral"} className="text-[15px]">
                    {formatGHS(c.amount, { sign: true })}
                  </Num>
                }
                meta={`${shortDate(c.occurred_on)}${c.note ? ` · ${c.note}` : ""}`}
                trailing={
                  <button
                    type="button"
                    onClick={() => removeContribution(c.id)}
                    aria-label="Remove contribution"
                    className="flex h-9 w-9 items-center justify-center rounded-control text-subtle transition-colors hover:bg-expense-soft hover:text-expense"
                  >
                    <Trash2 size={16} />
                  </button>
                }
              />
            ))}
          </ListCard>
        </div>
      )}

      <Button variant="danger" className="w-full" onClick={del}>
        {confirm ? <CircleAlert size={16} /> : <Trash2 size={16} />} {confirm ? "Tap again to delete this goal" : "Delete goal"}
      </Button>
    </div>
  );
}
