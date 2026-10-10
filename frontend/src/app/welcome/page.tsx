"use client";

import { ArrowRight, Briefcase, Check, Flame, Plus, Sparkles, User, Wallet, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MoneyField } from "@/components/MoneyField";
import { Wordmark } from "@/components/ui";
import { Button, Callout, Card, Chip, cx, FormError, Glyph, IconTile, Input, ListCard, ListRow, Num, ProgressBar, Spinner } from "@/components/ui";
import { api, ApiError, getToken } from "@/lib/api";
import { confetti, haptic } from "@/lib/feedback";
import { useAccounts, useMe } from "@/lib/hooks";
import { formatGHS, parseAmount } from "@/lib/money";
import { ACCOUNT_ICON } from "@/lib/visuals";

type Step = 0 | 1 | 2 | 3 | 4;

/** First-run setup: which accounts you use (and what's in them), your businesses, a budget. All skippable. */
export default function WelcomePage() {
  const router = useRouter();
  const { data: me } = useMe();
  const { accounts } = useAccounts();
  const [step, setStep] = useState<Step>(0);
  const [use, setUse] = useState<Record<number, boolean>>({});
  const [balances, setBalances] = useState<Record<number, string>>({});
  const [hasBusiness, setHasBusiness] = useState<boolean | null>(null);
  const [bizName, setBizName] = useState("");
  const [bizList, setBizList] = useState<string[]>([]);
  const [budget, setBudget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) router.replace("/login/");
  }, [router]);
  useEffect(() => {
    setUse((u) => (Object.keys(u).length ? u : Object.fromEntries(accounts.map((a) => [a.id, true]))));
  }, [accounts]);

  const next = () => {
    haptic.tap();
    setError(null);
    setStep((s) => Math.min(4, s + 1) as Step);
  };

  function addBiz() {
    const n = bizName.trim();
    if (!n || bizList.includes(n)) return;
    haptic.tap();
    setBizList([...bizList, n]);
    setBizName("");
  }

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      for (const a of accounts) {
        if (!use[a.id]) {
          await api(`/accounts/${a.id}`, { method: "DELETE" }).catch(() => api(`/accounts/${a.id}`, { method: "PATCH", body: { archived: true } }));
          continue;
        }
        const p = balances[a.id] ? parseAmount(balances[a.id]) : null;
        if (p) await api(`/accounts/${a.id}`, { method: "PATCH", body: { opening_balance: p } });
      }
      if (hasBusiness) for (const name of bizList) await api("/businesses", { method: "POST", body: { name } });
      const b = parseAmount(budget);
      if (b) await api("/budgets", { method: "POST", body: { amount: b } });
      haptic.success();
      confetti("big");
      setStep(4);
    } catch (e) {
      const err = e as ApiError;
      setError(Object.values(err.fields ?? {})[0]?.[0] ?? err.message);
    } finally {
      setBusy(false);
    }
  }

  const first = me?.name.split(" ")[0] ?? "";
  const usedCount = accounts.filter((a) => use[a.id]).length;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-bg px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      {step > 0 && step < 4 && (
        <div className="mb-8">
          <div className="flex items-center justify-between gap-3">
            <span className="eyebrow">Step {step} of 3</span>
            <Button variant="ghost" size="sm" className="-mr-2" onClick={() => router.replace("/")}>
              Skip
            </Button>
          </div>
          <div className="mt-2">
            <ProgressBar value={step} max={3} size="sm" label="Setup progress" />
          </div>
        </div>
      )}

      <div key={step} className="flex flex-1 animate-pop flex-col">
        {step === 0 && (
          <div className="flex flex-1 flex-col">
            <div className="pt-2">
              <Wordmark className="text-ink" />
            </div>
            <div className="flex flex-1 flex-col justify-center py-10 text-center">
              <div className="mx-auto">
                <IconTile size={88}>
                  <Wallet size={40} />
                </IconTile>
              </div>
              <h1 className="mt-9 text-[34px] leading-[1.05] font-extrabold text-ink">Welcome{first ? `, ${first}` : ""}</h1>
              <p className="mx-auto mt-3 max-w-xs text-[15px] text-muted">
                Every cedi in, every cedi out. Let&apos;s set things up. It takes about 30 seconds.
              </p>
              <ListCard className="mt-9 text-left">
                {(
                  [
                    [Sparkles, "Log a spend in about five seconds"],
                    [Flame, "Build a daily streak and earn badges"],
                    [Briefcase, "Keep business money separate, if you have any"],
                  ] as const
                ).map(([Icon, t], i) => (
                  <ListRow key={i} leading={<Glyph icon={Icon} size={36} />} title={<span className="block text-[14px] whitespace-normal">{t}</span>} />
                ))}
              </ListCard>
            </div>
            <Button size="lg" className="w-full" onClick={next}>
              Let&apos;s go <ArrowRight size={18} />
            </Button>
          </div>
        )}

        {step === 1 && (
          <>
            <StepTitle title="Where does your money live?" body={<>Turn off what you don&apos;t use. Add what&apos;s in each right now, if you like.</>} />
            <div className="mt-6 space-y-3">
              {accounts.map((a) => {
                const Icon = ACCOUNT_ICON[a.account_type];
                const on = !!use[a.id];
                return (
                  <Card key={a.id} tone={on ? "default" : "dashed"} className={cx("p-4 transition-colors", !on && "opacity-70")}>
                    <button
                      type="button"
                      onClick={() => {
                        haptic.tap();
                        setUse({ ...use, [a.id]: !on });
                      }}
                      className="flex w-full items-center gap-3 text-left"
                      aria-pressed={on}
                    >
                      <Glyph icon={Icon} size={44} active={on} />
                      <span className="flex-1 text-[16px] font-semibold text-ink">{a.name}</span>
                      <CheckMark on={on} />
                    </button>
                    {on && (
                      <div className="mt-3">
                        <MoneyField value={balances[a.id] ?? ""} onChange={(v) => setBalances({ ...balances, [a.id]: v })} placeholder="Balance now (optional)" />
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
            <Button size="lg" className="mt-auto w-full" onClick={next} disabled={usedCount === 0}>
              Continue <ArrowRight size={18} />
            </Button>
          </>
        )}

        {step === 2 && (
          <>
            <StepTitle title="Do you run a business or side hustle?" body={<>We&apos;ll keep its money separate from yours. You can add one later too.</>} />
            <div className="mt-6 grid grid-cols-2 gap-3">
              {(
                [
                  [false, User, "Just personal"],
                  [true, Briefcase, "Yes, I do"],
                ] as const
              ).map(([v, Icon, label]) => {
                const on = hasBusiness === v;
                return (
                  <button
                    key={String(v)}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      haptic.tap();
                      setHasBusiness(v);
                    }}
                    className={cx(
                      "flex flex-col items-center gap-3 rounded-card border-[1.5px] px-4 py-6 text-[15px] font-bold transition-colors active:scale-[0.98]",
                      on ? "border-ink bg-hero text-hero-fg" : "border-line bg-surface text-ink hover:border-ink/40",
                    )}
                  >
                    <Glyph icon={Icon} size={48} active={on} />
                    {label}
                  </button>
                );
              })}
            </div>
            {hasBusiness && (
              <div className="mt-6">
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    value={bizName}
                    onChange={(e) => setBizName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addBiz();
                      }
                    }}
                    placeholder="Business name"
                    aria-label="Business name"
                    maxLength={80}
                    className="min-w-0 flex-1"
                  />
                  <Button variant="secondary" onClick={addBiz} disabled={!bizName.trim()} className="h-12">
                    <Plus size={16} /> Add
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {bizList.map((b) => (
                    <span
                      key={b}
                      className="inline-flex h-9 animate-pop items-center gap-1 rounded-full border-[1.5px] border-ink bg-ink pr-1 pl-3.5 text-[13px] font-semibold text-surface"
                    >
                      {b}
                      <button
                        type="button"
                        aria-label={`Remove ${b}`}
                        onClick={() => setBizList(bizList.filter((x) => x !== b))}
                        className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-surface/15"
                      >
                        <X size={14} strokeWidth={2.5} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
            <Button size="lg" className="mt-auto w-full" onClick={next} disabled={hasBusiness === null || (hasBusiness && bizList.length === 0)}>
              Continue <ArrowRight size={18} />
            </Button>
          </>
        )}

        {step === 3 && (
          <>
            <StepTitle title="Set a monthly spending limit?" body={<>We&apos;ll turn it into a daily amount you can spend. Optional.</>} />
            <div className="mt-6">
              <MoneyField value={budget} onChange={setBudget} placeholder="e.g. 2,000" />
              <div className="mt-3 flex flex-wrap gap-2">
                {[100000, 200000, 300000, 500000].map((p) => (
                  <Chip
                    key={p}
                    active={parseAmount(budget) === p}
                    onClick={() => {
                      haptic.tap();
                      setBudget(String(p / 100));
                    }}
                  >
                    {formatGHS(p, { compact: true })}
                  </Chip>
                ))}
              </div>
              {parseAmount(budget) ? (
                <Callout className="mt-4">
                  That&apos;s about <Num>{formatGHS(Math.floor(parseAmount(budget)! / 30))}</Num> a day.
                </Callout>
              ) : null}
            </div>
            <div className="mt-4">
              <FormError>{error}</FormError>
            </div>
            <div className="mt-auto space-y-2 pt-6">
              <Button size="lg" className="w-full" onClick={finish} disabled={busy}>
                {busy && <Spinner />} Finish setup
              </Button>
              {!parseAmount(budget) && <p className="text-center text-[12.5px] text-muted">No limit? Just tap Finish.</p>}
            </div>
          </>
        )}

        {step === 4 && (
          <div className="flex flex-1 flex-col">
            <div className="flex flex-1 flex-col justify-center text-center">
              <div className="mx-auto">
                <IconTile size={96}>
                  <Check size={46} strokeWidth={3} className="draw-check" />
                </IconTile>
              </div>
              <h1 className="mt-9 text-[34px] leading-[1.05] font-extrabold text-ink">You&apos;re all set!</h1>
              <p className="mx-auto mt-3 max-w-xs text-[15px] text-muted">Record your first spend now to start your streak.</p>
            </div>
            <Button size="lg" className="w-full" onClick={() => router.replace("/?add=1")}>
              <Plus size={18} /> Record my first spend
            </Button>
            <Button variant="ghost" className="mt-2 w-full" onClick={() => router.replace("/")}>
              Go to my dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Heading + one line of context for each setup step. */
function StepTitle({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-[28px] leading-[1.1] font-extrabold text-ink">{title}</h1>
      <p className="mt-2 text-[15px] text-muted">{body}</p>
    </div>
  );
}

/** Round tick showing whether an account is in use. */
function CheckMark({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cx(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
        on ? "border-brand-ink bg-brand text-brand-ink" : "border-line bg-surface",
      )}
    >
      {on && <Check size={16} strokeWidth={3} />}
    </span>
  );
}
