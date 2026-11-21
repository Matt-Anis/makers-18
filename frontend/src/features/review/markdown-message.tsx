"use client";

import { isValidElement, useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";

function extractText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractText).join("");
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return extractText(node.props.children);
  }
  return "";
}

function CodeBlock({
  language,
  codeText,
  children,
}: {
  language: string | null;
  codeText: string;
  children: ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Ignore clipboard errors in restricted contexts.
    }
  }

  return (
    <div className="my-3.5 overflow-hidden rounded-control border border-border bg-sidebar">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/60 px-3 py-1.5 text-[11px] text-muted-foreground">
        <span className="font-mono lowercase">{language ?? "code"}</span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex cursor-pointer items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          {copied ? (
            <>
              <Check className="size-3 text-success" aria-hidden="true" />
              <span className="text-success">Copied</span>
            </>
          ) : (
            <>
              <Copy className="size-3" aria-hidden="true" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 font-mono text-xs leading-relaxed text-foreground">
        {children}
      </pre>
    </div>
  );
}

const MARKDOWN_COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="mt-5 mb-2.5 text-lg font-semibold tracking-tight text-foreground first:mt-0 sm:text-xl">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-5 mb-2 text-base font-semibold tracking-tight text-foreground first:mt-0 sm:text-lg">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-4 mb-1.5 text-sm font-semibold text-foreground first:mt-0 sm:text-base">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-3.5 mb-1 text-sm font-semibold text-foreground first:mt-0">
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p className="leading-7 text-foreground/95 [&:not(:first-child)]:mt-3">{children}</p>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic text-foreground/90">{children}</em>,
  ul: ({ children }) => (
    <ul className="my-2.5 list-disc space-y-1.5 pl-5 leading-7 text-foreground/95 marker:text-highlight/80">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2.5 list-decimal space-y-1.5 pl-5 leading-7 text-foreground/95 marker:font-mono marker:text-xs marker:text-muted-foreground">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-0.5 [&>p]:mt-1 [&>p]:first:mt-0">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-highlight/50 bg-card/60 py-1.5 pr-3 pl-4 text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-5 border-border" />,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-highlight underline underline-offset-3 transition-colors hover:text-highlight/80"
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="my-3.5 overflow-x-auto rounded-control border border-border">
      <table className="w-full border-collapse text-left text-xs sm:text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b border-border bg-muted/60">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-border/70">{children}</tbody>,
  tr: ({ children }) => <tr className="transition-colors hover:bg-secondary/35">{children}</tr>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-xs font-semibold text-foreground">{children}</th>
  ),
  td: ({ children }) => <td className="px-3 py-2 align-top text-foreground/90">{children}</td>,
  pre: ({ children }) => {
    let language: string | null = null;
    if (isValidElement<{ className?: string }>(children)) {
      const match = /language-([\w-]+)/.exec(children.props.className ?? "");
      if (match) {
        language = match[1];
      }
    }
    const codeText = extractText(children).replace(/\n$/, "");
    return (
      <CodeBlock language={language} codeText={codeText}>
        {children}
      </CodeBlock>
    );
  },
  code: ({ className, children, ...props }) => (
    <code
      className={`rounded-sm border border-border bg-secondary/75 px-1.5 py-0.5 font-mono text-[0.84em] text-token [pre_&]:rounded-none [pre_&]:border-0 [pre_&]:bg-transparent [pre_&]:p-0 [pre_&]:text-xs [pre_&]:text-foreground ${className ?? ""}`}
      {...props}
    >
      {children}
    </code>
  ),
};

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="min-w-0 text-sm wrap-anywhere sm:text-[0.9375rem]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
