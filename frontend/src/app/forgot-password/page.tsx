"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { authLinkClass, AuthLayout, firstError } from "@/components/AuthForm";
import { Button, Callout, Field, FormError, Glyph, Input, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { useMeta } from "@/lib/hooks";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: meta } = useMeta();

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
      footer={<Link href="/login" className={authLinkClass}>Back to log in</Link>}
    >
      {meta && !meta.mail_enabled ? (
        <div className="space-y-4">
          <Callout tone="warn">
            Email isn&apos;t set up on this Trackaa yet, so reset links can&apos;t be sent. Ask the person who runs it to turn on email.
          </Callout>
          <p className="text-[13.5px] leading-relaxed text-muted">
            Still logged in on another device? You can change your password there in <span className="font-semibold text-ink">Settings → Change password</span>.
          </p>
        </div>
      ) : sent ? (
        <div className="flex flex-col items-center py-2 text-center">
          <Glyph icon={MailCheck} size={52} active />
          <p className="font-display mt-4 text-[19px] font-bold text-ink">Check your inbox</p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-muted">If {email} has an account, a reset link is on its way. It expires in 60 minutes.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email" htmlFor="email">
            <Input id="email" required type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <FormError>{error}</FormError>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy && <Spinner />} Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
