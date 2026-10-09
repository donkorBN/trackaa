"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError, setToken } from "@/lib/api";
import { deviceTimezone } from "@/lib/dates";
import type { User } from "@/lib/types";
import { Input, Label, Spinner } from "./ui";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const body =
        mode === "login"
          ? { email: form.email, password: form.password }
          : { ...form, password_confirmation: form.password, timezone: deviceTimezone() };
      const res = await api<{ token: string; user: User }>(`/auth/${mode}`, { method: "POST", body });
      setToken(res.token);
      router.replace("/");
    } catch (err) {
      const e = err as ApiError;
      setError(Object.values(e.fields ?? {})[0]?.[0] ?? e.message);
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-2xl font-bold tracking-tight">Trackaa</div>
          <p className="mt-1 text-sm text-muted">Every cedi in, every cedi out.</p>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-3xl border border-line bg-surface p-6">
          <h1 className="text-lg font-semibold">{mode === "login" ? "Log in" : "Create your account"}</h1>
          {mode === "register" && (
            <div>
              <Label>Name</Label>
              <Input required autoComplete="name" value={form.name} onChange={set("name")} />
            </div>
          )}
          <div>
            <Label>Email</Label>
            <Input required type="email" autoComplete="email" value={form.email} onChange={set("email")} />
          </div>
          <div>
            <Label>Password</Label>
            <Input
              required
              type="password"
              minLength={mode === "register" ? 8 : undefined}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={form.password}
              onChange={set("password")}
            />
            {mode === "register" && <p className="mt-1 text-xs text-muted">At least 8 characters.</p>}
          </div>
          {error && <p className="rounded-xl bg-expense-soft px-3 py-2 text-sm text-expense">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 font-semibold text-accent-fg disabled:opacity-60"
          >
            {busy && <Spinner />}
            {mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-muted">
          {mode === "login" ? (
            <>
              New here? <Link href="/register" className="font-semibold text-ink">Create an account</Link>
            </>
          ) : (
            <>
              Already have an account? <Link href="/login" className="font-semibold text-ink">Log in</Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
