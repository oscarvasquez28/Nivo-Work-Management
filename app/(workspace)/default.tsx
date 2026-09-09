import Link from "next/link";

export default function Default() { return <div className="empty-state"><h1>Return to your workspace</h1><Link href="/issues" className="button">Open issues</Link></div>; }
