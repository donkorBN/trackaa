"use client";

import { ArrowRight, Briefcase, Check, Flame, Plus, Sparkles, User, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MoneyField } from "@/components/MoneyField";
import { Button, cx, FormError, Input, Spinner } from "@/components/ui";
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
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      {step > 0 && step < 4 && (
        <div className="mb-8 flex items-center gap-3">
          <div className="flex flex-1 gap-1.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className={cx("h-1.5 flex-1 rounded-full transition-colors duration-500", i <= step ? "bg-brand" : "bg-surface-3")} />
            ))}
          </div>
          <button type="button" onClick={() => router.replace("/")} className="text-[13px] font-medium text-muted">
            Skip
          </button>
        </div>
      )}

      <div key={step} className="flex flex-1 animate-pop flex-col">
        {step === 0 && (
          <div className="flex flex-1 flex-col justify-center text-center">
            <Image src="/icon-192.png" alt="" width={72} height={72} className="mx-auto rounded-[22px] shadow-float" />
            <h1 className="mt-8 text-[30px] leading-tight font-bold tracking-tight">Welcome{first ? `, ${first}` : ""} 👋</h1>
            <p className="mx-auto mt-3 max-w-xs text-[15px] text-muted">
              Every cedi in, every cedi out. Let&apos;s set things up. It takes about 30 seconds.
            </p>
            <div className="mx-auto mt-10 grid w-full max-w-xs gap-3 text-left text-sm">
              {(
                [
                  [Sparkles, "Log a spend in about five seconds"],
                  [Flame, "Build a daily streak and earn badges"],
                  [Briefcase, "Keep business money separate, if you have any"],
                ] as const
              ).map(([Icon, t], i) => (
                <div key={i} className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 shadow-card">
                  <Icon size={18} className="shrink-0 text-[#f97316]" />
                  {t}
                </div>
              ))}
            </div>
            <Button size="lg" className="mt-auto w-full" onClick={next}>
              Let&apos;s go <ArrowRight size={18} />
            </Button>
          </div>
        )}

        {step === 1 && (
          <>
            <h1 className="text-[26px] leading-tight font-bold tracking-tight">Where does your money live?</h1>
            <p className="mt-2 text-[15px] text-muted">Turn off what you don&apos;t use. Add what&apos;s in each right now, if you like.</p>
            <div className="mt-6 space-y-3">
              {accounts.map((a) => {
                const Icon = ACCOUNT_ICON[a.account_type];
                const on = !!use[a.id];
                return (
                  <div key={a.id} className={cx("rounded-3xl border p-4 transition", on ? "border-line bg-surface shadow-card" : "border-dashed border-line opacity-60")}>
                    <button
                      type="button"
                      onClick={() => {
                        haptic.tap();
                        setUse({ ...use, [a.id]: !on });
                      }}
                      className="flex w-full items-center gap-3 text-left"
                      aria-pressed={on}
                    >
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-2">
                        <Icon size={20} />
                      </span>
                      <span className="flex-1 text-[16px] font-semibold">{a.name}</span>
                      <span className={cx("flex h-7 w-7 items-center justify-center rounded-full transition", on ? "bg-income text-white" : "border-2 border-line")}>
                        {on && <Check size={16} strokeWidth={3} />}
                      </span>
                    </button>
                    {on && (
                      <div className="mt-3">
                        <MoneyField value={balances[a.id] ?? ""} onChange={(v) => setBalances({ ...balances, [a.id]: v })} placeholder="Balance now (optional)" />
                      </div>
                    )}
                  </div>
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
            <h1 className="text-[26px] leading-tight font-bold tracking-tight">Do you run a business or side hustle?</h1>
            <p className="mt-2 text-[15px] text-muted">We&apos;ll keep its money separate from yours. You can add one later too.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {(
                [
                  [false, User, "Just personal"],
                  [true, Briefcase, "Yes, I do"],
                ] as const
              ).map(([v, Icon, label]) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => {
                    haptic.tap();
                    setHasBusiness(v);
                  }}
                  className={cx(
                    "flex flex-col items-center gap-2 rounded-3xl border-2 px-4 py-6 font-semibold transition active:scale-95",
                    hasBusiness === v ? "border-accent bg-surface shadow-card" : "border-line bg-surface",
                  )}
                >
                  <Icon size={26} />
                  {label}
                </button>
              ))}
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
                    maxLength={80}
                    className="min-w-0 flex-1"
                  />
                  <Button onClick={addBiz} disabled={!bizName.trim()} className="h-11">
                    <Plus size={16} /> Add
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {bizList.map((b) => (
                    <span key={b} className="inline-flex animate-pop items-center gap-1.5 rounded-full bg-accent py-1.5 pr-1.5 pl-3.5 text-sm font-medium text-accent-fg">
                      {b}
                      <button type="button" aria-label={`Remove ${b}`} onClick={() => setBizList(bizList.filter((x) => x !== b))} className="rounded-full p-1 hover:bg-white/15">
                        <X size={13} />
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
            <h1 className="text-[26px] leading-tight font-bold tracking-tight">Set a monthly spending limit?</h1>
            <p className="mt-2 text-[15px] text-muted">We&apos;ll turn it into a daily amount you can spend. Optional.</p>
            <div className="mt-6">
              <MoneyField value={budget} onChange={setBudget} placeholder="e.g. 2,000" />
              <div className="mt-3 flex flex-wrap gap-2">
                {[100000, 200000, 300000, 500000].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      haptic.tap();
                      setBudget(String(p / 100));
                    }}
                    className="h-10 rounded-full border border-line bg-surface px-4 text-sm font-medium active:scale-95"
                  >
                    {formatGHS(p, { compact: true })}
                  </button>
                ))}
              </div>
              {parseAmount(budget) ? (
                <p className="mt-4 rounded-2xl bg-surface px-4 py-3 text-sm shadow-card">
                  That&apos;s about <b>{formatGHS(Math.floor(parseAmount(budget)! / 30))}</b> a day.
                </p>
              ) : null}
            </div>
            <FormError>{error}</FormError>
            <div className="mt-auto space-y-2 pt-6">
              <Button size="lg" className="w-full" onClick={finish} disabled={busy}>
                {busy && <Spinner />} Finish setup
              </Button>
              {!parseAmount(budget) && <p className="text-center text-xs text-muted">No limit? Just tap Finish.</p>}
            </div>
          </>
        )}

        {step === 4 && (
          <div className="flex flex-1 flex-col justify-center text-center">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-income text-white shadow-float">
              <Check size={48} strokeWidth={3} className="draw-check" />
            </div>
            <h1 className="mt-8 text-[30px] leading-tight font-bold tracking-tight">You&apos;re all set!</h1>
            <p className="mx-auto mt-3 max-w-xs text-[15px] text-muted">Record your first spend now to start your streak.</p>
            <Button size="lg" className="mt-auto w-full" onClick={() => router.replace("/?add=1")}>
              <Plus size={18} /> Record my first spend
            </Button>
            <button type="button" onClick={() => router.replace("/")} className="mt-3 h-11 text-sm font-medium text-muted">
              Go to my dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
