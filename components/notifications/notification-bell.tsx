"use client";

import Link from "next/link";
import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { AlertTriangle, Bell, CheckCheck } from "lucide-react";
import { Button, StatusIcon, cn } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { dateLabel, overdueIssuesFor } from "@/lib/domain/selectors";
import { useWorkspace } from "@/stores/workspace";
import { formatTimestamp } from "@/components/issues/issue-comments";
import { errorMessage } from "@/components/issues/issue-properties";
import type { WorkspaceData } from "@/types/domain";

export function NotificationBell({ data }: { data: WorkspaceData }) {
  const { mutate } = useWorkspace();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overdue = overdueIssuesFor(data, data.currentUserId);
  const notifications = Object.values(data.notifications).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unread = notifications.filter((notification) => !notification.readAt).length;
  const badge = unread + overdue.length;

  async function markAll() {
    setError(null);
    try { await mutate({ type: "notifications.readAll" }); }
    catch (failure) { setError(errorMessage(failure)); }
  }

  async function openNotification(id: string) {
    setOpen(false);
    try { await mutate({ type: "notification.read", id }); }
    catch (failure) { setError(errorMessage(failure)); }
  }

  return <Popover.Root open={open} onOpenChange={setOpen}>
    <Popover.Trigger asChild>
      <button className="icon-button relative rounded-md p-2 text-[var(--muted)] hover:bg-[var(--raised)] hover:text-[var(--text)]" aria-label={t("notif.title")} title={t("notif.title")}>
        <Bell size={15}/>
        {badge > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-semibold text-white">{badge > 99 ? "99+" : badge}</span>}
      </button>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content className="popover-content w-[min(360px,calc(100vw-2rem))] !p-0" align="end" sideOffset={8} collisionPadding={12}>
        <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
          <h2 className="text-xs font-semibold">{t("notif.title")}</h2>
          {unread > 0 && <Button size="sm" variant="ghost" className="!h-6 !min-h-0 !px-1.5 !text-[10px]" onClick={() => { void markAll(); }}><CheckCheck size={12}/>{t("notif.markAll")}</Button>}
        </div>
        <div className="max-h-[min(420px,60vh)] overflow-y-auto p-1.5">
          {error && <p role="alert" className="px-2 py-1 text-[11px] text-red-400">{error}</p>}
          {overdue.length > 0 && <section aria-label={t("notif.overdue")}>
            <h3 className="flex items-center gap-1.5 px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-500"><AlertTriangle size={11}/>{t("notif.overdue")}</h3>
            <ul>{overdue.map((issue) => <li key={issue.id}>
              <Link href={`/issues/${issue.id}`} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[var(--raised)]">
                <StatusIcon status={issue.status}/>
                <span className="min-w-0 flex-1"><span className="block truncate text-xs">{issue.title}</span><span className="text-[10px] text-amber-500">{issue.identifier} · {t("notif.dueOn", { date: dateLabel(issue.dueDate) })}</span></span>
              </Link>
            </li>)}</ul>
          </section>}
          {notifications.length > 0 && <section aria-label={t("notif.inbox")}>
            <h3 className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">{t("notif.inbox")}</h3>
            <ul>{notifications.slice(0, 30).map((notification) => {
              const issue = notification.issueId ? data.issues[notification.issueId] : null;
              const row = <span className="flex items-start gap-2">
                <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", !notification.readAt && "bg-[var(--accent)]")} aria-hidden="true"/>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-xs leading-4", notification.readAt && "text-[var(--muted)]")}>{notification.message}</span>
                  <span className="text-[10px] text-[var(--faint)]">{issue ? `${issue.identifier} · ` : ""}{formatTimestamp(notification.createdAt)}</span>
                </span>
              </span>;
              return <li key={notification.id}>
                {issue ? <Link href={`/issues/${issue.id}`} onClick={() => { void openNotification(notification.id); }} className="block rounded-md px-2 py-1.5 hover:bg-[var(--raised)]">{row}</Link>
                  : <button className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-[var(--raised)]" onClick={() => { void openNotification(notification.id); }}>{row}</button>}
              </li>;
            })}</ul>
          </section>}
          {!overdue.length && !notifications.length && <p className="px-3 py-6 text-center text-xs text-[var(--muted)]">{t("notif.empty")}</p>}
        </div>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}
