"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import type { Transaction } from "@/lib/types";
import { TransactionForm } from "./TransactionForm";
import { Sheet } from "./ui";

interface Ctx {
  openQuickAdd: () => void;
  openEdit: (tx: Transaction) => void;
}

const QuickAddCtx = createContext<Ctx>({ openQuickAdd: () => {}, openEdit: () => {} });

export function useQuickAdd() {
  return useContext(QuickAddCtx);
}

export function QuickAddProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ key: number; tx?: Transaction } | null>(null);
  const keyboardPrimer = useRef<HTMLInputElement>(null);

  const openQuickAdd = useCallback(() => {
    // iOS only raises the keyboard for focus() inside the tap handler. Focus a
    // primer input now; the amount field's autoFocus then takes it over.
    keyboardPrimer.current?.focus();
    setState({ key: Date.now() });
  }, []);
  const openEdit = useCallback((tx: Transaction) => setState({ key: Date.now(), tx }), []);
  const close = useCallback(() => setState(null), []);

  return (
    <QuickAddCtx.Provider value={{ openQuickAdd, openEdit }}>
      {children}
      <input
        ref={keyboardPrimer}
        aria-hidden
        tabIndex={-1}
        inputMode="decimal"
        className="pointer-events-none fixed top-0 left-0 h-0 w-0 opacity-0"
      />
      <Sheet open={!!state} onClose={close} title={state?.tx ? "Edit transaction" : "Add transaction"}>
        {state && <TransactionForm key={state.key} tx={state.tx} onDone={close} />}
      </Sheet>
    </QuickAddCtx.Provider>
  );
}
