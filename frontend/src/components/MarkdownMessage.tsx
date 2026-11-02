import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";

type MarkdownMessageProps = {
  content: string;
};

export function MarkdownMessage({ content }: Readonly<MarkdownMessageProps>) {
  return (
    <div className="prose max-w-none break-words text-[15px] leading-7 text-slate-800 dark:text-[#ececec] prose-headings:font-semibold prose-headings:text-slate-950 dark:prose-headings:text-[#fafaf9] prose-p:my-2 prose-li:text-slate-800 dark:prose-li:text-[#ececec] prose-pre:my-3 prose-pre:overflow-x-auto prose-pre:rounded-xl prose-pre:border prose-pre:border-[#2e2d29] prose-pre:bg-[#141312] prose-pre:p-0 prose-code:before:content-none prose-code:after:content-none prose-strong:text-slate-950 dark:prose-strong:text-[#fafaf9] prose-table:border prose-table:border-slate-300 dark:prose-table:border-[#2e2d29] prose-th:border prose-th:border-slate-300 dark:prose-th:border-[#2e2d29] prose-th:bg-slate-100 dark:prose-th:bg-[#1c1b18] prose-th:p-2.5 prose-th:text-slate-900 dark:prose-th:text-[#fafaf9] prose-td:border prose-td:border-slate-300 dark:prose-td:border-[#2e2d29] prose-td:p-2.5 prose-td:text-slate-800 dark:prose-td:text-[#ececec] prose-hr:border-slate-300 dark:prose-hr:border-[#2e2d29]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const isBlock = Boolean(className);
            const code = String(children).replace(/\n$/, "");
            return isBlock ? (
              <CodeBlock code={code} language={className?.replace("language-", "")} />
            ) : (
              <code
                className="rounded-md border border-[#383733] bg-[#242320] px-1.5 py-0.5 font-mono text-[13px] text-[#f5f5f4]"
                {...props}
              >
                {children}
              </code>
            );
          },
          a({ children, ...props }) {
            return (
              <a
                {...props}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[#d97706] underline decoration-[#d97706]/40 underline-offset-2 hover:decoration-[#d97706]"
              >
                {children}
              </a>
            );
          },
          table({ children, ...props }) {
            return <div className="my-3 max-w-full overflow-x-auto"><table {...props}>{children}</table></div>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="not-prose my-3 overflow-hidden rounded-xl border border-[#2e2d29] bg-[#141312] text-[#d6d3d1]">
      <div className="flex items-center justify-between border-b border-[#2e2d29] bg-[#1a1917] px-4 py-2 text-xs text-[#a8a29e]">
        <span className="font-mono text-[11px] uppercase tracking-wider">{language || "code"}</span>
        <button
          type="button"
          onClick={() => void copyCode()}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-[#d6d3d1] transition hover:bg-white/10"
        >
          {copied ? (
            <>
              <Check className="size-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="size-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}
