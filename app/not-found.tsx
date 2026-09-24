"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

export default function NotFound() {
  const { t } = useI18n();
  return <main className="empty-state min-h-screen"><span className="muted font-mono">404</span><h1>{t("notFound.title")}</h1><p>{t("notFound.description")}</p><Link href="/" className="button button-primary">{t("notFound.cta")}</Link></main>;
}
