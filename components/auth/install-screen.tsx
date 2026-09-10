"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { useWorkspace } from "@/stores/workspace";

const fallbackTimeZones = ["UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Tokyo", "Asia/Shanghai", "Asia/Dubai", "Australia/Sydney", "Pacific/Auckland"];

function useTimeZones() {
  return useMemo(() => {
    try {
      const values = Intl.supportedValuesOf("timeZone");
      return values.length > 0 ? values : fallbackTimeZones;
    } catch {
      return fallbackTimeZones;
    }
  }, []);
}

export function InstallScreen() {
  const { install } = useWorkspace();
  const timeZones = useTimeZones();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [firstTeamName, setFirstTeamName] = useState("");
  const [firstTeamKey, setFirstTeamKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim() || !password || !workspaceName.trim() || !firstTeamName.trim() || firstTeamKey.length < 2) return;
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setBusy(true);
    const failure = await install({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      workspaceName: workspaceName.trim(),
      timezone,
      firstTeamName: firstTeamName.trim(),
      firstTeamKey: firstTeamKey.trim().toUpperCase(),
    });
    setBusy(false);
    if (failure) setError(failure);
  }

  return <main className="flex min-h-svh items-center justify-center bg-[var(--bg)] px-4">
    <div className="w-full max-w-md">
      <div className="mb-8 flex items-center justify-center gap-2.5"><span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 18 18" fill="none"><path d="M3.5 13.5v-9L14.5 13.5v-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span><span className="text-lg font-semibold tracking-tight text-[var(--text)]">Nivo <span className="text-[var(--muted)]">Labs</span></span></div>
      <form onSubmit={submit} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
        <h1 className="text-base font-semibold text-[var(--text)]">Create your workspace</h1>
        <p className="mt-1 mb-5 text-xs leading-5 text-[var(--muted)]">Set up the first administrator account and team.</p>
        <label className="field-label mb-1.5 block" htmlFor="install-name">Full name</label>
        <Input id="install-name" autoComplete="name" autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ada Lovelace" disabled={busy} />
        <label className="field-label mt-4 mb-1.5 block" htmlFor="install-email">Email</label>
        <Input id="install-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ada@company.com" disabled={busy} />
        <label className="field-label mt-4 mb-1.5 block" htmlFor="install-password">Password</label>
        <Input id="install-password" type="password" autoComplete="new-password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" disabled={busy} />
        <label className="field-label mt-4 mb-1.5 block" htmlFor="install-confirm">Confirm password</label>
        <Input id="install-confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="••••••••" disabled={busy} />
        <label className="field-label mt-4 mb-1.5 block" htmlFor="install-workspace">Workspace/company name</label>
        <Input id="install-workspace" required value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="Nivo Labs" disabled={busy} />
        <label className="field-label mt-4 mb-1.5 block" htmlFor="install-timezone">Time zone</label>
        <Select id="install-timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)} disabled={busy}>{timeZones.map((tz) => <option key={tz} value={tz}>{tz}</option>)}</Select>
        <label className="field-label mt-4 mb-1.5 block" htmlFor="install-team">First team name</label>
        <Input id="install-team" required value={firstTeamName} onChange={(event) => setFirstTeamName(event.target.value)} placeholder="Engineering" disabled={busy} />
        <label className="field-label mt-4 mb-1.5 block" htmlFor="install-key">Team key</label>
        <Input id="install-key" required minLength={2} maxLength={6} value={firstTeamKey} onChange={(event) => setFirstTeamKey(event.target.value.toUpperCase())} placeholder="ENG" disabled={busy} />
        {error && <p role="alert" className="mt-3 flex items-center gap-1.5 text-xs text-[var(--danger)]"><AlertCircle size={13} />{error}</p>}
        <Button type="submit" variant="primary" className="mt-5 w-full justify-center" disabled={busy || !name.trim() || !email.trim() || !password || !workspaceName.trim() || !firstTeamName.trim() || firstTeamKey.length < 2}>{busy ? <Loader2 size={14} className="spin" /> : null}{busy ? "Creating workspace…" : "Create workspace"}</Button>
      </form>
      <p className="mt-6 text-center text-[10px] text-[var(--faint)]">Nivo · Work, in focus</p>
    </div>
  </main>;
}
