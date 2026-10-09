"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { cx } from "./ui";

interface ToastOptions {
  message: string;
  tone?: "success" | "error";
  action?: { label: string; onClick: () => void };
}

const ToastCtx = createContext<(t: ToastOptions) => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastOptions & { id: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((t: ToastOptions) => {
    if (timer.current) clearTimeout(timer.current);
    const id = Date.now();
    setToast({ ...t, id });
    timer.current = setTimeout(() => setToast((cur) => (cur?.id === id ? null : cur)), t.action ? 7000 : 3200);
  }, []);

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div
        className="toast-wrap pointer-events-none fixed inset-x-0 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-[60] flex justify-center px-4 md:bottom-8"
        aria-live="polite"
      >
        {toast && (
          <div
            key={toast.id}
            className={cx(
              "pointer-events-auto flex w-full max-w-md animate-pop items-center gap-3 rounded-2xl py-2.5 pr-2 pl-4 text-sm shadow-float",
              toast.tone === "error" ? "bg-expense text-white" : "bg-hero text-hero-fg dark:bg-surface-3",
            )}
          >
            {toast.tone === "error" ? <CircleAlert size={18} className="shrink-0" /> : <CircleCheck size={18} className="shrink-0 text-income" />}
            <span className="min-w-0 flex-1 py-1">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className="shrink-0 rounded-xl bg-white/10 px-3 py-1.5 font-semibold hover:bg-white/20"
                onClick={() => {
                  toast.action!.onClick();
                  setToast(null);
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastCtx.Provider>
  );
}
