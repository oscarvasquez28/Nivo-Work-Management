import { AppShell } from "@/components/shell";

export default function WorkspaceLayout({ children, issuePanel }: { children: React.ReactNode; issuePanel: React.ReactNode }) {
  return <AppShell panel={issuePanel}>{children}</AppShell>;
}
