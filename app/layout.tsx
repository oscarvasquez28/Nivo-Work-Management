import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspaceProvider } from "@/stores/workspace";
import { UIProvider } from "@/components/providers/ui-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Nivo · Work, in focus", template: "%s · Nivo" },
  description: "A calm, precise workspace for teams building what comes next.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning><body><a href="#main-content" className="skip-link">Skip to content</a><Suspense fallback={<div className="boot-screen">Loading your workspace…</div>}><WorkspaceProvider><UIProvider>{children}</UIProvider></WorkspaceProvider></Suspense></body></html>;
}
