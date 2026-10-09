"use client";

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
    timer.current = setTimeout(() => setToast((cur) => (cur?.id === id ? null : cur)), t.action ? 7000 : 3000);
  }, []);

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 md:bottom-8" aria-live="polite">
        {toast && (
          <div
            key={toast.id}
            className={cx(
              "pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm shadow-lg",
              toast.tone === "error" ? "bg-expense text-white" : "bg-accent text-accent-fg",
            )}
          >
            <span className="flex items-center gap-2">
              {toast.tone !== "error" && <span aria-hidden>✓</span>}
              {toast.message}
            </span>
            {toast.action && (
              <button
                type="button"
                className="shrink-0 rounded-lg px-2 py-1 font-semibold underline-offset-2 hover:underline"
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
