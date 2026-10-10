import {
  ArrowLeftRight, Banknote, Briefcase, Bus, Car, CircleDashed, Clapperboard, Coins, CreditCard, Fuel, Gift,
  GraduationCap, HeartPulse, Home, Landmark, Laptop, Lightbulb, type LucideIcon, Megaphone, Package, Percent,
  Repeat, Shirt, ShoppingBag, Smartphone, Store, Tag, TrendingUp, Truck, Undo2, Users, UtensilsCrossed, Wallet,
  Wifi,
} from "lucide-react";
import type { Account } from "./types";

/** Category icons. Colour is never per-category: icons sit in neutral Glyph tiles. */
const KNOWN: Record<string, LucideIcon> = {
  food: UtensilsCrossed,
  transport: Bus,
  "rent / housing": Home,
  utilities: Lightbulb,
  shopping: ShoppingBag,
  health: HeartPulse,
  education: GraduationCap,
  entertainment: Clapperboard,
  subscriptions: Repeat,
  "marketing / advertising": Megaphone,
  "inventory / stock": Package,
  "business operations": Briefcase,
  "staff / contractors": Users,
  delivery: Truck,
  "bank / momo fees": Landmark,
  "debt repayment": CreditCard,
  "other expense": CircleDashed,
  salary: Wallet,
  "business sales": Store,
  "freelance / services": Laptop,
  commission: Percent,
  "investment income": TrendingUp,
  refund: Undo2,
  "other income": Coins,
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

export function categoryIcon(name: string | null | undefined): LucideIcon {
  const key = (name ?? "").trim().toLowerCase();
  if (KNOWN[key]) return KNOWN[key];
  return KEYWORDS.find(([re]) => re.test(key))?.[1] ?? Tag;
}

/** Shades for "share of total" bars: ink first, fading toward paper. Order matters, not identity. */
export const SHARE_RAMP = [1, 2, 3, 4, 5, 6].map((i) => `var(--share-${i})`);

export const ACCOUNT_ICON: Record<Account["account_type"], LucideIcon> = {
  mobile_money: Smartphone,
  cash: Banknote,
  bank: Landmark,
  other: Wallet,
};

export const TransferIcon = ArrowLeftRight;
