"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ExternalLink } from "lucide-react";
import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
  content: string;
}

interface CitationInfo {
  num: number;
  title: string;
  url: string;
}

/** Try to extract a short domain from a URL. */
function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Extract citation details from the ## Sources section of the markdown.
 * Handles multiple common LLM output formats.
 */
function extractCitations(content: string): Map<number, CitationInfo> {
  const citations = new Map<number, CitationInfo>();
  const sourcesMatch = content.match(
    /##\s*Sources?\s*\n([\s\S]*?)(?=\n##\s|$)/i,
  );
  if (!sourcesMatch) return citations;

  for (const line of sourcesMatch[1].split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let m: RegExpMatchArray | null;

    // [N] [Title](URL)
    if ((m = trimmed.match(/^\[(\d+)\]\s+\[([^\]]+)\]\(([^)]+)\)/))) {
      citations.set(+m[1], { num: +m[1], title: m[2].trim(), url: m[3].trim() });
      continue;
    }
    // [N] Title — URL  /  [N] Title - URL
    if ((m = trimmed.match(/^\[(\d+)\]\s+(.+?)\s*[—\-–]\s*(https?:\/\/\S+)/))) {
      citations.set(+m[1], { num: +m[1], title: m[2].trim(), url: m[3].trim() });
      continue;
    }
    // [N] Title (URL)
    if ((m = trimmed.match(/^\[(\d+)\]\s+(.+?)\s*\((https?:\/\/[^)]+)\)/))) {
      citations.set(+m[1], { num: +m[1], title: m[2].trim(), url: m[3].trim() });
      continue;
    }
    // N. [Title](URL)
    if ((m = trimmed.match(/^(\d+)\.\s+\[([^\]]+)\]\(([^)]+)\)/))) {
      citations.set(+m[1], { num: +m[1], title: m[2].trim(), url: m[3].trim() });
      continue;
    }
    // N. Title — URL
    if ((m = trimmed.match(/^(\d+)\.\s+(.+?)\s*[—\-–]\s*(https?:\/\/\S+)/))) {
      citations.set(+m[1], { num: +m[1], title: m[2].trim(), url: m[3].trim() });
      continue;
    }
    // [Source N] Title — URL
    if ((m = trimmed.match(/^\[Source\s+(\d+)\]\s+(.+?)\s*[—\-–]\s*(https?:\/\/\S+)/i))) {
      citations.set(+m[1], { num: +m[1], title: m[2].trim(), url: m[3].trim() });
      continue;
    }
  }

  return citations;
}

/**
 * Pre-process markdown so inline citation refs become clickable links
 * and the Sources section URLs become proper markdown links.
 */
function preprocessMarkdown(
  content: string,
  citations: Map<number, CitationInfo>,
): string {
  if (citations.size === 0) return content;

  const sourcesIdx = content.search(/##\s*Sources?\s*\n/i);
  let body = sourcesIdx >= 0 ? content.slice(0, sourcesIdx) : content;
  let sources = sourcesIdx >= 0 ? content.slice(sourcesIdx) : "";

  // Body: [N] → [N](cite:N) — negative lookahead avoids existing links
  body = body.replace(/\[(\d+)\](?!\()/g, (match, n) =>
    citations.has(+n) ? `[${n}](cite:${n})` : match,
  );
  // Body: [Source N] → [N](cite:N)
  body = body.replace(/\[Source\s+(\d+)\](?!\()/gi, (match, n) =>
    citations.has(+n) ? `[${n}](cite:${n})` : match,
  );

  // Sources: make URLs proper <a> links
  if (sources) {
    // [N] Title — URL → [N] [Title](URL)
    sources = sources.replace(
      /\[(\d+)\]\s+([^[\n]+?)\s*[—\-–]\s*(https?:\/\/\S+)/g,
      (_, num, title, url) => `[${num}] [${title.trim()}](${url.trim()})`,
    );
    // [N] Title (URL) → [N] [Title](URL)
    sources = sources.replace(
      /\[(\d+)\]\s+([^[\n(]+?)\s*\((https?:\/\/[^)]+)\)/g,
      (_, num, title, url) => `[${num}] [${title.trim()}](${url.trim()})`,
    );
    // [Source N] Title — URL → [Source N] [Title](URL)
    sources = sources.replace(
      /\[Source\s+(\d+)\]\s+([^[\n]+?)\s*[—\-–]\s*(https?:\/\/\S+)/gi,
      (_, num, title, url) =>
        `[Source ${num}] [${title.trim()}](${url.trim()})`,
    );
    // N. Title — URL → N. [Title](URL)
    sources = sources.replace(
      /^(\d+)\.\s+([^[\n]+?)\s*[—\-–]\s*(https?:\/\/\S+)/gm,
      (_, num, title, url) => `${num}. [${title.trim()}](${url.trim()})`,
    );
  }

  return body + sources;
}

export const MarkdownContent = memo(function MarkdownContent({
  content,
}: MarkdownContentProps) {
  const citations = useMemo(() => extractCitations(content), [content]);
  const processed = useMemo(
    () => preprocessMarkdown(content, citations),
    [content, citations],
  );

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-headings:mt-3 prose-headings:mb-1.5 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-pre:my-2 prose-blockquote:my-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            const citeMatch = href?.match(/^cite:(\d+)$/);
            if (citeMatch) {
              const num = parseInt(citeMatch[1], 10);
              const citation = citations.get(num);
              if (citation) {
                return (
                  <Popover>
                    <PopoverTrigger asChild>
                      <span
                        role="button"
                        tabIndex={0}
                        className="inline-flex items-center justify-center text-[11px] font-semibold text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/15 rounded px-1 py-px cursor-pointer transition-colors no-underline align-baseline"
                      >
                        {children}
                      </span>
                    </PopoverTrigger>
                    <PopoverContent
                      side="top"
                      align="center"
                      className="w-80 p-0"
                    >
                      <div className="flex flex-col gap-1.5 p-3">
                        <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">
                          {citation.title}
                        </p>
                        <a
                          href={citation.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1.5 truncate"
                        >
                          <ExternalLink className="size-3 shrink-0" />
                          {getDomain(citation.url)}
                        </a>
                      </div>
                    </PopoverContent>
                  </Popover>
                );
              }
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
              >
                {children}
              </a>
            );
          },
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
        {processed}
      </ReactMarkdown>
    </div>
  );
});
