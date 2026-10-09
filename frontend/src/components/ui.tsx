"use client";

import { useEffect, type ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Card({ children, className, flush }: { children: ReactNode; className?: string; flush?: boolean }) {
  return <div className={cx("rounded-2xl border border-line bg-surface", !flush && "p-4", className)}>{children}</div>;
}

export function Chip({
  active,
  onClick,
  children,
  tone = "neutral",
  size = "md",
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  tone?: "neutral" | "income" | "expense" | "transfer";
  size?: "sm" | "md";
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
        "shrink-0 rounded-full border font-medium",
        size === "sm" ? "px-3 py-1.5 text-[13px]" : "px-3.5 py-2 text-sm",
        active ? activeTone : "border-line bg-surface text-ink hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "md",
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex rounded-xl bg-surface-2 p-1" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "flex-1 rounded-lg font-medium transition-colors",
            size === "sm" ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm",
            value === o.value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
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
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  const styles = {
    primary: "bg-accent text-accent-fg hover:opacity-90",
    secondary: "border border-line bg-surface text-ink hover:bg-surface-2",
    danger: "border border-line bg-surface text-expense hover:bg-expense-soft",
    ghost: "text-muted hover:text-ink hover:bg-surface-2",
  }[variant];
  return (
    <button
      type="button"
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50",
        styles,
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "rounded-xl border border-line bg-surface px-3.5 py-2.5 text-base text-ink placeholder:text-muted outline-none focus:border-ink",
        props.className ?? "w-full",
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cx(
        "rounded-xl border border-line bg-surface px-3 py-2.5 text-base text-ink outline-none focus:border-ink",
        props.className ?? "w-full",
      )}
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{children}</div>;
}

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex max-h-[94dvh] w-full flex-col rounded-t-3xl bg-surface shadow-xl md:max-w-lg md:rounded-3xl">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="text-base font-semibold">{title}</div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-muted hover:bg-surface-2" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
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
  return <div className={cx("animate-pulse rounded-xl bg-surface-2", className)} />;
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-expense/30 bg-expense-soft p-4 text-sm text-expense">
      <span>{msg}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="font-semibold underline">
          Retry
        </button>
      )}
    </div>
  );
}
