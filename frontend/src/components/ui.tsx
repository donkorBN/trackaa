"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Card({ children, className, flush }: { children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <div className={cx("rounded-3xl border border-line bg-surface shadow-card", !flush && "p-5", className)}>{children}</div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between px-1">
      <h2 className="text-[15px] font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("text-xs font-medium text-muted", className)}>{children}</div>;
}

type Tone = "neutral" | "income" | "expense" | "transfer";

export function Chip({
  active,
  onClick,
  children,
  tone = "neutral",
  icon,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
}) {
  const activeTone = {
    neutral: "bg-accent text-accent-fg border-accent",
    income: "bg-income text-white border-income",
    expense: "bg-expense text-white border-expense",
    transfer: "bg-transfer text-white border-transfer",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors active:scale-[0.97]",
        active ? activeTone : "border-line bg-surface text-ink hover:bg-surface-2",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "md",
  className,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div className={cx("flex rounded-2xl bg-surface-2 p-1", className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "flex-1 rounded-xl font-medium whitespace-nowrap transition-all",
            size === "sm" ? "h-8 px-2 text-xs" : "h-9 px-3 text-sm",
            value === o.value ? "bg-surface text-ink shadow-card dark:bg-surface-3" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "dark" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}) {
  const styles = {
    primary: "pop bg-brand text-brand-ink",
    dark: "bg-accent text-accent-fg hover:opacity-90",
    secondary: "border border-line bg-surface text-ink hover:bg-surface-2",
    danger: "bg-expense-soft text-expense hover:opacity-80",
    ghost: "text-muted hover:text-ink hover:bg-surface-2",
  }[variant];
  const sizes = { sm: "h-8 px-3 text-[13px] rounded-xl", md: "h-10 px-4 text-sm rounded-xl", lg: "h-13 px-5 text-[15px] rounded-2xl" }[size];
  return (
    <button
      type="button"
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap transition disabled:pointer-events-none disabled:opacity-50",
        variant !== "primary" && "active:scale-[0.98]",
        styles,
        sizes,
        className,
      )}
    >
      {children}
    </button>
  );
}

// 16px minimum: iPhone Safari zooms the page into any field with smaller text.
const fieldBase =
  "h-11 rounded-xl border border-line bg-surface px-3.5 text-base text-ink placeholder:text-subtle outline-none transition focus:border-ink/40 focus:ring-4 focus:ring-ink/5";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(fieldBase, props.className ?? "w-full")} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(fieldBase, "pr-8", props.className ?? "w-full")} />;
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-muted">
      {children}
    </label>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  wide,
  fill,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  wide?: boolean;
  /** Children manage their own scrolling (flex column filling the sheet). */
  fill?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.dataset.sheet = "open"; // lets toasts move out of the way
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      delete document.body.dataset.sheet;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 animate-fade-in bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={cx(
          "relative flex max-h-[94dvh] w-full animate-sheet-in flex-col rounded-t-[28px] bg-surface shadow-float md:rounded-[28px]",
          wide ? "md:max-w-xl" : "md:max-w-md",
        )}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-surface-3 md:hidden" />
        <div className="flex shrink-0 items-center gap-3 px-5 pt-3 pb-3">
          <div className="min-w-0 flex-1 text-[17px] font-semibold tracking-tight">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted hover:text-ink"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        {fill ? (
          <div className="flex min-h-0 flex-1 flex-col px-5">{children}</div>
        ) : (
          <div className="overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
        )}
      </div>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cx("inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent", className)}
      aria-label="Loading"
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-3xl bg-surface-3/70", className)} />;
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-expense-soft px-4 py-3 text-sm text-expense">
      <span>{msg}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="shrink-0 font-semibold underline underline-offset-2">
          Retry
        </button>
      )}
    </div>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="rounded-xl bg-expense-soft px-3.5 py-2.5 text-sm text-expense">{children}</p>;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx("relative h-7 w-12 shrink-0 rounded-full transition-colors", checked ? "bg-income" : "bg-surface-3")}
    >
      <span
        className={cx(
          "absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}

/** Paylead-style icon tile: deep teal square, neon icon, neon offset shadow, slight tilt. */
export function IconTile({ children, size = 72, tilt = true }: { children: ReactNode; size?: number; tilt?: boolean }) {
  return (
    <span
      aria-hidden
      className={cx("inline-flex shrink-0 items-center justify-center rounded-[22%] bg-[#0f2d2a] text-brand", tilt && "-rotate-3")}
      style={{ width: size, height: size, boxShadow: `${Math.round(size / 18)}px ${Math.round(size / 18)}px 0 0 var(--brand)` }}
    >
      {children}
    </span>
  );
}

/** Empty state in Paylead's style: dashed card, icon tile, bold headline, one clear action. */
export function EmptyState({
  icon,
  title,
  body,
  action,
  compact,
}: {
  icon: ReactNode;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cx("flex flex-col items-center rounded-3xl border-2 border-dashed border-line bg-surface text-center", compact ? "px-5 py-7" : "px-6 py-10")}>
      <IconTile size={compact ? 56 : 72}>{icon}</IconTile>
      <h3 className={cx("font-display mt-6 font-extrabold tracking-tight text-ink", compact ? "text-[19px]" : "text-[23px] leading-tight")}>{title}</h3>
      {body && <p className="mt-2 max-w-xs text-[14.5px] leading-relaxed text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
