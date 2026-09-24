"use client";

import { EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { useWorkspace } from "@/stores/workspace";
import { GanttChart } from "./gantt-chart";

export function TimelinePage({ projectId }: { projectId?: string }) {
  const { data, error } = useWorkspace();
  const { t } = useI18n();
  if (!data) return <div className="page space-y-4"><Skeleton className="h-8 w-48"/><Skeleton className="h-64 w-full"/>{error && <EmptyState title={t("shell.errorOpen")} description={error}/>}</div>;
  if (projectId && !data.projects[projectId]) return <div className="page"><EmptyState title={t("gantt.noProject")}/></div>;
  const issues = Object.values(data.issues).filter((issue) => !issue.deletedAt && (!projectId || issue.projectId === projectId));
  return <div className="page">
    {!projectId && <PageHeader eyebrow={t("shell.workspace")} title={t("gantt.title")} description={t("gantt.description")}/>}
    <GanttChart issues={issues} data={data}/>
  </div>;
}
