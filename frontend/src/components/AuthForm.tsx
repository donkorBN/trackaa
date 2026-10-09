"use client";

import { Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api, ApiError, getToken, setToken } from "@/lib/api";
import { deviceTimezone } from "@/lib/dates";
import type { User } from "@/lib/types";
import { Button, FormError, Input, Label, Spinner } from "./ui";

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm animate-pop">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image width={56} height={56} src="/icon-192.png" alt="" className="h-14 w-14 rounded-[18px] shadow-float" />
          <h1 className="mt-5 text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-[15px] text-muted">{subtitle}</p>}
        </div>
        <div className="rounded-[28px] border border-line bg-surface p-6 shadow-card">{children}</div>
        {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
      </div>
    </div>
  );
}

export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className="w-full pr-11" />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute top-1/2 right-1.5 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-subtle hover:text-ink"
      >
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

export function firstError(err: unknown) {
  const e = err as ApiError;
  return Object.values(e.fields ?? {})[0]?.[0] ?? e.message;
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => {
    if (getToken()) router.replace("/");
  }, [router]);

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
      setError(firstError(err));
      setBusy(false);
    }
  }

  const login = mode === "login";
  return (
    <AuthLayout
      title={login ? "Welcome back" : "Start tracking"}
      subtitle={login ? "Log in to Trackaa" : "Every cedi in, every cedi out."}
      footer={
        login ? (
          <>
            New to Trackaa? <Link href="/register" className="font-semibold text-ink">Create an account</Link>
          </>
        ) : (
          <>
            Already have an account? <Link href="/login" className="font-semibold text-ink">Log in</Link>
          </>
        )
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {!login && (
          <div>
            <Label htmlFor="name">Your name</Label>
            <Input id="name" required autoComplete="name" value={form.name} onChange={set("name")} />
          </div>
        )}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" required type="email" autoComplete="email" inputMode="email" value={form.email} onChange={set("email")} />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <Label htmlFor="password">Password</Label>
            {login && (
              <Link href="/forgot-password" className="text-[13px] font-medium text-muted hover:text-ink">
                Forgot?
              </Link>
            )}
          </div>
          <PasswordInput
            id="password"
            required
            minLength={login ? undefined : 8}
            autoComplete={login ? "current-password" : "new-password"}
            value={form.password}
            onChange={set("password")}
          />
          {!login && <p className="mt-1.5 text-xs text-muted">At least 8 characters.</p>}
        </div>
        <FormError>{error}</FormError>
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy && <Spinner />}
          {login ? "Log in" : "Create account"}
        </Button>
      </form>
    </AuthLayout>
  );
}
