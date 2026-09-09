import Link from "next/link";

export default function NotFound() { return <main className="empty-state min-h-screen"><span className="muted font-mono">404</span><h1>This page isn’t in your workspace</h1><p>The link may have changed. Your work is one click away.</p><Link href="/" className="button button-primary">Back to workspace</Link></main>; }
