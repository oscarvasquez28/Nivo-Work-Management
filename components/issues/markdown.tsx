import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ children }: { children: string }) {
  return <div className="min-w-0 break-words text-sm leading-7 text-[var(--text)] [&_a]:text-[var(--accent)] [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--border)] [&_blockquote]:pl-4 [&_blockquote]:text-[var(--muted)] [&_code]:rounded [&_code]:bg-[var(--raised)] [&_code]:px-1 [&_code]:text-xs [&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-[var(--raised)] [&_pre]:p-3 [&_td]:border [&_td]:border-[var(--border)] [&_td]:px-3 [&_th]:border [&_th]:border-[var(--border)] [&_th]:px-3 [&_ul]:list-disc [&_ul]:pl-5">
    <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml urlTransform={(url) => /^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(url) || (!/^[a-z][a-z\d+.-]*:/i.test(url) && !url.startsWith("//")) ? url : ""} components={{
      a: ({ href, children }) => <a href={href} target={href?.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">{children}</a>,
      img: ({ alt }) => <span className="text-[var(--muted)]">{alt ? `[${alt}]` : "[Image]"}</span>,
      table: ({ children }) => <div className="my-3 max-w-full overflow-x-auto"><table>{children}</table></div>,
    }}>{children}</ReactMarkdown>
  </div>;
}
