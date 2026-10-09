import { ymd } from "./dates";
import type { Period } from "./types";

/** Local calendar range for a named period, as inclusive Y-m-d strings. */
export function periodRange(p: Exclude<Period, "custom">): { from: string; to: string } {
  const now = new Date();
  const today = ymd(now);
  if (p === "today") return { from: today, to: today };
  if (p === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Monday
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { from: ymd(start), to: ymd(end) };
  }
  return {
    from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}
