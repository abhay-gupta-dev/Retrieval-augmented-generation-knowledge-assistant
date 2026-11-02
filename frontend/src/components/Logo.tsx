import { Sparkles } from "lucide-react";

export function Logo({ subtitle, compact = false }: { subtitle?: string; compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-[#d97706] to-[#b45309] text-white shadow-sm">
        <Sparkles className="size-4.5" />
      </div>
      <div className={`flex flex-col ${compact ? "max-[359px]:hidden" : ""}`}>
        <span className="font-medium tracking-tight text-slate-900 dark:text-stone-100">Cognitive RAG</span>
        {subtitle && <span className="text-[11px] text-slate-500 dark:text-stone-400">{subtitle}</span>}
      </div>
    </div>
  );
}
