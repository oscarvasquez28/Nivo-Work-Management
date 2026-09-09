"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="empty-state"><h1>We couldn’t open this view</h1><p>Your saved work is still in this browser. Try loading this view again.</p><div className="flex gap-2"><button type="button" className="button button-primary" onClick={reset}>Try again</button><Link href="/" className="button">Go home</Link></div></div>;
}
