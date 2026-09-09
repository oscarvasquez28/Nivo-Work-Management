"use client";

import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { useWorkspace } from "@/stores/workspace";

export function LoginScreen() {
  const { login } = useWorkspace();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !email.trim() || !password) return;
    setBusy(true);
    setError(null);
    const failure = await login(email.trim(), password);
    setBusy(false);
    if (failure) setError(failure);
  }

  return <main className="flex min-h-svh items-center justify-center bg-[var(--bg)] px-4">
    <div className="w-full max-w-85">
      <div className="mb-8 flex items-center justify-center gap-2.5"><span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 18 18" fill="none"><path d="M3.5 13.5v-9L14.5 13.5v-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span><span className="text-lg font-semibold tracking-tight text-[var(--text)]">Nivo <span className="text-[var(--muted)]">Labs</span></span></div>
      <form onSubmit={submit} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
        <h1 className="text-base font-semibold text-[var(--text)]">Sign in</h1>
        <p className="mt-1 mb-5 text-xs leading-5 text-[var(--muted)]">Access your Nivo Labs workspace.</p>
        <label className="field-label mb-1.5 block" htmlFor="login-email">Email</label>
        <Input id="login-email" type="email" autoComplete="email" autoFocus required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" disabled={busy} />
        <label className="field-label mt-4 mb-1.5 block" htmlFor="login-password">Password</label>
        <Input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" disabled={busy} />
        {error && <p role="alert" className="mt-3 flex items-center gap-1.5 text-xs text-[var(--danger)]"><AlertCircle size={13} />{error}</p>}
        <Button type="submit" variant="primary" className="mt-5 w-full justify-center" disabled={busy || !email.trim() || !password}>{busy ? <Loader2 size={14} className="spin" /> : null}{busy ? "Signing in…" : "Sign in"}</Button>
      </form>
      <p className="mt-6 text-center text-[10px] text-[var(--faint)]">Nivo · Work, in focus</p>
    </div>
  </main>;
}
