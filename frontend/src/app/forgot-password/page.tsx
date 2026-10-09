"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AuthLayout, firstError } from "@/components/AuthForm";
import { Button, FormError, Input, Label, Spinner } from "@/components/ui";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/auth/forgot-password", { method: "POST", body: { email } });
      setSent(true);
    } catch (err) {
      setError(firstError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll email you a link to choose a new one."
      footer={<Link href="/login" className="font-semibold text-ink">Back to log in</Link>}
    >
      {sent ? (
        <div className="py-2 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-income-soft text-income">
            <MailCheck size={22} />
          </span>
          <p className="mt-4 font-semibold">Check your inbox</p>
          <p className="mt-1 text-sm text-muted">If {email} has an account, a reset link is on its way. It expires in 60 minutes.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" required type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <FormError>{error}</FormError>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy && <Spinner />} Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
