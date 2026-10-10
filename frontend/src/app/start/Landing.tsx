"use client";

import {
  ArrowRight, Briefcase, Check, FileSpreadsheet, Flame, KeyRound, Lock, NotebookPen, Sheet as SheetIcon, Smartphone, Target, UserPlus, X, Zap,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { buttonClass, Card, cx, Glyph, IconTile, Tag, Wordmark } from "@/components/ui";
import { useMeta } from "@/lib/hooks";

/*
 * Sales page for ad traffic. Order: name the pain, let them recognise themselves,
 * the hard truth, what doing nothing costs, the offer, objections, the close.
 * Rule: every claim here is something the product actually does today.
 */

const RECOGNISE = [
  "You check your MoMo balance and say “eii, how?”",
  "You remember the big spends. It’s the GH₵ 10s and 20s you can’t account for.",
  "Someone asks for “small money”, you send it, and by Thursday you’re short.",
  "Your business money and your own money live in the same MoMo wallet.",
  "You started a budget in a notebook or on Excel. It died in week two.",
  "By the 20th you’re counting days to payday, or deciding who to call for a loan.",
];

const TRIED: { icon: LucideIcon; name: string; why: string }[] = [
  { icon: NotebookPen, name: "The notebook", why: "You have to remember to write it down and add it up yourself. Nobody keeps that up." },
  { icon: SheetIcon, name: "The Excel sheet", why: "Fine on a laptop on Sunday. Useless at the trotro station on Tuesday." },
  { icon: X, name: "Foreign budgeting apps", why: "Built for people who swipe cards. Your money moves on MoMo and in cash, in cedis." },
];

const FIXES: { icon: LucideIcon; pain: string; title: string; body: string }[] = [
  {
    icon: Zap,
    pain: "“I forget to write things down.”",
    title: "Log it in five seconds",
    body: "Tap +, type the amount, pick a category. Done before the mate collects the fare. No signal? It saves on your phone and syncs later.",
  },
  {
    icon: Target,
    pain: "“I only find out I’m broke at month end.”",
    title: "A budget that talks in days",
    body: "Set one monthly amount and Trackaa tells you what you can spend today and this week. A number you can act on, not a scary total.",
  },
  {
    icon: FileSpreadsheet,
    pain: "“I know I’m missing some spends.”",
    title: "Check it against your MoMo statement",
    body: "Import your MTN MoMo or bank statement and see every line you forgot to record. Add it with one tap. The file is read on your phone; only the transactions are saved.",
  },
  {
    icon: Briefcase,
    pain: "“My business money and my money are mixed up.”",
    title: "Personal and business, apart",
    body: "Mark any spend as personal or for your business, and see what each business really made this month.",
  },
  {
    icon: Flame,
    pain: "“I always quit after a week.”",
    title: "A habit that sticks",
    body: "Streaks, levels and badges make showing up feel good. Spent nothing today? One tap check-in keeps your streak.",
  },
  {
    icon: Lock,
    pain: "“I don’t want an app touching my MoMo.”",
    title: "Nothing is connected",
    body: "Trackaa never asks for your PIN or bank login. Export everything to a spreadsheet, or delete your account, whenever you want.",
  },
];

const INCLUDED = [
  "Your own Trackaa account",
  "Unlimited transactions, accounts and categories",
  "Monthly budget broken into daily and weekly amounts",
  "Savings goals with a weekly target",
  "MoMo and bank statement checks",
  "Insights: where it went, month by month",
  "Personal and business tracking",
  "Works on any phone and laptop, no download",
];

const STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: KeyRound, title: "Get your access code", body: "Pay with MoMo or card. One code per person." },
  { icon: UserPlus, title: "Create your account", body: "Enter the code, your name and a password." },
  { icon: Smartphone, title: "Add it to your home screen", body: "It opens like an app. Log your first spend today." },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "I don’t earn much. Is this really for me?",
    a: "Especially for you. When money is tight, a GH₵ 20 leak hurts more. You can’t keep what you can’t see.",
  },
  {
    q: "I’ve tried tracking before and stopped. Why would this be different?",
    a: "Most tools make it a chore. Here a spend takes five seconds, your categories come first, and your streak gives you a reason to open it tomorrow.",
  },
  {
    q: "Is it connected to my MoMo or bank account?",
    a: "No. You record what you spend, and you can import a statement to check you didn’t miss anything. Trackaa never asks for your PIN or bank login.",
  },
  {
    q: "Do I need to download anything?",
    a: "No. It runs in your phone’s browser. Add it to your home screen and it opens like an app. Anything you record without a connection is saved and synced when you’re back online.",
  },
  {
    q: "How do I get my access code?",
    a: "Pay on the payment page with MoMo or card and you’ll receive a code that looks like TRK-XXXX-XXXX. Enter it when you create your account. Each code works once.",
  },
  {
    q: "Can I use it on my laptop too?",
    a: "Yes. Log in on any device and everything is there.",
  },
  {
    q: "What happens to my data?",
    a: "It’s yours. Only you can see it. Download it as a spreadsheet any time, or delete your account and everything in it from Settings.",
  },
];

export function Landing() {
  const { data: meta } = useMeta();
  const buy = meta?.buy_url ?? null;
  const price = meta?.price_label ?? null;
  const [showBar, setShowBar] = useState(false);

  // Sticky buy bar on phones once the hero's button has scrolled away.
  useEffect(() => {
    const onScroll = () => setShowBar(window.scrollY > 700);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-dvh bg-bg">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 md:px-8 md:pt-6">
        <span className="flex items-center gap-2.5">
          <Image width={32} height={32} src="/icon-192.png" alt="" className="h-8 w-8 rounded-tile" />
          <Wordmark className="text-ink" />
        </span>
        <Link href="/login/" className={buttonClass("secondary", "sm")}>
          Log in
        </Link>
      </header>

      <main className="pb-28 md:pb-0">
        {/* 1. The pain, in their words */}
        <section className="mx-auto grid max-w-5xl items-center gap-10 px-4 pt-6 pb-16 md:grid-cols-[1.15fr_1fr] md:px-8 md:pt-12">
          <div>
            <div className="eyebrow">For everyone whose money disappears before month end</div>
            <h1 className="mt-3 text-[42px] leading-[0.98] font-extrabold text-ink md:text-[62px]">Payday was two weeks ago. Where did the money go?</h1>
            <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-muted">
              Not the rent. Not the school fees. The waakye, the Bolt rides, the data bundles, the “send me small”. Trackaa shows you where every
              cedi goes, so month end stops being a surprise.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Cta buy={buy} />
              {buy && (
                <Link href="/register/" className={buttonClass("secondary", "lg")}>
                  I have a code
                </Link>
              )}
            </div>
            <p className="mt-3 text-sm text-muted">
              {price && <span className="font-bold text-ink">{price} · </span>}
              Works on any phone. No download.
            </p>
          </div>
          <AppPreview />
        </section>

        {/* 2. Let them recognise themselves */}
        <Band>
          <SectionHead eyebrow="Be honest" title="Does this sound like you?" />
          <ul className="mt-7 grid gap-3 md:grid-cols-2">
            {RECOGNISE.map((r) => (
              <li key={r} className="flex items-start gap-3 rounded-card border border-line bg-surface p-4">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-hero text-brand">
                  <Check size={14} strokeWidth={3} />
                </span>
                <span className="text-[15.5px] leading-snug font-semibold text-ink">{r}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-ink">
            If you nodded at two or more, keep reading. <span className="font-bold">You’re not bad with money. You just can’t see it.</span>
          </p>
        </Band>

        {/* 3. The hard truth + 4. what doing nothing costs */}
        <section className="bg-hero text-hero-fg">
          <div className="mx-auto max-w-5xl px-4 py-16 md:px-8 md:py-20">
            <div className="eyebrow" style={{ color: "var(--brand)" }}>
              The hard truth
            </div>
            <h2 className="mt-3 max-w-3xl text-[34px] leading-[1.02] font-extrabold md:text-[48px]">
              You don’t have a money problem. You have a visibility problem.
            </h2>
            <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-hero-muted">
              Most people think the fix is earning more. Sometimes it is. But almost everyone is also leaking money they can’t see: small, daily,
              forgettable spends. You can’t remember 60 transactions a month, and you can’t fix what you can’t see.
            </p>

            <div className="mt-10 grid gap-3 md:grid-cols-3">
              {[
                ["GH₵ 20", "a day you don’t notice"],
                ["GH₵ 600", "gone every month"],
                ["GH₵ 7,300", "gone every year"],
              ].map(([n, l], i) => (
                <div key={n} className={cx("rounded-card p-5", i === 2 ? "pop bg-brand text-brand-ink" : "bg-white/[0.06]")}>
                  <div className="font-display tabular text-[40px] leading-none font-extrabold">{n}</div>
                  <div className={cx("mt-2 text-[15px] font-semibold", i === 2 ? "text-brand-ink" : "text-hero-muted")}>{l}</div>
                </div>
              ))}
            </div>
            <p className="mt-5 text-[15px] text-hero-muted">
              That’s a laptop. A semester’s fees. The start of an emergency fund. Leaking out GH₵ 20 at a time.
            </p>
          </div>
        </section>

        {/* Why what they tried before didn't work */}
        <Band>
          <SectionHead eyebrow="It’s not your fault" title="Why the notebook, the Excel sheet and the foreign apps didn’t work" />
          <div className="mt-7 grid gap-3 md:grid-cols-3">
            {TRIED.map((t) => (
              <Card key={t.name}>
                <Glyph icon={t.icon} size={44} />
                <h3 className="mt-4 text-[19px] font-bold">{t.name}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{t.why}</p>
              </Card>
            ))}
          </div>
          <p className="font-display mt-8 text-[24px] leading-tight font-extrabold text-ink md:text-[30px]">
            So we built one for how money actually moves here: MoMo, cash and cedis.
          </p>
        </Band>

        {/* 5. The offer, mapped to each pain */}
        <section className="mx-auto max-w-5xl px-4 py-16 md:px-8">
          <SectionHead eyebrow="Meet Trackaa" title="Every cedi, accounted for. In seconds a day." />
          <div className="mt-8 grid gap-3 md:grid-cols-2">
            {FIXES.map((f) => (
              <Card key={f.title} className="flex flex-col">
                <p className="text-[14px] font-semibold text-muted italic">{f.pain}</p>
                <div className="mt-4 flex items-center gap-3">
                  <Glyph icon={f.icon} size={44} active />
                  <h3 className="text-[20px] leading-tight font-bold">{f.title}</h3>
                </div>
                <p className="mt-3 text-[15px] leading-relaxed text-muted">{f.body}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Who it's for */}
        <Band>
          <SectionHead eyebrow="Straight talk" title="Who Trackaa is for, and who it isn’t" />
          <div className="mt-7 grid gap-3 md:grid-cols-2">
            <Card>
              <Tag tone="good" icon={Check}>
                For you if
              </Tag>
              <ul className="mt-4 space-y-3 text-[15.5px] text-ink">
                <Item ok>You earn and spend in cedis: salary, hustle, or both</Item>
                <Item ok>You’re tired of guessing where your money went</Item>
                <Item ok>You run a small business and want its money kept apart</Item>
                <Item ok>You can give it 30 seconds a day</Item>
              </ul>
            </Card>
            <Card tone="sunken">
              <Tag tone="neutral" icon={X}>
                Not for you if
              </Tag>
              <ul className="mt-4 space-y-3 text-[15.5px] text-muted">
                <Item>You want it to fill itself in. Trackaa doesn’t connect to MoMo or banks; you log what you spend</Item>
                <Item>You’re looking for investment or loan advice</Item>
              </ul>
            </Card>
          </div>
        </Band>

        {/* The offer stack */}
        <section className="mx-auto max-w-5xl px-4 py-16 md:px-8" id="get">
          <div className="pop rounded-sheet bg-surface p-6 md:p-10">
            <div className="grid gap-8 md:grid-cols-[1.2fr_1fr] md:items-center">
              <div>
                <div className="eyebrow">One access code</div>
                <h2 className="mt-2 text-[32px] leading-[1.05] font-extrabold md:text-[40px]">Everything you need to see your money clearly</h2>
                <ul className="mt-6 space-y-2.5">
                  {INCLUDED.map((i) => (
                    <Item key={i} ok>
                      {i}
                    </Item>
                  ))}
                </ul>
              </div>
              <div className="rounded-card bg-hero p-6 text-hero-fg">
                <div className="eyebrow" style={{ color: "var(--hero-muted)" }}>
                  Your price
                </div>
                <div className="font-display mt-2 text-[34px] leading-tight font-extrabold text-brand">{price ?? "One access code"}</div>
                <p className="mt-2 text-[14.5px] text-hero-muted">One code, one account, yours to keep.</p>
                <Cta buy={buy} className="mt-6 w-full" />
                <ol className="mt-6 space-y-3">
                  {STEPS.map((s, n) => (
                    <li key={s.title} className="flex gap-3">
                      <span className="font-display flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[14px] font-extrabold text-brand">
                        {n + 1}
                      </span>
                      <span className="text-[14px]">
                        <span className="font-bold">{s.title}.</span> <span className="text-hero-muted">{s.body}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>

        {/* Objections */}
        <Band>
          <SectionHead eyebrow="Before you decide" title="Questions people ask" />
          <div className="mt-7 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
            {FAQ.map((f) => (
              <details key={f.q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-bold text-ink">
                  {f.q}
                  <span className="text-[22px] leading-none text-subtle transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </Band>

        {/* The close */}
        <section className="mx-auto max-w-5xl px-4 py-16 md:px-8">
          <Card tone="ink" className="p-7 md:p-12">
            <h2 className="max-w-3xl text-[34px] leading-[1.02] font-extrabold text-hero-fg md:text-[48px]">
              Next month end, you’ll know exactly where it went.
            </h2>
            <p className="mt-4 max-w-xl text-[17px] text-hero-muted">
              Or you can keep checking your balance and saying “eii”. Your call.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Cta buy={buy} />
              {price && <span className="text-[15px] font-semibold text-hero-fg">{price}</span>}
            </div>
          </Card>
        </section>
      </main>

      <footer className="border-t border-line px-4 py-8 text-center text-[13px] text-muted">
        Trackaa · all amounts in Ghana cedis (GH₵) ·{" "}
        <Link href="/login/" className="font-semibold text-ink underline decoration-brand decoration-2 underline-offset-4">
          Log in
        </Link>
      </footer>

      {/* Sticky buy bar (phones) */}
      <div
        className={cx(
          "fixed inset-x-0 bottom-0 z-40 border-t-[1.5px] border-line bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-transform duration-300 md:hidden",
          showBar ? "translate-y-0" : "translate-y-full",
        )}
        aria-hidden={!showBar}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-bold text-ink">Trackaa</div>
            {price && <div className="truncate text-[12.5px] text-muted">{price}</div>}
          </div>
          <Cta buy={buy} size="md" />
        </div>
      </div>
    </div>
  );
}

function Cta({ buy, size = "lg", className }: { buy: string | null; size?: "md" | "lg"; className?: string }) {
  return buy ? (
    <a href={buy} target="_blank" rel="noopener noreferrer" className={cx(buttonClass("primary", size), className)}>
      Get your access code <ArrowRight size={18} strokeWidth={2.5} />
    </a>
  ) : (
    <Link href="/register/" className={cx(buttonClass("primary", size), className)}>
      Create your account <ArrowRight size={18} strokeWidth={2.5} />
    </Link>
  );
}

function Band({ children }: { children: ReactNode }) {
  return (
    <section className="border-y border-line bg-surface-2/60">
      <div className="mx-auto max-w-5xl px-4 py-16 md:px-8">{children}</div>
    </section>
  );
}

function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <div className="eyebrow">{eyebrow}</div>
      <h2 className="mt-2 max-w-3xl text-[32px] leading-[1.04] font-extrabold text-ink md:text-[42px]">{title}</h2>
    </div>
  );
}

function Item({ children, ok }: { children: ReactNode; ok?: boolean }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className={cx("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full", ok ? "bg-brand text-brand-ink" : "bg-surface-3 text-muted")}>
        {ok ? <Check size={12} strokeWidth={3.5} /> : <X size={12} strokeWidth={3.5} />}
      </span>
      <span className="leading-snug">{children}</span>
    </li>
  );
}

/** Illustration of the app, clearly labelled as an example. */
function AppPreview() {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="absolute -top-3 right-4 z-10">
        <Tag tone="ink">Example screen</Tag>
      </div>
      <div className="rounded-sheet border-2 border-brand-ink bg-surface p-4 shadow-hard-lg">
        <div className="rounded-card bg-hero p-5 text-hero-fg">
          <div className="eyebrow" style={{ color: "var(--hero-muted)" }}>
            Budget left this month
          </div>
          <div className="font-display tabular mt-2 text-[38px] leading-none font-extrabold text-brand">GH₵ 840.00</div>
          <div className="mt-4 h-2.5 rounded-full bg-white/10">
            <div className="h-full w-[58%] rounded-full bg-brand" />
          </div>
          <p className="mt-3 text-[13px] text-hero-muted">
            You can spend about <span className="font-bold text-hero-fg">GH₵ 52.50</span> a day for the next 16 days
          </p>
        </div>
        <div className="mt-3 divide-y divide-line rounded-card border border-line">
          {[
            ["Waakye", "Food · MoMo", "−GH₵ 25.00"],
            ["Bolt to Osu", "Transport · MoMo", "−GH₵ 38.00"],
            ["Data bundle", "Airtime · Cash", "−GH₵ 20.00"],
          ].map(([t, m, a]) => (
            <div key={t} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-[14px] font-semibold">{t}</div>
                <div className="truncate text-[11.5px] text-muted">{m}</div>
              </div>
              <div className="font-display tabular shrink-0 text-[14px] font-bold">{a}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3 px-1">
          <IconTile size={40}>
            <Flame size={19} fill="currentColor" />
          </IconTile>
          <div className="text-[14px]">
            <div className="font-bold">12-day streak</div>
            <div className="text-muted">Level 4 · Consistent</div>
          </div>
        </div>
      </div>
    </div>
  );
}
