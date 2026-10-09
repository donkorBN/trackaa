import type { Scope, TxType } from "./types";

// Remembered Quick Add defaults (per device).
export interface QuickDefaults {
  type: TxType;
  scope: Scope;
  account_id: number | null;
  to_account_id: number | null;
  business_id: number | null;
  category: { income: number | null; expense: number | null };
}

const KEY = "trackaa.quick-defaults";

export function loadDefaults(): QuickDefaults {
  const fallback: QuickDefaults = {
    type: "expense",
    scope: "personal",
    account_id: null,
    to_account_id: null,
    business_id: null,
    category: { income: null, expense: null },
  };
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export function saveDefaults(d: QuickDefaults) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}
