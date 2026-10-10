"use client";

import {
  BookOpenCheck, Briefcase, CalendarCheck, Check, Flag, Flame, Leaf, Lock, Medal, Scale, Sparkles, Target, Trophy, type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ymd } from "@/lib/dates";
import { confetti, haptic, newlyEarned } from "@/lib/feedback";
import { useProgress, useRefreshAll } from "@/lib/hooks";
import type { Badge, Progress } from "@/lib/types";
import { useToast } from "./toast";
import { Button, Card, cx, Glyph, IconTile, ProgressBar, Sheet, Spinner, Tag } from "./ui";

export const BADGE_ICON: Record<string, LucideIcon> = {
  first_log: Sparkles,
  streak_3: Flame,
  streak_7: CalendarCheck,
  streak_30: Trophy,
  zero_day: Leaf,
  logs_50: Medal,
  logs_200: BookOpenCheck,
  planner: Target,
  goal_getter: Flag,
  balanced: Scale,
  boss: Briefcase,
};

/** 🔥 streak pill for headers. Tapping opens the progress sheet. */
export function StreakChip() {
  const { data } = useProgress();
  const [open, setOpen] = useState(false);
  if (!data) return <div className="h-10 w-16" />;
  return (
    <>
      <button
        type="button"
        onClick={() => {
          haptic.tap();
          setOpen(true);
        }}
        aria-label={`${data.streak}-day streak. View progress`}
        className={cx(
          "inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[15px] font-extrabold transition active:scale-95",
          data.today_done
            ? "bg-hero text-brand"
            : data.at_risk
              ? "border-[1.5px] border-warn bg-warn-soft text-warn"
              : "border-[1.5px] border-line bg-surface text-muted",
        )}
      >
        <Flame size={18} strokeWidth={2.25} fill={data.today_done ? "currentColor" : "none"} />
        <span className="font-display tabular">{data.streak}</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Your progress" wide>
        <ProgressView p={data} />
      </Sheet>
    </>
  );
}

export function WeekStrip({ p, size = "md" }: { p: Progress; size?: "sm" | "md" }) {
  const today = ymd(new Date());
  return (
    <div className="flex justify-between gap-1">
      {p.week.map((d) => {
        const done = d.state === "logged" || d.state === "checkin";
        const isToday = d.date === today;
        return (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
            <div
              className={cx(
                "flex items-center justify-center rounded-full transition",
                size === "md" ? "h-9 w-9" : "h-7 w-7",
                d.state === "logged" && "bg-hero text-brand",
                d.state === "checkin" && "bg-brand text-brand-ink",
                d.state === "missed" && "bg-surface-2 text-subtle",
                d.state === "future" && "border-[1.5px] border-dashed border-line text-subtle",
                isToday && !done && "ring-2 ring-ink ring-offset-2 ring-offset-surface",
              )}
              title={d.state === "checkin" ? "Checked in: nothing spent" : d.state}
            >
              {done ? (d.state === "checkin" ? <Leaf size={size === "md" ? 15 : 12} /> : <Check size={size === "md" ? 16 : 13} strokeWidth={3} />) : null}
            </div>
            <span className={cx("text-[11px] font-bold", isToday ? "text-ink" : "text-subtle")}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Overview card: today's status, the week, and a "nothing spent" check-in. */
export function TodayCard() {
  const { data, mutate } = useProgress();
  const refreshAll = useRefreshAll();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!data) return null;

  async function checkIn() {
    setBusy(true);
    try {
      await api("/review", { method: "POST", body: { date: ymd(new Date()) } });
      haptic.success();
      await mutate();
      refreshAll();
      toast({ message: data!.streak + 1 > 1 ? `Checked in. ${data!.streak + 1}-day streak` : "Checked in. Streak started" });
      if ([3, 7, 14, 30, 60, 100].includes(data!.streak + 1)) confetti("big");
    } catch (e) {
      toast({ message: (e as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  const msg = data.today_done
    ? data.streak > 1
      ? `Day ${data.streak} done. Keep it going tomorrow.`
      : "Today is logged. Come back tomorrow to start a streak."
    : data.at_risk
      ? `Log something today to keep your ${data.streak}-day streak.`
      : "Log what you spend today to start a streak.";

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Glyph icon={Flame} active={data.today_done} size={44} />
          <div className="min-w-0">
            <div className="font-display text-[19px] leading-tight font-bold">{data.streak ? `${data.streak}-day streak` : "No streak yet"}</div>
            <p className="mt-0.5 text-[13px] text-muted">{msg}</p>
          </div>
        </div>
        <Tag tone="neutral">Lv {data.level.number}</Tag>
      </div>
      <div className="mt-5">
        <WeekStrip p={data} />
      </div>
      {!data.today_done && (
        <Button variant="secondary" size="md" className="mt-5 w-full" onClick={checkIn} disabled={busy}>
          {busy ? <Spinner /> : <Leaf size={16} />} I spent nothing today
        </Button>
      )}
    </Card>
  );
}

export function ProgressView({ p }: { p: Progress }) {
  const levelPct = p.level.days_for_next ? Math.min(100, (p.level.days_into_level / p.level.days_for_next) * 100) : 100;
  const earned = p.badges.filter((b) => b.earned).length;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <IconTile size={76}>
          <Flame size={36} fill={p.streak ? "currentColor" : "none"} />
        </IconTile>
        <div className="ml-1">
          <div className="font-display tabular text-[44px] leading-none font-extrabold">{p.streak}</div>
          <div className="mt-1.5 text-sm text-muted">day streak · best {p.best_streak}</div>
        </div>
      </div>

      <WeekStrip p={p} />

      <Card tone="sunken" flush className="p-4">
        <div className="flex items-baseline justify-between">
          <span className="font-display text-[17px] font-bold">
            Level {p.level.number} · {p.level.name}
          </span>
          <span className="text-xs text-muted">
            {p.active_days} active day{p.active_days === 1 ? "" : "s"}
          </span>
        </div>
        <div className="mt-3 rounded-full bg-surface">
          <ProgressBar value={levelPct} max={100} label="Level progress" />
        </div>
        <div className="mt-2 text-xs text-muted">
          {p.level.next_name && p.level.days_for_next
            ? `${p.level.days_for_next - p.level.days_into_level} more active day${p.level.days_for_next - p.level.days_into_level === 1 ? "" : "s"} to ${p.level.next_name}`
            : "Top level. Legendary."}
        </div>
      </Card>

      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <span className="font-display text-[17px] font-bold">Badges</span>
          <span className="text-xs text-muted">
            {earned} of {p.badges.length}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {p.badges.map((b) => (
            <BadgeTile key={b.key} b={b} />
          ))}
        </div>
      </div>
    </div>
  );
}

function BadgeTile({ b }: { b: Badge }) {
  const Icon = BADGE_ICON[b.key] ?? Sparkles;
  return (
    <div
      className={cx(
        "flex flex-col items-center rounded-control p-3 pt-4 text-center",
        b.earned ? "border-[1.5px] border-line bg-surface" : "border-[1.5px] border-dashed border-line bg-surface-2/50",
      )}
    >
      {b.earned ? (
        <IconTile size={44}>
          <Icon size={20} />
        </IconTile>
      ) : (
        <Glyph icon={Lock} size={44} />
      )}
      <span className={cx("mt-2.5 text-[12.5px] leading-tight font-bold", !b.earned && "text-muted")}>{b.name}</span>
      <span className="mt-0.5 text-[10.5px] leading-tight text-muted">{b.description}</span>
      {!b.earned && b.progress && (
        <span className="mt-2 w-full">
          <ProgressBar value={b.progress.current} max={b.progress.target} tone="ink" size="sm" label={`${b.name} progress`} />
          <span className="tabular mt-1 block text-[10px] font-semibold text-subtle">
            {b.progress.current}/{b.progress.target}
          </span>
        </span>
      )}
    </div>
  );
}

/** Celebrates newly earned badges once, with confetti. Several at once share one popup. */
export function BadgeCelebrations() {
  const { data } = useProgress();
  const [batch, setBatch] = useState<Badge[]>([]);
  const sheetOpen = useSheetOpen();
  useEffect(() => {
    if (!data) return;
    const fresh = newlyEarned(data.badges.filter((b) => b.earned).map((b) => b.key));
    if (fresh.length) setBatch((q) => [...q, ...data.badges.filter((b) => fresh.includes(b.key))]);
  }, [data]);
  // Wait until any open sheet (e.g. the save screen) has closed, so celebrations never stack.
  const show = !sheetOpen && batch.length > 0;
  useEffect(() => {
    if (!show) return;
    haptic.success();
    confetti("big");
  }, [show]);
  if (!show) return null;
  const single = batch.length === 1 ? batch[0] : null;
  const Icon = single ? (BADGE_ICON[single.key] ?? Sparkles) : Trophy;
  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label="Badge unlocked">
      <div className="absolute inset-0 animate-fade-in bg-overlay" onClick={() => setBatch([])} />
      <div className="relative w-full max-w-xs animate-pop rounded-sheet border-2 border-brand-ink bg-surface p-7 text-center shadow-hard-lg">
        <IconTile size={84}>
          <Icon size={38} />
        </IconTile>
        <div className="eyebrow mt-7" style={{ color: "var(--income)" }}>
          {single ? "Badge unlocked" : `${batch.length} badges unlocked`}
        </div>
        {single ? (
          <>
            <div className="font-display mt-1 text-[28px] leading-tight font-extrabold">{single.name}</div>
            <p className="mt-1 text-sm text-muted">{single.description}</p>
          </>
        ) : (
          <ul className="mt-4 space-y-2 text-left">
            {batch.map((b) => {
              const I = BADGE_ICON[b.key] ?? Sparkles;
              return (
                <li key={b.key} className="flex items-center gap-3 rounded-control bg-surface-2 px-3 py-2.5">
                  <Glyph icon={I} size={36} active />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">{b.name}</span>
                    <span className="block truncate text-xs text-muted">{b.description}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <Button size="lg" className="mt-6 w-full" onClick={() => setBatch([])}>
          Nice!
        </Button>
      </div>
    </div>
  );
}

/** True while a bottom sheet is open (the Sheet component marks <body>). */
function useSheetOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const read = () => setOpen(document.body.dataset.sheet === "open");
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.body, { attributes: true, attributeFilter: ["data-sheet"] });
    return () => mo.disconnect();
  }, []);
  return open;
}
