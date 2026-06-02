"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { FileAiPanel } from "@/components/certificates/file-ai-panel";
import { DocumentPreview } from "@/components/certificates/document-preview";
import { StatusBadge } from "@/components/common/status-badge";
import { getFile, getOcrResult, getPreview, retryOcr } from "@/lib/api";
import { attachSocketAuth, socket } from "@/lib/socket";

const processingStatuses = new Set(["UPLOADED", "QUEUED", "PROCESSING", "OCR_COMPLETED", "EXTRACTED"]);
const isProcessingStatus = (status?: string) => Boolean(status && processingStatuses.has(status));

export default function FileDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();

  const file = useQuery({
    queryKey: ["file", id],
    queryFn: () => getFile(id),
    refetchInterval: isProcessingStatus(queryClient.getQueryData<{ status: string }>(["file", id])?.status) ? 2000 : false
  });
  const shouldPoll = isProcessingStatus(file.data?.status);

  const preview = useQuery({
    queryKey: ["preview", id],
    queryFn: () => getPreview(id)
  });

  const ocr = useQuery({
    queryKey: ["ocr", id],
    queryFn: () => getOcrResult(id),
    refetchInterval: shouldPoll ? 2000 : false
  });

  useEffect(() => {
    attachSocketAuth();
    socket.connect();
    socket.emit("file:subscribe", id);

    const handleJobUpdate = (update: { fileId?: string; status: string }) => {
      if (update.fileId !== id) return;
      void queryClient.invalidateQueries({ queryKey: ["file", id] });
      void queryClient.invalidateQueries({ queryKey: ["ocr", id] });
      void queryClient.invalidateQueries({ queryKey: ["files"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    };

    socket.on("job:update", handleJobUpdate);
    return () => {
      socket.off("job:update", handleJobUpdate);
      socket.emit("file:unsubscribe", id);
    };
  }, [id, queryClient]);

  const retryMutation = useMutation({
    mutationFn: () => retryOcr(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["file", id] });
      void queryClient.invalidateQueries({ queryKey: ["ocr", id] });
    }
  });

  if (file.isLoading) {
    return <div className="text-sm text-slate-500">Loading file</div>;
  }

  if (!file.data) {
    return <div className="text-sm text-slate-500">File not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <Link href="/upload" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
            Uploads
          </Link>
          <h1 className="mt-3 truncate text-2xl font-semibold text-ink">{file.data.originalName}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={file.data.status} />
            {file.data.ocrConfidence !== null ? (
              <span className="text-sm text-slate-500">{Math.round(file.data.ocrConfidence * 100)}% OCR</span>
            ) : null}
            {shouldPoll ? (
              <span className="inline-flex items-center gap-2 text-sm text-slate-500">
                <span className="h-2 w-2 animate-pulse rounded-full bg-brand-600" />
                Extracting data
              </span>
            ) : null}
          </div>
          {file.data.failureReason ? (
            <p className="mt-2 max-w-3xl text-sm text-red-600">Failure reason: {file.data.failureReason}</p>
          ) : null}
        </div>
        <button
          type="button"
          disabled={retryMutation.isPending || shouldPoll}
          onClick={() => retryMutation.mutate()}
          className="focus-ring inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-soft hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCcw className="h-4 w-4" />
          Retry OCR
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <DocumentPreview file={file.data} previewUrl={preview.data?.url} />

        <section className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
          <FileAiPanel file={file.data} />
        </section>
      </div>

      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
        <h2 className="text-sm font-semibold text-ink">OCR text</h2>
        <pre className="mt-3 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-4 text-xs leading-5 text-slate-700">
          {ocr.data?.rawText ?? (shouldPoll ? "OCR text is being extracted..." : "OCR text unavailable")}
        </pre>
      </section>
    </div>
  );
}
