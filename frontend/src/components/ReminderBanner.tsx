"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ymd } from "@/lib/dates";
import { useMe } from "@/lib/hooks";
import { reviewedOn } from "@/lib/prefs";

/** In-app fallback for the daily reminder: shows after the reminder time until today is reviewed. */
export function ReminderBanner() {
  const { data: me } = useMe();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!me?.reminder_enabled) return setShow(false);
    const check = () => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      setShow(hhmm >= me.reminder_time && reviewedOn() !== ymd(now));
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [me]);

  if (!show) return null;
  return (
    <Link
      href="/review"
      className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm"
    >
      <span>
        <span className="font-semibold">End-of-day check.</span>{" "}
        <span className="text-muted">Have you recorded everything you earned and spent today?</span>
      </span>
      <span className="shrink-0 font-semibold">Review →</span>
    </Link>
  );
}
