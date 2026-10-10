"use client";

import { Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api, ApiError, getToken, setToken } from "@/lib/api";
import { deviceTimezone } from "@/lib/dates";
import type { User } from "@/lib/types";
import { useMeta } from "@/lib/hooks";
import { Button, Card, Field, FormError, Input, Label, Spinner, Wordmark } from "./ui";

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm animate-pop">
        <Link href="/" aria-label="Trackaa home" className="mx-auto mb-10 flex w-fit items-center gap-2.5">
          <Image width={36} height={36} src="/icon-192.png" alt="" className="h-9 w-9 rounded-tile" />
          <Wordmark className="text-ink" />
        </Link>
        <div className="mb-6 text-center">
          <h1 className="text-[34px] leading-[1.05] font-extrabold text-ink">{title}</h1>
          {subtitle && <p className="mt-2 text-[15px] text-muted">{subtitle}</p>}
        </div>
        <Card className="p-6">{children}</Card>
        {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
      </div>
    </div>
  );
}

/** Inline text link used under auth cards: ink text with a neon underline. */
export const authLinkClass = "font-semibold text-ink underline decoration-brand decoration-2 underline-offset-4 hover:decoration-ink";

export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className="w-full pr-11" />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute top-1/2 right-1.5 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-tile text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
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
  const [form, setForm] = useState({ name: "", email: "", password: "", access_code: "" });
  const { data: meta } = useMeta();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => {
    if (getToken()) router.replace("/");
    // Links sent to buyers look like /register/?code=TRK-XXXX-XXXX
    const code = new URLSearchParams(location.search).get("code");
    if (code) setForm((f) => ({ ...f, access_code: code }));
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
          : { ...form, access_code: form.access_code || undefined, password_confirmation: form.password, timezone: deviceTimezone() };
      const res = await api<{ token: string; user: User }>(`/auth/${mode}`, { method: "POST", body });
      setToken(res.token);
      router.replace(mode === "register" ? "/welcome/" : "/");
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
            New to Trackaa? <Link href="/register" className={authLinkClass}>Create an account</Link>
          </>
        ) : (
          <>
            Already have an account? <Link href="/login" className={authLinkClass}>Log in</Link>
          </>
        )
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {!login && meta?.access_code_required && (
          <Field
            label="Access code"
            htmlFor="access_code"
            hint={
              meta.buy_url ? (
                <>
                  Don&apos;t have one?{" "}
                  <a href={meta.buy_url} target="_blank" rel="noopener noreferrer" className={authLinkClass}>
                    Get an access code
                  </a>
                  {meta.price_label ? ` · ${meta.price_label}` : ""}
                </>
              ) : (
                "You'll find it in the message you got after buying Trackaa."
              )
            }
          >
            <Input
              id="access_code"
              required
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="TRK-XXXX-XXXX"
              className="tabular w-full tracking-wider uppercase"
              value={form.access_code}
              onChange={set("access_code")}
            />
          </Field>
        )}
        {!login && (
          <Field label="Your name" htmlFor="name">
            <Input id="name" required autoComplete="name" value={form.name} onChange={set("name")} />
          </Field>
        )}
        <Field label="Email" htmlFor="email">
          <Input id="email" required type="email" autoComplete="email" inputMode="email" value={form.email} onChange={set("email")} />
        </Field>
        <div>
          <div className="flex items-baseline justify-between">
            <Label htmlFor="password">Password</Label>
            {login && (
              <Link href="/forgot-password" className="text-[13px] font-semibold text-muted underline decoration-line decoration-2 underline-offset-4 hover:text-ink hover:decoration-brand">
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
          {!login && <p className="mt-1.5 text-[12.5px] text-muted">At least 8 characters.</p>}
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
