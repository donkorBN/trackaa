"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { getToken } from "@/lib/api";
import { HomeIcon, ListIcon, PlusIcon, CheckIcon, SettingsIcon } from "./icons";
import { QuickAddProvider, useQuickAdd } from "./quick-add";
import { cx, Spinner } from "./ui";

const NAV = [
  { href: "/", label: "Overview", icon: HomeIcon },
  { href: "/transactions", label: "Transactions", icon: ListIcon },
  { href: "/review", label: "Today", icon: CheckIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) router.replace("/login");
    else setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">
        <Spinner />
      </div>
    );
  }

  return (
    <QuickAddProvider>
      <Frame>{children}</Frame>
    </QuickAddProvider>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { openQuickAdd } = useQuickAdd();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  // Keyboard shortcut on desktop: "n" for a new transaction.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "n" && !e.metaKey && !e.ctrlKey && !["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) {
        e.preventDefault();
        openQuickAdd();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openQuickAdd]);

  return (
    <div className="min-h-dvh md:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface p-4 md:flex">
        <div className="mb-6 px-2 text-lg font-bold tracking-tight">Trackaa</div>
        <button
          type="button"
          onClick={openQuickAdd}
          className="mb-4 flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-fg hover:opacity-90"
        >
          <PlusIcon size={18} /> Add transaction
        </button>
        <nav className="space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                isActive(href) ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2 hover:text-ink",
              )}
            >
              <Icon /> {label}
            </Link>
          ))}
        </nav>
        <p className="mt-auto px-2 text-xs text-muted">Press N to add a transaction</p>
      </aside>

      <main className="mx-auto w-full max-w-3xl px-4 pt-5 pb-32 md:px-8 md:pt-8 md:pb-12">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 items-end">
          {NAV.slice(0, 2).map((n) => (
            <NavItem key={n.href} {...n} active={isActive(n.href)} />
          ))}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={openQuickAdd}
              aria-label="Add transaction"
              className="-mt-6 mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-lg active:scale-95"
            >
              <PlusIcon size={26} />
            </button>
          </div>
          {NAV.slice(2).map((n) => (
            <NavItem key={n.href} {...n} active={isActive(n.href)} />
          ))}
        </div>
      </nav>
    </div>
  );
}

function NavItem({ href, label, icon: Icon, active }: { href: string; label: string; icon: () => ReactNode; active: boolean }) {
  return (
    <Link href={href} className={cx("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", active ? "text-ink" : "text-muted")}>
      <Icon />
      {label}
    </Link>
  );
}
