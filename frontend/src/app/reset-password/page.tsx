"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthLayout, firstError, PasswordInput } from "@/components/AuthForm";
import { Button, FormError, Label, Spinner } from "@/components/ui";
import { api, setToken } from "@/lib/api";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [params, setParams] = useState<{ token: string; email: string } | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(location.search);
    setParams({ token: p.get("token") ?? "", email: p.get("email") ?? "" });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!params) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ token: string }>("/auth/reset-password", {
        method: "POST",
        body: { ...params, password, password_confirmation: password },
      });
      setToken(res.token);
      router.replace("/");
    } catch (err) {
      setError(firstError(err));
      setBusy(false);
    }
  }

  const invalid = params && (!params.token || !params.email);
  return (
    <AuthLayout
      title="Choose a new password"
      subtitle={params?.email || undefined}
      footer={<Link href="/login" className="font-semibold text-ink">Back to log in</Link>}
    >
      {invalid ? (
        <div className="space-y-4 text-center text-sm text-muted">
          <p>This reset link is incomplete. Request a new one.</p>
          <Link href="/forgot-password" className="font-semibold text-ink">Send a new link</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="password">New password</Label>
            <PasswordInput id="password" required minLength={8} autoFocus autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <p className="mt-1.5 text-xs text-muted">At least 8 characters. You&apos;ll be signed out everywhere else.</p>
          </div>
          <FormError>{error}</FormError>
          <Button type="submit" size="lg" className="w-full" disabled={busy || !params}>
            {busy && <Spinner />} Save and log in
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
