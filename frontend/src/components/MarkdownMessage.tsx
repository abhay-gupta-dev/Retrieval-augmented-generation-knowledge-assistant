import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownMessageProps = {
  content: string;
};

export function MarkdownMessage({ content }: Readonly<MarkdownMessageProps>) {
  return <div className="prose prose-slate max-w-none text-[15px] leading-7 dark:prose-invert prose-headings:font-bold prose-p:my-2 prose-pre:my-3 prose-pre:overflow-x-auto prose-pre:rounded-xl prose-pre:bg-[#102522] prose-pre:p-4 prose-code:before:content-none prose-code:after:content-none">
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
      code({ className, children, ...props }) {
        const isBlock = Boolean(className);
        const code = String(children).replace(/\n$/, "");
        return isBlock ? <CodeBlock code={code} language={className?.replace("language-", "")} /> : <code className="rounded bg-black/10 px-1.5 py-0.5 text-[.9em] dark:bg-white/10" {...props}>{children}</code>;
      },
      a({ children, ...props }) { return <a {...props} target="_blank" rel="noreferrer" className="font-semibold text-teal-700 underline decoration-teal-300 underline-offset-2 dark:text-teal-300">{children}</a>; },
    }}>{content}</ReactMarkdown>
  </div>;
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  async function copyCode() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }
  return <div className="not-prose relative my-3 overflow-hidden rounded-xl bg-[#102522] text-[#d8e7df]"><div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs text-[#a8c0b6]"><span>{language || "code"}</span><button type="button" onClick={() => void copyCode()} className="rounded-md px-2 py-1 text-[#d8e7df] hover:bg-white/10">{copied ? "Copied" : "Copy"}</button></div><pre className="overflow-x-auto p-4 text-sm leading-6"><code>{code}</code></pre></div>;
}
