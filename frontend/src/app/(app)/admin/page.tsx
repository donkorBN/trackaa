"use client";

import { Ban, Check, Copy, KeyRound, Link2, RotateCcw, Search } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { useToast } from "@/components/toast";
import {
  Button, Callout, Card, EmptyState, ErrorBox, Field, Input, ListCard, PageHeader, SectionTitle, Segmented, Sheet, Skeleton, Spinner, Stat, Tag,
} from "@/components/ui";
import { api, ApiError, fetcher, withQuery } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import type { AccessCode, AdminStats } from "@/lib/types";

type Filter = "available" | "redeemed" | "revoked" | "all";

const STATUS_TAG = {
  available: { tone: "good", label: "Available" },
  redeemed: { tone: "neutral", label: "Used" },
  revoked: { tone: "bad", label: "Revoked" },
} as const;

function signupLink(code: string) {
  return `${location.origin}/register/?code=${encodeURIComponent(code)}`;
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function AdminPage() {
  const { data: me } = useMe();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>("available");
  const [q, setQ] = useState("");
  const [making, setMaking] = useState(false);
  const stats = useSWR<AdminStats>(me?.is_admin ? "/admin/stats" : null, fetcher);
  const codes = useSWR<{ data: AccessCode[] }>(
    me?.is_admin ? withQuery("/admin/codes", { status: filter === "all" ? undefined : filter, q: q.trim() || undefined }) : null,
    fetcher,
  );

  if (me && !me.is_admin) {
    return <EmptyState icon={<KeyRound size={30} />} title="Nothing here" body="This page is only for the people who run Trackaa." />;
  }

  const refresh = () => {
    stats.mutate();
    codes.mutate();
  };

  async function copyText(text: string, what: string) {
    toast((await copy(text)) ? { message: `${what} copied` } : { message: "Couldn't copy. Select it and copy by hand.", tone: "error" });
  }

  async function setRevoked(c: AccessCode, revoked: boolean) {
    try {
      await api(`/admin/codes/${c.id}`, { method: "PATCH", body: { revoked } });
      toast({ message: revoked ? `${c.code} revoked` : `${c.code} is available again` });
      refresh();
    } catch (e) {
      toast({ message: (e as ApiError).message, tone: "error" });
    }
  }

  const list = codes.data?.data ?? [];
  const available = list.filter((c) => c.status === "available");

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Admin"
        title="Access codes"
        actions={
          <Button onClick={() => setMaking(true)}>
            <KeyRound size={17} /> New codes
          </Button>
        }
      />

      {stats.error && <ErrorBox error={stats.error} onRetry={() => stats.mutate()} />}
      {stats.data ? (
        <Card flush className="grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
          {[
            { label: "Users", value: stats.data.users, sub: `+${stats.data.users_last_7_days} this week` },
            { label: "Active", value: stats.data.active_last_7_days, sub: "this week" },
            { label: "Codes used", value: stats.data.codes_redeemed, sub: "accounts created" },
            { label: "Codes left", value: stats.data.codes_available, sub: `${stats.data.codes_revoked} revoked` },
          ].map((s) => (
            <div key={s.label} className="px-4 py-4">
              <Stat label={s.label} value={s.value} size="md" />
              <div className="mt-0.5 text-[12px] text-muted">{s.sub}</div>
            </div>
          ))}
        </Card>
      ) : (
        <Skeleton className="h-24" />
      )}

      <section>
        <SectionTitle
          hint="Send a buyer their code, or the sign-up link that fills it in for them."
          action={
            filter === "available" &&
            available.length > 0 && (
              <Button variant="secondary" size="sm" onClick={() => copyText(available.map((c) => c.code).join("\n"), `${available.length} codes`)}>
                <Copy size={15} /> Copy all
              </Button>
            )
          }
        >
          Codes
        </SectionTitle>
        <div className="space-y-3">
          <Segmented
            label="Code status"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "available", label: "Available" },
              { value: "redeemed", label: "Used" },
              { value: "revoked", label: "Revoked" },
              { value: "all", label: "All" },
            ]}
          />
          <div className="relative">
            <Search size={17} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-subtle" />
            <Input aria-label="Search codes" placeholder="Search code, note or email" value={q} onChange={(e) => setQ(e.target.value)} className="w-full pl-10" />
          </div>
        </div>

        <div className="mt-4">
          {codes.error ? (
            <ErrorBox error={codes.error} onRetry={() => codes.mutate()} />
          ) : !codes.data ? (
            <Skeleton className="h-64" />
          ) : list.length === 0 ? (
            <EmptyState
              compact
              icon={<KeyRound size={26} />}
              title={filter === "available" ? "No codes ready to sell" : "Nothing here yet"}
              body={filter === "available" ? "Create a batch and send one to each buyer." : undefined}
              action={
                filter === "available" && (
                  <Button onClick={() => setMaking(true)}>
                    <KeyRound size={17} /> New codes
                  </Button>
                )
              }
            />
          ) : (
            <ListCard>
              {list.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-display tabular text-[16px] font-bold tracking-wide">{c.code}</span>
                      <Tag tone={STATUS_TAG[c.status].tone}>{STATUS_TAG[c.status].label}</Tag>
                    </div>
                    <div className="mt-0.5 truncate text-[12.5px] text-muted">
                      {c.redeemed_by
                        ? `${c.redeemed_by.name} · ${c.redeemed_by.email}`
                        : c.note || `Created ${new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                      {c.redeemed_by && c.note ? ` · ${c.note}` : ""}
                    </div>
                  </div>
                  {c.status === "available" && (
                    <div className="flex gap-1.5">
                      <Button variant="secondary" size="sm" aria-label={`Copy ${c.code}`} onClick={() => copyText(c.code, "Code")}>
                        <Copy size={15} />
                      </Button>
                      <Button variant="secondary" size="sm" aria-label={`Copy sign-up link for ${c.code}`} onClick={() => copyText(signupLink(c.code), "Sign-up link")}>
                        <Link2 size={15} /> Link
                      </Button>
                      <Button variant="ghost" size="sm" aria-label={`Revoke ${c.code}`} onClick={() => setRevoked(c, true)}>
                        <Ban size={15} />
                      </Button>
                    </div>
                  )}
                  {c.status === "revoked" && (
                    <Button variant="secondary" size="sm" onClick={() => setRevoked(c, false)}>
                      <RotateCcw size={15} /> Restore
                    </Button>
                  )}
                </div>
              ))}
            </ListCard>
          )}
        </div>
      </section>

      <Sheet open={making} onClose={() => setMaking(false)} title="New access codes">
        {making && (
          <NewCodes
            onDone={() => {
              setMaking(false);
              setFilter("available");
              refresh();
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

function NewCodes({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const [count, setCount] = useState("10");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<AccessCode[] | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ data: AccessCode[] }>("/admin/codes", { method: "POST", body: { count: Number(count), note: note || null } });
      setMade(res.data);
    } catch (err) {
      const e = err as ApiError;
      setError(Object.values(e.fields ?? {})[0]?.[0] ?? e.message);
    } finally {
      setBusy(false);
    }
  }

  if (made) {
    return (
      <div className="space-y-4">
        <Callout>
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <Check size={15} /> {made.length} code{made.length === 1 ? "" : "s"} ready to sell
          </span>
        </Callout>
        <pre className="font-display tabular max-h-64 overflow-auto rounded-control bg-surface-2 p-4 text-[15px] leading-7 font-bold">
          {made.map((c) => c.code).join("\n")}
        </pre>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            onClick={async () => toast((await copy(made.map((c) => c.code).join("\n"))) ? { message: "Codes copied" } : { message: "Couldn't copy", tone: "error" })}
          >
            <Copy size={16} /> Copy codes
          </Button>
          <Button onClick={onDone}>Done</Button>
        </div>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <Field label="How many?" htmlFor="code-count" hint="Up to 200 at a time. Each one creates one account.">
        <Input id="code-count" type="number" inputMode="numeric" min={1} max={200} required value={count} onChange={(e) => setCount(e.target.value)} />
      </Field>
      <Field label="Note (optional)" htmlFor="code-note" hint="For your records: buyer, payment reference or campaign.">
        <Input id="code-note" maxLength={160} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Facebook ad, week 1" />
      </Field>
      {error && <Callout tone="bad">{error}</Callout>}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? <Spinner /> : <KeyRound size={17} />} Create codes
      </Button>
    </form>
  );
}
