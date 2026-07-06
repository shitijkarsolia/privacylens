import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Renders an assistant reply as GitHub-flavored Markdown, styled to match the
// chat surface. User messages are shown verbatim (see MessageList) — only
// assistant replies come back as Markdown from the model.
function MarkdownMessageImpl({ content }: { content: string }) {
  return (
    <div className="text-[15px] leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="my-2 whitespace-pre-wrap">{children}</p>,
          h1: ({ children }) => (
            <h1 className="mt-4 mb-2 text-lg font-semibold tracking-tight">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-4 mb-2 text-base font-semibold tracking-tight">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-3 mb-1.5 text-sm font-semibold tracking-tight">{children}</h3>
          ),
          ul: ({ children }) => (
            <ul className="my-2 list-disc space-y-1 pl-5 marker:text-[var(--color-text-secondary)]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 list-decimal space-y-1 pl-5 marker:text-[var(--color-text-secondary)]">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium text-[var(--color-accent)] underline decoration-[var(--color-accent)]/40 underline-offset-2 hover:decoration-[var(--color-accent)]"
            >
              {children}
            </a>
          ),
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-[var(--color-accent)]/40 pl-3 text-[var(--color-text-secondary)]">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-3 border-[var(--color-border)]" />,
          code: ({ className, children }) => {
            const isBlock = /language-/.test(className || "");
            if (isBlock) {
              return (
                <code className="font-mono text-[13px] leading-relaxed">{children}</code>
              );
            }
            return (
              <code className="rounded bg-[var(--color-canvas)] px-1.5 py-0.5 font-mono text-[13px] text-[var(--color-text)]">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-2 overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] p-3 scrollbar-thin">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto scrollbar-thin">
              <table className="w-full border-collapse text-[13px]">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-[var(--color-border)] bg-[var(--color-canvas)] px-2.5 py-1.5 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-[var(--color-border)] px-2.5 py-1.5">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export const MarkdownMessage = memo(MarkdownMessageImpl);
