"use client";

import { Input } from "./ui";

/** GH₵ amount field. Value is the raw typed string; parse with parseAmount(). */
export function MoneyField({ id, value, onChange, autoFocus, placeholder = "0.00" }: { id?: string; value: string; onChange: (v: string) => void; autoFocus?: boolean; placeholder?: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[15px] font-medium text-muted">GH₵</span>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
        className="tabular w-full pl-12"
      />
    </div>
  );
}
