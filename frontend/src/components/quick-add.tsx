"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
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
  const openQuickAdd = useCallback(() => setState({ key: Date.now() }), []);
  const openEdit = useCallback((tx: Transaction) => setState({ key: Date.now(), tx }), []);
  const close = useCallback(() => setState(null), []);

  return (
    <QuickAddCtx.Provider value={{ openQuickAdd, openEdit }}>
      {children}
      <Sheet fill open={!!state} onClose={close} title={state?.tx ? "Edit transaction" : "New transaction"}>
        {state && <TransactionForm key={state.key} tx={state.tx} onDone={close} />}
      </Sheet>
    </QuickAddCtx.Provider>
  );
}
