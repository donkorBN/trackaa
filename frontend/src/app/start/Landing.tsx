"use client";

import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { buttonClass, cx, Wordmark } from "@/components/ui";
import { useMeta } from "@/lib/hooks";

/*
 * Long-form sales letter for ad traffic. It reads like a letter, not a website:
 * one column, plain language, the reader's own month described back to them,
 * the pain made worse, then the offer, with calls to action along the way.
 * Rule: every claim about the product is something it does today.
 */

// Put your name here: a letter signed by a real person converts better than one signed by a brand.
const SIGNATURE = { name: "", role: "Founder, Trackaa" };

export function Landing() {
  const { data: meta } = useMeta();
  const buy = meta?.buy_url ?? null;
  const price = meta?.price_label ?? null;
  const [showBar, setShowBar] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowBar(window.scrollY > 900);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="mx-auto flex max-w-[680px] items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-2 md:pt-6">
        <span className="flex items-center gap-2">
          <Image width={28} height={28} src="/icon-192.png" alt="" className="h-7 w-7 rounded-tile" />
          <Wordmark className="text-ink" />
        </span>
        <Link href="/login/" className="text-sm font-semibold text-muted underline decoration-line decoration-2 underline-offset-4 hover:text-ink">
          Log in
        </Link>
      </header>

      <article className="mx-auto max-w-[680px] px-5 pt-10 pb-32 md:pb-20">
        {/* Headline */}
        <p className="text-center text-[13px] font-bold tracking-[0.08em] text-muted uppercase">
          For anyone in Ghana who earns good money but somehow never keeps it
        </p>
        <h1 className="mt-4 text-center text-[36px] leading-[1.06] font-extrabold md:text-[50px]">
          You’re earning more than ever. So why does the money never stay in your hands?
        </h1>
        <p className="mx-auto mt-5 max-w-[560px] text-center text-[19px] leading-relaxed text-muted">
          It’s not spiritual. It’s not your village people. And no, you don’t need a bigger salary. Read this to the end and you’ll see where your
          money has really been going, and how to keep it.
        </p>

        <hr className="my-10 border-line" />

        <P>Dear friend,</P>
        <P>Let me describe your month. Stop me if I get it wrong.</P>
        <P>
          Payday comes. For about a week, you feel fine. You pay back the person you borrowed from. You buy the things you’ve been postponing. You
          treat yourself a little, because you work hard and you deserve it. Somebody calls with an emergency, and you send something, because
          that’s what we do.
        </P>
        <P>Then the small things start.</P>
        <P>
          GH₵ 15 for breakfast. GH₵ 40 for Bolt because you’re tired and the trotro queue is long. GH₵ 20 for data. GH₵ 35 for lunch because you
          didn’t bring food. GH₵ 50 towards a friend’s contribution. GH₵ 25 for something you saw on Instagram that you can’t even remember now.
        </P>
        <P>
          <B>None of it feels like much. That’s exactly the problem.</B>
        </P>
        <P>Somewhere in the middle of the month, you check your MoMo balance and say the word every Ghanaian knows:</P>
        <Big>“Eii.”</Big>
        <P>
          You scroll through your history trying to understand it. You can’t. By the 20th you’re counting the days to payday, working out whether you
          can make it without calling someone.
        </P>
        <P>
          And the part that really hurts? <Mark>You know you earned good money this month.</Mark> More than last year. More than the year before.
        </P>
        <P>So where did it go?</P>

        <H2>The lie we tell ourselves about money</H2>
        <P>We have a saying in Ghana. Maybe you’ve said it yourself:</P>
        <Quote>“Money doesn’t last in my hands.”</Quote>
        <P>
          People say it like it’s a fact of life. Like a curse. Some genuinely believe their money has been tied. Others blame the economy, black tax,
          the dollar rate, the family. And some of that is real. The cedi is tough. Family is family.
        </P>
        <P>But here’s what nobody tells you.</P>
        <P>
          <B>Your money isn’t disappearing. It’s leaving.</B> One small spend at a time, through doors you can’t see, because you’ve never looked.
        </P>
        <P>
          It’s not that money doesn’t last in your hands. <Mark>It’s that you don’t know where it goes.</Mark> And you can’t hold on to what you
          can’t see.
        </P>

        <H2>Let’s do the maths you’ve been avoiding</H2>
        <P>Say you earn GH₵ 5,000 a month. Over the next five years, that’s GH₵ 300,000 passing through your hands.</P>
        <Big>Three hundred thousand cedis.</Big>
        <P>
          Now be honest with yourself. Five years from today, how much of it will you be able to point to? Land? Savings? A business? Or will you be
          exactly where you are now, earning a bit more, keeping the same nothing, and still saying “money doesn’t last in my hands”?
        </P>
        <P>
          It gets worse. The leak isn’t one big thing you could cut. It’s GH₵ 20 here and GH₵ 30 there. Just GH₵ 20 a day that you don’t notice is{" "}
          <B>GH₵ 600 a month</B>. That’s <B>GH₵ 7,300 a year</B>.
        </P>
        <P>
          That’s a deposit on a plot of land. A year of rent advance. An emergency fund that means the next hospital bill doesn’t push you into debt.
        </P>
        <P>Gone. And you didn’t even enjoy most of it, because you can’t remember what it was.</P>
        <P>
          Meanwhile, the people around you think you’re doing well. You’re the one they call. You can’t tell them you’re two weeks from payday with
          GH₵ 80 in your account, so you send what you can, and the hole gets deeper.
        </P>
        <P>
          You’re not lazy. You’re not careless. You work hard. <B>That’s what makes this so frustrating.</B>
        </P>

        <Box>
          <p className="text-[13px] font-bold tracking-[0.08em] text-muted uppercase">Try this. It takes two minutes.</p>
          <p className="mt-3">Open your MoMo app. Go to last month. Try to explain, line by line, where every cedi went.</p>
          <p className="mt-3">
            Most people give up halfway. Not because they wasted all of it, but because they genuinely can’t remember.{" "}
            <B>If you can’t explain it, you can’t control it.</B>
          </p>
        </Box>

        <H2>Why you haven’t fixed it yet</H2>
        <P>You’ve probably tried.</P>
        <P>
          You downloaded a budgeting app. It wanted your bank card, talked in dollars, and had no idea what MoMo is. You started a notebook. It’s
          somewhere in your bag, blank after page three. You made an Excel sheet one Sunday night, full of motivation. By Wednesday you’d forgotten it
          existed.
        </P>
        <P>
          <Mark>That’s not a discipline problem. It’s a friction problem.</Mark> If writing down a spend takes more effort than making it, you won’t do
          it. Nobody does.
        </P>
        <P>What you need is something so quick you’ll actually use it, built for how money moves here.</P>

        <H2>That’s why I built Trackaa</H2>
        <P>Trackaa is a simple money tracker built for MoMo, cash and cedis. It does one thing really well: it shows you where your money goes.</P>
        <P>
          You spend. You open Trackaa on your phone. You type the amount and tap a category. Done. Five seconds, before the mate finishes collecting
          the fares.
        </P>
        <P>No bank login. No PIN. Nothing connected. You record, and Trackaa does the adding up, the sorting and the warning for you.</P>
        <P>Here’s what happens when you start:</P>
        <Steps
          items={[
            ["Week one,", "you’ll probably be shocked. Food, transport and the “small small” things will turn out to be eating far more than you guessed."],
            ["Week two,", "you start catching yourself. You reach for your phone to order something and think, “I’ll have to log this.” Sometimes that’s enough."],
            ["At month end,", "for the first time, you know exactly where your money went. Not a feeling. Numbers."],
            ["Month two,", "you set a budget, and every day Trackaa tells you how much you can safely spend. Not this month. Today."],
          ]}
        />

        <CtaBlock buy={buy} price={price} />

        <H2>Here’s everything you get</H2>
        <Bullets
          items={[
            ["The five-second log.", "A big number pad and your most-used categories first, so recording a spend is quicker than making it."],
            ["A budget that talks in days.", "Set one monthly amount. Trackaa tells you what you can spend today and this week, and warns you when you’re spending too fast."],
            ["Your MoMo statement, checked.", "Import your MTN MoMo or bank statement and Trackaa shows every transaction you forgot to record. Add the missing ones in one tap."],
            ["Business money, kept apart.", "Sell anything on the side? See what your business really made, separate from your personal spending."],
            ["Savings goals with a weekly target.", "Want GH₵ 5,000 by December? Trackaa tells you exactly how much to put aside each week to get there."],
            ["Your patterns, finally visible.", "Which days you spend most, which categories keep growing, and how this month compares to last."],
            ["A habit that sticks.", "Streaks and badges that make you want to open it every day. Spent nothing today? Check in and keep your streak."],
            ["Private, and yours.", "Nothing is connected to your MoMo or bank. Download your data or delete your account whenever you want."],
            ["Works on any phone.", "No Play Store download. Add it to your home screen and it opens like an app."],
          ]}
        />

        <H2>What it costs</H2>
        <P>
          <B>You’ve already been paying for not tracking.</B> You just haven’t seen the bill.
        </P>
        <P>
          {price ? (
            <>
              Trackaa costs <Mark>{price}</Mark>. That’s probably less than what slipped through your hands last week without you noticing.
            </>
          ) : (
            <>Trackaa probably costs less than what slipped through your hands last week without you noticing.</>
          )}
        </P>
        <P>
          You get an access code and use it to create your account. That’s it. Create your account, and log your first spend today.
        </P>

        <CtaBlock buy={buy} price={price} />

        <H2>This isn’t for everyone</H2>
        <P>
          Trackaa is not for you if you want something that works without you. It doesn’t read your MoMo. You log your spends yourself. It takes
          seconds, but you have to do it.
        </P>
        <P>It’s also not for you if you’d rather not know. Some people prefer it that way.</P>
        <P>
          But if you’re tired of saying “eii” at your balance, and you know you earn too much to be this broke by the 20th, <B>it’s for you.</B>
        </P>

        <H2>You might be wondering…</H2>
        <Faq q="“Is it connected to my MoMo or bank?”">
          No. Trackaa never asks for your PIN or bank login. You record what you spend, and you can import your statement to check you didn’t miss
          anything.
        </Faq>
        <Faq q="“I don’t earn much. Is it really for me?”">
          Especially for you. When money is tight, every GH₵ 20 leak hurts more. You can’t keep what you can’t see.
        </Faq>
        <Faq q="“I’ve tried tracking before and gave up.”">
          Most tools make it a chore. Here a spend takes five seconds, and your streak gives you a reason to open it again tomorrow.
        </Faq>
        <Faq q="“Do I need to download anything?”">
          No. It runs in your phone’s browser. Add it to your home screen and it works like an app, even saving what you record when you have no
          signal.
        </Faq>

        <H2>Here’s the truth</H2>
        <P>
          Next month, money will pass through your hands again. Maybe GH₵ 3,000. Maybe GH₵ 10,000. The only question is whether, at the end of it,
          you’ll know where it went.
        </P>
        <P>
          You can keep saying money doesn’t last in your hands. <B>Or you can find out why, and fix it, starting today.</B>
        </P>

        <CtaBlock buy={buy} price={price} />

        <P>To keeping what you earn,</P>
        <p className="font-display text-[22px] font-extrabold">{SIGNATURE.name || "Trackaa"}</p>
        <p className="text-[15px] text-muted">{SIGNATURE.role}</p>

        <div className="mt-12 border-t border-line pt-8">
          <P>
            <B>P.S.</B> If you skipped down here, here’s the short version: your money isn’t disappearing, it’s leaking out in small spends you can’t
            see. Trackaa shows you every one of them, in five seconds a day.{price ? ` ${price}.` : ""}{" "}
            <CtaLink buy={buy}>Get your access code here.</CtaLink>
          </P>
          <P>
            <B>P.P.S.</B> Do the two-minute exercise. Open last month’s MoMo history and try to explain every cedi. If you can’t, that’s your answer.
          </P>
        </div>
      </article>

      <footer className="border-t border-line px-5 py-8 text-center text-[13px] text-muted">
        Trackaa · all amounts in Ghana cedis (GH₵) ·{" "}
        <Link href="/register/" className="font-semibold text-ink underline decoration-brand decoration-2 underline-offset-4">
          I have a code
        </Link>{" "}
        ·{" "}
        <Link href="/login/" className="font-semibold text-ink underline decoration-brand decoration-2 underline-offset-4">
          Log in
        </Link>
      </footer>

      {/* Phones: a buy bar follows the reader once the letter gets going. */}
      <div
        className={cx(
          "fixed inset-x-0 bottom-0 z-40 border-t-[1.5px] border-line bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-transform duration-300 md:hidden",
          showBar ? "translate-y-0" : "translate-y-full",
        )}
        aria-hidden={!showBar}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-bold">Trackaa</div>
            {price && <div className="truncate text-[12.5px] text-muted">{price}</div>}
          </div>
          <CtaButton buy={buy} size="md" />
        </div>
      </div>
    </div>
  );
}

/* ---------------- letter typography ---------------- */

function P({ children }: { children: ReactNode }) {
  return <p className="mb-5 text-[18.5px] leading-[1.7]">{children}</p>;
}

function B({ children }: { children: ReactNode }) {
  return <strong className="font-bold">{children}</strong>;
}

/** Highlighter: the line you want a skimmer to catch. */
function Mark({ children }: { children: ReactNode }) {
  return <mark className="rounded-[3px] bg-brand-soft px-0.5 font-semibold text-ink [box-decoration-break:clone]">{children}</mark>;
}

function H2({ children }: { children: ReactNode }) {
  return <h2 className="mt-12 mb-5 text-[28px] leading-[1.12] font-extrabold md:text-[32px]">{children}</h2>;
}

function Big({ children }: { children: ReactNode }) {
  return <p className="font-display my-7 text-center text-[34px] leading-tight font-extrabold md:text-[40px]">{children}</p>;
}

function Quote({ children }: { children: ReactNode }) {
  return <blockquote className="font-display my-7 border-l-4 border-brand pl-5 text-[26px] leading-snug font-extrabold md:text-[30px]">{children}</blockquote>;
}

function Box({ children }: { children: ReactNode }) {
  return <div className="my-9 rounded-card border-2 border-dashed border-ink/25 bg-surface p-6 text-[18px] leading-[1.65]">{children}</div>;
}

function Steps({ items }: { items: [string, string][] }) {
  return (
    <div className="mb-5 space-y-4">
      {items.map(([lead, rest]) => (
        <p key={lead} className="border-l-4 border-line pl-4 text-[18.5px] leading-[1.65]">
          <B>{lead}</B> {rest}
        </p>
      ))}
    </div>
  );
}

function Bullets({ items }: { items: [string, string][] }) {
  return (
    <ul className="mb-5 space-y-4">
      {items.map(([lead, rest]) => (
        <li key={lead} className="flex gap-3 text-[18.5px] leading-[1.65]">
          <span aria-hidden className="mt-[0.6em] h-2 w-2 shrink-0 rounded-full bg-ink" />
          <span>
            <B>{lead}</B> {rest}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <div className="mb-6">
      <p className="text-[18.5px] font-bold">{q}</p>
      <p className="mt-1 text-[18.5px] leading-[1.7] text-muted">{children}</p>
    </div>
  );
}

/* ---------------- calls to action ---------------- */

function CtaButton({ buy, size = "lg", className }: { buy: string | null; size?: "md" | "lg"; className?: string }) {
  const label = buy ? "Get your access code" : "Create your account";
  const content = (
    <>
      {label} <ArrowRight size={18} strokeWidth={2.5} />
    </>
  );
  return buy ? (
    <a href={buy} target="_blank" rel="noopener noreferrer" className={cx(buttonClass("primary", size), className)}>
      {content}
    </a>
  ) : (
    <Link href="/register/" className={cx(buttonClass("primary", size), className)}>
      {content}
    </Link>
  );
}

function CtaLink({ buy, children }: { buy: string | null; children: ReactNode }) {
  const cls = "font-bold text-ink underline decoration-brand decoration-[3px] underline-offset-4";
  return buy ? (
    <a href={buy} target="_blank" rel="noopener noreferrer" className={cls}>
      {children}
    </a>
  ) : (
    <Link href="/register/" className={cls}>
      {children}
    </Link>
  );
}

function CtaBlock({ buy, price }: { buy: string | null; price: string | null }) {
  return (
    <div className="my-10 flex flex-col items-center gap-3 rounded-card bg-surface-2 px-5 py-7 text-center">
      <CtaButton buy={buy} className="w-full max-w-sm" />
      <p className="text-[14px] text-muted">
        {price && <span className="font-bold text-ink">{price} · </span>}
        {buy ? "Pay with MoMo or card · " : ""}works on any phone
      </p>
      {buy && (
        <Link href="/register/" className="text-[14px] font-semibold text-ink underline decoration-line decoration-2 underline-offset-4">
          Already have a code? Create your account
        </Link>
      )}
    </div>
  );
}
