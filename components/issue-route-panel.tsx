"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { IssueDetail } from "@/components/issues/issue-detail";

export function IssueRoutePanel({ issueId }: { issueId: string }) {
  const router = useRouter();
  const trigger = useRef<HTMLElement | null>(null);
  const close = () => router.back();
  return <Dialog.Root open onOpenChange={(open) => { if (!open) close(); }}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px]" /><Dialog.Content className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto border-l border-[var(--border)] bg-[var(--bg)] shadow-2xl outline-none sm:max-w-[720px]" aria-describedby={undefined} onOpenAutoFocus={() => { trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }} onCloseAutoFocus={(event) => { event.preventDefault(); const target = trigger.current?.isConnected ? trigger.current : document.getElementById("main-content"); target?.focus({ preventScroll: true }); }}><Dialog.Title className="sr-only">Issue details</Dialog.Title><IssueDetail issueId={issueId} panel onClose={close} /></Dialog.Content></Dialog.Portal></Dialog.Root>;
}
