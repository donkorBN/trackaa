"use client";

import { CircleCheckBig, CloudOff, House, List, Plus, Settings } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { getToken } from "@/lib/api";
import { useRefreshAll } from "@/lib/hooks";
import { flushOutbox, useOutboxCount } from "@/lib/offline";
import { QuickAddProvider, useQuickAdd } from "./quick-add";
import { useToast } from "./toast";
import { cx, Spinner } from "./ui";

const NAV = [
  { href: "/", label: "Overview", icon: House },
  { href: "/transactions", label: "Transactions", icon: List },
  { href: "/review", label: "Today", icon: CircleCheckBig },
  { href: "/settings", label: "Settings", icon: Settings },
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
      <OfflineSync />
      <Frame>{children}</Frame>
    </QuickAddProvider>
  );
}

/** Pushes transactions saved while offline as soon as the connection is back. */
function OfflineSync() {
  const refreshAll = useRefreshAll();
  const toast = useToast();
  useEffect(() => {
    const run = async () => {
      const { synced, failed } = await flushOutbox();
      if (synced) {
        refreshAll();
        toast({ message: `Synced ${synced} offline transaction${synced === 1 ? "" : "s"}` });
      }
      if (failed.length) toast({ message: `Couldn't sync a transaction: ${failed[0]}`, tone: "error" });
    };
    run();
    window.addEventListener("online", run);
    const id = setInterval(run, 30_000);
    return () => {
      window.removeEventListener("online", run);
      clearInterval(id);
    };
  }, [refreshAll, toast]);
  return null;
}

function Frame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { openQuickAdd } = useQuickAdd();
  const pending = useOutboxCount();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  // Desktop shortcut: "n" for a new transaction.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "n" && !e.metaKey && !e.ctrlKey && !e.altKey && !["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) && !document.querySelector("[role=dialog]")) {
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
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface px-4 py-6 md:flex">
        <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
          <Image width={32} height={32} src="/icon-192.png" alt="" className="h-8 w-8 rounded-[10px]" />
          <span className="text-[17px] font-bold tracking-tight">Trackaa</span>
        </Link>
        <button
          type="button"
          onClick={openQuickAdd}
          className="mb-6 flex h-11 items-center justify-center gap-2 rounded-2xl bg-accent text-sm font-semibold text-accent-fg shadow-card hover:opacity-90"
        >
          <Plus size={18} strokeWidth={2.5} /> New transaction
        </button>
        <nav className="space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cx(
                "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                isActive(href) ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2 hover:text-ink",
              )}
            >
              <Icon size={19} strokeWidth={isActive(href) ? 2.2 : 1.8} /> {label}
            </Link>
          ))}
        </nav>
        <p className="mt-auto px-3 text-xs text-subtle">
          Press <kbd className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-[11px] text-muted">N</kbd> to add
        </p>
      </aside>

      <main className="mx-auto w-full max-w-2xl px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-36 md:px-8 md:pt-10 md:pb-16">
        {pending > 0 && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl bg-surface-2 px-4 py-2.5 text-[13px] text-muted">
            <CloudOff size={16} /> {pending} transaction{pending === 1 ? "" : "s"} saved offline, syncing when you&apos;re back online
          </div>
        )}
        {children}
      </main>

      {/* Mobile bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 md:hidden">
        <div className="pb-safe border-t border-line bg-surface/90 backdrop-blur-xl">
          <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
            {NAV.slice(0, 2).map((n) => (
              <NavItem key={n.href} {...n} active={isActive(n.href)} />
            ))}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={openQuickAdd}
                aria-label="Add transaction"
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-fg shadow-float transition active:scale-95"
              >
                <Plus size={26} strokeWidth={2.5} />
              </button>
            </div>
            {NAV.slice(2).map((n) => (
              <NavItem key={n.href} {...n} active={isActive(n.href)} />
            ))}
          </div>
        </div>
      </nav>
    </div>
  );
}

function NavItem({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof House; active: boolean }) {
  return (
    <Link href={href} className={cx("flex flex-col items-center gap-1 text-[10.5px] font-medium", active ? "text-ink" : "text-subtle")}>
      <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
      {label}
    </Link>
  );
}
