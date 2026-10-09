import {
  ArrowLeftRight, Banknote, Briefcase, Bus, Car, CircleDashed, Clapperboard, Coins, CreditCard, Fuel, Gift,
  GraduationCap, HeartPulse, Home, Landmark, Laptop, Lightbulb, type LucideIcon, Megaphone, Package, Percent,
  Repeat, Shirt, ShoppingBag, Smartphone, Store, Tag, TrendingUp, Truck, Undo2, Users, UtensilsCrossed, Wallet,
  Wifi,
} from "lucide-react";
import type { Account } from "./types";

const PALETTE = [
  "#f97316", "#0ea5e9", "#8b5cf6", "#eab308", "#ec4899", "#14b8a6",
  "#6366f1", "#22c55e", "#ef4444", "#a855f7", "#06b6d4", "#84cc16",
];

const KNOWN: Record<string, [LucideIcon, string]> = {
  food: [UtensilsCrossed, "#f97316"],
  transport: [Bus, "#0ea5e9"],
  "rent / housing": [Home, "#8b5cf6"],
  utilities: [Lightbulb, "#eab308"],
  shopping: [ShoppingBag, "#ec4899"],
  health: [HeartPulse, "#ef4444"],
  education: [GraduationCap, "#6366f1"],
  entertainment: [Clapperboard, "#a855f7"],
  subscriptions: [Repeat, "#06b6d4"],
  "marketing / advertising": [Megaphone, "#f43f5e"],
  "inventory / stock": [Package, "#d97706"],
  "business operations": [Briefcase, "#64748b"],
  "staff / contractors": [Users, "#14b8a6"],
  delivery: [Truck, "#0891b2"],
  "bank / momo fees": [Landmark, "#78716c"],
  "debt repayment": [CreditCard, "#be123c"],
  "other expense": [CircleDashed, "#94a3b8"],
  salary: [Wallet, "#16a34a"],
  "business sales": [Store, "#059669"],
  "freelance / services": [Laptop, "#0d9488"],
  commission: [Percent, "#65a30d"],
  "investment income": [TrendingUp, "#15803d"],
  refund: [Undo2, "#0284c7"],
  "other income": [Coins, "#ca8a04"],
};

// Reasonable icons for categories the user creates themselves.
const KEYWORDS: [RegExp, LucideIcon][] = [
  [/fuel|petrol|gas station/, Fuel],
  [/uber|bolt|taxi|car/, Car],
  [/airtime|data|phone|mobile/, Smartphone],
  [/internet|wifi/, Wifi],
  [/gift|donation|church|tithe/, Gift],
  [/cloth|fashion|shoe/, Shirt],
  [/food|eat|lunch|chop|restaurant/, UtensilsCrossed],
  [/rent|house/, Home],
  [/transport|trotro|bus/, Bus],
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function categoryVisual(name: string | null | undefined): { Icon: LucideIcon; color: string } {
  const key = (name ?? "").trim().toLowerCase();
  if (KNOWN[key]) return { Icon: KNOWN[key][0], color: KNOWN[key][1] };
  const kw = KEYWORDS.find(([re]) => re.test(key));
  return { Icon: kw?.[1] ?? Tag, color: PALETTE[hash(key) % PALETTE.length] };
}

export function colorFor(name: string) {
  return PALETTE[hash(name.toLowerCase()) % PALETTE.length];
}

export const ACCOUNT_ICON: Record<Account["account_type"], LucideIcon> = {
  mobile_money: Smartphone,
  cash: Banknote,
  bank: Landmark,
  other: Wallet,
};

export const TransferIcon = ArrowLeftRight;

/** A tinted circle with an icon, used for categories everywhere. */
export function IconBubble({
  Icon,
  color,
  size = 40,
  active,
}: {
  Icon: LucideIcon;
  color: string;
  size?: number;
  active?: boolean;
}) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full transition-colors"
      style={{
        width: size,
        height: size,
        color: active ? "#fff" : color,
        background: active ? color : `color-mix(in oklab, ${color} 14%, transparent)`,
      }}
    >
      <Icon size={Math.round(size * 0.46)} strokeWidth={2} />
    </span>
  );
}

export function Initials({ name, size = 36 }: { name: string; size?: number }) {
  const color = colorFor(name);
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-xl text-xs font-bold"
      style={{ width: size, height: size, color, background: `color-mix(in oklab, ${color} 14%, transparent)` }}
    >
      {initials}
    </span>
  );
}
