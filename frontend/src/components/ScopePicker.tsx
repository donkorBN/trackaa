"use client";

import { useBusinesses } from "@/lib/hooks";
import type { ScopeFilter } from "@/lib/types";
import { Chip, Segmented } from "./ui";

export interface ScopeValue {
  scope: ScopeFilter;
  businessId: number | null;
}

export function ScopePicker({ value, onChange }: { value: ScopeValue; onChange: (v: ScopeValue) => void }) {
  const { businesses, data } = useBusinesses();
  // Personal-only users never see the switch.
  if (!data || businesses.length === 0) return null;
  return (
    <div className="space-y-2.5">
      <Segmented
        value={value.scope}
        onChange={(scope) => onChange({ scope, businessId: null })}
        options={[
          { value: "all", label: "All" },
          { value: "personal", label: "Personal" },
          { value: "business", label: "Business" },
        ]}
      />
      {value.scope === "business" && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          <Chip active={value.businessId === null} onClick={() => onChange({ ...value, businessId: null })}>
            All businesses
          </Chip>
          {businesses.map((b) => (
            <Chip key={b.id} active={value.businessId === b.id} onClick={() => onChange({ ...value, businessId: b.id })}>
              {b.name}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}

export function scopeQuery(v: ScopeValue) {
  return {
    scope: v.scope === "all" ? undefined : v.scope,
    business_id: v.scope === "business" && v.businessId ? v.businessId : undefined,
  };
}
