"use client";

import {
  ArrowRight, Briefcase, FileSpreadsheet, Flame, KeyRound, Lock, Smartphone, Target, UserPlus, Zap, type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { buttonClass, Card, cx, Glyph, IconTile, Tag, Wordmark } from "@/components/ui";
import { useMeta } from "@/lib/hooks";

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Zap, title: "Log it in five seconds", body: "Amount, category, done. A big keypad and your usual categories first, so it never feels like admin." },
  { icon: Target, title: "A budget that talks in days", body: "Set a monthly amount and see what you can still spend today and this week, not just this month." },
  { icon: FileSpreadsheet, title: "Check it against MoMo", body: "Import your MTN MoMo or bank statement and see anything you forgot to record. The file stays on your phone." },
  { icon: Briefcase, title: "Personal and business, apart", body: "Run a side business? Keep its money separate from yours without a second app." },
  { icon: Flame, title: "A habit that sticks", body: "Streaks, levels and badges for showing up every day. A simple check-in counts on days you spend nothing." },
  { icon: Lock, title: "Yours alone", body: "Not linked to your bank or MoMo. Export everything as a spreadsheet, or delete your account in two taps." },
];

const STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: KeyRound, title: "Get an access code", body: "One code per person, used once." },
  { icon: UserPlus, title: "Create your account", body: "Enter the code, your name and a password." },
  { icon: Smartphone, title: "Add it to your home screen", body: "It opens like an app, no download needed." },
];

const FAQ: { q: string; a: string }[] = [
  { q: "Is it connected to my MoMo or bank account?", a: "No. You record what you spend, and you can import a statement to check you didn't miss anything. Trackaa never asks for your PIN or bank login." },
  { q: "Do I need to download anything?", a: "No. It runs in your phone's browser. Add it to your home screen and it opens like an app. Anything you record without a connection is saved and synced when you're back online." },
  { q: "What does the access code do?", a: "It unlocks one account. After you buy, you get a code that looks like TRK-XXXX-XXXX. Enter it when you sign up." },
  { q: "Can I get my data out?", a: "Yes. Download all your transactions as a spreadsheet at any time, and delete your account and data whenever you like." },
];

export function Landing() {
  const { data: meta } = useMeta();
  const buy = meta?.buy_url ?? null;
  const price = meta?.price_label ?? null;

  const primary = buy ? (
    <a href={buy} target="_blank" rel="noopener noreferrer" className={buttonClass("primary", "lg")}>
      Get your access code <ArrowRight size={18} strokeWidth={2.5} />
    </a>
  ) : (
    <Link href="/register/" className={buttonClass("primary", "lg")}>
      Create your account <ArrowRight size={18} strokeWidth={2.5} />
    </Link>
  );

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

      <main className="mx-auto max-w-5xl px-4 pb-20 md:px-8">
        {/* Hero */}
        <section className="grid items-center gap-10 pt-6 pb-14 md:grid-cols-[1.1fr_1fr] md:pt-14">
          <div>
            <div className="eyebrow">Personal finance in GH₵</div>
            <h1 className="mt-3 text-[44px] leading-[0.98] font-extrabold text-ink md:text-[64px]">Know where every cedi goes.</h1>
            <p className="mt-5 max-w-md text-[17px] leading-relaxed text-muted">
              Log what you spend in seconds, see what&apos;s left for today, and check it all against your MoMo statement. Built for Ghana.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {primary}
              {buy && (
                <Link href="/register/" className={buttonClass("secondary", "lg")}>
                  I have a code
                </Link>
              )}
            </div>
            {price && <p className="mt-3 text-sm font-semibold text-ink">{price}</p>}
          </div>
          <HeroPreview />
        </section>

        {/* Features */}
        <section aria-labelledby="features">
          <h2 id="features" className="text-[30px] leading-tight font-extrabold md:text-[38px]">
            Everything you need. Nothing you don&apos;t.
          </h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title}>
                <Glyph icon={f.icon} size={44} />
                <h3 className="mt-4 text-[19px] font-bold">{f.title}</h3>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{f.body}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="mt-16" aria-labelledby="how">
          <h2 id="how" className="text-[30px] leading-tight font-extrabold md:text-[38px]">
            Start in two minutes.
          </h2>
          <ol className="mt-6 grid gap-3 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <Card className="h-full">
                  <div className="flex items-center justify-between">
                    <Glyph icon={s.icon} size={44} active />
                    <span className="font-display text-[34px] leading-none font-extrabold text-surface-3">{i + 1}</span>
                  </div>
                  <h3 className="mt-4 text-[19px] font-bold">{s.title}</h3>
                  <p className="mt-1 text-[14.5px] text-muted">{s.body}</p>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        {/* FAQ */}
        <section className="mt-16" aria-labelledby="faq">
          <h2 id="faq" className="text-[30px] leading-tight font-extrabold md:text-[38px]">
            Questions
          </h2>
          <div className="mt-6 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
            {FAQ.map((f) => (
              <details key={f.q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15.5px] font-bold">
                  {f.q}
                  <span className="text-subtle transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Closing CTA */}
        <section className="mt-16">
          <Card tone="ink" className="flex flex-col items-start gap-6 p-7 md:flex-row md:items-center md:justify-between md:p-10">
            <div>
              <h2 className="text-[30px] leading-tight font-extrabold text-hero-fg md:text-[36px]">Your money, finally clear.</h2>
              <p className="mt-2 text-hero-muted">{price ? `${price}. ` : ""}One code, one account, yours to keep.</p>
            </div>
            {primary}
          </Card>
        </section>
      </main>

      <footer className="border-t border-line px-4 py-8 text-center text-[13px] text-muted">
        Trackaa · all amounts in Ghana cedis (GH₵) ·{" "}
        <Link href="/login/" className="font-semibold text-ink underline decoration-brand decoration-2 underline-offset-4">
          Log in
        </Link>
      </footer>
    </div>
  );
}

/** Illustration of the app, clearly labelled as an example. */
function HeroPreview() {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="absolute -top-3 right-4 z-10">
        <Tag tone="ink">Example</Tag>
      </div>
      <div className="rounded-sheet border-2 border-brand-ink bg-surface p-4 shadow-hard-lg">
        <div className="rounded-card bg-hero p-5 text-hero-fg">
          <div className="eyebrow" style={{ color: "var(--hero-muted)" }}>
            Net cash flow · This month
          </div>
          <div className="font-display tabular mt-2 text-[38px] leading-none font-extrabold text-brand">+GH₵ 1,240.00</div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              ["Money in", "GH₵ 3,200.00"],
              ["Money out", "GH₵ 1,960.00"],
            ].map(([l, v]) => (
              <div key={l} className="rounded-control bg-white/[0.06] p-3">
                <div className="text-xs font-semibold text-hero-muted">{l}</div>
                <div className="font-display tabular mt-1 text-[16px] font-bold">{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 rounded-card border border-line p-4">
          <div className="flex items-center justify-between">
            <span className="eyebrow">Budget left</span>
            <Tag tone="good">On track</Tag>
          </div>
          <div className="font-display tabular mt-1 text-[24px] font-extrabold">GH₵ 840.00</div>
          <div className="mt-3 h-2.5 rounded-full bg-surface-2">
            <div className="h-full w-[58%] rounded-full bg-brand" />
          </div>
          <p className="mt-3 text-[13px] text-muted">
            About <span className="font-bold text-ink">GH₵ 52.50</span> a day for the next 16 days
          </p>
        </div>
        <div className="mt-4 flex items-center gap-3 px-1">
          <IconTile size={40}>
            <Flame size={19} fill="currentColor" />
          </IconTile>
          <div className={cx("text-[14px]")}>
            <div className="font-bold">12-day streak</div>
            <div className="text-muted">Level 4 · Consistent</div>
          </div>
        </div>
      </div>
    </div>
  );
}
