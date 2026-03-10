"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { memo } from "react";

interface MarkdownContentProps {
  content: string;
}


export const MarkdownContent = memo(function MarkdownContent({
  content,
}: MarkdownContentProps) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-headings:mt-3 prose-headings:mb-1.5 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-pre:my-2 prose-blockquote:my-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
            >
              {children}
            </a>
          ),
          pre: ({ children }) => (
            <pre className="bg-muted rounded-lg p-4 overflow-x-auto text-sm">
              {children}
            </pre>
          ),
          code: ({ children, className }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
                  {children}
                </code>
              );
            }
            return <code className="font-mono text-sm">{children}</code>;
          },
          table: ({ children }) => (
            <div className="overflow-x-auto my-2 rounded-lg border border-border">
              <table className="w-full border-collapse text-sm">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-border bg-muted px-3 py-1.5 text-left font-semibold text-xs">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-border px-3 py-1.5 text-sm">
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
