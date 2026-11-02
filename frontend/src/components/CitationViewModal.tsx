import { FileText, X } from "lucide-react";
import type { Citation } from "../services/api";

type CitationViewModalProps = {
  citation: Citation | null;
  onClose: () => void;
};

export function CitationViewModal({ citation, onClose }: CitationViewModalProps) {
  if (!citation) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[#32302c] bg-[#1c1b18] p-6 shadow-2xl text-[#ececec]">
        <div className="flex items-center justify-between border-b border-[#32302c] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg bg-[#2a2926] text-[#d97706]">
              <FileText className="size-4.5" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-xs font-semibold text-[#fafaf9]">{citation.filename}</h3>
              <p className="text-[11px] text-[#a8a29e]">Chunk index: {citation.chunk_index}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-[#a8a29e] hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[#a8a29e]">
            Retrieved Context Excerpt
          </p>
          <div className="max-h-80 overflow-y-auto rounded-xl border border-[#2e2d29] bg-[#22211e] p-4 text-xs leading-relaxed text-[#d6d3d1]">
            {citation.excerpt}
          </div>
        </div>
      </div>
    </div>
  );
}
