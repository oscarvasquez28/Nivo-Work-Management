"use client";

import { useRef, useState, type ComponentProps, type CSSProperties, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { clsx, type ClassValue } from "clsx";
import { motion, useReducedMotion } from "motion/react";
import { Check, CircleDashed, Inbox, Loader2, UserRound, X } from "lucide-react";
import { PRIORITIES, STATUSES, type Priority, type Status, type User } from "@/types/domain";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function Button({ className, variant = "secondary", size = "md", type = "button", ...props }: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" }) {
  return <button type={type} className={cn("button", `button-${variant}`, `button-${size}`, className)} {...props} />;
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn("input", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn("select", className)} {...props} />;
}

export function Badge({ children, color, className }: { children: ReactNode; color?: string; className?: string }) {
  return <span className={cn("badge", color && "badge-colored", className)} style={color ? { "--badge-color": color } as CSSProperties : undefined}>{children}</span>;
}

export function Avatar({ user, size = "md" }: { user?: User | null; size?: "sm" | "md" | "lg" }) {
  return <span className={cn("avatar", `avatar-${size}`, !user && "avatar-unassigned")} style={user ? { "--avatar-color": user.color } as CSSProperties : undefined} role="img" aria-label={user?.name ?? "Unassigned"} title={user?.name ?? "Unassigned"}>{user ? user.initials : <UserRound size={size === "lg" ? 18 : 12} aria-hidden="true" />}</span>;
}

export function StatusIcon({ status }: { status: Status }) {
  const definition = STATUSES.find((item) => item.id === status) ?? STATUSES[0];
  return <span className={cn("status-icon", `status-${status}`)} style={{ color: definition.color }} role="img" aria-label={definition.name} title={definition.name}>
    {status === "backlog" ? <CircleDashed size={15} aria-hidden="true" /> : status === "done" ? <span className="status-complete"><Check size={10} strokeWidth={3} aria-hidden="true" /></span> : <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.6" />{status === "in_progress" && <path d="M8 4a4 4 0 0 1 0 8V4Z" fill="currentColor" />}{status === "in_review" && <circle cx="8" cy="8" r="3.3" fill="currentColor" />}</svg>}
  </span>;
}

export function PriorityIcon({ priority }: { priority: Priority }) {
  const label = PRIORITIES.find((item) => item.id === priority)?.name ?? "No priority";
  const bars = priority === "high" ? 3 : priority === "medium" ? 2 : priority === "low" ? 1 : 0;
  return <span className={cn("priority-icon", `priority-${priority}`)} role="img" aria-label={label} title={label}><svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">{priority === "urgent" ? <><rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="currentColor" /><path d="M8 4.5v4" stroke="var(--bg)" strokeWidth="1.6" strokeLinecap="round" /><circle cx="8" cy="11.5" r=".9" fill="var(--bg)" /></> : priority === "none" ? <path d="M4 8h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /> : [0, 1, 2].map((bar) => <rect key={bar} x={2 + bar * 4.5} y={10 - bar * 3} width="3" height={4 + bar * 3} rx=".7" fill="currentColor" opacity={bar < bars ? 1 : .2} />)}</svg></span>;
}

export function Progress({ value }: { value: number }) {
  const progress = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return <div className="progress" role="progressbar" aria-label="Completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><span className="progress-fill" style={{ width: `${progress}%` }} /></div>;
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-state-icon" aria-hidden="true">{icon ?? <Inbox size={23} strokeWidth={1.4} />}</div><h3>{title}</h3>{description && <p>{description}</p>}{action && <div className="empty-state-action">{action}</div>}</div>;
}

export function Modal({ open, onOpenChange, title, description, children, wide = false }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: ReactNode; wide?: boolean }) {
  const reducedMotion = useReducedMotion();
  const returnFocus = useRef<HTMLElement | null>(null);
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content asChild onOpenAutoFocus={() => { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }} onCloseAutoFocus={(event) => { if (returnFocus.current?.isConnected) { event.preventDefault(); returnFocus.current.focus(); } }}><motion.div className={cn("dialog-content", wide && "dialog-wide")} initial={reducedMotion ? false : { opacity: 0, y: 6, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .16, ease: "easeOut" }}><div className="dialog-header"><div><Dialog.Title className="dialog-title">{title}</Dialog.Title><Dialog.Description className={description ? "dialog-description" : "sr-only"}>{description ?? `${title} form`}</Dialog.Description></div><Dialog.Close asChild><Button variant="ghost" size="sm" className="icon-button" aria-label="Close dialog"><X size={17} /></Button></Dialog.Close></div><div className="dialog-body">{children}</div></motion.div></Dialog.Content></Dialog.Portal></Dialog.Root>;
}

export function ConfirmDialog({ open, onOpenChange, title, description, onConfirm, confirmLabel = "Confirm" }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; onConfirm: () => void | Promise<void>; confirmLabel?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That change could not be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return <AlertDialog.Root open={open} onOpenChange={(next) => { if (!busy) { setError(null); onOpenChange(next); } }}><AlertDialog.Portal><AlertDialog.Overlay className="dialog-overlay" /><AlertDialog.Content className="dialog-content confirm-dialog" onOpenAutoFocus={() => { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }} onCloseAutoFocus={(event) => { if (returnFocus.current?.isConnected) { event.preventDefault(); returnFocus.current.focus(); } }} onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }}><div className="dialog-header"><div><AlertDialog.Title className="dialog-title">{title}</AlertDialog.Title><AlertDialog.Description className="dialog-description">{description}</AlertDialog.Description></div></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="dialog-footer"><AlertDialog.Cancel asChild><Button disabled={busy}>Cancel</Button></AlertDialog.Cancel><AlertDialog.Action asChild><Button variant="danger" disabled={busy} onClick={(event) => { event.preventDefault(); void confirm(); }}>{busy && <Loader2 size={14} className="spin" />}{busy ? "Saving…" : confirmLabel}</Button></AlertDialog.Action></div></AlertDialog.Content></AlertDialog.Portal></AlertDialog.Root>;
}

export function Field({ label, children, htmlFor }: { label: string; children: ReactNode; htmlFor?: string }) {
  return <div className="field"><label className="field-label" htmlFor={htmlFor}>{label}</label>{children}</div>;
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return <header className="page-header"><div className="page-heading">{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</header>;
}

export function Skeleton({ className }: { className?: string }) {
  return <span className={cn("skeleton", className)} aria-hidden="true" />;
}
