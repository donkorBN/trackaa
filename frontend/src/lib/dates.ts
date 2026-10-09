export function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Value for <input type="datetime-local"> in the device's local time. */
export function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${ymd(d)}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function dayLabel(key: string): string {
  const today = ymd(new Date());
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (key === today) return "Today";
  if (key === ymd(y)) return "Yesterday";
  const [yy, mm, dd] = key.split("-").map(Number);
  const d = new Date(yy, mm - 1, dd);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: yy === new Date().getFullYear() ? undefined : "numeric",
  });
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function dateTimeLabel(iso: string): string {
  const d = new Date(iso);
  return `${dayLabel(ymd(d))}, ${timeLabel(iso)}`;
}

export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Accra";
  } catch {
    return "Africa/Accra";
  }
}

/** "2026-10-01" -> "1 Oct 2026" */
export function shortDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
