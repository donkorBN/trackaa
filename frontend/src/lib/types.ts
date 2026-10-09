export type TxType = "income" | "expense" | "transfer";
export type Scope = "personal" | "business";
export type ScopeFilter = "all" | Scope;

export interface User {
  id: number;
  name: string;
  email: string;
  timezone: string;
  reminder_enabled: boolean;
  reminder_time: string; // "HH:MM"
  last_reviewed_on: string | null; // Y-m-d
}

export interface Account {
  id: number;
  name: string;
  account_type: "mobile_money" | "cash" | "bank" | "other";
  opening_balance: number; // pesewas
  balance: number; // pesewas: opening balance + recorded activity
  archived: boolean;
}

export interface Business {
  id: number;
  name: string;
  archived: boolean;
}

export interface Category {
  id: number;
  name: string;
  transaction_type: "income" | "expense";
  archived: boolean;
  usage_count: number;
}

export interface Ref {
  id: number;
  name: string;
}

export interface Transaction {
  id: number;
  type: TxType;
  amount: number; // pesewas, always positive
  scope: Scope;
  business: Ref | null;
  category: Ref | null;
  account: Ref;
  to_account: Ref | null;
  description: string | null;
  occurred_at: string; // ISO 8601
  created_at: string;
}

export interface Totals {
  income: number;
  expense: number;
  net: number;
}

export interface Overview {
  today: Totals;
  month: Totals;
  period: Totals & { from: string; to: string };
  categories: { id: number; name: string; total: number }[];
  businesses: { id: number | null; name: string; income: number; expense: number; net: number }[];
  recent: Transaction[];
  has_transactions: boolean;
}

export interface TransactionPage {
  data: Transaction[];
  meta: { current_page: number; last_page: number; total: number };
  days: Record<string, { income: number; expense: number }>;
}

export type Period = "today" | "week" | "month" | "custom";

export interface TxInput {
  type: TxType;
  amount: number;
  scope: Scope;
  category_id: number | null;
  account_id: number;
  to_account_id: number | null;
  business_id: number | null;
  description: string | null;
  occurred_at: string | null;
  client_ref?: string;
}
