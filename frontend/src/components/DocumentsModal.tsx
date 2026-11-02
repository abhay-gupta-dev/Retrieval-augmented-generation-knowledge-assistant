import { useEffect, useState, type FormEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  FolderPlus,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import {
  createKnowledgeBase,
  deleteDocument,
  listDocuments,
  listKnowledgeBases,
  uploadDocument,
  type IndexedDocument,
  type KnowledgeBase,
} from "../services/api";

type DocumentsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  activeKbId?: string | null;
  onSelectKb?: (kbId: string, kbName: string) => void;
};

export function DocumentsModal({
  isOpen,
  onClose,
  activeKbId,
  onSelectKb,
}: DocumentsModalProps) {
  const [bases, setBases] = useState<KnowledgeBase[]>([]);
  const [selectedKbId, setSelectedKbId] = useState<string>("");
  const [documents, setDocuments] = useState<IndexedDocument[]>([]);
  const [newKbName, setNewKbName] = useState("");
  const [creatingKb, setCreatingKb] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Load KBs
  const loadKbs = async () => {
    try {
      const loaded = await listKnowledgeBases();
      setBases(loaded);
      if (!selectedKbId && loaded.length > 0) {
        const initial = activeKbId && loaded.some((k) => k.id === activeKbId) ? activeKbId : loaded[0].id;
        setSelectedKbId(initial);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load collections");
    }
  };

  useEffect(() => {
    if (isOpen) {
      void loadKbs();
    }
  }, [isOpen]);

  // Sync with prop if it changes
  useEffect(() => {
    if (activeKbId) {
      setSelectedKbId(activeKbId);
    }
  }, [activeKbId]);

  // Load docs for selected KB
  const loadDocs = async (kbId: string) => {
    if (!kbId) return;
    setLoadingDocs(true);
    setError("");
    try {
      const docs = await listDocuments(kbId);
      setDocuments(docs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    if (selectedKbId) {
      void loadDocs(selectedKbId);
    } else {
      setDocuments([]);
    }
  }, [selectedKbId]);

  // Polling if any doc is processing or queued
  useEffect(() => {
    const hasPending = documents.some((d) => d.status === "processing" || d.status === "queued");
    if (!hasPending || !selectedKbId || !isOpen) return;

    const timer = setInterval(() => {
      listDocuments(selectedKbId).then((updated) => {
        setDocuments(updated);
        const allDone = updated.every((d) => d.status === "ready" || d.status === "indexed" || d.status === "failed");
        if (allDone) {
          setSuccessMsg("Document indexing complete. Ready for questions!");
          setTimeout(() => setSuccessMsg(""), 4000);
        }
      });
    }, 2000);

    return () => clearInterval(timer);
  }, [documents, selectedKbId, isOpen]);

  if (!isOpen) return null;

  async function handleCreateKb(e: FormEvent) {
    e.preventDefault();
    if (!newKbName.trim()) return;
    setError("");
    setCreatingKb(true);
    try {
      const newKb = await createKnowledgeBase(newKbName.trim());
      setNewKbName("");
      await loadKbs();
      setSelectedKbId(newKb.id);
      onSelectKb?.(newKb.id, newKb.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create knowledge base");
    } finally {
      setCreatingKb(false);
    }
  }

  async function handleFileUpload(file: File) {
    let targetKbId = selectedKbId;
    setError("");
    setSuccessMsg("");

    // If no KB exists yet, auto-create one
    if (!targetKbId) {
      try {
        const autoKb = await createKnowledgeBase("My Documents");
        targetKbId = autoKb.id;
        setSelectedKbId(autoKb.id);
        await loadKbs();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create knowledge base for upload");
        return;
      }
    }

    setUploading(true);
    try {
      await uploadDocument(targetKbId, file);
      setSuccessMsg(`"${file.name}" uploaded. Processing in background…`);
      await loadDocs(targetKbId);
      const kb = bases.find((b) => b.id === targetKbId);
      if (kb) onSelectKb?.(kb.id, kb.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Document upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(docId: string) {
    if (!selectedKbId) return;
    try {
      await deleteDocument(selectedKbId, docId);
      setDocuments((cur) => cur.filter((d) => d.id !== docId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete document");
    }
  }

  const activeKb = bases.find((b) => b.id === selectedKbId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex h-[85dvh] max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#32302c] bg-[#1c1b18] text-[#ececec] shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#32302c] px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="hidden size-9 shrink-0 place-items-center rounded-xl bg-[#2a2926] text-[#d97706] sm:grid">
              <FileText className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#fafaf9] sm:text-base">Knowledge & Documents</h2>
              <p className="hidden text-xs text-[#a8a29e] sm:block">
                Upload TXT, Markdown, PDF, or DOCX documents to query with RAG citations
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-[#a8a29e] hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(8rem,35%)_minmax(0,1fr)] overflow-hidden md:grid-cols-[280px_1fr] md:grid-rows-1">
          {/* Left panel: Knowledge bases list */}
          <div className="flex min-h-0 flex-col border-b border-[#32302c] bg-[#171614] p-3 md:border-b-0 md:border-r md:p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#a8a29e]">
                Collections ({bases.length})
              </span>
            </div>

            <form onSubmit={handleCreateKb} className="mb-4 flex gap-1.5">
              <input
                type="text"
                placeholder="New collection name…"
                value={newKbName}
                onChange={(e) => setNewKbName(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-[#32302c] bg-[#22211e] px-2.5 py-1.5 text-xs text-[#ececec] placeholder:text-[#78716c] focus:border-[#d97706] focus:outline-none"
              />
              <button
                type="submit"
                disabled={creatingKb || !newKbName.trim()}
                title="Create collection"
                className="grid size-8 place-items-center rounded-lg bg-[#d97706] text-white transition hover:bg-[#b45309] disabled:opacity-40"
              >
                {creatingKb ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-4" />}
              </button>
            </form>

            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain">
              {bases.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#78716c]">
                  No collections yet. Create one or upload a file.
                </div>
              ) : (
                bases.map((kb) => (
                  <button
                    key={kb.id}
                    type="button"
                    onClick={() => {
                      setSelectedKbId(kb.id);
                      onSelectKb?.(kb.id, kb.name);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition ${
                      selectedKbId === kb.id
                        ? "bg-[#2a2926] font-medium text-[#fafaf9]"
                        : "text-[#a8a29e] hover:bg-[#22211e] hover:text-[#ececec]"
                    }`}
                  >
                    <span className="truncate">{kb.name}</span>
                    <span className="ml-2 shrink-0 rounded-md bg-[#22211e] px-1.5 py-0.5 text-[10px] text-[#78716c]">
                      {kb.document_count || 0}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right panel: Documents in selected KB */}
          <div className="flex min-h-0 flex-col overflow-y-auto overscroll-contain p-4 sm:p-6">
            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-300">
                <AlertCircle className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3 text-xs text-emerald-300">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Dropzone */}
            <label className="mb-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#383632] bg-[#22211e]/40 p-6 text-center transition hover:border-[#d97706]/60 hover:bg-[#22211e]">
              <input
                type="file"
                accept=".txt,.md,.pdf,.docx"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileUpload(file);
                }}
              />
              <div className="mb-2 grid size-10 place-items-center rounded-xl bg-[#2a2926] text-[#d97706]">
                {uploading ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
              </div>
              <p className="text-sm font-medium text-[#ececec]">
                {uploading ? "Uploading & processing…" : "Click or drop file to upload"}
              </p>
              <p className="mt-1 text-xs text-[#78716c]">Supported formats: TXT, Markdown, PDF, DOCX</p>
            </label>

            {/* Document list */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#a8a29e]">
                Documents in {activeKb?.name || "Collection"} ({documents.length})
              </h3>
              {selectedKbId && (
                <button
                  type="button"
                  onClick={() => void loadDocs(selectedKbId)}
                  className="flex items-center gap-1 text-xs text-[#a8a29e] hover:text-[#ececec]"
                >
                  <RefreshCw className="size-3" />
                  <span>Refresh</span>
                </button>
              )}
            </div>

            {loadingDocs ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-[#22211e]" />
                ))}
              </div>
            ) : documents.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center py-12 text-center text-[#78716c]">
                <FileText className="size-8 stroke-1 opacity-50" />
                <p className="mt-2 text-xs">No documents uploaded in this collection yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => {
                  const isReady = doc.status === "ready" || doc.status === "indexed";
                  const isProcessing = doc.status === "processing" || doc.status === "queued";
                  const isFailed = doc.status === "failed";

                  return (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between rounded-xl border border-[#2e2d29] bg-[#22211e] p-3.5 transition hover:border-[#383632]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <FileText className="size-4 shrink-0 text-[#d97706]" />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-[#ececec]">
                            {doc.original_filename}
                          </p>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[#78716c]">
                            <span>{(doc.size_bytes / 1024).toFixed(1)} KB</span>
                            {isReady && <span>· {doc.chunk_count} chunks indexed</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {isReady && (
                          <span className="flex items-center gap-1 rounded-full bg-emerald-950/50 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                            <CheckCircle2 className="size-3" />
                            Ready
                          </span>
                        )}
                        {isProcessing && (
                          <span className="flex items-center gap-1 rounded-full bg-amber-950/50 px-2 py-0.5 text-[11px] font-medium text-amber-400">
                            <Loader2 className="size-3 animate-spin" />
                            Indexing…
                          </span>
                        )}
                        {isFailed && (
                          <span className="flex items-center gap-1 rounded-full bg-rose-950/50 px-2 py-0.5 text-[11px] font-medium text-rose-400" title={doc.error_message || ""}>
                            <AlertCircle className="size-3" />
                            Failed
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => void handleDelete(doc.id)}
                          title="Delete document"
                          className="rounded-lg p-1 text-[#78716c] transition hover:bg-rose-950/50 hover:text-rose-400"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
