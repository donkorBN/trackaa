export type TxType = "income" | "expense" | "transfer";
export type Scope = "personal" | "business";
export type ScopeFilter = "all" | Scope;

export interface User {
  id: number;
  name: string;
  email: string;
  timezone: string;
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

export interface Budget {
  id: number;
  category: Ref | null;
  scope: "all" | "personal" | "business";
  amount: number;
  spent: number;
  remaining: number;
  daily: number;
  weekly: number;
  expected_by_now: number;
  daily_allowance: number | null;
  spent_today: number | null;
  spent_this_week: number | null;
}

export interface BudgetsResponse {
  month: string;
  days_in_month: number;
  days_elapsed: number;
  days_left: number;
  data: Budget[];
}

export interface Goal {
  id: number;
  name: string;
  target_amount: number;
  target_date: string | null;
  color: string | null;
  archived: boolean;
  saved: number;
  remaining: number;
  percent: number;
  weekly_needed: number | null;
  monthly_needed: number | null;
  projected_date: string | null;
  on_track: boolean | null;
  contribution_count: number;
}

export interface GoalDetail extends Goal {
  contributions: { id: number; amount: number; occurred_on: string; note: string | null; running_total: number }[];
}

export interface Insights {
  months: { month: string; income: number; expense: number; net: number }[];
  daily: { date: string; expense: number; income: number }[];
  weekdays: { weekday: number; label: string; total: number; average: number; days: number }[];
  categories: { id: number; name: string; this_month: number; last_month_to_date: number; last_month: number; change: number }[];
  top_expenses: { id: number; amount: number; description: string | null; category: string | null; occurred_at: string }[];
  stats: {
    average_daily_spend: number;
    projected_month_spend: number;
    savings_rate: number | null;
    average_monthly_spend: number | null;
    average_monthly_income: number | null;
    day_of_month: number;
    days_in_month: number;
  };
}

export interface StatementListItem {
  id: number;
  account: Ref;
  period: string;
  source_name: string | null;
  line_count: number;
  matched: number;
  unmatched: number;
  imported_at: string;
}

export interface StatementLineT {
  id: number;
  occurred_at: string;
  amount: number;
  description: string | null;
  reference: string | null;
  balance: number | null;
  status: "matched" | "unmatched" | "ignored";
  transaction: Transaction | null;
}

export interface StatementDetail {
  id: number;
  account: Ref & { account_type: Account["account_type"] };
  period: string;
  source_name: string | null;
  summary: {
    statement_in: number;
    statement_out: number;
    app_in: number;
    app_out: number;
    statement_closing: number | null;
    recorded_closing: number;
    difference: number | null;
    counts: { total: number; matched: number; unmatched: number; ignored: number };
  };
  lines: StatementLineT[];
  app_only: Transaction[];
}

export interface Badge {
  key: string;
  name: string;
  description: string;
  earned: boolean;
  progress: { current: number; target: number } | null;
}

export interface Progress {
  streak: number;
  best_streak: number;
  today_done: boolean;
  at_risk: boolean;
  week: { date: string; label: string; state: "logged" | "checkin" | "missed" | "future" }[];
  active_days: number;
  transactions: number;
  level: { number: number; name: string; next_name: string | null; days_into_level: number; days_for_next: number | null };
  badges: Badge[];
}
