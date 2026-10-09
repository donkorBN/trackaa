"use client";

import { BellRing, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ymd } from "@/lib/dates";
import { useMe } from "@/lib/hooks";

/** In-app daily reminder: shows after the reminder time until today has been reviewed. */
export function ReminderBanner() {
  const { data: me } = useMe();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!me?.reminder_enabled) return setShow(false);
    const check = () => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      setShow(hhmm >= me.reminder_time && me.last_reviewed_on !== ymd(now));
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [me]);

  if (!show) return null;
  return (
    <Link href="/review" className="flex animate-pop items-center gap-3 rounded-3xl border border-line bg-surface p-4 shadow-card">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-transfer-soft text-transfer">
        <BellRing size={19} />
      </span>
      <span className="min-w-0 flex-1 text-sm">
        <span className="block font-semibold">End-of-day check</span>
        <span className="block text-muted">Have you recorded everything you earned and spent today?</span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-subtle" />
    </Link>
  );
}
