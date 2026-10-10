"use client";

/**
 * Trackaa UI kit. Pages compose these; they should not invent their own colours, radii or shadows.
 * Rules live in frontend/DESIGN.md.
 */

import { ChevronRight, CircleAlert, Info, TriangleAlert, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ Layout */

export function PageHeader({
  eyebrow,
  title,
  actions,
  back,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="pt-1">
      {back && (
        <Link href={back.href} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
          <ChevronRight size={16} className="rotate-180" /> {back.label}
        </Link>
      )}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h1 className="mt-1 text-[34px] leading-[1.05] font-extrabold text-ink">{title}</h1>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function SectionTitle({ children, action, hint }: { children: ReactNode; action?: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3 px-0.5">
      <div className="min-w-0">
        <h2 className="text-[19px] leading-tight font-bold text-ink">{children}</h2>
        {hint && <p className="mt-0.5 text-[13px] text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

/** Small "See all ›" style link for section headers. */
export function SectionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-center text-[13px] font-semibold text-ink underline decoration-brand decoration-2 underline-offset-4 hover:decoration-ink">
      {children}
    </Link>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("eyebrow", className)}>{children}</div>;
}

type CardTone = "default" | "ink" | "sunken" | "dashed" | "brand";

const CARD_TONE: Record<CardTone, string> = {
  default: "border border-line bg-surface",
  ink: "bg-hero text-hero-fg",
  sunken: "bg-surface-2",
  dashed: "border-2 border-dashed border-line bg-surface",
  brand: "pop bg-brand text-brand-ink",
};

export function Card({
  children,
  className,
  flush,
  tone = "default",
}: {
  children: ReactNode;
  className?: string;
  /** No padding (lists, tables). */
  flush?: boolean;
  tone?: CardTone;
}) {
  return <div className={cx("rounded-card", CARD_TONE[tone], !flush && "p-5", className)}>{children}</div>;
}

/** Card that links somewhere: whole surface is the target, with a chevron. */
export function LinkCard({ href, children, tone = "default", className }: { href: string; children: ReactNode; tone?: CardTone; className?: string }) {
  return (
    <Link
      href={href}
      className={cx(
        "group flex items-center gap-4 rounded-card p-5 transition-colors",
        CARD_TONE[tone],
        tone === "default" && "hover:border-ink/30",
        tone === "dashed" && "hover:border-ink/40",
        className,
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
      <ChevronRight size={18} className="shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/** One row in a list card: leading glyph, title + meta, trailing value. */
export function ListRow({
  leading,
  title,
  meta,
  trailing,
  onClick,
  href,
  muted,
}: {
  leading?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  href?: string;
  muted?: boolean;
}) {
  const inner = (
    <>
      {leading}
      <span className={cx("min-w-0 flex-1", muted && "opacity-55")}>
        <span className="block truncate text-[15px] font-semibold text-ink">{title}</span>
        {meta && <span className="mt-0.5 block truncate text-[12.5px] text-muted">{meta}</span>}
      </span>
      {trailing !== undefined && <span className="shrink-0 text-right">{trailing}</span>}
    </>
  );
  const cls = "flex w-full items-center gap-3 px-4 py-3 text-left";
  if (href)
    return (
      <Link href={href} className={cx(cls, "transition-colors hover:bg-surface-2")}>
        {inner}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cx(cls, "transition-colors hover:bg-surface-2 active:bg-surface-2")}>
        {inner}
      </button>
    );
  return <div className={cls}>{inner}</div>;
}

/** Card holding ListRows with hairline dividers. */
export function ListCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("divide-y divide-line overflow-hidden rounded-card border border-line bg-surface", className)}>{children}</div>;
}

/* ------------------------------------------------------------------ Numbers */

type ValueTone = "neutral" | "income" | "expense" | "muted";
const VALUE_TONE: Record<ValueTone, string> = { neutral: "text-ink", income: "text-income", expense: "text-expense", muted: "text-muted" };

/** Label above a number. Use in grids of figures. */
export function Stat({ label, value, tone = "neutral", size = "md" }: { label: ReactNode; value: ReactNode; tone?: ValueTone; size?: "sm" | "md" | "lg" }) {
  return (
    <div className="min-w-0">
      <div className="eyebrow truncate">{label}</div>
      <div
        className={cx(
          "font-display tabular mt-1 truncate font-bold",
          { sm: "text-[15px]", md: "text-[19px]", lg: "text-[28px] leading-none font-extrabold" }[size],
          VALUE_TONE[tone],
        )}
      >
        {value}
      </div>
    </div>
  );
}

/** Money/number text in the display face. */
export function Num({ children, className, tone = "neutral" }: { children: ReactNode; className?: string; tone?: ValueTone }) {
  return <span className={cx("font-display tabular font-bold", VALUE_TONE[tone], className)}>{children}</span>;
}

/* ------------------------------------------------------------------ Status */

export type TagTone = "neutral" | "good" | "warn" | "bad" | "brand" | "ink";
const TAG_TONE: Record<TagTone, string> = {
  neutral: "bg-surface-2 text-muted",
  good: "bg-income-soft text-income",
  warn: "bg-warn-soft text-warn",
  bad: "bg-expense-soft text-expense",
  brand: "bg-brand text-brand-ink",
  ink: "bg-hero text-brand",
};

/** Small status label. Always carries words (and ideally an icon); never colour alone. */
export function Tag({ children, tone = "neutral", icon: Icon, className }: { children: ReactNode; tone?: TagTone; icon?: LucideIcon; className?: string }) {
  return (
    <span className={cx("inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-[11.5px] font-bold whitespace-nowrap", TAG_TONE[tone], className)}>
      {Icon && <Icon size={13} strokeWidth={2.5} />}
      {children}
    </span>
  );
}

export type BarTone = "brand" | "good" | "warn" | "bad" | "ink";
const BAR_FILL: Record<BarTone, string> = {
  brand: "bg-brand",
  good: "bg-brand",
  warn: "bg-warn",
  bad: "bg-expense",
  ink: "bg-ink",
};

/** Progress bar: sunken track, solid fill, optional pace tick. */
export function ProgressBar({
  value,
  max,
  tone = "brand",
  pace,
  size = "md",
  label,
  onDark,
}: {
  value: number;
  max: number;
  tone?: BarTone;
  pace?: number;
  size?: "sm" | "md" | "lg";
  label?: string;
  onDark?: boolean;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(value / max, 1)) * 100 : 0;
  const pacePct = pace !== undefined && max > 0 ? Math.min(pace / max, 1) * 100 : null;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cx(
        "relative w-full rounded-full",
        onDark ? "bg-white/10" : "bg-surface-2",
        { sm: "h-1.5", md: "h-2.5", lg: "h-3.5" }[size],
      )}
    >
      <div className={cx("h-full rounded-full transition-[width] duration-700", BAR_FILL[tone])} style={{ width: `${pct}%`, minWidth: pct > 0 ? 6 : 0 }} />
      {pacePct !== null && pacePct > 0 && pacePct < 100 && (
        <div
          className={cx("absolute -top-1 -bottom-1 w-[3px] rounded-full", onDark ? "bg-hero-fg" : "bg-ink")}
          style={{ left: `calc(${pacePct}% - 1.5px)` }}
          title="Where you'd be spending evenly"
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Controls */

type Tone = "neutral" | "income" | "expense" | "transfer";

/** Filter / choice pill. Active is ink; income and expense keep their meaning colour. */
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
    neutral: "border-ink bg-ink text-surface",
    transfer: "border-ink bg-ink text-surface",
    income: "border-income bg-income text-white",
    expense: "border-expense bg-expense text-white",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border-[1.5px] px-3.5 text-[13px] font-semibold transition-colors active:scale-[0.97]",
        active ? activeTone : "border-line bg-surface text-ink hover:border-ink/40",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/** Tabs: white pill on a sunken track (or neon on an ink panel). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "md",
  className,
  onDark,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  size?: "sm" | "md";
  className?: string;
  onDark?: boolean;
  label?: string;
}) {
  return (
    <div className={cx("flex rounded-control p-1", onDark ? "bg-white/[0.07]" : "bg-surface-2", className)} role="tablist" aria-label={label}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={cx(
              "flex-1 rounded-[10px] font-semibold whitespace-nowrap transition-colors",
              size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3 text-sm",
              onDark
                ? on
                  ? "bg-brand text-brand-ink"
                  : "text-hero-muted hover:text-hero-fg"
                : on
                  ? "bg-surface text-ink shadow-[0_1px_0_0_var(--border),0_0_0_1px_var(--border)] dark:bg-surface-3"
                  : "text-muted hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export type ButtonVariant = "primary" | "ink" | "secondary" | "danger" | "ghost";

export function buttonClass(variant: ButtonVariant = "primary", size: "sm" | "md" | "lg" = "md") {
  const styles = {
    primary: "pop bg-brand text-brand-ink",
    ink: "bg-hero text-hero-fg hover:bg-hero/90 dark:bg-surface-3",
    secondary: "border-[1.5px] border-ink/15 bg-surface text-ink hover:border-ink/40",
    danger: "border-[1.5px] border-expense/30 bg-surface text-expense hover:bg-expense-soft",
    ghost: "text-muted hover:bg-surface-2 hover:text-ink",
  }[variant];
  const sizes = { sm: "h-9 px-3.5 text-[13px]", md: "h-11 px-4 text-sm", lg: "h-[52px] px-5 text-[15px]" }[size];
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-control font-bold whitespace-nowrap transition disabled:pointer-events-none disabled:opacity-45",
    variant !== "primary" && "active:scale-[0.98]",
    styles,
    sizes,
  );
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** `dark` is kept as an alias of `ink`. */
  variant?: ButtonVariant | "dark";
  size?: "sm" | "md" | "lg";
}) {
  return (
    <button type="button" {...props} className={cx(buttonClass(variant === "dark" ? "ink" : variant, size), className)}>
      {children}
    </button>
  );
}

/** Round icon-only button for headers and toolbars. */
export function IconButton({
  label,
  children,
  href,
  onClick,
  className,
}: {
  label: string;
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  const cls = cx(
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[1.5px] border-line bg-surface text-ink transition-colors hover:border-ink/40",
    className,
  );
  return href ? (
    <Link href={href} aria-label={label} className={cls}>
      {children}
    </Link>
  ) : (
    <button type="button" aria-label={label} onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

// 16px minimum: iPhone Safari zooms the page into any field with smaller text.
export const fieldClass =
  "h-12 rounded-control border-[1.5px] border-line bg-surface px-3.5 text-base text-ink placeholder:text-subtle outline-none transition focus:border-ink focus:ring-4 focus:ring-brand/30";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(fieldClass, props.className ?? "w-full")} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(fieldClass, "pr-8", props.className ?? "w-full")} />;
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-semibold text-ink">
      {children}
    </label>
  );
}

/** Label + control + optional hint, stacked. */
export function Field({ label, htmlFor, hint, children }: { label: ReactNode; htmlFor?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="mt-1.5 text-[12.5px] text-muted">{hint}</p>}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative h-7 w-12 shrink-0 rounded-full border-2 transition-colors",
        checked ? "border-brand-ink bg-brand" : "border-line bg-surface-2",
      )}
    >
      <span
        className={cx(
          "absolute top-0.5 left-0.5 h-5 w-5 rounded-full transition-transform",
          checked ? "translate-x-5 bg-brand-ink" : "bg-subtle",
        )}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ Overlays */

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
      <div className="absolute inset-0 animate-fade-in bg-overlay" onClick={onClose} />
      <div
        className={cx(
          "relative flex max-h-[94dvh] w-full animate-sheet-in flex-col rounded-t-sheet bg-surface md:rounded-sheet md:border-2 md:border-brand-ink md:shadow-hard-lg",
          wide ? "md:max-w-xl" : "md:max-w-md",
        )}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-surface-3 md:hidden" />
        <div className="flex shrink-0 items-center gap-3 px-5 pt-3 pb-3">
          <div className="font-display min-w-0 flex-1 text-[20px] font-extrabold tracking-tight">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink hover:bg-surface-3"
            aria-label="Close"
          >
            <X size={18} strokeWidth={2.25} />
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

/* ------------------------------------------------------------------ Feedback */

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cx("inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent", className)}
      aria-label="Loading"
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-card bg-surface-2", className)} />;
}

type CalloutTone = "info" | "warn" | "bad";
const CALLOUT: Record<CalloutTone, { cls: string; Icon: LucideIcon }> = {
  info: { cls: "bg-surface-2 text-ink", Icon: Info },
  warn: { cls: "bg-warn-soft text-warn", Icon: TriangleAlert },
  bad: { cls: "bg-expense-soft text-expense", Icon: CircleAlert },
};

/** Inline message block with an icon. */
export function Callout({ tone = "info", children, action, className }: { tone?: CalloutTone; children: ReactNode; action?: ReactNode; className?: string }) {
  const { cls, Icon } = CALLOUT[tone];
  return (
    <div className={cx("flex items-start gap-2.5 rounded-control px-3.5 py-3 text-[13.5px] leading-snug", cls, className)}>
      <Icon size={17} className="mt-px shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <Callout
      tone="bad"
      action={
        onRetry && (
          <button type="button" onClick={onRetry} className="shrink-0 font-bold underline underline-offset-2">
            Retry
          </button>
        )
      }
    >
      {msg}
    </Callout>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <Callout tone="bad">{children}</Callout>;
}

/* ------------------------------------------------------------------ Icons */

/**
 * Featured icon: ink tile, neon glyph, neon offset shadow, slight tilt.
 * For empty states, celebrations and earned badges only; lists use Glyph.
 */
export function IconTile({ children, size = 72, tilt = true }: { children: ReactNode; size?: number; tilt?: boolean }) {
  const off = Math.max(2, Math.round(size / 18));
  return (
    <span
      aria-hidden
      className={cx("inline-flex shrink-0 items-center justify-center rounded-[22%] bg-hero text-brand", tilt && "-rotate-3")}
      style={{ width: size, height: size, boxShadow: `${off}px ${off}px 0 0 var(--brand)` }}
    >
      {children}
    </span>
  );
}

/** List icon: sunken square with an ink glyph. Selected = ink square, neon glyph. */
export function Glyph({
  icon: Icon,
  children,
  size = 40,
  active,
  tone = "neutral",
}: {
  icon?: LucideIcon;
  children?: ReactNode;
  size?: number;
  active?: boolean;
  tone?: "neutral" | "income" | "expense";
}) {
  return (
    <span
      aria-hidden
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-tile font-display font-extrabold transition-colors",
        active
          ? "bg-hero text-brand"
          : tone === "income"
            ? "bg-income-soft text-income"
            : tone === "expense"
              ? "bg-expense-soft text-expense"
              : "bg-surface-2 text-ink",
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {Icon ? <Icon size={Math.round(size * 0.46)} strokeWidth={2} /> : children}
    </span>
  );
}

/** Two-letter monogram for businesses and people. */
export function Monogram({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .map((w) => w.match(/[\p{L}\p{N}]/u)?.[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return <Glyph size={size}>{initials || "?"}</Glyph>;
}

/** Empty state: dashed card, featured icon tile, bold headline, one clear action. */
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
    <div className={cx("flex flex-col items-center rounded-card border-2 border-dashed border-line bg-surface text-center", compact ? "px-5 py-7" : "px-6 py-10")}>
      <IconTile size={compact ? 56 : 72}>{icon}</IconTile>
      <h3 className={cx("mt-6 font-extrabold text-ink", compact ? "text-[19px]" : "text-[23px] leading-tight")}>{title}</h3>
      {body && <p className="mt-2 max-w-xs text-[14.5px] leading-relaxed text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md border border-current/25 px-1.5 py-0.5 font-sans text-[11px]">{children}</kbd>;
}

/** "trackaa" with a neon underline, like Paylead's wordmark. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx("font-display relative text-[21px] font-extrabold tracking-tight", className)}>
      trackaa
      <span className="absolute -bottom-0.5 left-0 h-[3px] w-full rounded-full bg-brand" />
    </span>
  );
}
